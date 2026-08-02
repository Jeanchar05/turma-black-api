"use strict";
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const modules = [
    { id: "gemeos", name: "Gêmeos", desc: "Aprenda como 11, 22 e 33 ativam a família dos gêmeos.", image: "/assets/study/gemeos-card-v3.webp", href: "/estudo-gemeos", time: "12 rodadas" },
    { id: "espelhos", name: "Espelhos", desc: "Identifique números invertidos e monte regiões com vizinhos.", image: "/assets/study/espelhos-module.webp", href: "/estudo-espelhos", time: "12 rodadas" },
    { id: "fibonacci", name: "Fibonacci", desc: "Calcule soma, subtração, terminais e congruências na Race.", image: "/assets/study/fibonacci-card-v3.webp", href: "/estudo-fibonacci", time: "12 rodadas" },
    { id: "magneto", name: "Magneto", desc: "Encontre conexões que atraem outros números pelo histórico.", image: "/assets/study/magneto-card-v1.svg", href: "/estudo-magneto", time: "12 rodadas" },
    { id: "camaleoes", name: "Camaleões", desc: "Revele grupos escondidos pela soma e subtração dos dígitos.", image: "/assets/study/camaleoes-card-v1.svg", href: "/estudo-camaleoes", time: "12 rodadas" },
    { id: "pitagoras", name: "Pitágoras", desc: "Conecte pontos e encontre o terceiro vértice na Race.", image: "/assets/study/triangulacao-card-v1.svg", href: "/estudo-triangulacao", time: "Race interativa" },
    { id: "eclipse", name: "Eclipse Zero", desc: "Ative o Terminal 0 e use o Terminal 9 como proteção da leitura.", image: "/assets/study/eclipse-zero-card.svg", href: "/estudo-eclipse-zero", time: "Desafio de 12s", tag: "Novo" }
  ];

  const stores = {
    gemeos: "study_espelhos_gemeos_v1",
    espelhos: "study_espelhos_v1",
    fibonacci: "study_fibonacci_v1",
    magneto: "study_magneto_v1",
    camaleoes: "study_camaleoes_v2",
    pitagoras: "study_triangulacao_v1",
    eclipse: "study_eclipse_zero_v1"
  };

  function progress(id) {
    try {
      const state = JSON.parse(localStorage.getItem(stores[id]) || "{}");
      const values = Object.values(state.progress || {});
      return values.length ? Math.round(values.filter(Boolean).length / Math.max(3, values.length) * 100) : 0;
    } catch (_) {
      return 0;
    }
  }

  function isFavorite(id) {
    try { return localStorage.getItem(`study_favorite_${id}`) === "1"; }
    catch (_) { return false; }
  }

  function card(module, index) {
    const pct = progress(module.id);
    return `<article class="study-module-card ${module.tag ? "is-new" : ""}" data-module-card data-module="${module.id}" data-progress="${pct}">
      <div class="study-module-art">
        <img src="${module.image}?v=20260801-study-stable" alt="Capa do módulo ${module.name}" loading="lazy">
        ${module.tag ? `<span class="study-module-badge">${module.tag}</span>` : ""}
        <button class="study-fav" type="button" data-fav="${module.id}" aria-label="Favoritar módulo"><svg><use href="assets/dashboard-icons.svg#i-star"></use></svg></button>
      </div>
      <div class="study-module-body">
        <h2>${index + 1}. ${module.name}</h2>
        <p>${module.desc}</p>
        <div class="study-module-progress-row"><span>Seu progresso</span><strong>${pct}%</strong></div>
        <div class="study-module-progress"><i style="width:${pct}%"></i></div>
        <div class="study-module-meta"><span><svg><use href="assets/dashboard-icons.svg#i-layers"></use></svg>3 experiências</span><span><svg><use href="assets/dashboard-icons.svg#i-clock"></use></svg>${module.time}</span></div>
        <a class="study-open-module" href="${module.href}">Acessar módulo <b>→</b></a>
      </div>
    </article>`;
  }

  function bind() {
    $$('[data-fav]').forEach(button => {
      const id = button.dataset.fav;
      button.setAttribute("aria-pressed", String(isFavorite(id)));
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const enabled = !isFavorite(id);
        try { localStorage.setItem(`study_favorite_${id}`, enabled ? "1" : "0"); } catch (_) {}
        button.setAttribute("aria-pressed", String(enabled));
      });
    });

    $$('[data-study-filter]').forEach(button => {
      button.addEventListener("click", () => {
        const filter = button.dataset.studyFilter;
        $$('[data-study-filter]').forEach(item => item.classList.toggle("active", item === button));
        $$('[data-module-card]').forEach(card => {
          const pct = Number(card.dataset.progress || 0);
          const id = card.dataset.module;
          card.hidden = (filter === "progress" && (pct === 0 || pct === 100)) ||
            (filter === "done" && pct < 100) ||
            (filter === "favorites" && !isFavorite(id));
        });
      });
    });

    $("#studyMenuToggle")?.addEventListener("click", () => $("#studySidebar")?.classList.add("open"));
    $("#studyMobileOverlay")?.addEventListener("click", () => $("#studySidebar")?.classList.remove("open"));
  }

  function render() {
    const grid = $(".study-module-grid");
    if (!grid) return;
    grid.innerHTML = modules.map(card).join("");
    bind();

    const done = modules.filter(module => progress(module.id) === 100).length;
    const average = Math.round(modules.reduce((sum, module) => sum + progress(module.id), 0) / modules.length);
    $(".study-home-state") && ($(".study-home-state").textContent = `${modules.length} módulos disponíveis`);
    const metrics = $$(".study-metric strong");
    if (metrics[0]) metrics[0].textContent = String(modules.length);
    if (metrics[3]) metrics[3].textContent = `${done}/${modules.length}`;
    if ($("#homeScore")) $("#homeScore").textContent = `${average}%`;
    $("#homeScoreRing")?.style.setProperty("--score", `${average}%`);
    if ($("#homeCompletedSide")) $("#homeCompletedSide").textContent = `${done}/${modules.length}`;
  }

  function init() {
    try { render(); }
    finally {
      document.body?.classList.add("protected-ready");
      document.getElementById("studyLoading")?.remove();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();