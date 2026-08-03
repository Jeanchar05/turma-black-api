"use strict";
(() => {
  if (window.__TURMA_UNIFIED_V12__) return;
  window.__TURMA_UNIFIED_V12__ = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const path = (location.pathname.replace(/\/$/, "") || "/").toLowerCase();

  const navItems = [
    ["/dashboard", "Dashboard", "i-home"],
    ["/notas", "Anotações", "i-note"],
    ["/minigames", "Minigames", "i-game"],
    ["/estudo", "Estudo", "i-book"],
    ["/modulos", "Módulos", "i-layers"],
    ["/gestao", "Gestão", "i-activity"],
    ["/suporte", "Suporte", "i-support"],
    ["/perfil", "Perfil", "i-user"],
    ["/roleta", "Roleta", "i-roulette"],
    ["/provas", "Provas", "i-exam"],
    ["/favoritos", "Favoritos", "i-star"]
  ];

  const routeClass = () => {
    const route = path.replace(/^\//, "").replace(/\.html$/, "") || "home";
    document.body.classList.add("tp-v12", `tp-route-${route.replace(/[^a-z0-9-]/g, "-")}`);
  };

  const isActive = href => {
    if (href === "/dashboard") return path === "/" || path === "/dashboard" || path === "/dashboard.html";
    if (href === "/estudo") return path === "/estudo" || path === "/estudo.html" || path.startsWith("/estudo-");
    if (href === "/modulos") return path === "/modulos" || path === "/modulos.html";
    if (href === "/roleta") return path === "/roleta" || path === "/roleta.html";
    return path === href || path === `${href}.html`;
  };

  function normalizeSidebar() {
    if (path.includes("dashboard-free")) return;
    const nav = $(".dash-nav,.notes-main-nav,.support-nav");
    if (!nav) return;
    nav.classList.add("dash-nav");
    nav.innerHTML = navItems.map(([href, label, icon]) => `
      <a class="dash-nav-item${isActive(href) ? " active" : ""}" href="${href}">
        <svg><use href="/assets/dashboard-icons.svg#${icon}"></use></svg>
        <b>${label}</b>
      </a>`).join("");

    const sidebar = nav.closest("aside");
    if (sidebar) {
      sidebar.classList.add("dash-sidebar");
      const brand = $(".dash-brand,.notes-brand,.support-brand", sidebar);
      if (brand) brand.classList.add("dash-brand");
      const logout = $(".dash-logout,.notes-logout,.support-logout", sidebar);
      if (logout) logout.classList.add("dash-logout");
    }
  }

  function normalizeMain() {
    const main = $(".dash-main,.notes-main,.support-main,.roulette-main,.favorites-main,.modules-main,.reel-main");
    if (main) main.classList.add("dash-main");
    const topbar = $(".dash-topbar,.notes-topbar,.support-topbar,.roulette-topbar,.favorites-topbar,.modules-topbar,.reel-topbar");
    if (topbar) topbar.classList.add("dash-topbar");
  }

  function normalizeCopy() {
    $$('a[href="/notas"] b,a[href="/notas"] span,.notes-title-group h1').forEach(el => {
      if (/^notas$/i.test(el.textContent.trim())) el.textContent = "Anotações";
    });
    const title = document.querySelector("title");
    if (title && /^Notas \|/i.test(title.textContent)) title.textContent = title.textContent.replace(/^Notas/i, "Anotações");
    const tags = $("#noteTags");
    if (tags) tags.placeholder = "Adicionar tags separadas por vírgula";
  }

  function bindMobileMenu() {
    const sidebar = $(".dash-sidebar,.notes-sidebar,.support-sidebar,.roulette-sidebar,.favorites-sidebar");
    if (!sidebar) return;
    const overlay = $(".dash-mobile-overlay,.notes-mobile-overlay,.support-mobile-overlay,#studyMobileOverlay,#modulesMobileOverlay,#profileMobileOverlay,#examMobileOverlay,#favoritesMobileOverlay,#rouletteMobileOverlay,#reelMobileOverlay");
    const toggles = $$(".dash-menu-toggle,.notes-menu-button,.support-menu-button,.roulette-menu,#studyMenuToggle,#modulesMenuToggle,#profileMenuToggle,#examMenuToggle,#favoritesMenuToggle,#rouletteMenuToggle,#reelMenuToggle");
    const open = () => {
      sidebar.classList.add("open");
      if (overlay) overlay.hidden = false;
      document.documentElement.style.overflow = "hidden";
    };
    const close = () => {
      sidebar.classList.remove("open");
      if (overlay) overlay.hidden = true;
      document.documentElement.style.overflow = "";
    };
    toggles.forEach(button => {
      if (button.dataset.v12MenuBound) return;
      button.dataset.v12MenuBound = "1";
      button.addEventListener("click", event => {
        event.preventDefault();
        sidebar.classList.contains("open") ? close() : open();
      });
    });
    overlay?.addEventListener("click", close);
    navItems.forEach(([href]) => {
      const link = sidebar.querySelector(`a[href="${href}"]`);
      link?.addEventListener("click", () => {
        if (matchMedia("(max-width:900px)").matches) close();
      });
    });
  }

  function preventNotificationNavigation() {
    $$('a[href="/notificacoes"],a[href="/notificacoes.html"]').forEach(link => {
      link.href = "#";
      link.setAttribute("role", "button");
      link.dataset.notificationToggle = "1";
      link.addEventListener("click", event => event.preventDefault());
    });
  }

  function installImageFallbacks() {
    $$('img').forEach(img => {
      if (img.dataset.v12Fallback) return;
      img.dataset.v12Fallback = "1";
      img.addEventListener("error", () => {
        if (img.dataset.v12Failed) return;
        img.dataset.v12Failed = "1";
        const title = img.alt || "Turma do Primo";
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><defs><radialGradient id="b" cx="72%" cy="35%" r="80%"><stop stop-color="#7831b8" stop-opacity=".42"/><stop offset=".55" stop-color="#241033"/><stop offset="1" stop-color="#07030c"/></radialGradient><linearGradient id="g"><stop stop-color="#f4d67e"/><stop offset="1" stop-color="#ad54eb"/></linearGradient></defs><rect width="1200" height="675" rx="32" fill="url(#b)"/><circle cx="900" cy="330" r="150" fill="#0b0710" stroke="#a650e0" stroke-width="5"/><text x="900" y="375" text-anchor="middle" font-family="Georgia" font-size="130" fill="url(#g)">P</text><text x="80" y="300" font-family="Arial" font-size="55" font-weight="800" fill="#fff">${String(title).replace(/[<>&]/g, "")}</text><text x="82" y="360" font-family="Arial" font-size="20" letter-spacing="5" fill="#d2a6e8">TURMA DO PRIMO</text></svg>`;
        img.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
        img.classList.remove("image-load-failed");
      }, { once:true });
    });
  }

  function improveNotes() {
    if (!document.body.classList.contains("notes-page")) return;
    const editor = $("#notesEditor");
    const openEditor = () => editor?.classList.add("editor-open");
    const closeEditor = () => editor?.classList.remove("editor-open");
    $("#newNoteButton")?.addEventListener("click", openEditor);
    $$('[data-create-note]').forEach(button => button.addEventListener("click", openEditor));
    document.addEventListener("click", event => {
      if (event.target.closest(".note-card")) openEditor();
      if (event.target.closest('[data-editor-action="close"]')) closeEditor();
    });
  }

  function improveGestao() {
    if (!document.body.classList.contains("bankroll-page")) return;
    $("#exportBankrollButton")?.remove();
    $(".history-panel")?.remove();
    const hero = $(".bankroll-hero p");
    if (hero) hero.textContent = "Planeje sua banca, defina metas por período e acompanhe cada dia com clareza e disciplina.";
  }

  function cleanLegacyLayers() {
    const legacy = [
      "platform-final.css","platform-upgrade-v6.css","turma-overhaul-v8.css","turma-overhaul-v8-addons.css",
      "site-stabilization-v9.css","site-stabilization-v9b.css","turma-premium-v10.css","turma-premium-v10-free.css","turma-approved-v11.css"
    ];
    $$('link[rel="stylesheet"]').forEach(link => {
      const href = link.getAttribute("href") || "";
      if (legacy.some(file => href.includes(file))) link.disabled = true;
    });
  }

  function observe() {
    let timer;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        normalizeCopy();
        installImageFallbacks();
      }, 80);
    });
    observer.observe(document.body, { childList:true, subtree:true });
    setTimeout(() => observer.disconnect(), 12000);
  }

  function init() {
    cleanLegacyLayers();
    routeClass();
    normalizeSidebar();
    normalizeMain();
    normalizeCopy();
    bindMobileMenu();
    preventNotificationNavigation();
    installImageFallbacks();
    improveNotes();
    improveGestao();
    observe();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once:true }) : init();
})();
