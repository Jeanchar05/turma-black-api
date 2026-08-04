"use strict";
(() => {
  if (window.__TURMA_STABILITY_V17__) return;
  window.__TURMA_STABILITY_V17__ = true;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const route = (location.pathname.replace(/\/$/, "") || "/").replace(/\.html$/, "").toLowerCase();
  const nav = [
    ["/dashboard", "Início", "i-home"],
    ["/estudo", "Estudos", "i-book"],
    ["/modulos", "Módulos", "i-layers"],
    ["/gestao", "Gestão", "i-activity"],
    ["/perfil", "Perfil", "i-user"]
  ];

  function active(href) {
    if (href === "/dashboard") return route === "/" || route.startsWith("/dashboard");
    return route === href || route.startsWith(`${href}-`);
  }

  function theme() {
    const root = document.documentElement;
    let current = "dark";
    try { current = localStorage.getItem("theme") || localStorage.getItem("turma_global_theme_v2") || "dark"; } catch (_) {}
    current = current === "light" ? "light" : "dark";
    root.dataset.theme = current;
    root.style.colorScheme = current;

    const selector = '[data-global-theme],[data-theme-toggle],.dash-theme-toggle,#studyThemeToggle,#themeButton,#rouletteThemeTop,#rouletteThemeToggle,#examThemeToggle,#favoritesThemeToggle,#reelThemeToggle';
    document.addEventListener("click", (event) => {
      const button = event.target.closest(selector);
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const next = root.dataset.theme === "light" ? "dark" : "light";
      root.dataset.theme = next;
      root.style.colorScheme = next;
      try {
        localStorage.setItem("theme", next);
        localStorage.setItem("turma_global_theme_v2", next);
        localStorage.setItem("turma_theme", next);
      } catch (_) {}
      window.dispatchEvent(new CustomEvent("turma:theme-change", { detail: { theme: next } }));
    }, true);
  }

  function dedupe(selector) {
    const items = $$(selector);
    items.slice(1).forEach((item) => item.remove());
  }

  function bottomNav() {
    if (route.includes("dashboard-free") || route.startsWith("/admin") || route.startsWith("/painel-vendas") || route === "/") return;
    dedupe(".tp-mobile-bottom-nav");
    if ($(".tp-mobile-bottom-nav")) return;
    const bar = document.createElement("nav");
    bar.className = "tp-mobile-bottom-nav";
    bar.setAttribute("aria-label", "Navegação mobile");
    bar.innerHTML = nav.map(([href, label, icon]) => `<a class="${active(href) ? "active" : ""}" href="${href}"><svg><use href="/assets/dashboard-icons.svg#${icon}"></use></svg><span>${label}</span></a>`).join("");
    document.body.appendChild(bar);
  }

  function sidebars() {
    const pairs = [
      ["#dashSidebar", "#dashMenuToggle", "#dashMobileOverlay"],
      ["#studySidebar", "#studyMenuToggle", "#studyMobileOverlay"],
      ["#modulesSidebar", "#modulesMenuToggle", "#modulesMobileOverlay"],
      [".notes-sidebar", ".notes-menu-toggle", ".notes-mobile-overlay"],
      [".support-sidebar", ".support-menu-toggle", ".support-mobile-overlay"],
      [".roulette-sidebar", ".roulette-menu-toggle", ".roulette-mobile-overlay"],
      [".favorites-sidebar", ".favorites-menu-toggle", ".favorites-mobile-overlay"]
    ];
    pairs.forEach(([sideSel, buttonSel, overlaySel]) => {
      const side = $(sideSel), button = $(buttonSel), overlay = $(overlaySel);
      if (!side) return;
      if (matchMedia("(max-width: 820px)").matches) side.classList.remove("open");
      if (button && !button.dataset.stableBound) {
        button.dataset.stableBound = "1";
        button.addEventListener("click", () => {
          side.classList.add("open");
          if (overlay) overlay.hidden = false;
        });
      }
      if (overlay && !overlay.dataset.stableBound) {
        overlay.dataset.stableBound = "1";
        overlay.addEventListener("click", () => {
          side.classList.remove("open");
          overlay.hidden = true;
        });
      }
    });
  }

  function images() {
    $$('img').forEach((img) => {
      img.decoding = "async";
      if (!img.hasAttribute("loading") && !img.closest(".dash-hero,.study-hero,.strategy-hero")) img.loading = "lazy";
      if (!img.dataset.stableError) {
        img.dataset.stableError = "1";
        img.addEventListener("error", () => img.classList.add("image-load-failed"), { once: true });
      }
    });
  }

  function notifications() {
    $$('a[href="/notificacoes"],a[href="/notificacoes.html"]').forEach((link) => {
      link.href = "#";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const button = $("#notificationButton,.dash-notification-btn");
        if (button && button !== link) button.click();
      });
    });
  }

  function cleanup() {
    dedupe(".tp-mobile-bottom-nav");
    dedupe(".dash-mobile-overlay");
    $$('[data-ui-v10],[data-ui-v11],[data-ui-v12],[data-ui-v13],[data-ui-v14],[data-ui-v15]').forEach((node) => node.remove());
  }

  function init() {
    document.documentElement.dataset.uiStable = "v17";
    cleanup();
    theme();
    sidebars();
    images();
    notifications();
    bottomNav();
    setTimeout(() => { cleanup(); sidebars(); images(); bottomNav(); }, 600);
    setTimeout(() => { cleanup(); images(); }, 1800);
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
