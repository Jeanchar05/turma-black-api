"use strict";
(() => {
  const THEME_KEY = "turma_global_theme_v2";
  const $ = (selector, root = document) => root.querySelector(selector);

  function currentTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || localStorage.getItem("theme") || "dark";
    } catch (_) {
      return "dark";
    }
  }

  function applyTheme(value) {
    const theme = value === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem("theme", theme);
      localStorage.setItem("turma_theme", theme);
    } catch (_) {}
    const button = $("[data-global-theme]");
    if (button) {
      button.setAttribute("aria-pressed", String(theme === "light"));
      button.title = theme === "light" ? "Ativar tema escuro" : "Ativar tema claro";
    }
  }

  function bindTheme() {
    const button = $("[data-global-theme]");
    if (!button || button.dataset.hotfixBound === "1") return;
    button.dataset.hotfixBound = "1";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
    });
  }

  function bindNotifications() {
    const button = $("#notificationButton");
    const panel = $("#notificationPanel");
    if (!button || !panel || button.dataset.hotfixBound === "1") return;
    button.dataset.hotfixBound = "1";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      panel.hidden = !panel.hidden;
    });
    document.addEventListener("click", (event) => {
      if (panel.hidden) return;
      if (!panel.contains(event.target) && !button.contains(event.target)) panel.hidden = true;
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") panel.hidden = true;
    });
  }

  function stabilizePortrait() {
    const hero = $(".dash-hero");
    if (!hero) return;
    let wrap = $(".dash-hero-portrait-wrap", hero);
    if (!wrap) return;
    wrap.style.pointerEvents = "none";
    const image = $("img", wrap);
    if (image) {
      image.decoding = "async";
      image.loading = "eager";
      image.draggable = false;
    }
  }

  function init() {
    applyTheme(currentTheme());
    bindTheme();
    bindNotifications();
    stabilizePortrait();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
  setTimeout(init, 700);
})();