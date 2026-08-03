"use strict";
(() => {
  if (window.__TURMA_THEME_GLOBAL_V12__) return;
  window.__TURMA_THEME_GLOBAL_V12__ = true;

  const KEY = "turma_global_theme_v2";
  const root = document.documentElement;
  const selectors = '[data-global-theme],[data-theme-toggle],.dash-theme-toggle,#studyThemeToggle,#themeButton,#profileThemeToggle,#rouletteThemeTop,#rouletteThemeToggle,#examThemeToggle,#favoritesThemeToggle,#reelThemeToggle';

  const saved = () => {
    try { return localStorage.getItem(KEY) || localStorage.getItem("theme") || localStorage.getItem("turma_theme") || "dark"; }
    catch { return "dark"; }
  };

  function apply(value, broadcast = true) {
    const theme = value === "light" ? "light" : "dark";
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    try {
      localStorage.setItem(KEY, theme);
      localStorage.setItem("theme", theme);
      localStorage.setItem("turma_theme", theme);
    } catch {}

    document.querySelectorAll(selectors).forEach(button => {
      button.setAttribute("aria-pressed", String(theme === "light"));
      button.title = theme === "light" ? "Ativar tema escuro" : "Ativar tema claro";
      const use = button.querySelector("use");
      if (use && /i-(moon|sun)/.test(use.getAttribute("href") || "")) {
        use.setAttribute("href", `/assets/dashboard-icons.svg#${theme === "light" ? "i-sun" : "i-moon"}`);
      }
    });

    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#edf1f6" : "#05070b");
    if (broadcast) window.dispatchEvent(new CustomEvent("turma:theme-change", { detail:{ theme } }));
  }

  function bind() {
    document.addEventListener("click", event => {
      const button = event.target.closest(selectors);
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      apply(root.dataset.theme === "light" ? "dark" : "light");
    }, true);

    window.addEventListener("storage", event => {
      if ([KEY,"theme","turma_theme"].includes(event.key)) apply(event.newValue, false);
    });
  }

  function load(src, type, marker) {
    if (document.querySelector(`[data-${marker}]`)) return;
    const element = document.createElement(type === "style" ? "link" : "script");
    if (type === "style") {
      element.rel = "stylesheet";
      element.href = src;
    } else {
      element.src = src;
      element.defer = true;
    }
    element.dataset[marker] = "1";
    document.head.appendChild(element);
  }

  function install() {
    const version = "20260803-v12-root";
    load(`/turma-unified-v12.css?v=${version}`, "style", "turmaUnifiedV12Css");
    load(`/turma-unified-v12.js?v=${version}`, "script", "turmaUnifiedV12Js");
    load(`/notifications-button-v7.js?v=${version}`, "script", "notificationsButtonV7Js");
  }

  apply(saved(), false);
  const start = () => { bind(); install(); };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start, { once:true }) : start();
})();
