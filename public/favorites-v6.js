"use strict";
(() => {
  if (window.__TURMA_FAVORITES_V6__) return;
  window.__TURMA_FAVORITES_V6__ = true;
  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  if (route() !== "/favoritos") return;

  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const cover = (slug) => ({ dark: `/assets/modules-v4/${slug}-dark.webp`, light: `/assets/modules-v4/${slug}-light.webp` });
  const MODULES = {
    gemeos: { name: "Gêmeos", href: "/estudo-gemeos", category: "Famílias", cover: cover("gemeos") },
    espelhos: { name: "Espelhos", href: "/estudo-espelhos", category: "Conexões", cover: cover("espelhos") },
    fibonacci: { name: "Fibonacci", href: "/estudo-fibonacci", category: "Cálculos", cover: cover("fibonacci") },
    magneto: { name: "Magneto", href: "/estudo-magneto", category: "Conexões", cover: cover("magneto") },
    camaleoes: { name: "Camaleões", href: "/estudo-camaleoes", category: "Cálculos", cover: cover("camaleoes") },
    pitagoras: { name: "Pitágoras", href: "/estudo-triangulacao", category: "Famílias", cover: cover("pitagoras") },
    cavalo: { name: "Cavalo", href: "/estudo-cavalos", category: "Famílias", cover: cover("cavalo") },
    eclipse: { name: "Eclipse", href: "/estudo-eclipse", category: "Leitura", cover: { dark: "/assets/modules-v4/eclipse-zero-dark.webp", light: "/assets/modules-v4/eclipse-zero-light.webp" } }
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const theme = () => document.documentElement.dataset.theme === "light" ? "light" : "dark";
  let accountId = "";
  let study = null;

  function token() {
    for (const storage of [sessionStorage, localStorage]) for (const key of TOKEN_KEYS) { try { const value = storage.getItem(key); if (value) return value; } catch (_) {} }
    return "";
  }
  async function api(path, options = {}) {
    const jwt = token();
    const response = await fetch(path, {
      method: options.method || "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${jwt}`, ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}`);
    return data;
  }
  function opId(moduleId) { return `fav:${moduleId}:${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`; }

  function removeLegacyMinigame() {
    $('[data-favorite-filter="minigame"]')?.remove();
    $$('.favorite-card.minigame').forEach((card) => card.remove());
  }

  function card(moduleId, entry) {
    const module = MODULES[moduleId];
    if (!module) return "";
    const done = Array.isArray(entry.steps) ? entry.steps.length : 0;
    const initialCover = module.cover[theme()];
    return `<article class="favorite-card modulo favorites-v6-module" data-study-favorite="${esc(moduleId)}">
      <img class="favorites-v6-cover" data-cover-dark="${esc(module.cover.dark)}" data-cover-light="${esc(module.cover.light)}" src="${esc(initialCover)}" alt="Capa do módulo ${esc(module.name)}" loading="lazy" style="display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:18px;margin:0 0 18px;">
      <div class="favorite-card-top"><span class="favorite-card-type">MÓDULO DE ESTUDO</span><button class="favorites-v6-remove" type="button" data-remove-study-favorite="${esc(moduleId)}" title="Remover dos favoritos">★</button></div>
      <h2>${esc(module.name)}</h2><p>${esc(module.category)} • Conteúdo salvo diretamente da sua trilha de estudos.</p>
      <footer class="favorite-card-footer"><span class="favorite-card-meta">${done}/3 etapas concluídas</span><a class="favorite-card-open" href="${esc(module.href)}">Continuar <b>→</b></a></footer>
    </article>`;
  }

  function syncCovers() {
    const key = theme() === "light" ? "coverLight" : "coverDark";
    $$(".favorites-v6-cover").forEach((img) => {
      const src = img.dataset[key];
      if (src && img.getAttribute("src") !== src) img.src = src;
    });
  }

  function render() {
    const grid = $("#favoritesGrid");
    if (!grid || !study?.modules) return;
    removeLegacyMinigame();
    $$("[data-study-favorite]", grid).forEach((item) => item.remove());
    const favorites = Object.entries(study.modules).filter(([id, entry]) => MODULES[id] && entry?.favorite);
    if (favorites.length) {
      const empty = $(".favorites-empty", grid); if (empty && !grid.querySelector(".favorite-card")) empty.remove();
      grid.insertAdjacentHTML("beforeend", favorites.map(([id, entry]) => card(id, entry)).join(""));
    }
    const moduleCount = $("#favoriteModulesCount");
    if (moduleCount) {
      const legacyModules = $$(".favorite-card.modulo:not(.favorites-v6-module)", grid).length;
      moduleCount.textContent = String(legacyModules + favorites.length);
    }
    syncCovers();
  }

  async function removeFavorite(moduleId, button) {
    if (!accountId || !study?.modules?.[moduleId]) return;
    button.disabled = true;
    try {
      const data = await api("/study/state", {
        method: "POST",
        headers: { "X-Study-Account": accountId },
        body: { operations: [{ id: opId(moduleId), module: moduleId, kind: "patch", fields: { favorite: false } }] }
      });
      study = data.state || study;
      render();
    } catch (_) { button.disabled = false; }
  }

  async function init() {
    removeLegacyMinigame();
    try {
      const [me, stateData] = await Promise.all([api("/me"), api("/study/state")]);
      accountId = String(me.usuario?.id || me.usuario?._id || me.id || me._id || "");
      study = stateData.state || null;
      render();
      setTimeout(render, 450);
      setTimeout(render, 1200);
    } catch (_) {}
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-study-favorite]");
      if (button) { event.preventDefault(); removeFavorite(button.dataset.removeStudyFavorite, button); }
    });
    window.addEventListener("turma:theme-change", syncCovers);
    new MutationObserver(syncCovers).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();