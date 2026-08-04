"use strict";
(() => {
  if (window.__TURMA_THEME_STABLE_V17__) return;
  window.__TURMA_THEME_STABLE_V17__ = true;

  const KEY = "turma_global_theme_v2";
  const root = document.documentElement;
  const selector = '[data-global-theme],[data-theme-toggle],.dash-theme-toggle,#studyThemeToggle,#themeButton,#profileThemeToggle,#rouletteThemeTop,#rouletteThemeToggle,#examThemeToggle,#favoritesThemeToggle,#reelThemeToggle';

  function read() {
    try {
      const value = localStorage.getItem(KEY) || localStorage.getItem("theme") || localStorage.getItem("turma_theme");
      return value === "light" ? "light" : "dark";
    } catch (_) {
      return "dark";
    }
  }

  function paint(value, broadcast = true) {
    const theme = value === "light" ? "light" : "dark";
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    try {
      localStorage.setItem(KEY, theme);
      localStorage.setItem("theme", theme);
      localStorage.setItem("turma_theme", theme);
    } catch (_) {}

    document.querySelectorAll(selector).forEach((button) => {
      button.setAttribute("aria-pressed", String(theme === "light"));
      button.title = theme === "light" ? "Ativar tema escuro" : "Ativar tema claro";
      const use = button.querySelector("use");
      if (use && /i-(moon|sun)/.test(use.getAttribute("href") || "")) {
        use.setAttribute("href", `/assets/dashboard-icons.svg#${theme === "light" ? "i-sun" : "i-moon"}`);
      }
    });

    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#eef1f6" : "#05070b");
    if (broadcast) window.dispatchEvent(new CustomEvent("turma:theme-change", { detail: { theme } }));
  }

  function bind() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest(selector);
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      paint(root.dataset.theme === "light" ? "dark" : "light");
    }, true);

    window.addEventListener("storage", (event) => {
      if ([KEY, "theme", "turma_theme"].includes(event.key)) paint(event.newValue, false);
    });
  }

  paint(read(), false);
  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", bind, { once: true })
    : bind();
})();
