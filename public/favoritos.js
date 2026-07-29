"use strict";
(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const state = { user: null, home: null, notes: [], items: [], filter: "all", theme: "dark" };
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const firstName = (name) => String(name || "Usuário").trim().split(/\s+/)[0] || "Usuário";

  function token() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of TOKEN_KEYS) {
        try { const value = storage.getItem(key); if (value) return value; } catch (_) {}
      }
    }
    return "";
  }

  async function api(endpoint, options = {}) {
    const jwt = token();
    if (!jwt) throw new Error("Sessão expirada.");
    const response = await fetch(`${location.origin}${endpoint}`, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${jwt}`,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {})
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}.`);
    return data;
  }

  function toast(message, type = "success") {
    const stack = $("favoritesToastStack");
    if (!stack) return;
    const item = document.createElement("div");
    item.className = `favorites-toast ${type}`;
    item.textContent = message;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 3300);
  }

  function roleLabel(value) {
    return { dev: "Equipe", dono: "Equipe", superadmin: "Equipe", admin: "Equipe", suporte: "Suporte", aluno: "Aluno" }[String(value || "").toLowerCase()] || "Aluno";
  }

  function resolveTheme(value) {
    return value === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : (value === "light" ? "light" : "dark");
  }

  function applyTheme(value) {
    state.theme = value || "dark";
    const resolved = resolveTheme(state.theme);
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#07030d" : "#f2eff6");
    const use = $("favoritesThemeToggle")?.querySelector("use");
    if (use) use.setAttribute("href", `assets/dashboard-icons.svg#${resolved === "dark" ? "i-moon" : "i-sun"}`);
  }

  async function toggleTheme() {
    const next = (document.documentElement.dataset.theme || "dark") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { await api("/dashboard-premium/preferencias", { method: "PUT", body: { tema: next } }); } catch (_) {}
  }

  function setAvatar(user) {
    const photo = String(user?.foto || "").trim();
    $$('[data-favorites-avatar]').forEach((element) => {
      element.textContent = "";
      element.style.backgroundImage = `url("${(photo || "/assets/default-profile-user.svg?v=20260729-avatar-favorites").replaceAll('"', "%22")}")`;
      element.style.backgroundSize = "cover";
      element.style.backgroundPosition = "center";
    });
  }

  function fillHeader() {
    const home = state.home || {};
    const user = state.user || {};
    const plan = home.plano || {};
    $$('[data-favorites-name]').forEach((element) => { element.textContent = firstName(user.nome); });
    $$('[data-favorites-role]').forEach((element) => { element.textContent = roleLabel(user.cargo || user.tipo); });
    setAvatar(user);
    if ($("favoritesPlanName")) $("favoritesPlanName").textContent = plan.nome || "Turma do Primo";
    if ($("favoritesPlanLabel")) $("favoritesPlanLabel").textContent = plan.rotulo || "Acesso completo";
    const badge = $("favoritesNotificationBadge");
    const unread = Number(home.notificacoesNaoLidas || 0);
    if (badge) { badge.hidden = unread <= 0; badge.textContent = String(unread); }
  }

  function normalizeType(raw, target = "") {
    const value = `${raw || ""} ${target || ""}`.toLowerCase();
    if (/nota|anota/.test(value)) return "anotacao";
    if (/prova|exam/.test(value)) return "prova";
    if (/mini|game|zero for one|eclipse/.test(value)) return "minigame";
    if (/roleta|race|racetrack|fibonacci|ferrament/.test(value)) return /ferrament/.test(value) ? "ferramenta" : "roleta";
    if (/modul|estudo|aula|conteudo/.test(value)) return "modulo";
    return "modulo";
  }

  function routeFor(item) {
    const target = String(item.target || item.rota || item.url || "").trim();
    if (target.startsWith("/")) return target;
    const map = { modulo: "/modulos", anotacao: "/notas", prova: "/provas", roleta: "/roleta", minigame: "/minigames", ferramenta: "/roleta" };
    if (target && map[target]) return map[target];
    return map[item.type] || "/estudo";
  }

  function iconFor(type, item = {}) {
    const candidate = String(item.icon || "");
    if (candidate.startsWith("i-")) return candidate;
    return { modulo: "i-layers", anotacao: "i-note", prova: "i-exam", roleta: "i-roulette", minigame: "i-game", ferramenta: "i-settings" }[type] || "i-star";
  }

  function labelFor(type) {
    return { modulo: "MÓDULO", anotacao: "ANOTAÇÃO", prova: "PROVA", roleta: "ROLETA", minigame: "MINIGAME", ferramenta: "FERRAMENTA" }[type] || "FAVORITO";
  }

  function buildItems() {
    const raw = Array.isArray(state.home?.favoritos) ? state.home.favoritos : [];
    const fromHome = raw.map((item, index) => {
      const type = normalizeType(item.tipo || item.type || item.categoria, item.target || item.rota);
      return {
        id: String(item.id || item._id || `home-${index}`),
        type,
        title: item.title || item.titulo || item.nome || "Conteúdo favorito",
        description: item.description || item.descricao || item.resumo || "Conteúdo salvo na sua conta.",
        meta: item.meta || item.detalhe || item.progressoTexto || "Salvo na conta",
        icon: iconFor(type, item),
        href: routeFor({ ...item, type }),
        source: "home"
      };
    });

    const noteItems = state.notes.filter((note) => note.favorita).map((note) => ({
      id: String(note.id),
      type: "anotacao",
      title: note.titulo || "Anotação favorita",
      description: String(note.conteudo || "").slice(0, 150) || "Anotação salva na sua conta.",
      meta: "Anotação salva",
      icon: "i-note",
      href: "/notas",
      source: "note"
    }));

    const dedupe = new Map();
    [...fromHome, ...noteItems].forEach((item) => dedupe.set(`${item.source}:${item.id}`, item));
    state.items = Array.from(dedupe.values());
  }

  function renderStats() {
    const count = (types) => state.items.filter((item) => types.includes(item.type)).length;
    if ($("favoriteModulesCount")) $("favoriteModulesCount").textContent = String(count(["modulo"]));
    if ($("favoriteNotesCount")) $("favoriteNotesCount").textContent = String(count(["anotacao"]));
    if ($("favoriteExamsCount")) $("favoriteExamsCount").textContent = String(count(["prova"]));
    if ($("favoriteToolsCount")) $("favoriteToolsCount").textContent = String(count(["roleta", "minigame", "ferramenta"]));
  }

  function cardMarkup(item) {
    return `<article class="favorite-card ${esc(item.type)}" data-favorite-item="${esc(item.id)}" data-favorite-type="${esc(item.type)}">
      <div class="favorite-card-top"><span class="favorite-card-type">${esc(labelFor(item.type))}</span><span class="favorite-card-star" aria-hidden="true">★</span></div>
      <span class="favorite-card-icon"><svg><use href="assets/dashboard-icons.svg#${esc(item.icon)}"></use></svg></span>
      <h2>${esc(item.title)}</h2>
      <p>${esc(item.description)}</p>
      <footer class="favorite-card-footer"><span class="favorite-card-meta">${esc(item.meta)}</span><a class="favorite-card-open" href="${esc(item.href)}">Abrir <b>→</b></a></footer>
    </article>`;
  }

  function renderItems() {
    const grid = $("favoritesGrid");
    if (!grid) return;
    const visible = state.items.filter((item) => state.filter === "all" || item.type === state.filter || (state.filter === "roleta" && item.type === "ferramenta"));
    if (!visible.length) {
      grid.innerHTML = `<div class="favorites-empty"><span><svg><use href="assets/dashboard-icons.svg#i-star"></use></svg></span><strong>${state.items.length ? "Nenhum item nesta categoria" : "Nenhum favorito ainda"}</strong><p>${state.items.length ? "Escolha outro filtro para ver seus itens salvos." : "Marque anotações e conteúdos como favoritos para encontrá-los rapidamente nesta área."}</p><a href="/estudo">Explorar conteúdos →</a></div>`;
      return;
    }
    grid.innerHTML = visible.map(cardMarkup).join("");
  }

  function renderQuick() {
    const firstModule = state.items.find((item) => item.type === "modulo") || state.items[0];
    const popular = state.items[1] || state.items[0];
    if ($("favoritesContinueTitle")) $("favoritesContinueTitle").textContent = firstModule?.title || "Seus módulos";
    if ($("favoritesContinueText")) $("favoritesContinueText").textContent = firstModule ? "Continue pelos conteúdos que você salvou." : "Retome sua jornada de estudos.";
    if ($("favoritesPopularTitle")) $("favoritesPopularTitle").textContent = popular?.title || "Conteúdos salvos";
    if ($("favoritesPopularText")) $("favoritesPopularText").textContent = popular ? "Acesso rápido a um dos seus favoritos." : "Seus itens mais importantes aparecerão aqui.";
  }

  function renderAll() {
    buildItems();
    renderStats();
    renderItems();
    renderQuick();
    renderSearchResults("");
  }

  function setFilter(value) {
    state.filter = value || "all";
    $$('[data-favorite-filter]').forEach((button) => button.classList.toggle("active", button.dataset.favoriteFilter === state.filter));
    renderItems();
  }

  function openSidebar() {
    $("favoritesSidebar")?.classList.add("open");
    if ($("favoritesMobileOverlay")) $("favoritesMobileOverlay").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeSidebar() {
    $("favoritesSidebar")?.classList.remove("open");
    if ($("favoritesMobileOverlay")) $("favoritesMobileOverlay").hidden = true;
    document.body.style.removeProperty("overflow");
  }

  function openSearch() {
    const modal = $("favoritesSearchModal");
    if (!modal) return;
    modal.hidden = false;
    const input = $("favoritesSearchInput");
    if (input) { input.value = ""; setTimeout(() => input.focus(), 30); }
    renderSearchResults("");
  }

  function closeSearch() {
    if ($("favoritesSearchModal")) $("favoritesSearchModal").hidden = true;
  }

  function renderSearchResults(query) {
    const container = $("favoritesSearchResults");
    if (!container) return;
    const normalized = String(query || "").toLowerCase().trim();
    const list = state.items.filter((item) => !normalized || `${item.title} ${item.description} ${labelFor(item.type)}`.toLowerCase().includes(normalized)).slice(0, 18);
    container.innerHTML = list.length ? list.map((item) => `<a class="favorites-search-result" href="${esc(item.href)}"><span><svg><use href="assets/dashboard-icons.svg#${esc(item.icon)}"></use></svg></span><div><strong>${esc(item.title)}</strong><small>${esc(labelFor(item.type))} • ${esc(item.description)}</small></div></a>`).join("") : `<div class="favorites-empty" style="min-height:190px"><strong>Nenhum resultado</strong><p>Tente outro termo ou volte para todos os favoritos.</p></div>`;
  }

  function logout() {
    for (const storage of [sessionStorage, localStorage]) TOKEN_KEYS.forEach((key) => { try { storage.removeItem(key); } catch (_) {} });
    location.replace("/");
  }

  function registerEvents() {
    $("favoritesMenuToggle")?.addEventListener("click", openSidebar);
    $("favoritesMobileOverlay")?.addEventListener("click", closeSidebar);
    $("favoritesThemeToggle")?.addEventListener("click", toggleTheme);
    $("favoritesSearchTrigger")?.addEventListener("click", openSearch);
    $("favoritesLogout")?.addEventListener("click", logout);
    $("favoritesSearchInput")?.addEventListener("input", (event) => renderSearchResults(event.target.value));
    $("favoritesSearchModal")?.addEventListener("click", (event) => { if (event.target === $("favoritesSearchModal")) closeSearch(); });
    document.addEventListener("click", (event) => {
      const filter = event.target.closest("[data-favorite-filter]");
      if (filter) { event.preventDefault(); setFilter(filter.dataset.favoriteFilter); }
    });
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
      if (event.key === "Escape") { closeSearch(); closeSidebar(); }
    });
  }

  async function init() {
    registerEvents();
    try {
      const results = await Promise.allSettled([
        api("/dashboard-premium/home"),
        api("/dashboard-premium/notas")
      ]);
      if (results[0].status === "fulfilled") {
        state.home = results[0].value || {};
        state.user = state.home.usuario || {};
        state.theme = state.home.preferencias?.tema || "dark";
      } else {
        throw results[0].reason || new Error("Não foi possível carregar sua conta.");
      }
      if (results[1].status === "fulfilled") state.notes = results[1].value.notas || [];
      applyTheme(state.theme);
      fillHeader();
      renderAll();
    } catch (error) {
      toast(error.message || "Não foi possível carregar seus favoritos.", "error");
      state.items = [];
      renderStats();
      renderItems();
    } finally {
      setTimeout(() => $("favoritesLoading")?.remove(), 180);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
