"use strict";
(() => {
  if (window.__TURMA_STUDENT_SHELL_V7__) return;
  window.__TURMA_STUDENT_SHELL_V7__ = true;

  const PATH = (window.TurmaNavigation?.pathname || location.pathname).toLowerCase();
  const TARGETS = new Set(["/notas", "/perfil", "/provas", "/gestao", "/roleta", "/suporte"]);
  if (!TARGETS.has(PATH)) return;

  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const ICONS = "/assets/dashboard-icons.svg";
  const ROUTES = [
    ["/dashboard", "i-home", "Dashboard"],
    ["/estudo", "i-book", "Estudo"],
    ["/modulos", "i-layers", "Módulos"],
    ["/notas", "i-note", "Anotações"],
    ["/favoritos", "i-star", "Favoritos"],
    ["/roleta", "i-roulette", "Roleta Operacional"],
    ["/roleta-real", "i-roulette", "Roleta Real"],
    ["/provas", "i-exam", "Provas"],
    ["/gestao", "i-activity", "Gestão"],
    ["/suporte", "i-support", "Suporte"],
    ["/perfil", "i-user", "Perfil"],
  ];
  const TITLES = {
    "/notas": "Anotações", "/perfil": "Meu Perfil", "/provas": "Provas",
    "/gestao": "Gestão", "/roleta": "Roleta Operacional", "/suporte": "Suporte"
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function token() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of TOKEN_KEYS) {
        try { const value = storage.getItem(key); if (value) return value; } catch (_) {}
      }
    }
    return "";
  }
  function icon(name) { return `<svg aria-hidden="true"><use href="${ICONS}#${name}"></use></svg>`; }
  function navMarkup() {
    return ROUTES.map(([href, ico, label]) => `<a href="${href}" class="${PATH === href ? "is-active" : ""}" ${PATH === href ? 'aria-current="page"' : ""}>${icon(ico)}<span>${label}</span></a>`).join("");
  }
  function normalizeExistingLearnShell() {
    const nav = $(".learn-nav");
    if (!nav) return false;
    nav.innerHTML = navMarkup();
    return true;
  }
  function legacyMain() { return $(".dash-main") || $(".support-main") || $(".roulette-main"); }
  function injectShell() {
    if (normalizeExistingLearnShell()) {
      document.body.classList.add("tp-unified-v7", "tp-unified-v7-native");
      return;
    }
    const main = legacyMain();
    if (!main || $("#tpUnifiedSidebar")) return;
    document.body.classList.add("tp-unified-v7");
    main.classList.add("tp-unified-main");

    const backdrop = document.createElement("div");
    backdrop.id = "tpUnifiedBackdrop";
    backdrop.className = "learn-backdrop tp-unified-backdrop";
    backdrop.hidden = true;

    const sidebar = document.createElement("aside");
    sidebar.id = "tpUnifiedSidebar";
    sidebar.className = "learn-sidebar tp-unified-sidebar";
    sidebar.setAttribute("aria-label", "Menu principal");
    sidebar.innerHTML = `
      <a class="learn-brand" href="/dashboard"><img src="/assets/turma-primo-logo.svg" width="38" height="44" alt=""><span>TURMA DO<strong>PRIMO<span>·</span></strong></span></a>
      <button class="learn-close-menu" id="tpUnifiedClose" type="button" aria-label="Fechar menu">×</button>
      <div class="learn-space">${icon("i-book")}<span>Espaço do aluno<small>Aprenda no seu ritmo</small></span></div>
      <p class="learn-nav-label">SEU APRENDIZADO</p>
      <nav class="learn-nav">${navMarkup()}</nav>
      <div class="learn-sidebar-bottom">
        <a class="learn-support" href="/suporte">${icon("i-support")}<span>Precisa de uma ajuda?<small>Converse com o suporte</small></span>↗</a>
        <button class="learn-logout" id="tpUnifiedLogout" type="button">${icon("i-logout")}Sair da conta</button>
        <small class="learn-signature">CONHECIMENTO EM MOVIMENTO</small>
      </div>`;

    const topbar = document.createElement("header");
    topbar.id = "tpUnifiedTopbar";
    topbar.className = "learn-topbar tp-unified-topbar";
    topbar.innerHTML = `
      <button class="learn-icon-button learn-menu" id="tpUnifiedMenu" type="button" aria-label="Abrir menu" aria-expanded="false">${icon("i-menu")}</button>
      <div class="learn-breadcrumb"><a href="/dashboard">Meu espaço</a><span>/</span><strong>${TITLES[PATH] || "Turma do Primo"}</strong></div>
      <div class="learn-top-actions">
        <button class="learn-icon-button" id="tpUnifiedTheme" type="button" aria-label="Alternar tema">${icon("i-moon")}</button>
        <a class="learn-icon-button" href="/notificacoes" aria-label="Notificações">${icon("i-bell")}</a>
        <a class="learn-account" href="/perfil"><span id="tpUnifiedAvatar">P</span><span><strong id="tpUnifiedName">Aluno</strong><small>Meu perfil</small></span></a>
      </div>`;

    document.body.insertBefore(backdrop, document.body.firstChild);
    document.body.insertBefore(sidebar, main);
    main.insertBefore(topbar, main.firstChild);
    bindShell();
    loadIdentity();
  }
  function openMenu() {
    $("#tpUnifiedSidebar")?.classList.add("is-open");
    const backdrop = $("#tpUnifiedBackdrop"); if (backdrop) backdrop.hidden = false;
    $("#tpUnifiedMenu")?.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    $("#tpUnifiedSidebar")?.classList.remove("is-open");
    const backdrop = $("#tpUnifiedBackdrop"); if (backdrop) backdrop.hidden = true;
    $("#tpUnifiedMenu")?.setAttribute("aria-expanded", "false");
  }
  function clickLegacyTheme() {
    const selectors = {
      "/perfil": "#profileThemeToggle", "/provas": "#examThemeToggle", "/gestao": "#studyThemeToggle",
      "/roleta": "#rouletteThemeTop", "/suporte": "#themeButton"
    };
    const control = $(selectors[PATH] || "");
    if (control) return control.click();
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
  }
  async function logout() {
    const jwt = token();
    try { if (jwt) await fetch("/logout", { method: "POST", headers: { Authorization: `Bearer ${jwt}` }, keepalive: true }); } catch (_) {}
    for (const storage of [sessionStorage, localStorage]) for (const key of TOKEN_KEYS) try { storage.removeItem(key); } catch (_) {}
    location.replace("/");
  }
  function bindShell() {
    $("#tpUnifiedMenu")?.addEventListener("click", openMenu);
    $("#tpUnifiedClose")?.addEventListener("click", closeMenu);
    $("#tpUnifiedBackdrop")?.addEventListener("click", closeMenu);
    $("#tpUnifiedTheme")?.addEventListener("click", clickLegacyTheme);
    $("#tpUnifiedLogout")?.addEventListener("click", logout);
    addEventListener("resize", () => { if (innerWidth > 980) closeMenu(); });
  }
  async function loadIdentity() {
    const jwt = token(); if (!jwt) return;
    try {
      const response = await fetch("/me", { headers: { Accept: "application/json", Authorization: `Bearer ${jwt}` }, cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const user = data.usuario || data.user || data;
      const name = String(user.nome || "Aluno").trim();
      const first = name.split(/\s+/)[0] || "Aluno";
      $("#tpUnifiedName").textContent = first;
      const avatar = $("#tpUnifiedAvatar");
      const photo = String(user.foto || "").trim();
      if (photo) { avatar.textContent = ""; avatar.style.backgroundImage = `url("${photo.replaceAll('"', "%22")}")`; }
      else avatar.textContent = first.charAt(0).toUpperCase();
    } catch (_) {}
  }
  function normalizeExamCopy() {
    if (PATH !== "/provas") return;
    const cards = $$('[data-exam-card]');
    const primo = cards.find((card) => card.querySelector('[data-exam-locked="primo"]'));
    const daily = cards.find((card) => card.querySelector('[data-exam-locked="daily"]'));
    const weekly = cards.find((card) => card.querySelector('[data-exam-locked="weekly"]'));
    if (primo) { const meta = primo.querySelector(".exam-card-meta span"); if (meta) meta.innerHTML = `${icon("i-exam")}25 questões`; }
    if (daily) {
      const schedule = daily.querySelector(".exam-schedule"); if (schedule) schedule.innerHTML = `${icon("i-clock")}Segunda a sexta`;
      const meta = daily.querySelector(".exam-card-meta span"); if (meta) meta.innerHTML = `${icon("i-exam")}10 questões`;
    }
    if (weekly) { const meta = weekly.querySelector(".exam-card-meta span"); if (meta) meta.innerHTML = `${icon("i-exam")}20 questões`; }
  }

  function init() { injectShell(); normalizeExamCopy(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
