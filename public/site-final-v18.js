"use strict";
(() => {
  if (window.__TURMA_FINAL_V18__) return;
  window.__TURMA_FINAL_V18__ = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const route = (location.pathname.replace(/\/$/, "") || "/").replace(/\.html$/, "").toLowerCase();
  const THEME_KEY = "turma_global_theme_v2";

  const routeClass = {
    "/dashboard": "dashboard-page", "/notas": "notes-page", "/minigames": "minigames-page",
    "/estudo": "study-home-page", "/modulos": "modules-page", "/gestao": "bankroll-page",
    "/suporte": "support-page", "/perfil": "profile-page", "/roleta": "roulette-page",
    "/roleta-reel": "reel-page", "/provas": "exam-page", "/favoritos": "favorites-page"
  };
  const navItems = [
    ["/dashboard", "Início", "i-home"], ["/estudo", "Estudos", "i-book"],
    ["/modulos", "Módulos", "i-layers"], ["/gestao", "Gestão", "i-activity"], ["/perfil", "Perfil", "i-user"]
  ];

  function normalizeRoute() {
    document.body.classList.add(routeClass[route] || `route-${route.replace(/^\//, "").replace(/[^a-z0-9-]/g, "-")}`);
    if (route === "/roleta-reel") document.body.classList.add("roulette-reel-page", "reel-page");
  }

  function active(href) {
    if (href === "/dashboard") return route === "/" || route.startsWith("/dashboard");
    return route === href || route.startsWith(`${href}-`);
  }

  function normalizeNavigation() {
    $$(".dash-nav,.notes-main-nav").forEach((nav) => {
      nav.querySelectorAll("a").forEach((link) => {
        const href = (link.getAttribute("href") || "").replace(/\.html$/, "");
        const label = link.querySelector("b,span:last-child");
        if (href === "/notas" && label) label.textContent = "Anotações";
        link.classList.toggle("active", href === route || (href === "/dashboard" && route === "/dashboard"));
      });
      if (!nav.querySelector('a[href="/gestao"]')) {
        const anchor = document.createElement("a");
        anchor.className = `dash-nav-item${route === "/gestao" ? " active" : ""}`;
        anchor.href = "/gestao";
        anchor.innerHTML = '<svg><use href="/assets/dashboard-icons.svg#i-activity"></use></svg><b>Gestão</b>';
        nav.querySelector('a[href="/modulos"]')?.insertAdjacentElement("afterend", anchor);
      }
    });
    $$(".notes-title-group h1").forEach((title) => { title.textContent = "Anotações"; });
    document.title = document.title.replace(/^Notas\b/, "Anotações");
  }

  function readTheme() {
    try {
      const value = localStorage.getItem(THEME_KEY) || localStorage.getItem("theme") || localStorage.getItem("turma_theme");
      return value === "light" ? "light" : "dark";
    } catch (_) { return "dark"; }
  }

  function applyTheme(theme, save = true) {
    const value = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = value;
    document.documentElement.style.colorScheme = value;
    if (save) {
      try {
        localStorage.setItem(THEME_KEY, value);
        localStorage.setItem("theme", value);
        localStorage.setItem("turma_theme", value);
      } catch (_) {}
    }
    const icon = value === "light" ? "i-sun" : "i-moon";
    $$('[data-global-theme],.dash-theme-toggle,#studyThemeToggle,#profileThemeToggle,#reelThemeToggle,#themeButton,#rouletteThemeToggle,#examThemeToggle,#favoritesThemeToggle').forEach((button) => {
      button.setAttribute("aria-pressed", String(value === "light"));
      button.title = value === "light" ? "Ativar tema escuro" : "Ativar tema claro";
      const use = $("use", button);
      if (use && /i-(moon|sun)/.test(use.getAttribute("href") || "")) use.setAttribute("href", `/assets/dashboard-icons.svg#${icon}`);
    });
  }

  function bindTheme() {
    applyTheme(readTheme(), false);
    document.addEventListener("click", (event) => {
      const button = event.target.closest('[data-global-theme],.dash-theme-toggle,#studyThemeToggle,#profileThemeToggle,#reelThemeToggle,#themeButton,#rouletteThemeToggle,#examThemeToggle,#favoritesThemeToggle');
      if (!button || button.dataset.v18ThemeHandled === "1") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
    }, true);
  }

  function removeDuplicateMobileBars() {
    $$(".tp-mobile-bottom-nav,.dash-mobile-bottom,.m16-bottom").forEach((bar) => bar.remove());
  }

  function createMobileBar() {
    if (route === "/" || route.startsWith("/admin") || route.startsWith("/painel-vendas") || route.includes("dashboard-free")) return;
    removeDuplicateMobileBars();
    const bar = document.createElement("nav");
    bar.className = "tp-mobile-bottom-nav";
    bar.setAttribute("aria-label", "Navegação mobile");
    bar.innerHTML = navItems.map(([href, label, icon]) => `<a href="${href}" class="${active(href) ? "active" : ""}"><svg><use href="/assets/dashboard-icons.svg#${icon}"></use></svg><span>${label}</span></a>`).join("");
    document.body.appendChild(bar);
  }

  function bindDrawer(sidebar, button, overlay) {
    if (!sidebar || !button || button.dataset.v18Bound) return;
    button.dataset.v18Bound = "1";
    const close = () => {
      sidebar.classList.remove("open");
      if (overlay) overlay.hidden = true;
      document.body.classList.remove("menu-open");
    };
    button.addEventListener("click", (event) => {
      if (!matchMedia("(max-width: 860px)").matches) return;
      event.preventDefault();
      sidebar.classList.add("open");
      if (overlay) overlay.hidden = false;
      document.body.classList.add("menu-open");
    });
    overlay?.addEventListener("click", close);
    sidebar.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
  }

  function drawers() {
    [
      ["#dashSidebar", "#dashMenuToggle", "#dashMobileOverlay"], ["#studySidebar", "#studyMenuToggle", "#studyMobileOverlay"],
      ["#modulesSidebar", "#modulesMenuToggle", "#modulesMobileOverlay"], ["#profileSidebar", "#profileMenuToggle", "#profileMobileOverlay"],
      ["#reelSidebar", "#reelMenuToggle", "#reelMobileOverlay"], ["#notesSidebar", "#notesMenuButton", "#notesMobileOverlay"],
      ["#supportSidebar", "#supportMenuToggle", "#supportMobileOverlay"], ["#rouletteSidebar", "#rouletteMenuToggle", "#rouletteMobileOverlay"],
      ["#favoritesSidebar", "#favoritesMenuToggle", "#favoritesMobileOverlay"]
    ].forEach(([s, b, o]) => bindDrawer($(s), $(b), $(o)));
  }

  function imageSafety() {
    $$("img").forEach((image) => {
      image.decoding = "async";
      if (!image.closest(".dash-hero,.study-approved-hero,.bankroll-hero,.modules-heading,.reel-heading")) image.loading = "lazy";
      if (!image.dataset.v18Error) {
        image.dataset.v18Error = "1";
        image.addEventListener("error", () => image.classList.add("image-load-failed"), { once: true });
      }
    });
    $$(".bankroll-hero > img,.bankroll-hero > picture").forEach((node) => node.remove());
  }

  function notesFix() {
    if (route !== "/notas") return;
    const form = $("#noteEditorForm"), editor = $("#notesEditor"), tags = $("#noteTags");
    if (form && !form.hidden && editor) editor.classList.remove("is-empty");
    if (tags) tags.placeholder = "Ex.: resumo, estratégia, importante";
  }

  function notificationFix() {
    $$('a[href="/notificacoes"],a[href="/notificacoes.html"]').forEach((link) => {
      link.href = "#";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        $("#notificationButton,.dash-notification-btn")?.click();
      });
    });
  }

  function releaseLoading() {
    setTimeout(() => {
      $$(".dash-loading,.notes-loading,.modules-loading").forEach((loading) => {
        loading.hidden = true;
        loading.style.display = "none";
      });
      document.body.style.opacity = "1";
      document.body.style.visibility = "visible";
    }, 1400);
  }

  function init() {
    normalizeRoute();
    bindTheme();
    normalizeNavigation();
    removeDuplicateMobileBars();
    createMobileBar();
    drawers();
    imageSafety();
    notesFix();
    notificationFix();
    releaseLoading();
    document.documentElement.dataset.uiFinal = "v18";
    setTimeout(() => {
      normalizeNavigation();
      drawers();
      imageSafety();
      if (!$('.tp-mobile-bottom-nav')) createMobileBar();
    }, 700);
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
