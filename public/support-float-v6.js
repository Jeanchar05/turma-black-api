"use strict";
(() => {
  if (window.__TURMA_SUPPORT_FLOAT_V6__) return;
  window.__TURMA_SUPPORT_FLOAT_V6__ = true;

  const STORAGE_KEY = "turma_support_float_v6";
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const state = { ticket: null, tickets: [], poller: null, suspended: false, minimized: true, open: false, unread: 0, lastMessageId: "" };

  function token() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of TOKEN_KEYS) {
        try { const value = storage.getItem(key); if (value) return value; } catch (_) {}
      }
    }
    return "";
  }

  async function api(path, options = {}) {
    const jwt = token();
    if (!jwt) throw new Error("Sessão expirada.");
    const response = await fetch(path, {
      method: options.method || "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${jwt}`, ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}`);
    return data;
  }

  function loadUiState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      state.suspended = Boolean(saved.suspended);
      state.minimized = saved.minimized !== false;
      state.open = Boolean(saved.open);
      state.ticketId = String(saved.ticketId || "");
      state.lastMessageId = String(saved.lastMessageId || "");
    } catch (_) {}
  }

  function saveUiState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        suspended: state.suspended,
        minimized: state.minimized,
        open: state.open,
        ticketId: state.ticket?.id || state.ticketId || "",
        lastMessageId: state.lastMessageId || ""
      }));
    } catch (_) {}
  }

  function formatDate(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function statusLabel(status) {
    return { aberto: "Aberto", em_atendimento: "Em atendimento", respondido: "Respondido", resolvido: "Resolvido", fechado: "Fechado" }[status] || "Atendimento";
  }

  function activeTicket(list) {
    const open = list.filter((item) => !["resolvido", "fechado"].includes(item.status));
    if (state.ticketId) return list.find((item) => item.id === state.ticketId) || open[0] || list[0] || null;
    return open[0] || list[0] || null;
  }

  function inject() {
    if ($("#supportFloatV6")) return;
    const host = document.createElement("div");
    host.id = "supportFloatV6";
    host.className = "support-float-v6";
    host.innerHTML = `
      <button class="support-float-launcher" id="supportFloatLauncher" type="button" aria-label="Abrir atendimento">
        <span class="support-float-pulse"></span><b>?</b><span>Suporte</span><i id="supportFloatBadge" hidden>0</i>
      </button>
      <section class="support-float-panel" id="supportFloatPanel" hidden aria-label="Chat de suporte">
        <header class="support-float-head">
          <div><span id="supportFloatCode">SUPORTE</span><strong id="supportFloatTitle">Atendimento</strong><small id="supportFloatStatus">Carregando…</small></div>
          <div class="support-float-controls">
            <button type="button" data-support-action="suspend" title="Suspender atualizações">Ⅱ</button>
            <button type="button" data-support-action="minimize" title="Deixar no canto">—</button>
            <button type="button" data-support-action="close" title="Fechar">×</button>
          </div>
        </header>
        <div class="support-float-suspended" id="supportFloatSuspended" hidden><span>Ⅱ</span><div><strong>Atendimento suspenso</strong><small>As atualizações automáticas estão pausadas.</small></div><button type="button" data-support-action="resume">Retomar</button></div>
        <div class="support-float-body" id="supportFloatBody">
          <div class="support-float-empty">Carregando conversa…</div>
        </div>
        <form class="support-float-reply" id="supportFloatReply">
          <textarea id="supportFloatInput" maxlength="3000" rows="1" placeholder="Escreva uma mensagem…"></textarea>
          <button type="submit" aria-label="Enviar">➤</button>
        </form>
        <footer><a href="/suporte">Abrir Central de Suporte ↗</a><small id="supportFloatFooter">Atualização automática ativa</small></footer>
      </section>`;
    document.body.appendChild(host);

    $("#supportFloatLauncher")?.addEventListener("click", () => {
      state.open = true;
      state.minimized = false;
      saveUiState();
      renderVisibility();
      refreshTicket(true);
    });
    host.addEventListener("click", (event) => {
      const action = event.target.closest("[data-support-action]")?.dataset.supportAction;
      if (!action) return;
      if (action === "suspend") { state.suspended = true; state.open = true; state.minimized = false; stopPolling(); }
      if (action === "resume") { state.suspended = false; state.open = true; state.minimized = false; refreshTicket(true); startPolling(); }
      if (action === "minimize") { state.minimized = true; state.open = false; }
      if (action === "close") { state.open = false; state.minimized = true; state.unread = 0; }
      saveUiState();
      renderVisibility();
    });
    $("#supportFloatReply")?.addEventListener("submit", sendReply);
    $("#supportFloatInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("#supportFloatReply")?.requestSubmit(); }
    });
  }

  function renderVisibility() {
    const panel = $("#supportFloatPanel");
    const launcher = $("#supportFloatLauncher");
    if (!panel || !launcher) return;
    panel.hidden = !state.open || state.minimized;
    launcher.hidden = state.open && !state.minimized;
    $("#supportFloatSuspended").hidden = !state.suspended;
    $("#supportFloatReply").hidden = state.suspended || !state.ticket || ["resolvido", "fechado"].includes(state.ticket.status);
    $("#supportFloatFooter").textContent = state.suspended ? "Atualizações pausadas" : "Atualização automática ativa";
    const badge = $("#supportFloatBadge");
    if (badge) { badge.hidden = state.unread <= 0; badge.textContent = String(Math.min(99, state.unread)); }
  }

  function renderTicket() {
    const ticket = state.ticket;
    if (!ticket) {
      $("#supportFloatCode").textContent = "CENTRAL DE SUPORTE";
      $("#supportFloatTitle").textContent = "Nenhum chamado ativo";
      $("#supportFloatStatus").textContent = "Abra um chamado quando precisar";
      $("#supportFloatBody").innerHTML = '<div class="support-float-empty"><strong>Precisa de ajuda?</strong><span>Abra um chamado pela Central de Suporte e a conversa ficará disponível aqui.</span><a href="/suporte">Abrir chamado →</a></div>';
      renderVisibility();
      return;
    }
    $("#supportFloatCode").textContent = `CHAMADO #${ticket.id.slice(-6).toUpperCase()}`;
    $("#supportFloatTitle").textContent = ticket.assunto || "Atendimento";
    $("#supportFloatStatus").textContent = `${statusLabel(ticket.status)} • ${ticket.atendenteNome ? `com ${ticket.atendenteNome}` : "aguardando equipe"}`;
    const messages = Array.isArray(ticket.respostas) ? ticket.respostas : [];
    const body = $("#supportFloatBody");
    body.innerHTML = messages.length ? messages.map((message) => {
      const mine = message.tipo === "usuario";
      const system = message.tipo === "sistema";
      return `<article class="support-float-message ${mine ? "mine" : "team"} ${system ? "system" : ""}"><strong>${esc(system ? "Sistema" : mine ? "Você" : (message.autorNome || "Equipe Turma do Primo"))}</strong><p>${esc(message.mensagem).replaceAll("\n", "<br>")}</p><small>${esc(formatDate(message.criadoEm))}</small></article>`;
    }).join("") : '<div class="support-float-empty">A conversa aparecerá aqui.</div>';
    const last = messages[messages.length - 1];
    if (last?.id && state.lastMessageId && last.id !== state.lastMessageId && !state.open && last.tipo === "equipe") state.unread += 1;
    if (last?.id) state.lastMessageId = last.id;
    saveUiState();
    if (!state.minimized) requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
    renderVisibility();
  }

  async function loadTickets() {
    try {
      const data = await api("/meus-chamados");
      state.tickets = Array.isArray(data.chamados) ? data.chamados : [];
      const chosen = activeTicket(state.tickets);
      state.ticketId = chosen?.id || state.ticketId || "";
      if (!chosen) { state.ticket = null; renderTicket(); return; }
      await refreshTicket(false);
    } catch (_) {}
  }

  async function refreshTicket(force = false) {
    if (state.suspended && !force) return;
    const id = state.ticket?.id || state.ticketId || activeTicket(state.tickets)?.id;
    if (!id) return loadTickets();
    try {
      const data = await api(`/suporte/${encodeURIComponent(id)}`);
      state.ticket = data.chamado || null;
      state.ticketId = state.ticket?.id || id;
      renderTicket();
    } catch (_) {}
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!state.ticket?.id || state.suspended) return;
    const input = $("#supportFloatInput");
    const message = String(input?.value || "").trim();
    if (!message) return;
    const button = $("#supportFloatReply button");
    button.disabled = true;
    try {
      await api(`/suporte/${encodeURIComponent(state.ticket.id)}/responder`, { method: "POST", body: { mensagem: message } });
      input.value = "";
      await refreshTicket(true);
    } catch (_) {
      input.placeholder = "Não foi possível enviar. Tente novamente.";
    } finally { button.disabled = false; }
  }

  function stopPolling() {
    clearInterval(state.poller);
    state.poller = null;
  }

  function startPolling() {
    stopPolling();
    if (state.suspended) return;
    state.poller = setInterval(() => {
      if (!document.hidden) refreshTicket(false);
    }, state.open && !state.minimized ? 5000 : 12000);
  }

  async function init() {
    if (!token()) return;
    loadUiState();
    inject();
    renderVisibility();
    await loadTickets();
    if (state.open && !state.minimized) await refreshTicket(true);
    startPolling();
    document.addEventListener("visibilitychange", () => { if (!document.hidden && !state.suspended) refreshTicket(false); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
