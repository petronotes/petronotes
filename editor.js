/* editor.js — Editor logic for Записки петрофизика (CMS version) */

(function () {
  'use strict';

  // ========== STATE (in-memory only) ==========
  var editorState = {
    title: '',
    category: '',
    content: ''
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
  function generateCmsEntry() {
    var title = editorState.title || 'Без заголовка';
    var category = editorState.category || 'Статья';
    var slug = generateSlug(title);
    var today = new Date().toISOString().split('T')[0];
    var excerpt = editorState.content.split('\n').filter(function (line) {
      return line.trim() && !line.startsWith('#') && !line.startsWith('>') && !line.startsWith('-') && !line.startsWith('```');
    }).slice(0, 2).join(' ').substring(0, 200);

    return {
      slug: slug,
      title: title,
      date: today,
      category: category,
      excerpt: excerpt + (excerpt.length >= 200 ? '...' : ''),
      file: slug + '.md'
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

  // ========== LOAD SAMPLE CONTENT ==========
  titleInput.value = 'Пример статьи о нейтронном каротаже';
  categoryInput.value = 'Каротаж';
  editorTextarea.value = '## Введение\n\nНейтронный каротаж — один из важнейших методов **геофизических исследований скважин** (ГИС). Он основан на взаимодействии нейтронов с ядрами элементов горных пород.\n\n## Типы нейтронов\n\nРазличают следующие виды нейтронов:\n\n- **Быстрые** > 1 МэВ\n- **Медленные** < 1 МэВ\n- **Тепловые** ~0,025 эВ\n\n> Тепловые нейтроны имеют низкую кинетическую энергию, близкую к температуре окружающей среды. Они находятся в термодинамическом равновесии с окружающей средой.\n\n## Источники нейтронов\n\nДля создания поля нейтронов применяются:\n\n1. Постоянные источники (`Pu239`, `Am241` + `Be9`)\n2. Импульсные генераторы (энергия **14 МэВ**)\n\n### Формулы\n\nРеакция в постоянном источнике:\n\n```\nHe4 + Be9 → C12 + n\n```\n\nГде `n` — испущенный нейтрон.\n\n## Сравнение методов\n\n| Метод | Источник | Детектор |\n|---|---|---|\n| **ННКнт** | Стационарный | Надтепловые нейтроны |\n| **ННКт** | Стационарный | Тепловые нейтроны |\n| **НГК** | Стационарный | Гамма-кванты |\n\n## Заключение\n\nНейтронный каротаж позволяет определять *водородосодержание* горных пород, что является основой для расчёта **коэффициента пористости**.';

  updatePreview();

})();
