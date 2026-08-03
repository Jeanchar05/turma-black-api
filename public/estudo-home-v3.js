"use strict";
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const cover = ({ title, subtitle, symbol, accent }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
      <defs>
        <radialGradient id="bg" cx="76%" cy="35%" r="78%"><stop stop-color="${accent}" stop-opacity=".42"/><stop offset=".52" stop-color="#28103d"/><stop offset="1" stop-color="#06030b"/></radialGradient>
        <linearGradient id="gold"><stop stop-color="#fff0a6"/><stop offset=".45" stop-color="#efc35c"/><stop offset="1" stop-color="${accent}"/></linearGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity=".68"/></filter>
      </defs>
      <rect width="1200" height="675" rx="34" fill="url(#bg)"/>
      <g fill="none" stroke="${accent}" opacity=".2"><circle cx="930" cy="320" r="190"/><circle cx="930" cy="320" r="145"/><circle cx="930" cy="320" r="98"/><path d="M0 565C270 455 520 515 725 585S1050 655 1200 545" stroke-width="4"/></g>
      <g transform="translate(72 62)"><rect width="70" height="82" rx="15" fill="#13081c" stroke="#efc35c" stroke-width="2"/><text x="35" y="59" text-anchor="middle" font-family="Georgia" font-size="48" font-weight="700" fill="#efc35c">P</text><text x="92" y="34" font-family="Arial" font-size="14" letter-spacing="6" fill="#e8deea">TURMA DO PRIMO</text><text x="92" y="61" font-family="Arial" font-size="11" letter-spacing="4" fill="${accent}">MÓDULO EXCLUSIVO</text></g>
      <g transform="translate(74 300)" filter="url(#shadow)"><text font-family="Arial" font-size="21" font-weight="700" letter-spacing="8" fill="${accent}">MÓDULO</text><text y="90" font-family="Georgia" font-size="82" font-weight="700" fill="url(#gold)">${title}</text><text y="137" font-family="Arial" font-size="16" letter-spacing="6" fill="#ded2e2">${subtitle}</text></g>
      <g transform="translate(930 320)"><circle r="120" fill="#0b0610" stroke="${accent}" stroke-width="5"/><circle r="84" fill="#180a23" stroke="#efc35c" stroke-opacity=".72" stroke-width="2"/><text y="35" text-anchor="middle" font-family="Georgia" font-size="94" fill="url(#gold)">${symbol}</text></g>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };

  const modules = [
    { id:"gemeos", name:"Gêmeos", desc:"Aprenda como 11, 22 e 33 ativam a família dos gêmeos.", image:cover({title:"GÊMEOS",subtitle:"11 · 22 · 33",symbol:"Ⅱ",accent:"#b45cff"}), href:"/estudo-gemeos", time:"12 rodadas" },
    { id:"espelhos", name:"Espelhos", desc:"Identifique números invertidos e monte regiões com vizinhos.", image:cover({title:"ESPELHOS",subtitle:"REFLEXO · INVERSÃO",symbol:"◇",accent:"#e4b84e"}), href:"/estudo-espelhos", time:"12 rodadas" },
    { id:"fibonacci", name:"Fibonacci", desc:"Calcule soma, subtração, terminais e congruências na Race.", image:cover({title:"FIBONACCI",subtitle:"SEQUÊNCIA · PROTEÇÃO",symbol:"Φ",accent:"#9b65ff"}), href:"/estudo-fibonacci", time:"12 rodadas" },
    { id:"magneto", name:"Magneto", desc:"Encontre conexões que atraem outros números pelo histórico.", image:cover({title:"MAGNETO",subtitle:"ATRAÇÃO · CONEXÃO",symbol:"∩",accent:"#55aaff"}), href:"/estudo-magneto", time:"12 rodadas" },
    { id:"camaleoes", name:"Camaleões", desc:"Revele grupos escondidos pela soma e subtração dos dígitos.", image:cover({title:"CAMALEÕES",subtitle:"ADAPTAÇÃO · LEITURA",symbol:"◉",accent:"#58d18b"}), href:"/estudo-camaleoes", time:"12 rodadas" },
    { id:"pitagoras", name:"Pitágoras", desc:"Conecte pontos e encontre o terceiro vértice na Race.", image:cover({title:"PITÁGORAS",subtitle:"TRIANGULAÇÃO",symbol:"△",accent:"#ff85b0"}), href:"/estudo-triangulacao", time:"Race interativa" },
    { id:"cavalo", name:"Cavalo", desc:"Treine as famílias 1·4·7, 2·5·8 e 3·6·9 e suas conexões.", image:cover({title:"CAVALO",subtitle:"1·4·7  2·5·8  3·6·9",symbol:"♞",accent:"#55b5ff"}), href:"/estudo-cavalos", time:"3 giros" },
    { id:"eclipse", name:"Eclipse Zero", desc:"Ative o Terminal 0 e use o Terminal 9 como proteção da leitura.", image:cover({title:"ECLIPSE ZERO",subtitle:"TERMINAIS 0 E 9",symbol:"◐",accent:"#efc354"}), href:"/estudo-eclipse-zero", time:"Desafio de 12s", tag:"Novo" }
  ];

  const stores = {
    gemeos:"study_espelhos_gemeos_v1", espelhos:"study_espelhos_v1", fibonacci:"study_fibonacci_v1",
    magneto:"study_magneto_v1", camaleoes:"study_camaleoes_v2", pitagoras:"study_triangulacao_v1",
    cavalo:"study_cavalos_v1", eclipse:"study_eclipse_zero_v1"
  };

  function progress(id) {
    try {
      const state = JSON.parse(localStorage.getItem(stores[id]) || "{}");
      const values = Object.values(state.progress || {});
      return values.length ? Math.round(values.filter(Boolean).length / Math.max(3, values.length) * 100) : 0;
    } catch { return 0; }
  }

  function isFavorite(id) {
    try { return localStorage.getItem(`study_favorite_${id}`) === "1"; } catch { return false; }
  }

  function card(module, index) {
    const pct = progress(module.id);
    return `<article class="study-module-card ${module.tag ? "is-new" : ""}" data-module-card data-module="${module.id}" data-progress="${pct}">
      <div class="study-module-art">
        <img src="${module.image}" alt="Capa do módulo ${module.name}">
        ${module.tag ? `<span class="study-module-badge">${module.tag}</span>` : ""}
        <button class="study-fav" type="button" data-fav="${module.id}" aria-label="Favoritar módulo ${module.name}"><svg><use href="/assets/dashboard-icons.svg#i-star"></use></svg></button>
      </div>
      <div class="study-module-body">
        <h2>${index + 1}. ${module.name}</h2>
        <p>${module.desc}</p>
        <div class="study-module-progress-row"><span>Seu progresso</span><strong>${pct}%</strong></div>
        <div class="study-module-progress"><i style="width:${pct}%"></i></div>
        <div class="study-module-meta"><span><svg><use href="/assets/dashboard-icons.svg#i-layers"></use></svg>3 experiências</span><span><svg><use href="/assets/dashboard-icons.svg#i-clock"></use></svg>${module.time}</span></div>
        <a class="study-open-module" href="${module.href}">Acessar módulo <b>→</b></a>
      </div>
    </article>`;
  }

  function updateSummary() {
    const done = modules.filter(module => progress(module.id) === 100).length;
    const started = modules.filter(module => progress(module.id) > 0 && progress(module.id) < 100).length;
    const average = Math.round(modules.reduce((sum, module) => sum + progress(module.id), 0) / modules.length);
    $(".study-home-state") && ($(".study-home-state").textContent = "8 módulos disponíveis");
    const metrics = $$(".study-metric strong");
    if (metrics[0]) metrics[0].textContent = "8";
    if (metrics[3]) metrics[3].textContent = `${done}/8`;
    $("#homeScore") && ($("#homeScore").textContent = `${average}%`);
    $("#homeScoreRing")?.style.setProperty("--score", `${average}%`);
    $("#homeStarted") && ($("#homeStarted").textContent = String(started));
    $("#homeCompletedSide") && ($("#homeCompletedSide").textContent = `${done}/8`);
  }

  function bind() {
    $$('[data-fav]').forEach(button => {
      const id = button.dataset.fav;
      button.setAttribute("aria-pressed", String(isFavorite(id)));
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const active = !isFavorite(id);
        try { localStorage.setItem(`study_favorite_${id}`, active ? "1" : "0"); } catch {}
        button.setAttribute("aria-pressed", String(active));
      });
    });

    $$('[data-study-filter]').forEach(button => button.addEventListener("click", () => {
      const filter = button.dataset.studyFilter;
      $$('[data-study-filter]').forEach(item => item.classList.toggle("active", item === button));
      $$('[data-module-card]').forEach(item => {
        const pct = Number(item.dataset.progress || 0);
        const id = item.dataset.module;
        item.hidden = (filter === "progress" && (pct === 0 || pct === 100)) || (filter === "done" && pct < 100) || (filter === "favorites" && !isFavorite(id));
      });
    }));

    $("#studyMenuToggle")?.addEventListener("click", () => {
      $("#studySidebar")?.classList.add("open");
      const overlay = $("#studyMobileOverlay");
      if (overlay) overlay.hidden = false;
    });
    $("#studyMobileOverlay")?.addEventListener("click", () => {
      $("#studySidebar")?.classList.remove("open");
      $("#studyMobileOverlay").hidden = true;
    });
  }

  function init() {
    try {
      const grid = $(".study-module-grid");
      if (grid) grid.innerHTML = modules.map(card).join("");
      updateSummary();
      bind();
    } finally {
      document.body.classList.add("protected-ready");
      $("#studyLoading")?.remove();
    }
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once:true }) : init();
})();
