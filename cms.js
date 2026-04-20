/* cms.js — Markdown CMS engine for Записки петрофизика */

var CMS = (function () {
  'use strict';

  var CONTENT_DIR = './content/';
  var MANIFEST_URL = CONTENT_DIR + 'posts.json';

  // ========== MARKDOWN PARSER ==========
  function parseMarkdown(md) {
    if (!md || !md.trim()) return '';

    var html = md;

    // Escape HTML (preserve markdown)
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (match, lang, code) {
      return '<pre><code>' + code.trim() + '</code></pre>';
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Images: ![alt](url "caption") → figure with caption, ![alt](url) → figure without caption
    html = html.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*?)")?\)/g, function(match, alt, src, caption) {
      var figHtml = '<figure class="article-figure">';
      figHtml += '<img src="' + src + '" alt="' + alt + '" loading="lazy">';
      if (caption) {
        figHtml += '<figcaption>' + caption + '</figcaption>';
      } else if (alt) {
        figHtml += '<figcaption>' + alt + '</figcaption>';
      }
      figHtml += '</figure>';
      return figHtml;
    });

    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Tables
    html = parseMarkdownTables(html);

    // Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Blockquotes (handle multi-line with > prefix)
    // First, mark blockquote lines
    html = html.replace(/^&gt; (.+)$/gm, '%%%BQ%%%$1');
    // Also handle empty blockquote continuation lines (just "> " or ">")
    html = html.replace(/^&gt;\s*$/gm, '%%%BQ_EMPTY%%%');
    // Group consecutive blockquote lines
    var lines = html.split('\n');
    var result = [];
    var inBlockquote = false;
    var blockquoteLines = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.startsWith('%%%BQ%%%')) {
        var content = line.substring('%%%BQ%%%'.length);
        if (!inBlockquote) {
          inBlockquote = true;
          blockquoteLines = [];
        }
        blockquoteLines.push(content);
      } else if (line === '%%%BQ_EMPTY%%%') {
        // Empty line inside blockquote = paragraph break
        if (!inBlockquote) {
          inBlockquote = true;
          blockquoteLines = [];
        }
        blockquoteLines.push('</p><p>');
      } else {
        if (inBlockquote) {
          result.push('<blockquote><p>' + blockquoteLines.join(' ') + '</p></blockquote>');
          inBlockquote = false;
          blockquoteLines = [];
        }
        result.push(line);
      }
    }
    if (inBlockquote) {
      result.push('<blockquote><p>' + blockquoteLines.join(' ') + '</p></blockquote>');
    }
    html = result.join('\n');

    // Unordered lists
    lines = html.split('\n');
    result = [];
    var inUl = false;

    for (var j = 0; j < lines.length; j++) {
      var uline = lines[j];
      var ulMatch = uline.match(/^- (.+)$/);
      if (ulMatch) {
        if (!inUl) {
          result.push('<ul>');
          inUl = true;
        }
        result.push('<li>' + ulMatch[1] + '</li>');
      } else {
        if (inUl) {
          result.push('</ul>');
          inUl = false;
        }
        result.push(uline);
      }
    }
    if (inUl) result.push('</ul>');
    html = result.join('\n');

    // Ordered lists
    lines = html.split('\n');
    result = [];
    var inOl = false;

    for (var k = 0; k < lines.length; k++) {
      var oline = lines[k];
      var olMatch = oline.match(/^\d+\. (.+)$/);
      if (olMatch) {
        if (!inOl) {
          result.push('<ol>');
          inOl = true;
        }
        result.push('<li>' + olMatch[1] + '</li>');
      } else {
        if (inOl) {
          result.push('</ol>');
          inOl = false;
        }
        result.push(oline);
      }
    }
    if (inOl) result.push('</ol>');
    html = result.join('\n');

    // Paragraphs: wrap remaining non-block lines
    lines = html.split('\n');
    result = [];
    for (var m = 0; m < lines.length; m++) {
      var pline = lines[m].trim();
      if (!pline) {
        result.push('');
        continue;
      }
      if (pline.match(/^<(h[1-6]|ul|ol|li|\/li|\/ul|\/ol|blockquote|\/blockquote|pre|hr|img|table|thead|tbody|tr|th|td|div|figure|figcaption)/)) {
        result.push(pline);
        continue;
      }
      if (pline.match(/<\/(h[1-6]|ul|ol|blockquote|pre|table|thead|tbody|div|figure)>$/)) {
        result.push(pline);
        continue;
      }
      if (pline.startsWith('<p>') || pline.startsWith('<p ')) {
        result.push(pline);
        continue;
      }
      result.push('<p>' + pline + '</p>');
    }

    html = result.join('\n');
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
  }

  // Parse markdown tables
  function parseMarkdownTables(md) {
    var tableRegex = /^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm;
    return md.replace(tableRegex, function (match, headerLine, separatorLine, bodyLines) {
      var headers = headerLine.split('|').filter(function (c) { return c.trim(); });
      var rows = bodyLines.trim().split('\n');

      var tableHtml = '<table><thead><tr>';
      headers.forEach(function (h) {
        tableHtml += '<th>' + h.trim() + '</th>';
      });
      tableHtml += '</tr></thead><tbody>';

      rows.forEach(function (row) {
        var cells = row.split('|').filter(function (c) { return c.trim(); });
        tableHtml += '<tr>';
        cells.forEach(function (cell) {
          tableHtml += '<td>' + cell.trim() + '</td>';
        });
        tableHtml += '</tr>';
      });

      tableHtml += '</tbody></table>';
      return tableHtml;
    });
  }

  // ========== FORMAT DATE ==========
  function formatDate(dateStr) {
    var months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    var parts = dateStr.split('-');
    var day = parseInt(parts[2], 10);
    var month = months[parseInt(parts[1], 10) - 1];
    var year = parts[0];
    return day + ' ' + month + ' ' + year;
  }

  // ========== LOAD POSTS MANIFEST ==========
  function loadManifest(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', MANIFEST_URL, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            var posts = JSON.parse(xhr.responseText);
            // Filter out future posts (scheduled publishing)
            var today = new Date().toISOString().slice(0, 10);
            posts = posts.filter(function (p) {
              return p.date <= today;
            });
            // Sort by date descending
            posts.sort(function (a, b) {
              return b.date.localeCompare(a.date);
            });
            callback(null, posts);
          } catch (e) {
            callback(e, null);
          }
        } else {
          callback(new Error('Failed to load manifest: ' + xhr.status), null);
        }
      }
    };
    xhr.send();
  }

  // ========== LOAD ARTICLE CONTENT ==========
  function loadArticle(filename, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', CONTENT_DIR + filename, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          callback(null, xhr.responseText);
        } else {
          callback(new Error('Failed to load article: ' + xhr.status), null);
        }
      }
    };
    xhr.send();
  }

  // ========== RENDER INDEX CARDS ==========
  function renderArticleCards(posts, container) {
    container.innerHTML = '';

    posts.forEach(function (post) {
      var card = document.createElement('a');
      card.href = './article.html?slug=' + encodeURIComponent(post.slug);
      card.className = 'article-card';

      card.innerHTML =
        '<div class="article-card-meta">' +
          '<span class="article-card-tag">' + escapeHtml(post.category) + '</span>' +
          '<span class="article-card-date">' + formatDate(post.date) + '</span>' +
        '</div>' +
        '<h3>' + escapeHtml(post.title) + '</h3>' +
        '<p>' + escapeHtml(post.excerpt) + '</p>';

      container.appendChild(card);
    });
  }

  // ========== RENDER FULL ARTICLE ==========
  function renderArticle(post, markdownContent, headerEl, bodyEl) {
    // Render header
    headerEl.innerHTML =
      '<div class="article-author">' +
        '<div class="article-avatar">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">' +
            '<path d="M12 12c2.5 0 4.5-2 4.5-4.5S14.5 3 12 3 7.5 5 7.5 7.5 9.5 12 12 12z"/>' +
            '<path d="M20 21c0-3.5-3.5-6.5-8-6.5S4 17.5 4 21"/>' +
          '</svg>' +
        '</div>' +
        '<div class="article-author-info">' +
          '<span class="article-author-name">Записки петрофизика</span>' +
          '<span class="article-author-detail">Петрофизика &middot; Каротаж &middot; Интерпретация</span>' +
        '</div>' +
      '</div>' +
      '<span class="article-category">' + escapeHtml(post.category) + '</span>' +
      '<h1 class="article-title">' + escapeHtml(post.title) + '</h1>' +
      '<time class="article-date" datetime="' + post.date + '">' + formatDate(post.date) + '</time>';

    // Render body
    bodyEl.innerHTML = parseMarkdown(markdownContent);

    // Update page title
    document.title = post.title + ' — Записки петрофизика';
  }

  // ========== RENDER RELATED ARTICLES ==========
  function renderRelated(posts, currentSlug, container) {
    var related = posts.filter(function (p) { return p.slug !== currentSlug; }).slice(0, 3);
    if (!related.length) {
      container.style.display = 'none';
      return;
    }

    var gridHtml = '';
    related.forEach(function (post) {
      gridHtml +=
        '<a href="./article.html?slug=' + encodeURIComponent(post.slug) + '" class="related-card">' +
          '<div class="related-card-tag">' + escapeHtml(post.category) + '</div>' +
          '<h3>' + escapeHtml(post.title) + '</h3>' +
        '</a>';
    });

    container.innerHTML =
      '<h2>Читайте также</h2>' +
      '<div class="related-grid">' + gridHtml + '</div>';
  }

  // ========== GET SLUG FROM URL ==========
  function getSlugFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get('slug');
  }

  // ========== ESCAPE HTML ==========
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ========== PUBLIC API ==========
  return {
    loadManifest: loadManifest,
    loadArticle: loadArticle,
    parseMarkdown: parseMarkdown,
    renderArticleCards: renderArticleCards,
    renderArticle: renderArticle,
    renderRelated: renderRelated,
    getSlugFromUrl: getSlugFromUrl,
    formatDate: formatDate,
    escapeHtml: escapeHtml
  };

})();
