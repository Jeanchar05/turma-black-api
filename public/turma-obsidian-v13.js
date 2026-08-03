"use strict";
(() => {
  if (window.__TURMA_OBSIDIAN_V13__) return;
  window.__TURMA_OBSIDIAN_V13__ = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
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
    "/estudo": ["TRILHA DE CONHECIMENTO", "Estude com método.", "Evolua com clareza.", "Oito estratégias organizadas para transformar leitura em prática.", "▤"],
    "/modulos": ["VIDEOAULAS E E-BOOKS", "Aprenda no seu ritmo.", "Pratique em cada aula.", "Videoaulas, materiais escritos e exercícios conectados aos módulos.", "▰"],
    "/gestao": ["GESTÃO DE BANCA", "Controle cada decisão.", "Proteja seu capital.", "Planejamento, disciplina, metas, stop-loss e evolução real da banca.", "▥"],
    "/suporte": ["CENTRAL DE SUPORTE", "Conte com a equipe.", "Sua evolução importa.", "Abra chamados, reporte problemas e acompanhe cada atendimento.", "◉"],
    "/perfil": ["SEU PERFIL", "Sua jornada em um só lugar.", "Progresso que acompanha você.", "Dados pessoais, segurança, plano e preferências da plataforma.", "P"],
    "/roleta": ["AMBIENTE OPERACIONAL", "Acesse suas ferramentas.", "Leitura, Race e Racetrack.", "Entre nas roletas, organize marcações e acompanhe suas leituras.", "◌"],
    "/provas": ["CENTRAL DE AVALIAÇÕES", "Teste seu conhecimento.", "Supere sua média.", "Prova diária, semanal e Prova do Primo com níveis diferentes.", "✓"],
    "/favoritos": ["SUA COLEÇÃO", "Tudo que importa.", "Sempre ao alcance.", "Módulos, estratégias, anotações e conteúdos salvos.", "☆"],
    "/minigames": ["MINIGAME EXCLUSIVO", "Treine a leitura.", "Domine sua execução.", "Uma experiência conectada à Roleta Reel, Race e Racetrack.", "◉"]
  };

  function active(href) {
    if (href === "/dashboard") return cleanPath === "/" || cleanPath === "/dashboard";
    if (href === "/estudo") return cleanPath === "/estudo" || cleanPath.startsWith("/estudo-");
    if (href === "/roleta") return cleanPath === "/roleta";
    return cleanPath === href;
  }

  function theme() {
    const key = "turma_global_theme_v2";
    const root = document.documentElement;
    const current = (() => { try { return localStorage.getItem(key) || localStorage.getItem("theme") || "dark"; } catch { return "dark"; } })();
    const apply = value => {
      const next = value === "light" ? "light" : "dark";
      root.dataset.theme = next;
      root.style.colorScheme = next;
      try { localStorage.setItem(key, next); localStorage.setItem("theme", next); } catch {}
      $$('[data-global-theme],[data-theme-toggle],.dash-theme-toggle,#studyThemeToggle,#themeButton,#rouletteThemeTop,#rouletteThemeToggle,#examThemeToggle,#favoritesThemeToggle,#reelThemeToggle').forEach(button => {
        button.setAttribute("aria-pressed", String(next === "light"));
        const use = $("use", button);
        if (use) use.setAttribute("href", `/assets/dashboard-icons.svg#${next === "light" ? "i-sun" : "i-moon"}`);
      });
      $('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#edf1f7" : "#02050a");
    };
    apply(current);
    document.addEventListener("click", event => {
      const button = event.target.closest('[data-global-theme],[data-theme-toggle],.dash-theme-toggle,#studyThemeToggle,#themeButton,#rouletteThemeTop,#rouletteThemeToggle,#examThemeToggle,#favoritesThemeToggle,#reelThemeToggle');
      if (!button) return;
      event.preventDefault();
      apply(root.dataset.theme === "light" ? "dark" : "light");
    }, true);
  }

  function normalizeShell() {
    const route = cleanPath.replace(/^\//, "") || "dashboard";
    document.body.classList.add("obsidian-v13", `tp-route-${route.replace(/[^a-z0-9-]/g, "-")}`);
    if (route === "dashboard") document.body.classList.add("tp-route-dashboard", "tp-v10-dashboard");

    if (!cleanPath.includes("dashboard-free")) {
      const nav = $(".dash-nav,.notes-main-nav,.support-nav,.roulette-nav,.favorites-nav");
      if (nav) {
        nav.classList.add("dash-nav");
        nav.innerHTML = navItems.map(([href, label, icon]) => `<a class="dash-nav-item${active(href) ? " active" : ""}" href="${href}"><svg><use href="/assets/dashboard-icons.svg#${icon}"></use></svg><b>${label}</b></a>`).join("");
        const sidebar = nav.closest("aside");
        sidebar?.classList.add("dash-sidebar");
        if (sidebar && !sidebar.querySelector(".tp13-sidebar-spacer")) nav.insertAdjacentHTML("afterend", '<div class="tp13-sidebar-spacer"></div>');
      }
    }

    $(".dash-main,.notes-main,.support-main,.roulette-main,.favorites-main,.modules-main,.reel-main")?.classList.add("dash-main");
    $(".dash-topbar,.notes-topbar,.support-topbar,.roulette-topbar,.favorites-topbar,.modules-topbar,.reel-topbar")?.classList.add("dash-topbar");

    $$('a[href="/notas"] b,a[href="/notas"] span,.notes-title-group h1').forEach(el => {
      if (/^notas$/i.test(el.textContent.trim())) el.textContent = "Anotações";
    });
    if (/^Notas \|/i.test(document.title)) document.title = document.title.replace(/^Notas/i, "Anotações");
  }

  function art(symbol, label) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 560"><defs><radialGradient id="b"><stop stop-color="#8d31ed" stop-opacity=".45"/><stop offset=".6" stop-color="#2a0c40" stop-opacity=".28"/><stop offset="1" stop-color="#06030b" stop-opacity="0"/></radialGradient><linearGradient id="g"><stop stop-color="#d269ff"/><stop offset=".55" stop-color="#8b31ea"/><stop offset="1" stop-color="#f0c55d"/></linearGradient><filter id="gl"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><ellipse cx="520" cy="290" rx="330" ry="235" fill="url(#b)"/><g fill="none" stroke="#b358ff" stroke-opacity=".22"><circle cx="520" cy="280" r="190"/><circle cx="520" cy="280" r="145"/><circle cx="520" cy="280" r="100"/></g><g transform="translate(520 280)"><circle r="128" fill="#0b0610" stroke="url(#g)" stroke-width="5"/><circle r="92" fill="#160a21" stroke="#f0c55d" stroke-opacity=".64" stroke-width="2"/><text y="35" text-anchor="middle" font-family="Georgia" font-size="110" fill="url(#g)" filter="url(#gl)">${symbol}</text></g><text x="520" y="510" text-anchor="middle" font-family="Arial" font-size="17" letter-spacing="7" fill="#ded3e2" opacity=".72">${label}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function pageHero() {
    const meta = pageMeta[cleanPath];
    if (!meta || $(".tp13-page-hero")) return;
    const host = $(".study-home,.study-content,.modules-content,.minigames-content,.bankroll-content,.support-content,.profile-content,.exam-content,.provas-content,.favorites-content,.roulette-shell,.roulette-content,.roleta-content");
    if (!host) return;
    const [kicker, title, accent, description, symbol] = meta;
    const section = document.createElement("section");
    section.className = "tp13-page-hero";
    section.innerHTML = `<div class="tp13-page-copy"><span class="tp13-kicker">${kicker}</span><h1>${title}<br><strong>${accent}</strong></h1><p>${description}</p></div><div class="tp13-page-art"><img src="${art(symbol, kicker)}" alt=""></div>`;
    host.prepend(section);
  }

  function dashboardPortrait() {
    if (cleanPath !== "/dashboard") return;
    const hero = $(".dash-hero");
    if (!hero) return;
    if (!$('.dash-hero-portrait-wrap', hero)) {
      const script = document.createElement("script");
      script.src = "/dashboard-portrait-final.js?v=20260803-obsidian-v13";
      script.async = true;
      document.head.appendChild(script);
    }
    const content = $(".dash-content");
    content?.classList.add("tp-v10-dashboard-content");
  }

  function minigamesBanner() {
    if (cleanPath !== "/minigames") return;
    const image = $(".minigames-banner img");
    if (image) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 720"><defs><radialGradient id="b" cx="72%" cy="48%"><stop stop-color="#7b1ec0" stop-opacity=".5"/><stop offset=".55" stop-color="#1a0928"/><stop offset="1" stop-color="#05040a"/></radialGradient><linearGradient id="g"><stop stop-color="#f8dd84"/><stop offset=".45" stop-color="#e4ae3d"/><stop offset="1" stop-color="#a840f5"/></linearGradient></defs><rect width="1600" height="720" rx="34" fill="url(#b)"/><g fill="none" stroke="#aa48f2" stroke-opacity=".22"><circle cx="1190" cy="360" r="250"/><circle cx="1190" cy="360" r="205"/><circle cx="1190" cy="360" r="160"/><path d="M0 610C320 490 560 560 790 630S1290 700 1600 560" stroke-width="4"/></g><g transform="translate(110 120)"><text font-family="Arial" font-size="20" letter-spacing="10" fill="#e9bb52">MINIGAME EXCLUSIVO</text><text y="115" font-family="Georgia" font-size="102" font-weight="700" fill="url(#g)">ROLETA REEL</text><text y="180" font-family="Arial" font-size="20" letter-spacing="8" fill="#d9cfdf">LEITURA · ESTRATÉGIA · DISCIPLINA</text><text y="255" font-family="Arial" font-size="24" fill="#b8b0be">Treine suas estratégias, analise cada giro</text><text y="292" font-family="Arial" font-size="24" fill="#b8b0be">e evolua com inteligência e controle.</text></g><g transform="translate(1190 360)"><circle r="225" fill="#0a0610" stroke="url(#g)" stroke-width="8"/><circle r="172" fill="#160a21" stroke="#e8b84d" stroke-width="4"/><circle r="76" fill="#09050d" stroke="#9c3bea" stroke-width="5"/><circle r="28" fill="url(#g)"/><g stroke="#e8b84d" stroke-width="3">${Array.from({length:16},(_,i)=>`<line x1="0" y1="-170" x2="0" y2="-216" transform="rotate(${i*22.5})"/>`).join("")}</g></g></svg>`;
      image.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }
  }

  function notifications() {
    $$('a[href="/notificacoes"],a[href="/notificacoes.html"]').forEach(link => {
      link.href = "#";
      link.addEventListener("click", event => {
        event.preventDefault();
        const button = $("#notificationButton");
        if (button && button !== link) button.click();
      });
    });
  }

  function mobile() {
    document.addEventListener("click", event => {
      const toggle = event.target.closest(".dash-menu-toggle,.notes-menu-button,.support-menu-button,.roulette-menu,#studyMenuToggle,#modulesMenuToggle,#profileMenuToggle,#examMenuToggle,#favoritesMenuToggle,#reelMenuToggle");
      if (toggle) {
        const sidebar = $(".dash-sidebar,.notes-sidebar,.support-sidebar,.roulette-sidebar,.favorites-sidebar");
        sidebar?.classList.toggle("open");
        const overlay = $(".dash-mobile-overlay,.notes-mobile-overlay,.support-mobile-overlay");
        if (overlay) overlay.hidden = !sidebar?.classList.contains("open");
      }
      const overlay = event.target.closest(".dash-mobile-overlay,.notes-mobile-overlay,.support-mobile-overlay");
      if (overlay) {
        $(".dash-sidebar,.notes-sidebar,.support-sidebar,.roulette-sidebar,.favorites-sidebar")?.classList.remove("open");
        overlay.hidden = true;
      }
    });
  }

  function cleanOldHeroes() {
    $$(".study-approved-hero,.tp-v10-page-hero").forEach(el => el.remove());
  }

  function init() {
    theme();
    normalizeShell();
    cleanOldHeroes();
    pageHero();
    dashboardPortrait();
    minigamesBanner();
    notifications();
    mobile();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once:true }) : init();
})();
