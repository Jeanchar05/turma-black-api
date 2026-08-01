"use strict";
(() => {
  const MODULES = [
    { id: "gemeos", name: "Gêmeos", href: "/estudo-gemeos", store: "study_espelhos_gemeos_v1" },
    { id: "espelhos", name: "Espelhos", href: "/estudo-espelhos", store: "study_espelhos_v1" },
    { id: "fibonacci", name: "Fibonacci", href: "/estudo-fibonacci", store: "study_fibonacci_v1" },
    { id: "magneto", name: "Magneto", href: "/estudo-magneto", store: "study_magneto_v1" },
    { id: "camaleoes", name: "Camaleões", href: "/estudo-camaleoes", store: "study_camaleoes_v2" },
    { id: "pitagoras", name: "Pitágoras", href: "/estudo-triangulacao", store: "study_triangulacao_v1" }
  ];

  let syncing = false;
  let scheduled = false;
  let lastSignature = "";

  function moduleProgress(module) {
    try {
      const state = JSON.parse(localStorage.getItem(module.store) || "{}");
      const values = Object.values(state.progress || {});
      return values.length ? Math.round(values.filter(Boolean).length / Math.max(3, values.length) * 100) : 0;
    } catch (_) {
      return 0;
    }
  }

  function selectedModules() {
    return MODULES.filter(module => localStorage.getItem(`study_favorite_${module.id}`) === "1");
  }

  function cardMarkup(module) {
    return `<article class="favorite-card modulo" data-sync-study-favorite="${module.id}" data-favorite-type="modulo">
      <div class="favorite-card-top"><span class="favorite-card-type">MÓDULO DE ESTUDO</span><span class="favorite-card-star">★</span></div>
      <span class="favorite-card-icon"><svg><use href="assets/dashboard-icons.svg#i-book"></use></svg></span>
      <h2>${module.name}</h2>
      <p>Módulo favoritado na Central de Estudos.</p>
      <footer class="favorite-card-footer"><span class="favorite-card-meta">${moduleProgress(module)}% concluído</span><a class="favorite-card-open" href="${module.href}">Abrir <b>→</b></a></footer>
    </article>`;
  }

  function setEmptyState(hidden) {
    document.body.classList.toggle("has-study-favorites", hidden);
    document.querySelectorAll(".favorites-empty").forEach(empty => {
      if (hidden) {
        empty.dataset.hiddenByStudy = "1";
        empty.hidden = true;
        empty.setAttribute("aria-hidden", "true");
        empty.style.setProperty("display", "none", "important");
      } else if (empty.dataset.hiddenByStudy === "1") {
        delete empty.dataset.hiddenByStudy;
        empty.hidden = false;
        empty.removeAttribute("aria-hidden");
        empty.style.removeProperty("display");
      }
    });
  }

  function sync() {
    if (syncing) return;
    const grid = document.getElementById("favoritesGrid");
    if (!grid) return;

    syncing = true;
    const favorites = selectedModules();
    const desired = new Map(favorites.map(module => [module.id, module]));

    const grouped = new Map();
    grid.querySelectorAll("[data-sync-study-favorite]").forEach(card => {
      const id = card.dataset.syncStudyFavorite;
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(card);
    });

    grouped.forEach((cards, id) => {
      if (!desired.has(id)) {
        cards.forEach(card => card.remove());
        return;
      }
      cards.slice(1).forEach(card => card.remove());
    });

    favorites.forEach(module => {
      if (!grid.querySelector(`[data-sync-study-favorite="${module.id}"]`)) {
        grid.insertAdjacentHTML("beforeend", cardMarkup(module));
      }
    });

    const hasFavorites = favorites.length > 0;
    grid.classList.toggle("has-study-favorites", hasFavorites);
    grid.dataset.hasStudyFavorites = hasFavorites ? "1" : "0";
    setEmptyState(hasFavorites);

    const moduleCounter = document.getElementById("favoriteModulesCount");
    if (moduleCounter) moduleCounter.textContent = String(favorites.length);

    lastSignature = favorites.map(module => module.id).join("|");
    syncing = false;
  }

  function scheduleSync() {
    if (scheduled || syncing) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      sync();
    });
  }

  function init() {
    const style = document.createElement("style");
    style.textContent = `
      body.has-study-favorites .favorites-empty{display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important}
      #favoritesGrid.has-study-favorites{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(250px,320px))!important;align-items:start!important;gap:18px!important}
    `;
    document.head.appendChild(style);

    sync();

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(() => {
      const signature = selectedModules().map(module => module.id).join("|");
      if (signature !== lastSignature || document.querySelector("body.has-study-favorites .favorites-empty:not([hidden])")) sync();
    }, 400);

    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    document.addEventListener("click", event => {
      if (event.target.closest("[data-favorite-filter], [data-fav]")) setTimeout(sync, 30);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
