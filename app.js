/* app.js — Shared logic for Записки петрофизика */

(function () {
  'use strict';

  // ========== DARK MODE TOGGLE ==========
  const toggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;

  // Light theme by default; persist choice in cookie
  function getThemeCookie() {
    var m = document.cookie.match(/(?:^|; )theme=(light|dark)/);
    return m ? m[1] : null;
  }
  function setThemeCookie(t) {
    document.cookie = 'theme=' + t + ';path=/;max-age=31536000;SameSite=Lax';
  }

  let currentTheme = getThemeCookie() || 'light';
  root.setAttribute('data-theme', currentTheme);
  updateToggleIcon();

  if (toggle) {
    toggle.addEventListener('click', function () {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', currentTheme);
      setThemeCookie(currentTheme);
      toggle.setAttribute('aria-label', 'Переключить на ' + (currentTheme === 'dark' ? 'светлую' : 'тёмную') + ' тему');
      updateToggleIcon();
    });
  }

  function updateToggleIcon() {
    if (!toggle) return;
    if (currentTheme === 'dark') {
      toggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    } else {
      toggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
  }

  // ========== SMOOTH SCROLL FOR ANCHOR LINKS ==========
  document.addEventListener('click', function (e) {
    const anchor = e.target.closest('a[href^="#"]');
    if (anchor) {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // ========== HEADER SCROLL EFFECT ==========
  const header = document.querySelector('.site-header');
  if (header) {
    let lastScroll = 0;
    window.addEventListener('scroll', function () {
      const currentScroll = window.scrollY;
      if (currentScroll > 60) {
        header.style.boxShadow = 'var(--shadow-sm)';
      } else {
        header.style.boxShadow = 'none';
      }
      lastScroll = currentScroll;
    }, { passive: true });
  }

})();
