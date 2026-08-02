"use strict";
(() => {
  if (window.__TURMA_PLATFORM_UPGRADE_V6__) return;
  window.__TURMA_PLATFORM_UPGRADE_V6__ = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const route = (location.pathname.replace(/\/$/, "") || "/").toLowerCase();
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const STUDY_KEYS = [
    ["study_espelhos_gemeos_v1", "gemeos"],
    ["study_espelhos_v1", "espelhos"],
    ["study_fibonacci_v1", "fibonacci"],
    ["study_magneto_v1", "magneto"],
    ["study_camaleoes_v2", "camaleoes"],
    ["study_triangulacao_v1", "pitagoras"],
    ["study_cavalos_v1", "cavalos"],
    ["study_eclipse_zero_v1", "eclipse-zero"]
  ];

  const MODULE_ASSETS = {
    gemeos: { card: "/assets/study/gemeos-card-ai-final-v1.svg", internal: "/assets/study/gemeos-hero-v2.svg" },
    espelhos: { card: "/assets/study/espelhos-module.webp", internal: "/assets/study/espelhos-module.webp" },
    fibonacci: { card: "/assets/study/fibonacci-card-v3.webp", internal: "/assets/study/fibonacci-module.webp" },
    magneto: { data: "/assets/study/final-data/magneto.js" },
    camaleoes: { data: "/assets/study/final-data/camaleoes.js" },
    pitagoras: { data: "/assets/study/final-data/pitagoras.js" },
    cavalos: { data: "/assets/study/final-data/cavalos-card.js" },
    "eclipse-zero": { card: "/assets/study/eclipse-zero-card.svg", internal: "/assets/study/eclipse-zero-module.svg" }
  };

  const token = () => {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of TOKEN_KEYS) {
        try { const value = storage.getItem(key); if (value) return value; } catch (_) {}
      }
    }
    return "";
  };

  function loadScript(src) {
    return new Promise((resolve) => {
      if (!src) return resolve();
      if ([...document.scripts].some(script => script.src.includes(src))) return resolve();
      const script = document.createElement("script");
      script.src = `${src}?v=20260802-upgrade-v6`;
      script.onload = script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }

  async function moduleAsset(id, type = "card") {
    const config = MODULE_ASSETS[id];
    if (!config) return "";
    if (config.data) {
      await loadScript(config.data);
      const value = window.TURMA_STUDY_IMAGES?.[id]?.[type];
      if (value) return value;
    }
    return config[type] || config.card || "";
  }

  function fixManagementIcons() {
    const selectors = [
      '.dash-nav-item[href="/gestao"]',
      '.dash-nav-item[data-nav="gestao"]',
      'a[href="/gestao"]',
      'button[data-nav="gestao"]'
    ];
    $$(selectors.join(",")).forEach(item => {
      let holder = item.querySelector("svg")?.parentElement || item.querySelector("svg");
      const old = item.querySelector("svg");
      const icon = document.createElement("span");
      icon.className = "tp-management-icon";
      icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2M3 10l6-6 6 9 6-7"/></svg>';
      if (old) old.replaceWith(icon);
      else if (!item.querySelector(".tp-management-icon")) item.prepend(icon);
      item.dataset.nav = item.dataset.nav || "gestao";
    });
  }

  function normalizeNotesHeader() {
    if (!document.body.classList.contains("notes-page")) return;
    document.title = "Anotações | Turma do Primo";
    const group = $(".notes-title-group");
    if (group) {
      group.querySelector("h1") && (group.querySelector("h1").textContent = "Anotações");
      group.querySelector("p") && (group.querySelector("p").textContent = "Seu caderno interativo de estudos.");
    }
    $$(".notes-main-nav a").forEach(link => {
      if (link.getAttribute("href") === "/notas") link.querySelector("span") && (link.querySelector("span").textContent = "Anotações");
    });
    $("#newNoteButton") && ($("#newNoteButton").innerHTML = "<span>＋</span> Nova anotação");
  }

  function notificationIcon(type) {
    return ({ premium:"i-crown", seguranca:"i-shield", prova:"i-exam", suporte:"i-support", agenda:"i-clock", atualizacao:"i-activity" }[type] || "i-bell");
  }

  let notifications = [];
  let notificationPanel = null;

  function notificationButtons() {
    return $$([
      "#notificationButton",
      '.dash-notification-btn[href="/notificacoes"]',
      '.roulette-notification[href="/notificacoes"]',
      '.favorites-notification[href="/notificacoes"]',
      'a[href="/notificacoes"]',
      '[data-notification-toggle]'
    ].join(","));
  }

  function ensureNotificationPanel() {
    if (notificationPanel) return notificationPanel;
    notificationPanel = document.createElement("aside");
    notificationPanel.className = "turma-notification-popover";
    notificationPanel.id = "turmaNotificationPopover";
    notificationPanel.hidden = true;
    notificationPanel.innerHTML = `
      <header class="turma-notification-head">
        <div><span>CENTRAL</span><h3>Notificações</h3></div>
        <button type="button" data-mark-all>Marcar como lidas</button>
      </header>
      <div class="turma-notification-list" data-notification-list></div>`;
    document.body.appendChild(notificationPanel);
    notificationPanel.querySelector("[data-mark-all]")?.addEventListener("click", markAllNotifications);
    notificationPanel.querySelector("[data-notification-list]")?.addEventListener("click", event => {
      const card = event.target.closest("[data-notification-id]");
      if (!card) return;
      markNotification(card.dataset.notificationId);
      const href = card.dataset.link;
      if (href && href !== "/notificacoes") location.href = href;
    });
    return notificationPanel;
  }

  function formatNotificationDate(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle:"short", timeStyle:"short" }).format(date);
  }

  function renderNotifications() {
    const panel = ensureNotificationPanel();
    const list = panel.querySelector("[data-notification-list]");
    const unread = notifications.filter(item => !item.lida).length;
    notificationButtons().forEach(button => {
      button.style.position = "relative";
      let badge = button.querySelector(".turma-notification-badge") || button.querySelector("b");
      if (!badge) {
        badge = document.createElement("b");
        button.appendChild(badge);
      }
      badge.classList.add("turma-notification-badge");
      badge.textContent = String(unread);
      badge.hidden = unread === 0;
    });
    if (!list) return;
    if (!notifications.length) {
      list.innerHTML = '<div class="turma-notification-empty">Nenhuma notificação no momento.<br>Os avisos enviados pelo painel administrativo aparecerão aqui.</div>';
      return;
    }
    list.innerHTML = notifications.map(item => `
      <article class="turma-notification-item ${item.lida ? "" : "unread"}" data-notification-id="${String(item.id || "")}" data-link="${String(item.link || "")}">
        <span class="turma-notification-icon"><svg><use href="/assets/dashboard-icons.svg#${notificationIcon(item.tipo)}"></use></svg></span>
        <div><strong>${String(item.titulo || "Notificação")}</strong><p>${String(item.mensagem || "")}</p><time>${formatNotificationDate(item.criadoEm || item.createdAt)}</time></div>
      </article>`).join("");
  }

  async function loadNotifications() {
    const access = token();
    if (!access) return renderNotifications();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch("/minhas-notificacoes", { headers:{ Authorization:`Bearer ${access}`, Accept:"application/json" }, cache:"no-store", signal:controller.signal });
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.notificacoes)) notifications = data.notificacoes;
    } catch (_) {} finally { clearTimeout(timer); renderNotifications(); }
  }

  async function markNotification(id) {
    const access = token();
    const item = notifications.find(value => String(value.id) === String(id));
    if (item) item.lida = true;
    renderNotifications();
    if (!access || !id) return;
    try { await fetch(`/notificacoes/${encodeURIComponent(id)}/lida`, { method:"POST", headers:{ Authorization:`Bearer ${access}`, "Content-Type":"application/json" } }); } catch (_) {}
  }

  async function markAllNotifications() {
    notifications.forEach(item => { item.lida = true; });
    renderNotifications();
    const access = token();
    if (!access) return;
    try { await fetch("/notificacoes/marcar-todas-lidas", { method:"POST", headers:{ Authorization:`Bearer ${access}`, "Content-Type":"application/json" } }); } catch (_) {}
  }

  function bindNotifications() {
    ensureNotificationPanel();
    notificationButtons().forEach(button => {
      if (button.dataset.notificationBound) return;
      button.dataset.notificationBound = "1";
      if (button.tagName === "A") button.removeAttribute("href");
      button.setAttribute("role", "button");
      button.setAttribute("aria-haspopup", "dialog");
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const panel = ensureNotificationPanel();
        panel.hidden = !panel.hidden;
        if (!panel.hidden) loadNotifications();
      });
    });
    document.addEventListener("click", event => {
      if (!notificationPanel || notificationPanel.hidden) return;
      if (notificationPanel.contains(event.target) || event.target.closest('[data-notification-bound="1"]')) return;
      notificationPanel.hidden = true;
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && notificationPanel) notificationPanel.hidden = true; });
    loadNotifications();
    setInterval(loadNotifications, 60000);
  }

  function readStudyProgress() {
    const completedVideo = (() => {
      try { const parsed = JSON.parse(localStorage.getItem("turma_video_lessons_completed_v1") || "[]"); return new Set(Array.isArray(parsed) ? parsed : []); } catch (_) { return new Set(); }
    })();
    const values = STUDY_KEYS.map(([key, id]) => {
      let percentage = completedVideo.has(id) ? 100 : 0;
      try {
        const state = JSON.parse(localStorage.getItem(key) || "{}");
        const progressValues = Object.values(state.progress || {});
        if (progressValues.length) percentage = Math.max(percentage, Math.round(progressValues.filter(Boolean).length / Math.max(3, progressValues.length) * 100));
      } catch (_) {}
      return { id, percentage: Math.min(100, percentage) };
    });
    return {
      values,
      done: values.filter(item => item.percentage >= 100).length,
      started: values.filter(item => item.percentage > 0 && item.percentage < 100).length,
      average: Math.round(values.reduce((sum, item) => sum + item.percentage, 0) / values.length)
    };
  }

  function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }

  function focusDays(user = {}) {
    const profileValue = Number(user.diasFoco ?? user.focusDays ?? user.sequenciaFoco ?? user.streak ?? 0);
    let history = [];
    try { history = JSON.parse(localStorage.getItem("turma_focus_history_v4") || "[]"); if (!Array.isArray(history)) history = []; } catch (_) {}
    if (/^\/estudo(?:-|$)|^\/modulos(?:$|\.html$)/.test(route)) {
      const today = localDate();
      if (!history.includes(today)) {
        history.push(today);
        try { localStorage.setItem("turma_focus_history_v4", JSON.stringify(history.slice(-365))); } catch (_) {}
      }
    }
    let streak = 0;
    const cursor = new Date();
    while (history.includes(localDate(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    return Math.max(profileValue, streak, history.length ? 1 : 0);
  }

  function averageScore(user = {}) {
    const fields = [user.mediaGeral, user.media, user.notaMedia, user.average, user.desempenho?.media, user.progresso?.media];
    const direct = fields.map(Number).find(value => Number.isFinite(value) && value >= 0);
    if (direct !== undefined) return direct;
    for (const key of ["turma_exam_results_v1", "examResults", "provas_resultados"]) {
      try {
        const entries = JSON.parse(localStorage.getItem(key) || "[]");
        if (!Array.isArray(entries) || !entries.length) continue;
        const grades = entries.map(item => Number(item.nota ?? item.score ?? item.media)).filter(Number.isFinite);
        if (grades.length) return grades.reduce((sum, value) => sum + value, 0) / grades.length;
      } catch (_) {}
    }
    return 0;
  }

  function syncDashboard(user = {}) {
    const progress = readStudyProgress();
    const focus = focusDays(user);
    const score = averageScore(user);
    const set = (selector, value) => $$(selector).forEach(element => { element.textContent = value; });
    set("#statModules", `${progress.done} / 8`);
    set("#statProgress", `${progress.average}%`);
    set("#statFocus", String(focus));
    set("#statAverage", score.toLocaleString("pt-BR", { minimumFractionDigits:1, maximumFractionDigits:1 }));
    set("#progressValue", `${progress.average}%`);
    set("#legendDone", `${progress.done}/8`);
    set("#legendStarted", String(progress.started));
    $("#progressRing")?.style.setProperty("--value", progress.average);
    set("[data-profile-modules]", `${progress.done}/8`);
    set("[data-profile-progress]", `${progress.average}%`);
    set("[data-profile-focus]", String(focus));
    set("[data-profile-average]", score.toLocaleString("pt-BR", { minimumFractionDigits:1, maximumFractionDigits:1 }));
    try { localStorage.setItem("turma_progress_snapshot_v1", JSON.stringify({ ...progress, focus, score, updatedAt:Date.now() })); } catch (_) {}
  }

  async function loadUserAndSync() {
    const access = token();
    if (!access) return syncDashboard({});
    try {
      const response = await fetch("/me", { headers:{ Authorization:`Bearer ${access}`, Accept:"application/json" }, cache:"no-store" });
      const data = await response.json().catch(() => ({}));
      syncDashboard(data.usuario || data.user || {});
    } catch (_) { syncDashboard({}); }
  }

  async function repairModulesPage() {
    if (!document.body.classList.contains("modules-page")) return;
    const apply = async () => {
      for (const button of $$("[data-module-id]")) {
        const id = button.dataset.moduleId;
        const image = button.querySelector(".module-video-cover img");
        const src = await moduleAsset(id, "card");
        if (image && src && image.src !== src) {
          image.hidden = false;
          image.src = src;
          image.onerror = () => { image.hidden = true; image.closest(".module-video-cover")?.classList.add("study-broken-image"); };
        }
      }
      const selected = $("[data-module-id].active")?.dataset.moduleId || localStorage.getItem("turma_video_lesson_selected_v1") || "gemeos";
      const player = $("#modulesPlayerFrame");
      const cover = await moduleAsset(selected, "card");
      if (player && cover && !player.querySelector("iframe")) {
        player.classList.add("has-module-cover");
        player.style.backgroundImage = `url("${cover}")`;
      }
    };
    await apply();
    const observer = new MutationObserver(apply);
    $("#modulesList") && observer.observe($("#modulesList"), { childList:true, subtree:true, attributes:true, attributeFilter:["class"] });
    document.addEventListener("click", event => { if (event.target.closest("[data-module-id]")) setTimeout(apply, 30); });
  }

  async function repairStudyHero() {
    if (!/^\/estudo-/.test(route)) return;
    const moduleId = route.includes("gemeos") ? "gemeos" : route.includes("espelho") ? "espelhos" : route.includes("fibonacci") ? "fibonacci" : route.includes("magneto") ? "magneto" : route.includes("camaleo") ? "camaleoes" : (route.includes("triang") || route.includes("pitag")) ? "pitagoras" : route.includes("cavalo") ? "cavalos" : route.includes("eclipse") ? "eclipse-zero" : "";
    if (!moduleId) return;
    const src = await moduleAsset(moduleId, "card");
    const heroArt = $(".strategy-hero .hero-art");
    if (!heroArt || !src) return;
    heroArt.classList.remove("study-final-hidden-art");
    heroArt.style.display = "block";
    let image = heroArt.querySelector("img");
    if (!image) { image = document.createElement("img"); heroArt.replaceChildren(image); }
    image.src = src;
    image.alt = "Capa oficial do módulo";
    image.style.cssText = "width:100%;height:100%;object-fit:cover;object-position:center;display:block";
  }

  function ensureThemeButtons() {
    ["#rouletteThemeTop", "#examThemeToggle", "#favoritesThemeToggle"].forEach(selector => {
      const button = $(selector);
      if (!button || button.dataset.globalTheme) return;
      button.dataset.globalTheme = "1";
    });
  }

  function init() {
    normalizeNotesHeader();
    fixManagementIcons();
    ensureThemeButtons();
    bindNotifications();
    loadUserAndSync();
    repairModulesPage();
    setTimeout(repairStudyHero, 500);
    setTimeout(() => { fixManagementIcons(); normalizeNotesHeader(); repairModulesPage(); repairStudyHero(); }, 1500);
    window.addEventListener("storage", event => {
      if (event.key?.startsWith("study_") || ["turma_video_lessons_completed_v1", "turma_focus_history_v4"].includes(event.key)) loadUserAndSync();
    });
    document.addEventListener("turma:protected-ready", event => syncDashboard(event.detail?.user || {}));
    document.addEventListener("turma:progress-sync", () => loadUserAndSync());
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once:true }) : init();
})();
