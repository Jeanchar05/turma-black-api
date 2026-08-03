"use strict";
(() => {
  if (window.__TURMA_PREMIUM_V10__) return;
  window.__TURMA_PREMIUM_V10__ = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const route = (location.pathname.replace(/\/$/, "") || "/").toLowerCase();
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const nav = [
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
    "/estudo": { kicker:"TRILHA DE CONHECIMENTO", title:"Estude com método.", accent:"Evolua com clareza.", desc:"Oito estratégias organizadas para transformar leitura em prática.", art:"book" },
    "/modulos": { kicker:"VIDEOAULAS E E-BOOKS", title:"Aprenda no seu ritmo.", accent:"Pratique em cada aula.", desc:"Videoaulas, materiais escritos e exercícios conectados aos módulos.", art:"layers" },
    "/gestao": { kicker:"GESTÃO DE BANCA", title:"Controle cada decisão.", accent:"Proteja seu capital.", desc:"Planejamento, disciplina, metas, stop-loss e evolução real da banca.", art:"bank" },
    "/suporte": { kicker:"CENTRAL DE SUPORTE", title:"Conte com a equipe.", accent:"Sua evolução importa.", desc:"Abra chamados, reporte problemas e envie feedback diretamente ao painel administrativo.", art:"support" },
    "/perfil": { kicker:"SEU PERFIL", title:"Sua jornada em um só lugar.", accent:"Progresso que acompanha você.", desc:"Dados pessoais, nível da conta, segurança e preferências da plataforma.", art:"profile" },
    "/roleta": { kicker:"AMBIENTE OPERACIONAL", title:"Acesse suas ferramentas.", accent:"Leitura, Race e Racetrack.", desc:"Entre nas roletas, organize marcações e acompanhe suas leituras com clareza.", art:"roulette" },
    "/provas": { kicker:"AVALIAÇÕES", title:"Teste seu conhecimento.", accent:"Supere sua média.", desc:"Prova diária, semanal e Prova do Primo com níveis diferentes de dificuldade.", art:"exam" },
    "/favoritos": { kicker:"SUA COLEÇÃO", title:"Tudo que importa.", accent:"Sempre ao alcance.", desc:"Módulos, estratégias, anotações e conteúdos salvos em um único lugar.", art:"star" }
  };

  const modules = [
    {key:"gemeos",names:["gemeos","gêmeos"],title:"GÊMEOS",subtitle:"11 · 22 · 33",symbol:"Ⅱ",accent:"#b45cff"},
    {key:"espelhos",names:["espelho","espelhos"],title:"ESPELHOS",subtitle:"REFLEXO E CONEXÃO",symbol:"◇",accent:"#e9b94f"},
    {key:"fibonacci",names:["fibonacci"],title:"FIBONACCI",subtitle:"SEQUÊNCIA E PROTEÇÃO",symbol:"Φ",accent:"#9a63ff"},
    {key:"magneto",names:["magneto"],title:"MAGNETO",subtitle:"NÚMEROS QUE SE PUXAM",symbol:"∩",accent:"#51a8ff"},
    {key:"camaleoes",names:["camaleoes","camaleões"],title:"CAMALEÕES",subtitle:"ADAPTAÇÃO E LEITURA",symbol:"◉",accent:"#58d28b"},
    {key:"pitagoras",names:["pitagoras","pitágoras","triangulacao","triangulação"],title:"PITÁGORAS",subtitle:"TRIANGULAÇÃO",symbol:"△",accent:"#ff8ab5"},
    {key:"cavalo",names:["cavalo","cavalos"],title:"CAVALO",subtitle:"1·4·7  2·5·8  3·6·9",symbol:"♞",accent:"#55b4ff"},
    {key:"eclipse",names:["eclipse zero","eclipse"],title:"ECLIPSE ZERO",subtitle:"TERMINAIS 0 E 9",symbol:"◐",accent:"#efc354"}
  ];

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  }

  function artSvg(kind, title = "TURMA DO PRIMO") {
    const symbols = {book:"▤",layers:"▰",bank:"▥",support:"◉",profile:"P",roulette:"◌",exam:"✓",star:"☆",minigames:"◉",free:"♛"};
    const symbol = symbols[kind] || "P";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 540">
      <defs>
        <radialGradient id="bg" cx="50%" cy="50%" r="60%"><stop stop-color="#7c25c7" stop-opacity=".5"/><stop offset=".55" stop-color="#2a0d40" stop-opacity=".3"/><stop offset="1" stop-color="#08050d" stop-opacity="0"/></radialGradient>
        <linearGradient id="g" x1="0" x2="1"><stop stop-color="#c866ff"/><stop offset=".52" stop-color="#7f2ed1"/><stop offset="1" stop-color="#f0c45a"/></linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <ellipse cx="520" cy="290" rx="330" ry="230" fill="url(#bg)"/>
      <g fill="none" stroke="#b55cff" stroke-opacity=".28">
        <circle cx="520" cy="280" r="190"/><circle cx="520" cy="280" r="145"/><circle cx="520" cy="280" r="100"/>
        <path d="M90 430C260 330 390 380 520 420S750 480 870 370"/>
      </g>
      <g transform="translate(520 280)">
        <path d="M0-130 26-80 82-92 62-38 108-6 52 14 54 72 0 48-54 72-52 14-108-6-62-38-82-92-26-80Z" fill="url(#g)" opacity=".15"/>
        <circle r="126" fill="#0d0714" stroke="url(#g)" stroke-width="5"/>
        <circle r="92" fill="#160a21" stroke="#f0c45a" stroke-opacity=".55" stroke-width="2"/>
        <text y="34" text-anchor="middle" font-family="Georgia" font-size="108" fill="url(#g)" filter="url(#glow)">${symbol}</text>
      </g>
      <text x="520" y="500" text-anchor="middle" font-family="Arial" font-size="18" letter-spacing="8" fill="#e8ddec" opacity=".7">${esc(title)}</text>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function moduleSvg(item) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
      <defs><radialGradient id="b" cx="72%" cy="32%" r="78%"><stop stop-color="${item.accent}" stop-opacity=".38"/><stop offset=".5" stop-color="#26103a"/><stop offset="1" stop-color="#07030d"/></radialGradient><linearGradient id="g"><stop stop-color="${item.accent}"/><stop offset="1" stop-color="#f3d27d"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity=".65"/></filter></defs>
      <rect width="1200" height="675" rx="30" fill="url(#b)"/>
      <g opacity=".2" fill="none" stroke="${item.accent}"><circle cx="930" cy="300" r="190"/><circle cx="930" cy="300" r="142"/><path d="M0 560C280 450 510 510 710 590S1050 650 1200 540" stroke-width="4"/></g>
      <g transform="translate(78 72)"><rect width="66" height="78" rx="14" fill="#120719" stroke="#f0c45a" stroke-width="2"/><text x="33" y="57" text-anchor="middle" font-family="Georgia" font-size="46" font-weight="700" fill="#f0c45a">P</text><text x="86" y="33" font-family="Arial" font-size="14" letter-spacing="6" fill="#d8cedd">TURMA DO PRIMO</text><text x="86" y="59" font-family="Arial" font-size="11" letter-spacing="4" fill="${item.accent}">MÓDULO EXCLUSIVO</text></g>
      <g transform="translate(80 300)" filter="url(#s)"><text font-family="Arial" font-size="22" font-weight="700" letter-spacing="8" fill="${item.accent}">MÓDULO</text><text y="92" font-family="Georgia" font-size="82" font-weight="700" fill="url(#g)">${item.title}</text><text y="137" font-family="Arial" font-size="16" letter-spacing="6" fill="#d9cedf">${item.subtitle}</text></g>
      <g transform="translate(930 300)"><circle r="116" fill="#0c0712" stroke="${item.accent}" stroke-width="4"/><circle r="82" fill="#180a23" stroke="#f0c45a" stroke-opacity=".7" stroke-width="2"/><text y="34" text-anchor="middle" font-family="Georgia" font-size="96" fill="url(#g)">${item.symbol}</text></g>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function currentNavPath(href) {
    if (href === "/dashboard" && (route === "/" || route === "/dashboard" || route === "/dashboard.html")) return true;
    if (href === "/estudo" && route.startsWith("/estudo")) return true;
    if (href === "/modulos" && route.startsWith("/modulos")) return true;
    if (href === "/roleta" && (route === "/roleta" || route === "/roleta.html" || route === "/roleta-reel")) return true;
    return route === href || route === `${href}.html`;
  }

  function normalizeSidebar() {
    if (route.includes("dashboard-free")) return;
    const host = $(".dash-nav,.notes-main-nav,.support-nav,.roulette-nav,.favorites-nav");
    if (!host || host.dataset.v10Nav) return;
    host.dataset.v10Nav = "1";
    host.innerHTML = nav.map(([href,label,icon]) => `<a class="dash-nav-item${currentNavPath(href) ? " active" : ""}" href="${href}"><svg><use href="/assets/dashboard-icons.svg#${icon}"></use></svg><b>${label}</b></a>`).join("");
    const side = host.closest("aside");
    if (side && !side.querySelector(".tp-v10-sidebar-spacer")) host.insertAdjacentHTML("afterend", '<div class="tp-v10-sidebar-spacer"></div>');
  }

  function normalizeNotes() {
    if (!route.startsWith("/notas")) return;
    $(".notes-title-group h1")?.replaceChildren(document.createTextNode("Anotações"));
    const title = $(".notes-title-group p");
    if (title) title.textContent = "Registre, organize e compartilhe seus estudos.";
    const tags = $("#noteTags");
    if (tags) tags.placeholder = "Adicionar tags...";
    const category = $("#noteCategory");
    if (category && !category.options.length) modules.forEach(item => category.add(new Option(item.title.charAt(0) + item.title.slice(1).toLowerCase(), item.title.charAt(0) + item.title.slice(1).toLowerCase())));
  }

  function identifyModule(element) {
    const text = normalize(`${element.textContent || ""} ${element.getAttribute?.("href") || ""} ${element.dataset?.module || ""}`);
    return modules.find(item => item.names.some(name => text.includes(normalize(name))));
  }

  function applyModuleCovers() {
    const cards = $$(".study-module-card,.module-video-item,[data-module],a[href*='estudo-']");
    cards.forEach(card => {
      const item = identifyModule(card);
      if (!item) return;
      const image = $(".study-module-art img,.module-video-cover img,img", card);
      if (!image || image.dataset.v10Cover === item.key) return;
      const src = moduleSvg(item);
      image.dataset.v10Cover = item.key;
      image.src = src;
      image.removeAttribute("srcset");
      image.alt = `Capa do módulo ${item.title}`;
      image.onerror = () => { image.src = src; };
    });
    const pathItem = modules.find(item => item.names.some(name => normalize(route).includes(normalize(name))));
    if (pathItem) {
      const heroImage = $(".strategy-hero .hero-art img,.module-hero img,.strategy-head img");
      if (heroImage && heroImage.dataset.v10Cover !== pathItem.key) {
        heroImage.dataset.v10Cover = pathItem.key;
        heroImage.src = moduleSvg(pathItem);
      }
    }
  }

  function insertHero() {
    const meta = pageMeta[route] || pageMeta[route.replace(/\.html$/, "")];
    if (!meta || $(".tp-v10-page-hero")) return;
    const host = $(".study-content,.modules-content,.bankroll-content,.support-content,.profile-content,.roulette-content,.roleta-content,.exam-content,.provas-content,.favorites-content,.dash-content");
    if (!host) return;
    const section = document.createElement("section");
    section.className = "tp-v10-page-hero";
    section.innerHTML = `<div class="tp-v10-copy"><span class="tp-v10-kicker">${meta.kicker}</span><h1>${meta.title}<br><strong>${meta.accent}</strong></h1><p>${meta.desc}</p></div><div class="tp-v10-art"><img src="${artSvg(meta.art,meta.kicker)}" alt=""></div>`;
    host.prepend(section);
  }

  function improveMinigames() {
    if (!route.startsWith("/minigames")) return;
    const image = $(".minigames-banner img");
    if (image) {
      image.src = artSvg("minigames", "ROLETA REEL");
      image.alt = "Roleta Reel — minigame exclusivo da Turma do Primo";
    }
    const heading = $(".minigames-heading");
    if (heading) heading.hidden = true;
    const button = $(".minigames-play");
    if (button) button.innerHTML = '<svg width="21" height="21"><use href="/assets/dashboard-icons.svg#i-game"></use></svg> Jogar Roleta Reel <span>→</span>';
  }

  function improveDashboard() {
    if (!(route === "/dashboard" || route === "/dashboard.html")) return;
    document.body.classList.add("tp-v10-dashboard");
    $(".dash-content")?.classList.add("tp-v10-dashboard-content");
    const host = $(".tp-v10-dashboard-grid");
    if (host && !host.dataset.v10Ready) {
      host.dataset.v10Ready = "1";
      const moduleData = [
        ["Gêmeos",75,"Ⅱ"],["Espelhos",60,"◇"],["Fibonacci",80,"Φ"],["Magneto",65,"∩"],["Camaleões",70,"◉"]
      ];
      const progress = $("#tpV10ModuleProgress");
      if (progress) progress.innerHTML = moduleData.map(([name,pct,symbol]) => `<article><span class="tp-v10-mini-icon">${symbol}</span><div><b>${name}</b><i style="--p:${pct}%"></i></div><small>${pct}%</small></article>`).join("");
    }
  }

  function loadPortraitForFree() {
    if (!route.includes("dashboard-free")) return;
    if (document.querySelector('script[data-v10-free-portrait]')) return;
    const hero = $(".free-hero");
    if (hero) hero.classList.add("dash-hero");
    const script = document.createElement("script");
    script.src = "/dashboard-portrait-final.js?v=20260803-v10";
    script.async = true;
    script.dataset.v10FreePortrait = "1";
    document.head.appendChild(script);
  }

  function fixNotifications() {
    $$('a[href="/notificacoes"],a[href="/notificacoes.html"]').forEach(link => {
      link.href = "#";
      link.dataset.notificationToggle = "1";
    });
  }

  function installBodyClass() {
    const clean = route.replace(/^\//, "").replace(/\.html$/, "") || "home";
    document.body.classList.add("tp-v10-ready", `tp-route-${clean.replace(/[^a-z0-9-]/g,"-")}`);
  }

  function observe() {
    let timer = 0;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { applyModuleCovers(); normalizeNotes(); improveMinigames(); }, 40);
    });
    observer.observe(document.body, { childList:true, subtree:true });
    setTimeout(() => observer.disconnect(), 12000);
  }

  function init() {
    installBodyClass();
    normalizeSidebar();
    normalizeNotes();
    applyModuleCovers();
    insertHero();
    improveMinigames();
    improveDashboard();
    loadPortraitForFree();
    fixNotifications();
    observe();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once:true }) : init();
})();
