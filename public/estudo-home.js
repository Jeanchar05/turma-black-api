"use strict";
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const EMPTY_ART = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'%3E%3Crect width='1600' height='900' fill='%2307030d'/%3E%3C/svg%3E";

  const modules = [
    { id: "gemeos", name: "Gêmeos", desc: "Aprenda como 11, 22 e 33 ativam a família dos gêmeos, como montar a entrada e quando a leitura reseta.", payload: "/assets/study/gemeos-card-v4.base64?v=20260801-7", fallback: "/assets/study/gemeos-card-v3.webp?v=20260801-7", href: "/estudo-gemeos" },
    { id: "espelhos", name: "Espelhos", desc: "Identifique números invertidos, monte a região com 3 vizinhos e proteja a repetição do número atual.", payload: "/assets/study/espelhos-card-v5.base64?v=20260801-7", fallback: "/assets/study/espelhos-module.webp?v=20260801-7", href: "/estudo-espelhos" },
    { id: "fibonacci", name: "Fibonacci", desc: "Calcule soma e subtração da timeline, acompanhe terminais e encontre congruências na Race.", payload: "/assets/study/fibonacci-card-v4.base64?v=20260801-7", fallback: "/assets/study/fibonacci-card-v3.webp?v=20260801-7", href: "/estudo-fibonacci" },
    { id: "magneto", name: "Magneto", desc: "Identifique conexões que atraem outros números e confirme a força da leitura pelo histórico.", payload: "/assets/study/magneto-card-exact.base64?v=20260801-3", fallback: "/assets/study/magneto-card-v1.svg?v=20260801-3", href: "/estudo-magneto" },
    { id: "camaleoes", name: "Camaleões", desc: "Use soma e subtração dos dígitos para revelar grupos escondidos e números ausentes.", payload: "/assets/study/camaleoes-card-exact.base64?v=20260801-7", fallback: "/assets/study/camaleoes-card-v1.svg?v=20260801-7", href: "/estudo-camaleoes" },
    { id: "pitagoras", name: "Pitágoras", desc: "Conecte dois pontos, reconheça famílias geométricas e encontre o terceiro vértice na Race.", payload: "/assets/study/triangulacao-card-exact.base64?v=20260801-pitagoras-3", fallback: EMPTY_ART, href: "/estudo-triangulacao" }
  ];

  const stores = {
    gemeos: "study_espelhos_gemeos_v1",
    espelhos: "study_espelhos_v1",
    fibonacci: "study_fibonacci_v1",
    magneto: "study_magneto_v1",
    camaleoes: "study_camaleoes_v2",
    pitagoras: "study_triangulacao_v1"
  };

  function state(id) {
    try { return JSON.parse(localStorage.getItem(stores[id]) || "{}"); }
    catch { return {}; }
  }

  function pct(id) {
    const progress = state(id).progress || {};
    const values = Object.values(progress);
    return values.length ? Math.round(values.filter(Boolean).length / Math.max(3, values.length) * 100) : 0;
  }

  function mime(base64) {
    if (base64.startsWith("UklG")) return "image/webp";
    if (base64.startsWith("/9j/")) return "image/jpeg";
    if (base64.startsWith("iVBOR")) return "image/png";
    return "";
  }

  function card(module, index) {
    const progress = pct(module.id);
    const label = progress === 100 ? "Concluído" : progress > 0 ? "Em andamento" : "Disponível";
    return `
      <article class="study-module-card" data-module-card data-module="${module.id}" data-progress="${progress}">
        <div class="study-module-art">
          <img src="${module.fallback}" data-card-payload="${module.payload}" data-card-fallback="${module.fallback}" alt="Capa premium do módulo ${module.name}">
          <span class="study-module-badge">${label}</span>
          <button class="study-fav" type="button" data-fav="${module.id}" aria-label="Favoritar módulo"><svg><use href="assets/dashboard-icons.svg#i-star"></use></svg></button>
        </div>
        <div class="study-module-body">
          <h2>${index + 1}. ${module.name}</h2>
          <p>${module.desc}</p>
          <div class="study-module-progress-row"><span>Progresso do módulo</span><strong>${progress}% concluído</strong></div>
          <div class="study-module-progress"><i style="width:${progress}%"></i></div>
          <div class="study-module-meta">
            <span><svg><use href="assets/dashboard-icons.svg#i-layers"></use></svg>3 etapas</span>
            <span><svg><use href="assets/dashboard-icons.svg#i-clock"></use></svg>12 rodadas</span>
          </div>
          <a class="study-open-module" href="${module.href}">Acessar módulo <b>→</b></a>
        </div>
      </article>`;
  }

  async function hydrate() {
    await Promise.all($$("[data-card-payload]").map(async img => {
      img.onerror = () => { img.onerror = null; img.src = img.dataset.cardFallback || EMPTY_ART; };
      try {
        const response = await fetch(`${img.dataset.cardPayload}&t=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
        if (!response.ok) throw new Error("asset indisponível");
        const base64 = (await response.text()).trim();
        const type = mime(base64);
        if (!type) throw new Error("formato inválido");
        img.src = `data:${type};base64,${base64}`;
      } catch {
        img.src = img.dataset.cardFallback || EMPTY_ART;
      }
    }));
  }

  function favKey(id) { return `study_favorite_${id}`; }

  function bind() {
    $$("[data-fav]").forEach(button => {
      const id = button.dataset.fav;
      button.setAttribute("aria-pressed", String(localStorage.getItem(favKey(id)) === "1"));
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        const enabled = localStorage.getItem(favKey(id)) !== "1";
        localStorage.setItem(favKey(id), enabled ? "1" : "0");
        button.setAttribute("aria-pressed", String(enabled));
      };
    });
  }

  function render() {
    const grid = $(".study-module-grid");
    if (!grid) return;
    grid.innerHTML = modules.map(card).join("");
    hydrate();
    bind();

    const total = modules.length;
    const done = modules.filter(module => pct(module.id) === 100).length;
    const average = Math.round(modules.reduce((sum, module) => sum + pct(module.id), 0) / total);
    if ($(".study-home-state")) $(".study-home-state").textContent = `${total} módulos disponíveis`;
    const metrics = $$(".study-metric strong");
    if (metrics[0]) metrics[0].textContent = total;
    if (metrics[3]) metrics[3].textContent = `${done}/${total}`;
    if ($("#homeScore")) $("#homeScore").textContent = `${average}%`;
    $("#homeScoreRing")?.style.setProperty("--score", `${average}%`);
    if ($("#homeCompletedSide")) $("#homeCompletedSide").textContent = `${done}/${total}`;
  }

  function token() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of KEYS) {
        try { const value = storage.getItem(key); if (value) return value; } catch {}
      }
    }
    return "";
  }

  async function fill() {
    try {
      const response = await fetch("/dashboard-premium/home", { headers: { Authorization: `Bearer ${token()}` }, cache: "no-store" });
      const data = await response.json();
      const user = data.usuario || {};
      $$("[data-study-name]").forEach(element => element.textContent = String(user.nome || "Primo").split(/\s+/)[0]);
      $$("[data-study-role]").forEach(element => element.textContent = user.cargo || user.tipo || "Aluno");
    } catch {}
  }

  function init() {
    render();
    fill();
    $("#studyMenuToggle")?.addEventListener("click", () => $("#studySidebar")?.classList.add("open"));
    $("#studyMobileOverlay")?.addEventListener("click", () => $("#studySidebar")?.classList.remove("open"));
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();