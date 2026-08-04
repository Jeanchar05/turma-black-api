"use strict";
(() => {
  if (window.__TURMA_FINAL_V18__) return;
  window.__TURMA_FINAL_V18__ = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const route = (location.pathname.replace(/\/$/, "") || "/").replace(/\.html$/, "").toLowerCase();

  const routeClass = {
    "/dashboard": "dashboard-page",
    "/notas": "notes-page",
    "/minigames": "minigames-page",
    "/estudo": "study-home-page",
    "/modulos": "modules-page",
    "/gestao": "bankroll-page",
    "/suporte": "support-page",
    "/perfil": "profile-page",
    "/roleta": "roulette-page",
    "/roleta-reel": "reel-page",
    "/provas": "exam-page",
    "/favoritos": "favorites-page"
  };

  const navItems = [
    ["/dashboard", "Início", "i-home"],
    ["/estudo", "Estudos", "i-book"],
    ["/modulos", "Módulos", "i-layers"],
    ["/gestao", "Gestão", "i-activity"],
    ["/perfil", "Perfil", "i-user"]
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
        const modules = nav.querySelector('a[href="/modulos"]');
        modules?.insertAdjacentElement("afterend", anchor);
      }
    });

    $$(".notes-title-group h1").forEach((title) => { title.textContent = "Anotações"; });
    document.title = document.title.replace(/^Notas\b/, "Anotações");
  }

  function removeDuplicateMobileBars() {
    const bars = $$(".tp-mobile-bottom-nav,.dash-mobile-bottom,.m16-bottom");
    bars.forEach((bar) => bar.remove());
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
    const mappings = [
      ["#dashSidebar", "#dashMenuToggle", "#dashMobileOverlay"],
      ["#studySidebar", "#studyMenuToggle", "#studyMobileOverlay"],
      ["#modulesSidebar", "#modulesMenuToggle", "#modulesMobileOverlay"],
      ["#profileSidebar", "#profileMenuToggle", "#profileMobileOverlay"],
      ["#reelSidebar", "#reelMenuToggle", "#reelMobileOverlay"],
      ["#notesSidebar", "#notesMenuButton", "#notesMobileOverlay"],
      ["#supportSidebar", "#supportMenuToggle", "#supportMobileOverlay"],
      ["#rouletteSidebar", "#rouletteMenuToggle", "#rouletteMobileOverlay"],
      ["#favoritesSidebar", "#favoritesMenuToggle", "#favoritesMobileOverlay"]
    ];
    mappings.forEach(([s, b, o]) => bindDrawer($(s), $(b), $(o)));
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

    // Remove imagens decorativas antigas que apareciam gigantes antes do conteúdo correto.
    $$(".bankroll-hero > img,.bankroll-hero > picture").forEach((node) => node.remove());
  }

  function notesFix() {
    if (route !== "/notas") return;
    const form = $("#noteEditorForm");
    const editor = $("#notesEditor");
    if (form && !form.hidden && editor) editor.classList.remove("is-empty");
    const tags = $("#noteTags");
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

  function init() {
    normalizeRoute();
    normalizeNavigation();
    removeDuplicateMobileBars();
    createMobileBar();
    drawers();
    imageSafety();
    notesFix();
    notificationFix();
    document.documentElement.dataset.uiFinal = "v18";

    setTimeout(() => {
      normalizeNavigation();
      drawers();
      imageSafety();
      if (!$('.tp-mobile-bottom-nav')) createMobileBar();
    }, 700);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();
})();
