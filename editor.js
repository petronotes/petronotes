/* editor.js — Editor logic for Записки петрофизика (CMS version) */

(function () {
  'use strict';

  // ========== STATE (in-memory only) ==========
  var editorState = {
    title: '',
    category: '',
    content: '',
    // Editing mode: if set, we're updating an existing article (keeps slug/file/date)
    editingSlug: null,
    originalFile: null,
    originalDate: null
  };

  // ========== DOM REFS ==========
  var titleInput = document.getElementById('articleTitle');
  var categoryInput = document.getElementById('articleCategory');
  var editorTextarea = document.getElementById('editorContent');
  var previewContent = document.getElementById('previewContent');
  var editorPane = document.getElementById('editorPane');
  var previewPane = document.getElementById('previewPane');
  var htmlOutputOverlay = document.getElementById('htmlOutputOverlay');
  var htmlOutputCode = document.getElementById('htmlOutputCode');

  // Buttons
  var btnExportHtml = document.getElementById('btnExportHtml');
  var btnDownload = document.getElementById('btnDownload');
  var btnCopyHtml = document.getElementById('btnCopyHtml');
  var btnDownloadHtml = document.getElementById('btnDownloadHtml');
  var modalClose = document.getElementById('modalClose');

  // GitHub integration buttons
  var btnPublish       = document.getElementById('btnPublish');
  var btnNewArticle    = document.getElementById('btnNewArticle');
  var btnOpenArticles  = document.getElementById('btnOpenArticles');
  var btnGhSettings    = document.getElementById('btnGhSettings');

  // GitHub Settings modal
  var ghOverlay        = document.getElementById('ghSettingsOverlay');
  var ghSettingsClose  = document.getElementById('ghSettingsClose');
  var ghOwner          = document.getElementById('ghOwner');
  var ghRepo           = document.getElementById('ghRepo');
  var ghBranch         = document.getElementById('ghBranch');
  var ghToken          = document.getElementById('ghToken');
  var ghTestBtn        = document.getElementById('ghTestBtn');
  var ghSaveBtn        = document.getElementById('ghSaveBtn');
  var ghClearBtn       = document.getElementById('ghClearBtn');
  var ghTestStatus     = document.getElementById('ghTestStatus');

  // Articles list modal
  var articlesOverlay  = document.getElementById('articlesOverlay');
  var articlesClose    = document.getElementById('articlesClose');
  var articlesList     = document.getElementById('articlesList');

  // Publish modal
  var publishOverlay   = document.getElementById('publishOverlay');
  var publishClose     = document.getElementById('publishClose');
  var publishCancel    = document.getElementById('publishCancel');
  var publishConfirm   = document.getElementById('publishConfirm');
  var publishDate      = document.getElementById('publishDate');
  var publishStatus    = document.getElementById('publishStatus');

  var toast            = document.getElementById('toast');

  // Mobile tabs
  var mobileTabs = document.querySelectorAll('.mobile-tab');

  // ========== UPDATE PREVIEW (uses CMS parser) ==========
  function updatePreview() {
    editorState.title = titleInput.value;
    editorState.category = categoryInput.value;
    editorState.content = editorTextarea.value;

    var previewHtml = '';

    if (editorState.category) {
      previewHtml += '<div style="margin-bottom:var(--space-4);"><span class="article-card-tag" style="display:inline-block;">' + CMS.escapeHtml(editorState.category) + '</span></div>';
    }

    if (editorState.title) {
      previewHtml += '<h1 style="font-family:var(--font-display);font-size:var(--text-2xl);font-weight:700;letter-spacing:-0.02em;line-height:1.12;margin-bottom:var(--space-6);">' + CMS.escapeHtml(editorState.title) + '</h1>';
    }

    if (editorState.content) {
      previewHtml += CMS.parseMarkdown(editorState.content);
    }

    if (!previewHtml) {
      previewHtml = '<p style="color:var(--color-text-faint);text-align:center;padding:var(--space-12) 0;">Начните писать, чтобы увидеть предпросмотр...</p>';
    }

    previewContent.innerHTML = previewHtml;
  }

  // ========== TOOLBAR ACTIONS ==========
  function insertMarkdown(before, after, placeholder) {
    var start = editorTextarea.selectionStart;
    var end = editorTextarea.selectionEnd;
    var text = editorTextarea.value;
    var selected = text.substring(start, end) || placeholder || '';

    editorTextarea.value = text.substring(0, start) + before + selected + after + text.substring(end);
    editorTextarea.selectionStart = start + before.length;
    editorTextarea.selectionEnd = start + before.length + selected.length;
    editorTextarea.focus();
    updatePreview();
  }

  function insertAtLineStart(prefix) {
    var start = editorTextarea.selectionStart;
    var text = editorTextarea.value;
    var lineStart = text.lastIndexOf('\n', start - 1) + 1;

    editorTextarea.value = text.substring(0, lineStart) + prefix + text.substring(lineStart);
    editorTextarea.selectionStart = editorTextarea.selectionEnd = start + prefix.length;
    editorTextarea.focus();
    updatePreview();
  }

  // Toolbar button handlers
  document.querySelectorAll('.toolbar-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var action = btn.dataset.action;
      switch (action) {
        case 'bold':
          insertMarkdown('**', '**', 'жирный текст');
          break;
        case 'italic':
          insertMarkdown('*', '*', 'курсив');
          break;
        case 'h2':
          insertAtLineStart('## ');
          break;
        case 'h3':
          insertAtLineStart('### ');
          break;
        case 'ul':
          insertAtLineStart('- ');
          break;
        case 'ol':
          insertAtLineStart('1. ');
          break;
        case 'quote':
          insertAtLineStart('> ');
          break;
        case 'code':
          insertMarkdown('`', '`', 'код');
          break;
        case 'codeblock':
          insertMarkdown('```\n', '\n```', 'блок кода');
          break;
        case 'link':
          insertMarkdown('[', '](https://)', 'текст ссылки');
          break;
        case 'image':
          insertMarkdown('![', '](https://example.com/image.jpg "Подпись к рисунку")', 'описание рисунка');
          break;
      }
    });
  });

  // ========== KEYBOARD SHORTCUTS ==========
  editorTextarea.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          insertMarkdown('**', '**', 'жирный текст');
          break;
        case 'i':
          e.preventDefault();
          insertMarkdown('*', '*', 'курсив');
          break;
        case 'k':
          e.preventDefault();
          insertMarkdown('[', '](https://)', 'текст ссылки');
          break;
      }
    }
    // Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      var start = editorTextarea.selectionStart;
      editorTextarea.value = editorTextarea.value.substring(0, start) + '  ' + editorTextarea.value.substring(editorTextarea.selectionEnd);
      editorTextarea.selectionStart = editorTextarea.selectionEnd = start + 2;
    }
  });

  // ========== LIVE PREVIEW UPDATE ==========
  var previewTimer;
  editorTextarea.addEventListener('input', function () {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 150);
  });
  titleInput.addEventListener('input', updatePreview);
  categoryInput.addEventListener('input', updatePreview);

  // ========== GENERATE SLUG ==========
  function generateSlug(title) {
    // Transliterate Russian
    var translit = {
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i',
      'й':'j','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
      'у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y',
      'ь':'','э':'e','ю':'yu','я':'ya'
    };
    return title.toLowerCase().split('').map(function (c) {
      return translit[c] || c;
    }).join('').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  // ========== GENERATE CMS JSON ENTRY ==========
  function generateCmsEntry(dateOverride) {
    var title = editorState.title || 'Без заголовка';
    var category = editorState.category || 'Статья';
    var slug, file, date;

    if (editorState.editingSlug) {
      // Preserve slug and file when editing an existing article
      slug = editorState.editingSlug;
      file = editorState.originalFile || (slug + '.md');
      date = dateOverride || editorState.originalDate || new Date().toISOString().split('T')[0];
    } else {
      slug = generateSlug(title);
      file = slug + '.md';
      date = dateOverride || new Date().toISOString().split('T')[0];
    }

    var excerpt = editorState.content.split('\n').filter(function (line) {
      return line.trim() && !line.startsWith('#') && !line.startsWith('>') && !line.startsWith('-') && !line.startsWith('```');
    }).slice(0, 2).join(' ').substring(0, 200);

    return {
      slug: slug,
      title: title,
      date: date,
      category: category,
      excerpt: excerpt + (excerpt.length >= 200 ? '...' : ''),
      file: file
    };
  }

  // ========== GENERATE FULL HTML (for standalone export) ==========
  function generateFullHtml() {
    var title = CMS.escapeHtml(editorState.title || 'Без заголовка');
    var category = CMS.escapeHtml(editorState.category || 'Статья');
    var bodyHtml = CMS.parseMarkdown(editorState.content || '');
    var today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

    return '<!DOCTYPE html>\n<html lang="ru">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + title + ' — Записки петрофизика</title>\n<link rel="stylesheet" href="./base.css">\n<link rel="stylesheet" href="./style.css">\n<link href="https://api.fontshare.com/v2/css?f[]=zodiak@400,500,600,700&f[]=satoshi@300,400,500,600,700&display=swap" rel="stylesheet">\n</head>\n<body>\n<div class="site-wrapper">\n<main>\n<article class="container">\n<header class="article-header">\n<span class="article-category">' + category + '</span>\n<h1 class="article-title">' + title + '</h1>\n<time class="article-date">' + today + '</time>\n</header>\n<div class="article-body">\n' + bodyHtml + '\n</div>\n</article>\n</main>\n</div>\n</body>\n</html>';
  }

  // ========== EXPORT HTML ==========
  btnExportHtml.addEventListener('click', function () {
    // Show CMS info alongside HTML
    var entry = generateCmsEntry();
    var cmsInfo = '/* === Запись для posts.json === */\n' + JSON.stringify(entry, null, 2) + '\n\n/* === Сохраните Markdown как: content/' + entry.file + ' === */\n\n---\n\n/* === HTML-версия статьи (для справки): === */\n\n' + generateFullHtml();
    htmlOutputCode.value = cmsInfo;
    htmlOutputOverlay.classList.add('active');
  });

  // ========== MODAL CLOSE ==========
  modalClose.addEventListener('click', function () {
    htmlOutputOverlay.classList.remove('active');
  });

  htmlOutputOverlay.addEventListener('click', function (e) {
    if (e.target === htmlOutputOverlay) {
      htmlOutputOverlay.classList.remove('active');
    }
  });

  // ========== COPY HTML ==========
  btnCopyHtml.addEventListener('click', function () {
    htmlOutputCode.select();
    try {
      document.execCommand('copy');
      btnCopyHtml.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg> Скопировано!';
      setTimeout(function () {
        btnCopyHtml.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Копировать';
      }, 2000);
    } catch (e) {
      // Fallback
    }
  });

  // ========== DOWNLOAD ==========
  function downloadFile(content, filename, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  btnDownload.addEventListener('click', function () {
    var content = editorTextarea.value;
    var entry = generateCmsEntry();
    downloadFile(content, entry.file, 'text/markdown');
  });

  btnDownloadHtml.addEventListener('click', function () {
    var html = generateFullHtml();
    var entry = generateCmsEntry();
    var filename = entry.slug + '.html';
    downloadFile(html, filename, 'text/html');
  });

  // ========== MOBILE TABS ==========
  mobileTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = tab.dataset.tab;
      mobileTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');

      if (target === 'editor') {
        editorPane.classList.remove('hidden');
        previewPane.classList.add('hidden');
      } else {
        editorPane.classList.add('hidden');
        previewPane.classList.remove('hidden');
        updatePreview();
      }
    });
  });

  // ========== DESKTOP: SHOW BOTH PANES ==========
  function handleResize() {
    if (window.innerWidth > 768) {
      editorPane.classList.remove('hidden');
      previewPane.classList.remove('hidden');
    } else {
      var activeTab = document.querySelector('.mobile-tab.active');
      if (activeTab) {
        var target = activeTab.dataset.tab;
        if (target === 'editor') {
          editorPane.classList.remove('hidden');
          previewPane.classList.add('hidden');
        } else {
          editorPane.classList.add('hidden');
          previewPane.classList.remove('hidden');
        }
      }
    }
  }

  window.addEventListener('resize', handleResize);
  handleResize();

  // ========== GITHUB INTEGRATION ==========

  function showToast(message, type, durationMs) {
    toast.textContent = message;
    toast.className = 'toast visible' + (type ? ' ' + type : '');
    setTimeout(function () {
      toast.classList.remove('visible');
    }, durationMs || 2800);
  }

  function openModal(overlay) { overlay.classList.add('active'); }
  function closeModal(overlay) { overlay.classList.remove('active'); }

  // Generic: close modal when clicking backdrop
  [ghOverlay, articlesOverlay, publishOverlay].forEach(function (ov) {
    ov.addEventListener('click', function (e) {
      if (e.target === ov) closeModal(ov);
    });
  });

  // ----- Settings modal -----
  function populateSettingsForm() {
    var cfg = GitHubAPI.getConfig();
    ghOwner.value = cfg.owner;
    ghRepo.value = cfg.repo;
    ghBranch.value = cfg.branch || 'main';
    ghToken.value = cfg.token;
    var mode = GitHubAPI.storageMode();
    if (mode === 'none') {
      ghTestStatus.textContent = '⚠ Браузер блокирует сохранение. Откройте редактор в отдельной вкладке.';
      ghTestStatus.className = 'gh-status error';
    } else {
      ghTestStatus.textContent = 'Хранилище: ' + mode;
      ghTestStatus.className = 'gh-status';
    }
  }

  btnGhSettings.addEventListener('click', function () {
    populateSettingsForm();
    openModal(ghOverlay);
  });
  ghSettingsClose.addEventListener('click', function () { closeModal(ghOverlay); });

  ghSaveBtn.addEventListener('click', function () {
    GitHubAPI.saveConfig({
      owner: ghOwner.value.trim(),
      repo: ghRepo.value.trim(),
      branch: ghBranch.value.trim() || 'main',
      token: ghToken.value.trim()
    });
    // Verify the save actually persisted
    var check = GitHubAPI.getConfig();
    if (check.owner && check.repo && check.token) {
      closeModal(ghOverlay);
      showToast('Настройки сохранены', 'success');
    } else {
      ghTestStatus.textContent = '✗ Не удалось сохранить настройки: браузер блокирует хранилище. Режим: ' + GitHubAPI.storageMode();
      ghTestStatus.className = 'gh-status error';
    }
  });

  ghTestBtn.addEventListener('click', function () {
    // Save temporarily so testConnection uses the current inputs
    GitHubAPI.saveConfig({
      owner: ghOwner.value.trim(),
      repo: ghRepo.value.trim(),
      branch: ghBranch.value.trim() || 'main',
      token: ghToken.value.trim()
    });
    ghTestStatus.textContent = 'Проверяю...';
    ghTestStatus.className = 'gh-status';
    GitHubAPI.testConnection().then(function (repo) {
      ghTestStatus.textContent = '✓ Подключено к ' + repo.full_name + (repo.private ? ' (приватный)' : '');
      ghTestStatus.className = 'gh-status success';
    }).catch(function (err) {
      ghTestStatus.textContent = '✗ ' + err.message;
      ghTestStatus.className = 'gh-status error';
    });
  });

  ghClearBtn.addEventListener('click', function () {
    if (confirm('Очистить настройки GitHub?')) {
      GitHubAPI.clearConfig();
      populateSettingsForm();
      showToast('Настройки очищены');
    }
  });

  // ----- New article -----
  btnNewArticle.addEventListener('click', function () {
    if (editorState.content && !confirm('Очистить редактор и начать новую статью? Несохранённые изменения будут потеряны.')) return;
    titleInput.value = '';
    categoryInput.value = '';
    editorTextarea.value = '';
    editorState.editingSlug = null;
    editorState.originalFile = null;
    editorState.originalDate = null;
    updatePreview();
    titleInput.focus();
    showToast('Новая статья');
  });

  // ----- Articles list modal -----
  btnOpenArticles.addEventListener('click', function () {
    if (!GitHubAPI.isConfigured()) {
      openModal(ghOverlay);
      populateSettingsForm();
      showToast('Сначала настройте GitHub', 'error');
      return;
    }
    articlesList.innerHTML = '<p class="gh-help">Загрузка...</p>';
    openModal(articlesOverlay);
    GitHubAPI.listArticles().then(function (posts) {
      renderArticlesList(posts);
    }).catch(function (err) {
      articlesList.innerHTML = '<p class="gh-help error" style="color:#b54a3a;">Ошибка: ' + CMS.escapeHtml(err.message) + '</p>';
    });
  });
  articlesClose.addEventListener('click', function () { closeModal(articlesOverlay); });

  function renderArticlesList(posts) {
    if (!posts.length) {
      articlesList.innerHTML = '<p class="gh-help">Пока нет ни одной статьи.</p>';
      return;
    }
    var today = new Date().toISOString().slice(0, 10);
    var html = '';
    posts.forEach(function (p, idx) {
      var isFuture = p.date > today;
      var metaClass = isFuture ? 'articles-list-meta future-badge' : 'articles-list-meta';
      var metaText = (isFuture ? 'Запланировано на ' : '') + CMS.formatDate(p.date) + ' · ' + CMS.escapeHtml(p.category);
      html += '<div class="articles-list-item" data-idx="' + idx + '">' +
        '<div class="articles-list-info">' +
          '<p class="articles-list-title">' + CMS.escapeHtml(p.title) + '</p>' +
          '<div class="' + metaClass + '">' + metaText + '</div>' +
        '</div>' +
        '<div class="articles-list-actions">' +
          '<button class="articles-edit" data-slug="' + CMS.escapeHtml(p.slug) + '">Редакт.</button>' +
          '<button class="articles-delete danger" data-slug="' + CMS.escapeHtml(p.slug) + '">Удалить</button>' +
        '</div>' +
      '</div>';
    });
    articlesList.innerHTML = html;

    // Attach handlers
    articlesList.querySelectorAll('.articles-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slug = btn.dataset.slug;
        var post = posts.filter(function (p) { return p.slug === slug; })[0];
        if (!post) return;
        loadArticleForEditing(post);
      });
    });
    articlesList.querySelectorAll('.articles-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slug = btn.dataset.slug;
        var post = posts.filter(function (p) { return p.slug === slug; })[0];
        if (!post) return;
        if (!confirm('Удалить статью «' + post.title + '»? Это действие нельзя отменить.')) return;
        btn.disabled = true;
        btn.textContent = 'Удаляю...';
        GitHubAPI.deleteArticle(post).then(function () {
          showToast('Статья удалена', 'success');
          // Refresh list
          return GitHubAPI.listArticles();
        }).then(function (posts2) {
          renderArticlesList(posts2);
        }).catch(function (err) {
          showToast('Ошибка: ' + err.message, 'error', 5000);
          btn.disabled = false;
          btn.textContent = 'Удалить';
        });
      });
    });
  }

  function loadArticleForEditing(post) {
    articlesList.innerHTML = '<p class="gh-help">Загружаю «' + CMS.escapeHtml(post.title) + '»...</p>';
    GitHubAPI.loadArticleSource(post.file).then(function (md) {
      titleInput.value = post.title;
      categoryInput.value = post.category;
      editorTextarea.value = md;
      editorState.editingSlug = post.slug;
      editorState.originalFile = post.file;
      editorState.originalDate = post.date;
      updatePreview();
      closeModal(articlesOverlay);
      showToast('Открыта: ' + post.title, 'success');
    }).catch(function (err) {
      showToast('Ошибка: ' + err.message, 'error', 5000);
    });
  }

  // ----- Publish flow -----
  btnPublish.addEventListener('click', function () {
    if (!GitHubAPI.isConfigured()) {
      populateSettingsForm();
      openModal(ghOverlay);
      showToast('Сначала настройте GitHub', 'error');
      return;
    }
    if (!editorState.title || !editorState.content.trim()) {
      showToast('Добавьте заголовок и текст статьи', 'error');
      return;
    }
    // Default date: existing article keeps its date, new one gets today
    var defaultDate = editorState.originalDate || new Date().toISOString().split('T')[0];
    publishDate.value = defaultDate;
    publishStatus.textContent = '';
    publishStatus.className = 'gh-status';
    publishConfirm.disabled = false;
    publishConfirm.textContent = 'Опубликовать';
    openModal(publishOverlay);
  });

  publishClose.addEventListener('click', function () { closeModal(publishOverlay); });
  publishCancel.addEventListener('click', function () { closeModal(publishOverlay); });

  publishConfirm.addEventListener('click', function () {
    var chosenDate = publishDate.value;
    if (!chosenDate) {
      publishStatus.textContent = 'Выберите дату';
      publishStatus.className = 'gh-status error';
      return;
    }
    var entry = generateCmsEntry(chosenDate);
    publishConfirm.disabled = true;
    publishConfirm.textContent = 'Публикую...';
    publishStatus.textContent = 'Сохраняю файлы в GitHub...';
    publishStatus.className = 'gh-status';

    GitHubAPI.publishArticle(entry, editorTextarea.value).then(function () {
      publishStatus.textContent = '✓ Опубликовано';
      publishStatus.className = 'gh-status success';
      // Remember we're now editing this article
      editorState.editingSlug = entry.slug;
      editorState.originalFile = entry.file;
      editorState.originalDate = entry.date;
      setTimeout(function () {
        closeModal(publishOverlay);
        var today = new Date().toISOString().slice(0, 10);
        var msg = entry.date > today
          ? 'Запланировано на ' + CMS.formatDate(entry.date)
          : 'Статья опубликована';
        showToast(msg, 'success', 4000);
      }, 800);
    }).catch(function (err) {
      publishStatus.textContent = '✗ ' + err.message;
      publishStatus.className = 'gh-status error';
      publishConfirm.disabled = false;
      publishConfirm.textContent = 'Повторить';
    });
  });

  // Warn when leaving with unsaved changes
  window.addEventListener('beforeunload', function (e) {
    if (editorState.content && editorState.content.trim() && !editorState.editingSlug) {
      // Only warn for truly new unsaved content
      // (skip for sample content — check that something meaningful was typed)
    }
  });

  // ========== LOAD SAMPLE CONTENT ==========
  titleInput.value = 'Пример статьи о нейтронном каротаже';
  categoryInput.value = 'Каротаж';
  editorTextarea.value = '## Введение\n\nНейтронный каротаж — один из важнейших методов **геофизических исследований скважин** (ГИС). Он основан на взаимодействии нейтронов с ядрами элементов горных пород.\n\n## Типы нейтронов\n\nРазличают следующие виды нейтронов:\n\n- **Быстрые** > 1 МэВ\n- **Медленные** < 1 МэВ\n- **Тепловые** ~0,025 эВ\n\n> Тепловые нейтроны имеют низкую кинетическую энергию, близкую к температуре окружающей среды. Они находятся в термодинамическом равновесии с окружающей средой.\n\n## Источники нейтронов\n\nДля создания поля нейтронов применяются:\n\n1. Постоянные источники (`Pu239`, `Am241` + `Be9`)\n2. Импульсные генераторы (энергия **14 МэВ**)\n\n### Формулы\n\nРеакция в постоянном источнике:\n\n```\nHe4 + Be9 → C12 + n\n```\n\nГде `n` — испущенный нейтрон.\n\n## Сравнение методов\n\n| Метод | Источник | Детектор |\n|---|---|---|\n| **ННКнт** | Стационарный | Надтепловые нейтроны |\n| **ННКт** | Стационарный | Тепловые нейтроны |\n| **НГК** | Стационарный | Гамма-кванты |\n\n## Заключение\n\nНейтронный каротаж позволяет определять *водородосодержание* горных пород, что является основой для расчёта **коэффициента пористости**.';

  updatePreview();

})();
