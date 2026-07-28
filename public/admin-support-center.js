"use strict";
(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const state = { tickets: [], feedbacks: [], current: null, poller: null, user: null, activeTab: "tickets" };
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function token() { for (const key of TOKEN_KEYS) { try { const value = sessionStorage.getItem(key); if (value) return value; } catch (_) {} } return ""; }
  async function api(endpoint, options = {}) {
    const response = await fetch(`${location.origin}${endpoint}`, {
      method: options.method || "GET",
      headers: { Accept: options.accept || "application/json", Authorization: `Bearer ${token()}`, ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    if (options.raw) return response;
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}.`);
    return data;
  }

  function toast(message, type = "success") {
    const stack = $("adminToastStack");
    if (!stack) return;
    const item = document.createElement("div");
    item.className = `admin-toast ${type}`;
    item.innerHTML = `<b>${type === "error" ? "!" : "✓"}</b><span>${esc(message)}</span>`;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 3800);
  }

  function formatDate(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function relative(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "";
    const min = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `há ${hours} h`;
    return `há ${Math.floor(hours / 24)} dia(s)`;
  }

  function statusLabel(status) { return { aberto: "Aberto", em_atendimento: "Em atendimento", respondido: "Respondido", resolvido: "Resolvido", fechado: "Fechado" }[status] || status || "Aberto"; }

  function supportMarkup() {
    return `
      <div class="admin-section-head"><div><span class="admin-kicker">ATENDIMENTO ONLINE</span><h2>Central de Suporte</h2><p>Assuma tickets, converse com alunos em tempo real e acompanhe feedbacks da plataforma.</p></div><div class="admin-support-tabs"><button class="active" type="button" data-support-tab="tickets">Tickets</button><button type="button" data-support-tab="feedback">Feedbacks</button></div></div>
      <div class="admin-support-view" id="supportTicketsView">
        <div class="admin-mini-stat-grid"><article><small>Abertos</small><strong id="supportCenterOpen">0</strong></article><article><small>Em atendimento</small><strong id="supportCenterProgress">0</strong></article><article><small>Respondidos</small><strong id="supportCenterAnswered">0</strong></article><article><small>Urgentes</small><strong id="supportCenterUrgent">0</strong></article></div>
        <div class="admin-panel-card"><div class="admin-filterbar"><div class="admin-search"><span>⌕</span><input id="supportCenterSearch" type="search" placeholder="Buscar aluno, e-mail ou assunto" /></div><select id="supportCenterStatus"><option value="">Todos os status</option><option value="aberto">Abertos</option><option value="em_atendimento">Em atendimento</option><option value="respondido">Respondidos</option><option value="resolvido">Resolvidos</option><option value="fechado">Fechados</option></select><select id="supportCenterPriority"><option value="">Todas as prioridades</option><option value="urgente">Urgente</option><option value="alta">Alta</option><option value="normal">Normal</option><option value="baixa">Baixa</option></select><button class="admin-secondary-btn" type="button" id="supportCenterRefresh">↻ Atualizar</button></div>
          <div class="admin-support-board"><div class="admin-support-queue" id="supportCenterList"><div class="admin-empty-state">Carregando chamados…</div></div><aside class="admin-support-side"><div class="admin-support-side-card"><small>FILA ATUAL</small><h3>Distribuição</h3><div class="admin-support-agent-list" id="supportAgentList"></div></div><div class="admin-support-side-card"><small>ORIENTAÇÃO</small><h3>Fluxo de atendimento</h3><p>Abra o ticket, assuma o atendimento, responda o aluno e altere o status para resolvido quando concluir.</p></div></aside></div>
        </div>
      </div>
      <div class="admin-support-view" id="supportFeedbackView" hidden>
        <div class="admin-panel-card"><div class="admin-filterbar"><select id="feedbackCenterStatus"><option value="">Todos os feedbacks</option><option value="novo">Novos</option><option value="lido">Lidos</option><option value="planejado">Planejados</option><option value="concluido">Concluídos</option><option value="arquivado">Arquivados</option></select><button class="admin-secondary-btn" type="button" id="feedbackCenterRefresh">↻ Atualizar</button></div><div class="admin-support-feedback-list" id="supportFeedbackList"><div class="admin-empty-state">Carregando feedbacks…</div></div></div>
      </div>`;
  }

  function ensureUI() {
    const section = $("section-support");
    if (!section || section.dataset.supportEnhanced === "1") return;
    section.dataset.supportEnhanced = "1";
    section.innerHTML = supportMarkup();
    const oldModal = $("supportModal");
    if (oldModal) oldModal.remove();
    const modal = document.createElement("div");
    modal.className = "admin-support-chat-modal";
    modal.id = "adminSupportChatModal";
    modal.hidden = true;
    modal.innerHTML = `<div class="admin-support-chat-card"><header><div><small id="adminSupportCode">CHAMADO</small><h2 id="adminSupportTitle">Atendimento</h2><div id="adminSupportMeta"></div></div><button type="button" data-admin-support-close>×</button></header><div class="admin-support-chat-tools"><button type="button" id="adminSupportAssume">Assumir atendimento</button><select id="adminSupportStatus"><option value="aberto">Aberto</option><option value="em_atendimento">Em atendimento</option><option value="respondido">Respondido</option><option value="resolvido">Resolvido</option><option value="fechado">Fechado</option></select><button type="button" id="adminSupportSaveStatus">Atualizar status</button><span id="adminSupportAgent"></span></div><div class="admin-support-thread" id="adminSupportThread"></div><div class="admin-support-files" id="adminSupportFiles"></div><form class="admin-support-reply" id="adminSupportReplyForm"><textarea id="adminSupportReply" rows="4" maxlength="5000" placeholder="Responder ao aluno…" required></textarea><div><button class="admin-primary-btn" type="submit">Enviar resposta</button></div></form></div>`;
    document.body.appendChild(modal);
  }

  function registerEvents() {
    document.addEventListener("click", (event) => {
      const nav = event.target.closest('[data-section="support"]');
      if (nav) setTimeout(() => { ensureUI(); loadTickets(); }, 60);
      const tab = event.target.closest("[data-support-tab]");
      if (tab) switchTab(tab.dataset.supportTab);
      if (event.target.closest("#supportCenterRefresh")) loadTickets(true);
      if (event.target.closest("#feedbackCenterRefresh")) loadFeedback(true);
      const open = event.target.closest("[data-support-open]");
      if (open) openTicket(open.dataset.supportOpen);
      const assume = event.target.closest("[data-support-assume]");
      if (assume) assumeTicket(assume.dataset.supportAssume);
      if (event.target.closest("[data-admin-support-close]")) closeModal();
      if (event.target.closest("#adminSupportAssume")) assumeTicket(state.current?.id);
      if (event.target.closest("#adminSupportSaveStatus")) updateStatus(state.current?.id, $("adminSupportStatus")?.value);
      const file = event.target.closest("[data-admin-file]");
      if (file) downloadFile(file.dataset.adminFile, file.dataset.fileName);
      const feedback = event.target.closest("[data-feedback-status]");
      if (feedback) updateFeedback(feedback.dataset.feedbackStatus, feedback.value);
    }, true);

    document.addEventListener("input", (event) => { if (event.target.id === "supportCenterSearch") debounce(loadTickets); });
    document.addEventListener("change", (event) => {
      if (["supportCenterStatus", "supportCenterPriority"].includes(event.target.id)) loadTickets();
      if (event.target.id === "feedbackCenterStatus") loadFeedback();
    });
    document.addEventListener("submit", (event) => { if (event.target.id === "adminSupportReplyForm") { event.preventDefault(); submitReply(); } }, true);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
  }

  let timer;
  function debounce(callback) { clearTimeout(timer); timer = setTimeout(callback, 300); }

  function switchTab(tab) {
    state.activeTab = tab;
    $$('[data-support-tab]').forEach((button) => button.classList.toggle("active", button.dataset.supportTab === tab));
    if ($("supportTicketsView")) $("supportTicketsView").hidden = tab !== "tickets";
    if ($("supportFeedbackView")) $("supportFeedbackView").hidden = tab !== "feedback";
    if (tab === "feedback") loadFeedback(); else loadTickets();
  }

  async function loadContext() {
    try { const data = await api("/admin/painel/contexto"); state.user = data.usuario || {}; } catch (_) {}
  }

  async function loadTickets(showToast = false) {
    ensureUI();
    if (!$("supportCenterList")) return;
    try {
      const search = encodeURIComponent($("supportCenterSearch")?.value.trim() || "");
      const status = encodeURIComponent($("supportCenterStatus")?.value || "");
      const priority = encodeURIComponent($("supportCenterPriority")?.value || "");
      const [summary, list] = await Promise.all([api("/admin/suporte/resumo"), api(`/admin/suporte?busca=${search}&status=${status}&prioridade=${priority}&limite=300`)]);
      const data = summary.resumo || {};
      $("supportCenterOpen").textContent = data.abertos || 0;
      $("supportCenterProgress").textContent = data.atendimento || 0;
      $("supportCenterAnswered").textContent = data.respondidos || 0;
      $("supportCenterUrgent").textContent = data.urgentes || 0;
      const badge = $("supportMenuBadge"); if (badge) { badge.textContent = String(data.abertos || 0); badge.hidden = !Number(data.abertos); }
      state.tickets = list.chamados || [];
      renderTickets(); renderAgents();
      if (showToast) toast("Fila atualizada.");
    } catch (error) { $("supportCenterList").innerHTML = `<div class="admin-empty-state">${esc(error.message)}</div>`; }
  }

  function renderTickets() {
    $("supportCenterList").innerHTML = state.tickets.length ? state.tickets.map((ticket) => `
      <article class="admin-support-ticket"><span>☏</span><div><strong>${esc(ticket.assunto)}</strong><small>${esc(ticket.nome || ticket.email)} • ${esc(ticket.ultimaMensagem || "Chamado criado")}</small><div class="admin-support-ticket-meta"><span class="admin-support-chip ${esc(ticket.status)}">${esc(statusLabel(ticket.status))}</span><span class="admin-support-chip">${esc(ticket.prioridade)}</span><span class="admin-support-chip">${esc(ticket.categoria)}</span>${ticket.atendenteNome ? `<span class="admin-support-chip">${esc(ticket.atendenteNome)}</span>` : ""}<span class="admin-support-chip">${relative(ticket.ultimaRespostaEm || ticket.updatedAt)}</span></div></div><div class="admin-support-ticket-actions">${ticket.atendenteId ? "" : `<button type="button" data-support-assume="${esc(ticket.id)}">Assumir</button>`}<button type="button" data-support-open="${esc(ticket.id)}">Abrir chat</button></div></article>`).join("") : `<div class="admin-empty-state">Nenhum chamado encontrado.</div>`;
  }

  function renderAgents() {
    const map = new Map();
    state.tickets.filter((ticket) => ticket.atendenteNome).forEach((ticket) => map.set(ticket.atendenteNome, (map.get(ticket.atendenteNome) || 0) + 1));
    $("supportAgentList").innerHTML = map.size ? [...map.entries()].map(([name, total]) => `<div class="admin-support-agent"><span>${esc(name.charAt(0).toUpperCase())}</span><div><strong>${esc(name)}</strong><small>${total} ticket(s) na fila</small></div></div>`).join("") : `<div class="admin-empty-state">Nenhum atendimento assumido.</div>`;
  }

  async function openTicket(id, silent = false) {
    try {
      const data = await api(`/admin/suporte/${encodeURIComponent(id)}`);
      state.current = data.chamado;
      renderModal();
      $("adminSupportChatModal").hidden = false;
      clearInterval(state.poller);
      state.poller = setInterval(() => refreshCurrent(), 4000);
    } catch (error) { if (!silent) toast(error.message, "error"); }
  }

  async function refreshCurrent() {
    if (!state.current?.id || document.hidden) return;
    try { const data = await api(`/admin/suporte/${encodeURIComponent(state.current.id)}`); state.current = data.chamado; renderModal(false); } catch (_) {}
  }

  function renderModal(scroll = true) {
    const ticket = state.current; if (!ticket) return;
    $("adminSupportCode").textContent = `CHAMADO #${ticket.id.slice(-6).toUpperCase()}`;
    $("adminSupportTitle").textContent = ticket.assunto;
    $("adminSupportMeta").innerHTML = `<span class="admin-support-chip ${esc(ticket.status)}">${esc(statusLabel(ticket.status))}</span><span class="admin-support-chip">${esc(ticket.prioridade)}</span><span class="admin-support-chip">${esc(ticket.nome || ticket.email)}</span>`;
    $("adminSupportStatus").value = ticket.status;
    $("adminSupportAgent").textContent = ticket.atendenteNome ? `Atendente: ${ticket.atendenteNome}` : "Sem atendente";
    $("adminSupportAssume").hidden = Boolean(ticket.atendenteId);
    $("adminSupportThread").innerHTML = (ticket.respostas || []).map((message) => `<div class="admin-support-message ${message.tipo === "equipe" ? "team" : ""} ${message.tipo === "sistema" ? "system" : ""}"><strong>${esc(message.autorNome || (message.tipo === "equipe" ? "Equipe" : "Aluno"))}</strong><div>${esc(message.mensagem).replaceAll("\n", "<br>")}</div><small>${formatDate(message.criadoEm)}</small></div>`).join("");
    $("adminSupportFiles").innerHTML = (ticket.anexos || []).map((file) => `<button type="button" data-admin-file="${esc(file.id)}" data-file-name="${esc(file.nome)}">📎 ${esc(file.nome)}</button>`).join("");
    if (scroll) $("adminSupportThread").scrollTop = $("adminSupportThread").scrollHeight;
  }

  function closeModal() { clearInterval(state.poller); state.poller = null; state.current = null; if ($("adminSupportChatModal")) $("adminSupportChatModal").hidden = true; }

  async function assumeTicket(id) {
    if (!id) return;
    try { await api(`/admin/suporte/${encodeURIComponent(id)}/assumir`, { method: "POST", body: {} }); toast("Atendimento assumido."); await loadTickets(); await openTicket(id, true); } catch (error) { toast(error.message, "error"); }
  }

  async function updateStatus(id, status) {
    if (!id) return;
    try { await api(`/admin/suporte/${encodeURIComponent(id)}/status`, { method: "POST", body: { status } }); toast("Status atualizado."); await loadTickets(); await openTicket(id, true); } catch (error) { toast(error.message, "error"); }
  }

  async function submitReply() {
    if (!state.current?.id) return;
    const message = $("adminSupportReply")?.value.trim();
    if (!message) return;
    try {
      await api(`/admin/suporte/${encodeURIComponent(state.current.id)}/responder`, { method: "POST", body: { mensagem: message, status: $("adminSupportStatus")?.value || "respondido" } });
      $("adminSupportReply").value = ""; toast("Resposta enviada ao aluno."); await openTicket(state.current.id, true); await loadTickets();
    } catch (error) { toast(error.message, "error"); }
  }

  async function downloadFile(id, name) {
    try {
      const response = await api(`/suporte/anexos/${encodeURIComponent(id)}`, { raw: true });
      if (!response.ok) throw new Error("Não foi possível abrir o arquivo.");
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name || "arquivo"; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (error) { toast(error.message, "error"); }
  }

  async function loadFeedback(showToast = false) {
    ensureUI();
    try {
      const status = encodeURIComponent($("feedbackCenterStatus")?.value || "");
      const data = await api(`/admin/suporte/feedback?status=${status}`);
      state.feedbacks = data.feedbacks || [];
      renderFeedback();
      if (showToast) toast("Feedbacks atualizados.");
    } catch (error) { $("supportFeedbackList").innerHTML = `<div class="admin-empty-state">${esc(error.message)}</div>`; }
  }

  function renderFeedback() {
    $("supportFeedbackList").innerHTML = state.feedbacks.length ? state.feedbacks.map((item) => `<article class="admin-feedback-item"><header><div><h3>${esc(item.tipo)}</h3><small>${esc(item.nome || item.email)} • ${formatDate(item.createdAt)}</small></div><span class="admin-support-chip">${esc(item.status)}</span></header><div class="admin-feedback-rating">${"★".repeat(item.nota)}${"☆".repeat(Math.max(0, 5 - item.nota))}</div><p>${esc(item.mensagem)}</p><div class="admin-feedback-actions"><select data-feedback-status="${esc(item.id)}"><option value="novo" ${item.status === "novo" ? "selected" : ""}>Novo</option><option value="lido" ${item.status === "lido" ? "selected" : ""}>Lido</option><option value="planejado" ${item.status === "planejado" ? "selected" : ""}>Planejado</option><option value="concluido" ${item.status === "concluido" ? "selected" : ""}>Concluído</option><option value="arquivado" ${item.status === "arquivado" ? "selected" : ""}>Arquivado</option></select></div></article>`).join("") : `<div class="admin-empty-state">Nenhum feedback encontrado.</div>`;
  }

  async function updateFeedback(id, status) { try { await api(`/admin/suporte/feedback/${encodeURIComponent(id)}/status`, { method: "POST", body: { status } }); toast("Feedback atualizado."); await loadFeedback(); } catch (error) { toast(error.message, "error"); } }

  async function init() { registerEvents(); ensureUI(); await loadContext(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();