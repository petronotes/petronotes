/* github.js — GitHub REST API client for CMS storage */

var GitHubAPI = (function () {
  'use strict';

  // ========== CONFIG STORAGE ==========
  // Multi-tier storage: localStorage → sessionStorage → cookie.
  // Perplexity's iframe environment sometimes blocks specific mechanisms,
  // so we try each one in order and pick the first that actually works.

  var STORAGE_KEY = 'petroblog_gh_config_v1';
  var KEYS = ['owner', 'repo', 'branch', 'token'];

  function tryStorage(storage) {
    if (!storage) return null;
    try {
      var probe = '__probe_' + Math.random();
      storage.setItem(probe, '1');
      var ok = storage.getItem(probe) === '1';
      storage.removeItem(probe);
      return ok ? storage : null;
    } catch (e) {
      return null;
    }
  }

  function getStorage() {
    try { if (tryStorage(window.localStorage))   return window.localStorage;   } catch (e) {}
    try { if (tryStorage(window.sessionStorage)) return window.sessionStorage; } catch (e) {}
    return null;
  }

  // ----- Cookie fallback -----
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value, days) {
    var maxAge = (days || 365) * 24 * 60 * 60;
    var secure = location.protocol === 'https:' ? ';Secure' : '';
    // SameSite=None + Secure is required for cookies set inside cross-site iframes;
    // on insecure contexts we fall back to Lax which works for top-level pages.
    var sameSite = location.protocol === 'https:' ? ';SameSite=None' : ';SameSite=Lax';
    document.cookie = name + '=' + encodeURIComponent(value) + ';path=/;max-age=' + maxAge + sameSite + secure;
  }

  function deleteCookie(name) {
    var secure = location.protocol === 'https:' ? ';Secure' : '';
    var sameSite = location.protocol === 'https:' ? ';SameSite=None' : ';SameSite=Lax';
    document.cookie = name + '=;path=/;max-age=0' + sameSite + secure;
  }

  function readFromCookies() {
    var out = {};
    KEYS.forEach(function (k) { out[k] = getCookie('gh_' + k) || ''; });
    return out;
  }

  function writeToCookies(cfg) {
    KEYS.forEach(function (k) { setCookie('gh_' + k, cfg[k] || ''); });
  }

  function clearCookies() {
    KEYS.forEach(function (k) { deleteCookie('gh_' + k); });
  }

  // ----- Unified API -----
  function getConfig() {
    var storage = getStorage();
    if (storage) {
      var raw = storage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          var parsed = JSON.parse(raw);
          return {
            owner:  parsed.owner  || '',
            repo:   parsed.repo   || '',
            branch: parsed.branch || 'main',
            token:  parsed.token  || ''
          };
        } catch (e) { /* fall through */ }
      }
      // Migrate old cookie-based config if present
      var legacy = readFromCookies();
      if (legacy.owner || legacy.repo || legacy.token) {
        storage.setItem(STORAGE_KEY, JSON.stringify(legacy));
        clearCookies();
        return {
          owner:  legacy.owner  || '',
          repo:   legacy.repo   || '',
          branch: legacy.branch || 'main',
          token:  legacy.token  || ''
        };
      }
    }
    // Pure-cookie fallback
    var c = readFromCookies();
    return {
      owner:  c.owner  || '',
      repo:   c.repo   || '',
      branch: c.branch || 'main',
      token:  c.token  || ''
    };
  }

  function saveConfig(cfg) {
    var normalized = {
      owner:  cfg.owner  || '',
      repo:   cfg.repo   || '',
      branch: cfg.branch || 'main',
      token:  cfg.token  || ''
    };
    var storage = getStorage();
    var saved = false;
    if (storage) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        saved = storage.getItem(STORAGE_KEY) !== null;
      } catch (e) { saved = false; }
    }
    if (!saved) {
      // Last-resort cookie write
      writeToCookies(normalized);
    } else {
      // Clean up any legacy cookies so we have one source of truth
      clearCookies();
    }
    return saved || readFromCookies().token === normalized.token;
  }

  function clearConfig() {
    var storage = getStorage();
    if (storage) {
      try { storage.removeItem(STORAGE_KEY); } catch (e) {}
    }
    clearCookies();
  }

  function isConfigured() {
    var c = getConfig();
    return !!(c.owner && c.repo && c.token);
  }

  // Expose which backend is in use (for diagnostics in the settings UI)
  function storageMode() {
    try {
      if (tryStorage(window.localStorage))   return 'localStorage';
      if (tryStorage(window.sessionStorage)) return 'sessionStorage';
    } catch (e) {}
    // Probe cookie writability
    var probe = '_ghprobe_' + Math.random().toString(36).slice(2);
    setCookie(probe, '1');
    var ok = document.cookie.indexOf(probe + '=1') !== -1;
    deleteCookie(probe);
    return ok ? 'cookie' : 'none';
  }

  // ========== BASE64 HELPERS (UTF-8 safe) ==========
  function utf8ToBase64(str) {
    // Encode UTF-8 string to base64
    var bytes = new TextEncoder().encode(str);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToUtf8(b64) {
    // Decode base64 to UTF-8 string
    var binary = atob(b64.replace(/\s/g, ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  // ========== API CALLS ==========
  function apiUrl(path) {
    var cfg = getConfig();
    return 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + path;
  }

  function request(method, url, body) {
    var cfg = getConfig();
    return fetch(url, {
      method: method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + cfg.token,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      if (res.status === 404) return { notFound: true };
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error((err && err.message) || ('HTTP ' + res.status));
        });
      }
      return res.json();
    });
  }

  // Test credentials by fetching repo info
  function testConnection() {
    var cfg = getConfig();
    return fetch('https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + cfg.token
      }
    }).then(function (res) {
      if (res.status === 200) return res.json();
      if (res.status === 404) throw new Error('Репозиторий не найден. Проверьте owner и repo.');
      if (res.status === 401) throw new Error('Токен недействителен.');
      if (res.status === 403) throw new Error('Нет доступа к репозиторию.');
      throw new Error('Ошибка ' + res.status);
    });
  }

  // GET file — returns { content: string, sha: string } or { notFound: true }
  function getFile(path) {
    var cfg = getConfig();
    var url = apiUrl(path) + '?ref=' + encodeURIComponent(cfg.branch);
    return request('GET', url).then(function (data) {
      if (data.notFound) return { notFound: true };
      return {
        content: base64ToUtf8(data.content),
        sha: data.sha
      };
    });
  }

  // PUT file — creates or updates a file
  function putFile(path, content, message, sha) {
    var cfg = getConfig();
    var body = {
      message: message,
      content: utf8ToBase64(content),
      branch: cfg.branch
    };
    if (sha) body.sha = sha;
    return request('PUT', apiUrl(path), body);
  }

  // Delete file
  function deleteFile(path, message, sha) {
    var cfg = getConfig();
    return request('DELETE', apiUrl(path), {
      message: message,
      sha: sha,
      branch: cfg.branch
    });
  }

  // ========== HIGHER-LEVEL: POSTS MANIFEST ==========
  function loadManifest() {
    return getFile('content/posts.json').then(function (result) {
      if (result.notFound) return { posts: [], sha: null };
      try {
        return { posts: JSON.parse(result.content), sha: result.sha };
      } catch (e) {
        throw new Error('posts.json содержит некорректный JSON');
      }
    });
  }

  function saveManifest(posts, sha, message) {
    var content = JSON.stringify(posts, null, 2) + '\n';
    return putFile('content/posts.json', content, message || 'Update posts.json', sha);
  }

  // Publish article: save .md + upsert entry in posts.json
  function publishArticle(entry, markdown) {
    var mdPath = 'content/' + entry.file;

    // Step 1: check if .md already exists to get its SHA
    return getFile(mdPath).then(function (mdResult) {
      var mdSha = mdResult.notFound ? null : mdResult.sha;
      var msgAction = mdSha ? 'Обновлена статья' : 'Новая статья';

      // Step 2: write the .md file
      return putFile(mdPath, markdown, msgAction + ': ' + entry.title, mdSha);
    }).then(function () {
      // Step 3: load manifest, upsert, save
      return loadManifest();
    }).then(function (manifest) {
      var posts = manifest.posts || [];
      var idx = -1;
      for (var i = 0; i < posts.length; i++) {
        if (posts[i].slug === entry.slug) { idx = i; break; }
      }
      if (idx >= 0) {
        posts[idx] = entry;
      } else {
        posts.unshift(entry);
      }
      return saveManifest(posts, manifest.sha, 'Обновлён манифест: ' + entry.title);
    });
  }

  // List existing articles
  function listArticles() {
    return loadManifest().then(function (manifest) {
      var posts = manifest.posts || [];
      posts.sort(function (a, b) { return b.date.localeCompare(a.date); });
      return posts;
    });
  }

  // Load article markdown for editing
  function loadArticleSource(filename) {
    return getFile('content/' + filename).then(function (result) {
      if (result.notFound) throw new Error('Файл не найден: ' + filename);
      return result.content;
    });
  }

  // Delete article: remove .md + entry from posts.json
  function deleteArticle(entry) {
    var mdPath = 'content/' + entry.file;
    return getFile(mdPath).then(function (mdResult) {
      if (mdResult.notFound) {
        // File already gone, just update manifest
        return { skipMd: true };
      }
      return deleteFile(mdPath, 'Удалена статья: ' + entry.title, mdResult.sha);
    }).then(function () {
      return loadManifest();
    }).then(function (manifest) {
      var posts = (manifest.posts || []).filter(function (p) { return p.slug !== entry.slug; });
      return saveManifest(posts, manifest.sha, 'Удалена статья из манифеста: ' + entry.title);
    });
  }

  // ========== PUBLIC API ==========
  return {
    getConfig:          getConfig,
    saveConfig:         saveConfig,
    clearConfig:        clearConfig,
    isConfigured:       isConfigured,
    storageMode:        storageMode,
    testConnection:     testConnection,
    getFile:            getFile,
    putFile:            putFile,
    loadManifest:       loadManifest,
    publishArticle:     publishArticle,
    listArticles:       listArticles,
    loadArticleSource:  loadArticleSource,
    deleteArticle:      deleteArticle
  };

})();
