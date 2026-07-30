"use strict";
(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const state = { home: null, user: null, theme: "dark" };
  const firstName = (name) => String(name || "Usuário").trim().split(/\s+/)[0] || "Usuário";
  const roleLabel = (value) => ({ dev:"Equipe", dono:"Equipe", superadmin:"Equipe", admin:"Equipe", suporte:"Suporte", moderador:"Moderador", vendedor:"Vendedor", aluno:"Aluno" }[String(value || "").toLowerCase()] || "Aluno");

  function token() {
    for (const storage of [sessionStorage, localStorage]) for (const key of TOKEN_KEYS) {
      try { const value = storage.getItem(key); if (value) return value; } catch (_) {}
    }
    return "";
  }

  async function api(endpoint, options = {}) {
    const jwt = token();
    if (!jwt) throw new Error("Sessão expirada.");
    const response = await fetch(`${location.origin}${endpoint}`, {
      method: options.method || "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${jwt}`, ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}.`);
    return data;
  }

  function toast(message, type = "success") {
    const stack = $("rouletteToastStack"); if (!stack) return;
    const item = document.createElement("div"); item.className = `roulette-toast ${type}`; item.textContent = message; stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 3200);
  }

  function setAvatar(user) {
    const photo = String(user?.foto || "").trim() || "/assets/default-profile-user.svg?v=20260729-roulette-avatar";
    $$('[data-roulette-avatar]').forEach((element) => {
      element.textContent = "";
      element.style.backgroundImage = `url("${photo.replaceAll('"','%22')}")`;
      element.style.backgroundSize = "cover";
      element.style.backgroundPosition = "center";
    });
  }

  function resolveTheme(value) {
    return value === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : (value === "light" ? "light" : "dark");
  }

  function applyTheme(value) {
    state.theme = value || "dark";
    const resolved = resolveTheme(state.theme);
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#07030d" : "#f2eff6");
    const use = $("rouletteThemeToggle")?.querySelector("use");
    if (use) use.setAttribute("href", `assets/dashboard-icons.svg#${resolved === "dark" ? "i-moon" : "i-sun"}`);
  }

  async function toggleTheme() {
    const next = (document.documentElement.dataset.theme || "dark") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { await api("/dashboard-premium/preferencias", { method: "PUT", body: { tema: next } }); } catch (_) {}
  }

  function fillHeader() {
    const home = state.home || {}, user = state.user || {}, plan = home.plano || {};
    $$('[data-roulette-name]').forEach((el) => el.textContent = firstName(user.nome));
    $$('[data-roulette-role]').forEach((el) => el.textContent = roleLabel(user.cargo || user.tipo));
    setAvatar(user);
    if ($("roulettePlanName")) $("roulettePlanName").textContent = plan.nome || "Turma do Primo";
    if ($("roulettePlanLabel")) $("roulettePlanLabel").textContent = plan.rotulo || "Acesso completo";
    const unread = Number(home.notificacoesNaoLidas || 0), badge = $("rouletteNotificationBadge");
    if (badge) { badge.hidden = unread <= 0; badge.textContent = String(unread); }
  }

  function openSidebar() { $("rouletteSidebar")?.classList.add("open"); if ($("rouletteMobileOverlay")) $("rouletteMobileOverlay").hidden = false; document.body.style.overflow = "hidden"; }
  function closeSidebar() { $("rouletteSidebar")?.classList.remove("open"); if ($("rouletteMobileOverlay")) $("rouletteMobileOverlay").hidden = true; document.body.style.removeProperty("overflow"); }
  function openSearch() { const modal = $("rouletteSearchModal"); if (!modal) return; modal.hidden = false; const input = $("rouletteSearchInput"); if (input) { input.value = ""; setTimeout(() => input.focus(), 25); } renderSearch(""); }
  function closeSearch() { if ($("rouletteSearchModal")) $("rouletteSearchModal").hidden = true; }

  const searchItems = [
    ["EsportivaBet","Plataforma utilizada pela Turma do Primo","i-roulette","https://go.aff.esportiva.bet/aeg41h8f",true],
    ["Roleta Ao Vivo","Mesas ao vivo na EsportivaBet","i-roulette","https://go.aff.esportiva.bet/aeg41h8f",true],
    ["Mesas Clássicas","Opções tradicionais de roleta","i-target","https://go.aff.esportiva.bet/aeg41h8f",true],
    ["Mesas VIP","Confira as mesas disponíveis","i-crown","https://go.aff.esportiva.bet/aeg41h8f",true],
    ["Race","Ferramenta interna da Turma","i-roulette","#race",false],
    ["Racetrack","Tabela operacional 0–36","i-target","#racetrack",false],
    ["Leituras e Padrões","Conteúdos de estudo","i-chart","/estudo",false],
    ["Módulos de Roleta","Trilha de aprendizado","i-book","/modulos",false]
  ];

  function renderSearch(query) {
    const container = $("rouletteSearchResults"); if (!container) return;
    const q = String(query || "").trim().toLowerCase();
    const items = searchItems.filter(([title, desc]) => !q || `${title} ${desc}`.toLowerCase().includes(q));
    container.innerHTML = items.map(([title, desc, icon, href, external]) => `<a class="roulette-search-result" href="${href}" ${external ? 'target="_blank" rel="noopener sponsored"' : ""}><span><svg><use href="assets/dashboard-icons.svg#${icon}"></use></svg></span><div><strong>${title}</strong><small>${desc}</small></div></a>`).join("") || `<div style="padding:28px;text-align:center;color:#94899b;font-size:11px">Nenhum resultado encontrado.</div>`;
  }

  function logout() {
    for (const storage of [sessionStorage, localStorage]) TOKEN_KEYS.forEach((key) => { try { storage.removeItem(key); } catch (_) {} });
    location.replace("/");
  }

  function registerEvents() {
    $("rouletteMenuToggle")?.addEventListener("click", openSidebar);
    $("rouletteMobileOverlay")?.addEventListener("click", closeSidebar);
    $("rouletteThemeToggle")?.addEventListener("click", toggleTheme);
    $("rouletteSearchTrigger")?.addEventListener("click", openSearch);
    $("rouletteLogout")?.addEventListener("click", logout);
    $("rouletteSearchInput")?.addEventListener("input", (event) => renderSearch(event.target.value));
    $("rouletteSearchModal")?.addEventListener("click", (event) => { if (event.target === $("rouletteSearchModal")) closeSearch(); });
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
      if (event.key === "Escape") { closeSearch(); closeSidebar(); }
    });
    document.addEventListener("click", (event) => {
      const tool = event.target.closest("[data-roulette-tool]");
      if (!tool) return;
      event.preventDefault();
      toast(`${tool.dataset.rouletteTool} está preparado para a próxima integração.`);
    });
  }

  async function init() {
    registerEvents();
    try {
      state.home = await api("/dashboard-premium/home");
      state.user = state.home?.usuario || {};
      state.theme = state.home?.preferencias?.tema || "dark";
      applyTheme(state.theme);
      fillHeader();
    } catch (error) {
      applyTheme("dark");
      toast(error.message || "Não foi possível carregar os dados da conta.", "error");
    } finally {
      setTimeout(() => $("rouletteLoading")?.remove(), 180);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();