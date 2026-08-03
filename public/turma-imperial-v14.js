"use strict";
(() => {
  if (window.__TURMA_IMPERIAL_V14__) return;
  window.__TURMA_IMPERIAL_V14__ = true;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const path = (location.pathname.replace(/\/$/, "") || "/").toLowerCase();
  const cleanPath = path.replace(/\.html$/, "");

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

  const pageMeta = {
    "/estudo": { kicker: "TRILHA DE CONHECIMENTO", title: "Painel de", accent: "Estudos", desc: "Organize sua evolução, acompanhe os oito módulos e avance com clareza.", art: "/assets/imperial-v14/study-art.svg" },
    "/modulos": { kicker: "VIDEOAULAS E E-BOOKS", title: "Biblioteca de", accent: "Módulos", desc: "Acesse estratégias visuais, explicações interativas, materiais escritos e desafios práticos.", art: "/assets/imperial-v14/modules-art.svg" },
    "/gestao": { kicker: "GESTÃO DE BANCA", title: "Controle. Disciplina.", accent: "Consistência e lucro.", desc: "Planeje sua banca, registre cada sessão e acompanhe sua curva de evolução real.", art: "/assets/imperial-v14/gestao-art.svg" },
    "/suporte": { kicker: "CENTRAL DE SUPORTE", title: "Conte com a", accent: "equipe do Primo.", desc: "Abra chamados, acompanhe respostas e envie feedback diretamente para o painel administrativo.", art: null, symbol: "◉" },
    "/perfil": { kicker: "SEU PERFIL", title: "Sua jornada em", accent: "um só lugar.", desc: "Acompanhe seus dados, metas, plano, segurança e preferências da plataforma.", art: null, symbol: "P" },
    "/roleta": { kicker: "AMBIENTE OPERACIONAL", title: "Acesse suas", accent: "ferramentas.", desc: "Entre nas roletas, organize marcações e conecte sua leitura à Race e ao Racetrack.", art: null, symbol: "◌" },
    "/provas": { kicker: "CENTRAL DE AVALIAÇÕES", title: "Provas do", accent: "Primo", desc: "Avalie sua leitura, reforce seu conhecimento e suba de nível.", art: "/assets/imperial-v14/provas-art.svg" },
    "/favoritos": { kicker: "SUA COLEÇÃO", title: "Tudo que importa.", accent: "Sempre ao alcance.", desc: "Módulos, anotações, estratégias e ferramentas salvas em um único lugar.", art: null, symbol: "☆" },
    "/minigames": { kicker: "MINIGAME EXCLUSIVO", title: "Treine a leitura.", accent: "Domine sua execução.", desc: "Uma experiência conectada à Roleta Reel, Race e Racetrack.", art: "/assets/imperial-v14/minigames-art.svg" }
  };

  const moduleAssets = [
    { keys: ["gemeos", "gêmeos"], src: "/assets/imperial-v14/modules/gemeos.svg" },
    { keys: ["espelho", "espelhos"], src: "/assets/imperial-v14/modules/espelhos.svg" },
    { keys: ["fibonacci"], src: "/assets/imperial-v14/modules/fibonacci.svg" },
    { keys: ["magneto"], src: "/assets/imperial-v14/modules/magneto.svg" },
    { keys: ["camaleoes", "camaleões"], src: "/assets/imperial-v14/modules/camaleoes.svg" },
    { keys: ["pitagoras", "pitágoras", "triangulacao", "triangulação"], src: "/assets/imperial-v14/modules/pitagoras.svg" },
    { keys: ["cavalo", "cavalos"], src: "/assets/imperial-v14/modules/cavalo.svg" },
    { keys: ["eclipse zero", "eclipse-zero", "eclipse"], src: "/assets/imperial-v14/modules/eclipse-zero.svg" }
  ];

  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  function active(href) {
    if (href === "/dashboard") return cleanPath === "/" || cleanPath === "/dashboard";
    if (href === "/estudo") return cleanPath === "/estudo" || cleanPath.startsWith("/estudo-");
    if (href === "/roleta") return cleanPath === "/roleta";
    return cleanPath === href;
  }

  function installClass() {
    document.body.classList.add("imperial-v14", `tp-route-${(cleanPath.replace(/^\//, "") || "dashboard").replace(/[^a-z0-9-]/g, "-")}`);
  }

  function normalizeSidebar() {
    if (cleanPath.includes("dashboard-free")) return;
    const nav = $(".dash-nav,.notes-main-nav,.support-nav,.roulette-nav,.favorites-nav");
    if (!nav || nav.dataset.imperial14) return;
    nav.dataset.imperial14 = "1";
    nav.classList.add("dash-nav");
    nav.innerHTML = navItems.map(([href, label, icon]) => `<a class="dash-nav-item${active(href) ? " active" : ""}" href="${href}"><svg><use href="/assets/dashboard-icons.svg#${icon}"></use></svg><b>${label}</b></a>`).join("");
    const sidebar = nav.closest("aside");
    if (!sidebar) return;
    sidebar.classList.add("dash-sidebar");
    if (!sidebar.querySelector(".tp14-sidebar-spacer")) nav.insertAdjacentHTML("afterend", '<div class="tp14-sidebar-spacer"></div>');
  }

  function normalizeMain() {
    $(".notes-main,.support-main,.roulette-main,.favorites-main,.exam-main,.modules-main,.study-main,.profile-main,.bankroll-main,.reel-main")?.classList.add("dash-main");
    $(".notes-topbar,.support-topbar,.roulette-topbar,.favorites-topbar,.exam-topbar,.modules-topbar,.study-topbar,.reel-topbar")?.classList.add("dash-topbar");
  }

  function heroSymbol(symbol) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 520"><defs><radialGradient id="b"><stop stop-color="#8f30df" stop-opacity=".5"/><stop offset="1" stop-color="#080511" stop-opacity="0"/></radialGradient><linearGradient id="g"><stop stop-color="#be62ff"/><stop offset="1" stop-color="#edbd54"/></linearGradient><filter id="gl"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><ellipse cx="380" cy="270" rx="290" ry="220" fill="url(#b)"/><g fill="none" stroke="#a74bea" stroke-opacity=".24"><circle cx="390" cy="260" r="190"/><circle cx="390" cy="260" r="145"/><circle cx="390" cy="260" r="100"/></g><circle cx="390" cy="260" r="126" fill="#0d0714" stroke="url(#g)" stroke-width="5"/><circle cx="390" cy="260" r="90" fill="#160a21" stroke="#e8b94f" stroke-opacity=".6"/><text x="390" y="300" text-anchor="middle" font-family="Georgia" font-size="112" fill="url(#g)" filter="url(#gl)">${symbol}</text></svg>`)}`;
  }

  function insertPageHero() {
    const meta = pageMeta[cleanPath];
    if (!meta || $(".tp14-page-hero")) return;
    const host = $(".study-content,.modules-content,.bankroll-content,.support-content,.profile-content,.roulette-content,.roleta-content,.exam-content,.provas-content,.favorites-content,.minigames-content,.dash-content");
    if (!host) return;
    const section = document.createElement("section");
    section.className = "tp14-page-hero tp14-reveal";
    const art = meta.art || heroSymbol(meta.symbol || "P");
    section.innerHTML = `<div class="tp14-page-copy"><span class="tp14-kicker">${meta.kicker}</span><h1>${meta.title}<br><strong>${meta.accent}</strong></h1><p>${meta.desc}</p></div><img class="tp14-page-art" src="${art}" alt="" />`;
    host.prepend(section);
  }

  function applyDashboardArt() {
    if (cleanPath !== "/dashboard" && cleanPath !== "/dashboard-free") return;
    $(".dash-content")?.classList.add("tp14-dashboard-content");
    if (cleanPath === "/dashboard-free") document.body.classList.add("tp-route-dashboard-free");
  }

  function findModule(element) {
    const text = normalize(`${element.textContent || ""} ${element.getAttribute?.("href") || ""} ${element.dataset?.module || ""}`);
    return moduleAssets.find(item => item.keys.some(key => text.includes(normalize(key))));
  }

  function applyModuleImages() {
    $$(".study-module-card,.module-video-item,[data-module],a[href*='estudo-']").forEach(card => {
      const item = findModule(card);
      if (!item) return;
      const image = $(".study-module-art img,.module-video-cover img,img", card);
      if (!image || image.dataset.imperial14 === item.src) return;
      image.dataset.imperial14 = item.src;
      image.src = item.src;
      image.removeAttribute("srcset");
      image.loading = "lazy";
      image.onerror = () => { image.style.opacity = ".25"; };
    });

    const current = moduleAssets.find(item => item.keys.some(key => normalize(cleanPath).includes(normalize(key))));
    if (current) {
      const heroImage = $(".strategy-hero img,.module-hero img,.strategy-head img,.hero-art img");
      if (heroImage) {
        heroImage.src = current.src;
        heroImage.removeAttribute("srcset");
      }
    }
  }

  function fixNamesAndLinks() {
    $$('a[href="/notas"] b,a[href="/notas"] span,.notes-title-group h1').forEach(el => {
      if (/^notas$/i.test(el.textContent.trim())) el.textContent = "Anotações";
    });
    $$('a[href="/notificacoes"],a[href="/notificacoes.html"]').forEach(link => {
      link.href = "#";
      link.dataset.notificationToggle = "1";
    });
  }

  function mobileMenu() {
    const sidebar = $(".dash-sidebar,.notes-sidebar,.support-sidebar,.roulette-sidebar,.favorites-sidebar");
    const toggle = $(".dash-menu-toggle,.notes-menu-button,.roulette-menu,#profileMenuToggle,#examMenuToggle,#favoritesMenuToggle,#reelMenuToggle");
    const overlay = $(".dash-mobile-overlay");
    if (!sidebar || !toggle || toggle.dataset.imperialBound) return;
    toggle.dataset.imperialBound = "1";
    const close = () => { sidebar.classList.remove("open"); if (overlay) overlay.hidden = true; };
    toggle.addEventListener("click", event => { event.preventDefault(); sidebar.classList.toggle("open"); if (overlay) overlay.hidden = !sidebar.classList.contains("open"); });
    overlay?.addEventListener("click", close);
    sidebar.addEventListener("click", event => { if (event.target.closest("a") && innerWidth <= 900) close(); });
  }

  function themeToggle() {
    const key = "turma_global_theme_v2";
    const apply = value => {
      const theme = value === "light" ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
      try { localStorage.setItem(key, theme); localStorage.setItem("theme", theme); } catch {}
      $$('[data-global-theme],[data-theme-toggle],.dash-theme-toggle,#profileThemeToggle,#examThemeToggle,#favoritesThemeToggle,#reelThemeToggle,#rouletteThemeTop').forEach(btn => {
        btn.setAttribute("aria-pressed", String(theme === "light"));
        const use = $("use", btn);
        if (use) use.setAttribute("href", `/assets/dashboard-icons.svg#${theme === "light" ? "i-sun" : "i-moon"}`);
      });
    };
    let saved = "dark";
    try { saved = localStorage.getItem(key) || localStorage.getItem("theme") || "dark"; } catch {}
    apply(saved);
    document.addEventListener("click", event => {
      const button = event.target.closest('[data-global-theme],[data-theme-toggle],.dash-theme-toggle,#profileThemeToggle,#examThemeToggle,#favoritesThemeToggle,#reelThemeToggle,#rouletteThemeTop');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      apply(document.documentElement.dataset.theme === "light" ? "dark" : "light");
    }, true);
  }

  function reveal() {
    const elements = $$(".dash-hero,.dash-stat-grid article,.dash-panel,.study-module-card,.module-video-item,.notes-organizer,.notes-library,.notes-editor,.minigames-banner,.minigames-feature,.exam-card,.favorites-card,.support-card,.bankroll-card,.roulette-panel-new,.roulette-platform-new");
    elements.forEach(el => el.classList.add("tp14-reveal"));
    if (!("IntersectionObserver" in window)) { elements.forEach(el => el.classList.add("is-visible")); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } }), { threshold: .08 });
    $$(".tp14-reveal").forEach(el => observer.observe(el));
  }

  function observe() {
    let timer;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { applyModuleImages(); fixNamesAndLinks(); }, 80);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 14000);
  }

  function init() {
    installClass();
    normalizeSidebar();
    normalizeMain();
    insertPageHero();
    applyDashboardArt();
    applyModuleImages();
    fixNamesAndLinks();
    mobileMenu();
    themeToggle();
    reveal();
    observe();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
