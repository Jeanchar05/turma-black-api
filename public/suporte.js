"use strict";
(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const state = { user: null, tickets: [], currentTicket: null, theme: "dark", rating: 5, poller: null, selectedFiles: [] };
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const firstName = (name) => String(name || "Usuário").trim().split(/\s+/)[0] || "Usuário";

  function token() { for (const key of TOKEN_KEYS) { try { const value = sessionStorage.getItem(key); if (value) return value; } catch (_) {} } return ""; }
  function clearSession() { TOKEN_KEYS.forEach((key) => { try { sessionStorage.removeItem(key); } catch (_) {} }); }

  async function api(endpoint, options = {}) {
    const jwt = token();
    if (!jwt) throw new Error("Sessão expirada.");
    const response = await fetch(`${location.origin}${endpoint}`, {
      method: options.method || "GET",
      headers: { Accept: options.accept || "application/json", Authorization: `Bearer ${jwt}`, ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    if (options.raw) return response;
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}.`);
    return data;
  }

  function toast(message, type = "success") {
    const item = document.createElement("div");
    item.className = `support-toast ${type}`;
    item.textContent = message;
    $("supportToastStack")?.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 3600);
  }

  function formatDate(value, withTime = true) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(date);
  }

  function statusLabel(status) {
    return { aberto: "Aberto", em_atendimento: "Em atendimento", respondido: "Respondido", resolvido: "Resolvido", fechado: "Fechado" }[status] || status || "Aberto";
  }

  function roleLabel(value) {
    return { dev: "Dev", dono: "Dono", superadmin: "Dono", admin: "Admin", suporte: "Suporte", aluno: "Aluno" }[String(value || "").toLowerCase()] || "Aluno";
  }

  function setAvatar(user) {
    const photo = String(user?.foto || "").trim();
    $$('[data-user-avatar]').forEach((element) => {
      element.textContent = photo ? "" : firstName(user?.nome).charAt(0).toUpperCase();
      element.style.backgroundImage = photo ? `url("${photo.replaceAll('"', "%22')}")` : "";
    });
  }

  function fillUser(user) {
    state.user = user || {};
    $$('[data-user-name]').forEach((element) => { element.textContent = firstName(user?.nome); });
    $$('[data-user-fullname]').forEach((element) => { element.textContent = user?.nome || "Usuário"; });
    $$('[data-user-role]').forEach((element) => { element.textContent = roleLabel(user?.cargo || user?.tipo); });
    setAvatar(user);
  }

  function resolveTheme(theme) { return theme === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : (theme === "light" ? "light" : "dark"); }
  function applyTheme(theme) {
    state.theme = theme;
    const resolved = resolveTheme(theme);
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#07030d" : "#eef0f5");
    const use = $("themeButton")?.querySelector("use");
    if (use) use.setAttribute("href", `assets/dashboard-icons.svg#${resolved === "dark" ? "i-moon" : "i-sun"}`);
  }
  async function toggleTheme() {
    const next = (document.documentElement.dataset.theme || "dark") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { await api("/dashboard-premium/preferencias", { method: "PUT", body: { tema: next } }); } catch (_) {}
  }

  function registerEvents() {
    $("supportMenuButton")?.addEventListener("click", openSidebar);
    $("supportMobileOverlay")?.addEventListener("click", () => { closeSidebar(); closeChat(); closeFeedback(); });
    $("themeButton")?.addEventListener("click", toggleTheme);
    $("supportForm")?.addEventListener("submit", submitTicket);
    $("supportFiles")?.addEventListener("change", (event) => selectFiles(event.target.files));
    $("refreshTickets")?.addEventListener("click", () => loadTickets(true));
    $("ticketSearch")?.addEventListener("input", renderTickets);
    $("chatReplyForm")?.addEventListener("submit", submitReply);
    $("feedbackForm")?.addEventListener("submit", submitFeedback);

    const drop = $("supportFileDrop");
    ["dragenter", "dragover"].forEach((type) => drop?.addEventListener(type, (event) => { event.preventDefault(); drop.classList.add("dragging"); }));
    ["dragleave", "drop"].forEach((type) => drop?.addEventListener(type, (event) => { event.preventDefault(); drop.classList.remove("dragging"); }));
    drop?.addEventListener("drop", (event) => selectFiles(event.dataTransfer.files));

    document.addEventListener("click", (event) => {
      const scroll = event.target.closest("[data-scroll]");
      if (scroll) $(scroll.dataset.scroll)?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (event.target.closest("[data-open-feedback]")) openFeedback();
      if (event.target.closest("[data-close-feedback]")) closeFeedback();
      if (event.target.closest("[data-close-chat]")) closeChat();
      const ticket = event.target.closest("[data-open-ticket]");
      if (ticket) openChat(ticket.dataset.openTicket);
      const file = event.target.closest("[data-download-file]");
      if (file) downloadFile(file.dataset.downloadFile, file.dataset.fileName);
      const rating = event.target.closest("[data-rating]");
      if (rating) setRating(Number(rating.dataset.rating));
      if (event.target.closest("[data-logout]")) { clearSession(); location.replace("/"); }
    });

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("ticketSearch")?.focus(); }
      if (event.key === "Escape") { closeSidebar(); closeChat(); closeFeedback(); }
    });
  }

  function openSidebar() { $("supportSidebar")?.classList.add("open"); if ($("supportMobileOverlay")) $("supportMobileOverlay").hidden = false; }
  function closeSidebar() { $("supportSidebar")?.classList.remove("open"); if (!$("supportChatModal")?.hidden || !$("feedbackModal")?.hidden) return; if ($("supportMobileOverlay")) $("supportMobileOverlay").hidden = true; }

  function selectFiles(fileList) {
    state.selectedFiles = Array.from(fileList || []).filter((file) => file.size <= 4 * 1024 * 1024).slice(0, 4);
    const rejected = Array.from(fileList || []).length - state.selectedFiles.length;
    $("supportFilePreview").innerHTML = state.selectedFiles.map((file) => `<span class="support-file-chip">${esc(file.name)} • ${(file.size / 1024 / 1024).toFixed(2)} MB</span>`).join("");
    if (rejected > 0) toast("Alguns arquivos foram ignorados. Use até 4 arquivos de no máximo 4 MB.", "error");
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  async function uploadFiles(ticketId, files, messageId = "") {
    for (const file of files) {
      const base64 = await fileToBase64(file);
      await api(`/suporte/${encodeURIComponent(ticketId)}/anexos`, { method: "POST", body: { nome: file.name, mime: file.type || "application/octet-stream", base64, mensagemId: messageId || null } });
    }
  }

  async function submitTicket(event) {
    event.preventDefault();
    const button = $("supportSubmit");
    const status = $("supportFormStatus");
    button.disabled = true;
    status.textContent = "Criando chamado…";
    try {
      const data = await api("/suporte", { method: "POST", body: {
        categoria: $("supportCategory").value,
        prioridade: $("supportPriority").value,
        assunto: $("supportSubject").value.trim(),
        mensagem: $("supportMessage").value.trim()
      }});
      if (state.selectedFiles.length) { status.textContent = "Enviando anexos…"; await uploadFiles(data.chamado.id, state.selectedFiles); }
      event.currentTarget.reset();
      state.selectedFiles = [];
      $("supportFilePreview").innerHTML = "";
      status.textContent = "";
      toast("Chamado aberto com sucesso.");
      await loadTickets();
      openChat(data.chamado.id);
    } catch (error) { status.textContent = ""; toast(error.message, "error"); }
    finally { button.disabled = false; }
  }

  async function loadTickets(showToast = false) {
    try {
      const data = await api("/meus-chamados");
      state.tickets = data.chamados || [];
      renderTickets();
      if (showToast) toast("Chamados atualizados.");
    } catch (error) { $("ticketList").innerHTML = `<div class="support-empty">${esc(error.message)}</div>`; }
  }

  function renderTickets() {
    const query = String($("ticketSearch")?.value || "").trim().toLowerCase();
    const items = state.tickets.filter((ticket) => !query || `${ticket.assunto} ${ticket.categoria} ${ticket.status} ${ticket.ultimaMensagem}`.toLowerCase().includes(query));
    $("ticketList").innerHTML = items.length ? items.map((ticket) => `
      <article class="support-ticket-item">
        <span class="support-ticket-icon"><svg><use href="assets/dashboard-icons.svg#i-support"></use></svg></span>
        <div><strong>${esc(ticket.assunto)}</strong><small>${esc(ticket.ultimaMensagem || "Chamado criado")}</small><div class="support-ticket-meta"><span class="support-chip ${esc(ticket.status)}">${esc(statusLabel(ticket.status))}</span><span class="support-chip">${esc(ticket.categoria)}</span><span class="support-chip">${formatDate(ticket.ultimaRespostaEm || ticket.updatedAt)}</span></div></div>
        <button type="button" data-open-ticket="${esc(ticket.id)}">Abrir atendimento</button>
      </article>`).join("") : `<div class="support-empty">Nenhum chamado encontrado.</div>`;
  }

  async function openChat(id, silent = false) {
    try {
      const data = await api(`/suporte/${encodeURIComponent(id)}`);
      state.currentTicket = data.chamado;
      renderChat();
      const modal = $("supportChatModal");
      modal.hidden = false; modal.setAttribute("aria-hidden", "false");
      if ($("supportMobileOverlay")) $("supportMobileOverlay").hidden = false;
      clearInterval(state.poller);
      state.poller = setInterval(() => refreshOpenChat(), 4000);
    } catch (error) { if (!silent) toast(error.message, "error"); }
  }

  async function refreshOpenChat() {
    if (!state.currentTicket?.id || document.hidden) return;
    try {
      const data = await api(`/suporte/${encodeURIComponent(state.currentTicket.id)}`);
      const oldCount = state.currentTicket.respostas?.length || 0;
      state.currentTicket = data.chamado;
      renderChat(oldCount !== (data.chamado.respostas?.length || 0));
    } catch (_) {}
  }

  function renderChat(scroll = true) {
    const ticket = state.currentTicket;
    if (!ticket) return;
    $("chatTicketCode").textContent = `CHAMADO #${ticket.id.slice(-6).toUpperCase()}`;
    $("chatTitle").textContent = ticket.assunto;
    $("chatMeta").innerHTML = `<span class="support-chip ${esc(ticket.status)}">${esc(statusLabel(ticket.status))}</span><span class="support-chip">${esc(ticket.prioridade)}</span>${ticket.atendenteNome ? `<span class="support-chip">Atendente: ${esc(ticket.atendenteNome)}</span>` : ""}`;
    const currentEmail = String(state.user?.email || "").toLowerCase();
    $("chatMessages").innerHTML = (ticket.respostas || []).map((message) => {
      const mine = String(message.autorEmail || "").toLowerCase() === currentEmail;
      return `<div class="support-message ${mine ? "mine" : ""} ${message.tipo === "sistema" ? "system" : ""}"><strong>${esc(message.tipo === "equipe" ? (message.autorNome || "Equipe Turma do Primo") : (message.autorNome || "Você"))}</strong><div>${esc(message.mensagem).replaceAll("\n", "<br>")}</div><small>${formatDate(message.criadoEm)}</small></div>`;
    }).join("") || `<div class="support-empty">Nenhuma mensagem.</div>`;
    $("chatFiles").innerHTML = (ticket.anexos || []).map((file) => `<button class="support-file-chip" type="button" data-download-file="${esc(file.id)}" data-file-name="${esc(file.nome)}">📎 ${esc(file.nome)}</button>`).join("");
    if (scroll) $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
  }

  function closeChat() {
    clearInterval(state.poller); state.poller = null; state.currentTicket = null;
    if ($("supportChatModal")) { $("supportChatModal").hidden = true; $("supportChatModal").setAttribute("aria-hidden", "true"); }
    if (!$("supportSidebar")?.classList.contains("open") && $("supportMobileOverlay")) $("supportMobileOverlay").hidden = true;
  }

  async function submitReply(event) {
    event.preventDefault();
    if (!state.currentTicket?.id) return;
    const message = $("chatReply").value.trim();
    const files = Array.from($("chatReplyFiles").files || []).filter((file) => file.size <= 4 * 1024 * 1024).slice(0, 4);
    if (!message && !files.length) return;
    $("chatReplyStatus").textContent = "Enviando…";
    try {
      let messageId = "";
      if (message) {
        const data = await api(`/suporte/${encodeURIComponent(state.currentTicket.id)}/responder`, { method: "POST", body: { mensagem: message } });
        messageId = data.mensagemId || "";
      }
      if (files.length) await uploadFiles(state.currentTicket.id, files, messageId);
      $("chatReply").value = ""; $("chatReplyFiles").value = ""; $("chatReplyStatus").textContent = "";
      await openChat(state.currentTicket.id, true); await loadTickets();
    } catch (error) { $("chatReplyStatus").textContent = ""; toast(error.message, "error"); }
  }

  async function downloadFile(id, name) {
    try {
      const response = await api(`/suporte/anexos/${encodeURIComponent(id)}`, { raw: true });
      if (!response.ok) throw new Error("Não foi possível abrir o arquivo.");
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = name || "arquivo"; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (error) { toast(error.message, "error"); }
  }

  function openFeedback() { $("feedbackModal").hidden = false; $("feedbackModal").setAttribute("aria-hidden", "false"); if ($("supportMobileOverlay")) $("supportMobileOverlay").hidden = false; }
  function closeFeedback() { if ($("feedbackModal")) { $("feedbackModal").hidden = true; $("feedbackModal").setAttribute("aria-hidden", "true"); } if (!$("supportSidebar")?.classList.contains("open") && $("supportChatModal")?.hidden && $("supportMobileOverlay")) $("supportMobileOverlay").hidden = true; }
  function setRating(value) { state.rating = Math.max(1, Math.min(5, value)); $$('[data-rating]').forEach((button) => button.classList.toggle("active", Number(button.dataset.rating) <= state.rating)); }
  async function submitFeedback(event) {
    event.preventDefault();
    try {
      const data = await api("/suporte/feedback", { method: "POST", body: { tipo: $("feedbackType").value, nota: state.rating, mensagem: $("feedbackMessage").value.trim() } });
      event.currentTarget.reset(); setRating(5); closeFeedback(); toast(data.mensagem || "Feedback enviado.");
    } catch (error) { toast(error.message, "error"); }
  }

  async function init() {
    registerEvents();
    try {
      const [me, preferences] = await Promise.all([api("/me"), api("/dashboard-premium/preferencias").catch(() => ({ preferencias: { tema: "dark" } }))]);
      fillUser(me.usuario || me); applyTheme(preferences.preferencias?.tema || "dark"); await loadTickets();
    } catch (error) { toast(error.message, "error"); }
    setTimeout(() => $("supportLoading")?.remove(), 180);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();