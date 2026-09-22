"use strict";
(() => {
  if (window.__TURMA_ADMIN_SUPPORT_V7__) return;
  window.__TURMA_ADMIN_SUPPORT_V7__ = true;

  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const ADMIN_ROLES = new Set(["dev", "dono", "superadmin", "admin"]);
  let role = "aluno";
  const $ = (selector, root = document) => root.querySelector(selector);

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
  function notify(message, type = "success") {
    const stack = $("#adminToastStack");
    if (!stack) return alert(message);
    const item = document.createElement("div");
    item.className = `admin-toast ${type}`;
    item.innerHTML = `<b>${type === "error" ? "!" : "✓"}</b><span>${String(message)}</span>`;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 3500);
  }
  function ticketId(panel) {
    return panel?.querySelector("[data-support-reply]")?.dataset.supportReply || panel?.querySelector("[data-support-assume]")?.dataset.supportAssume || "";
  }
  function enhance() {
    const panel = $("#ccTicketPanel");
    if (!panel) return;
    const id = ticketId(panel);
    if (!id) return;

    const replyBox = $(".cc-reply-box", panel);
    const allowed = ADMIN_ROLES.has(role);
    if (replyBox) {
      replyBox.classList.toggle("cc-support-readonly-v7", !allowed);
      const textarea = $("textarea", replyBox);
      const status = $("#ccSupportReplyStatus", replyBox);
      const button = $("[data-support-reply]", replyBox);
      const assume = $("[data-support-assume]", replyBox);
      if (textarea) textarea.disabled = !allowed;
      if (status) { status.disabled = !allowed; status.hidden = !allowed; }
      if (button) button.hidden = !allowed;
      if (assume) assume.hidden = !allowed;
      let note = $(".cc-support-permission-v7", replyBox);
      if (!allowed && !note) {
        note = document.createElement("div");
        note.className = "cc-support-permission-v7";
        note.textContent = "Somente administradores podem responder, assumir, fechar ou alterar este atendimento.";
        replyBox.prepend(note);
      }
      if (allowed && note) note.remove();
    }

    let actions = $(".cc-support-actions-v7", panel);
    if (!actions && allowed) {
      actions = document.createElement("div");
      actions.className = "cc-support-actions-v7";
      actions.innerHTML = `<button type="button" data-v7-close-ticket="${id}">Fechar ticket</button>${role === "dev" ? `<button type="button" class="danger" data-v7-delete-ticket="${id}">Apagar ticket</button>` : ""}`;
      const head = $(".cc-ticket-head", panel);
      (head || panel).appendChild(actions);
    } else if (actions) {
      if (!allowed) { actions.remove(); return; }
      const close = $("[data-v7-close-ticket]", actions); if (close) close.dataset.v7CloseTicket = id;
      const del = $("[data-v7-delete-ticket]", actions); if (del) del.dataset.v7DeleteTicket = id;
    }
  }
  async function closeTicket(id) {
    if (!ADMIN_ROLES.has(role)) return;
    if (!confirm("Fechar este chamado? O aluno continuará vendo o histórico, mas o atendimento ficará encerrado.")) return;
    try {
      await api(`/admin/suporte/${encodeURIComponent(id)}/status`, { method: "POST", body: { status: "fechado" } });
      notify("Ticket fechado.");
      $("[data-refresh-support]")?.click();
    } catch (error) { notify(error.message, "error"); }
  }
  async function deleteTicket(id) {
    if (role !== "dev") return;
    if (!confirm("Apagar este chamado permanentemente? Essa ação é exclusiva DEV e não pode ser desfeita.")) return;
    try {
      await api(`/admin/suporte/${encodeURIComponent(id)}`, { method: "DELETE" });
      notify("Ticket apagado permanentemente.");
      $("[data-refresh-support]")?.click();
    } catch (error) { notify(error.message, "error"); }
  }
  async function loadRole() {
    try {
      const data = await api("/me");
      const user = data.usuario || data.user || data;
      role = String(user.cargo || user.tipo || "aluno").toLowerCase();
    } catch (_) {}
  }
  function bind() {
    document.addEventListener("click", (event) => {
      const close = event.target.closest("[data-v7-close-ticket]");
      if (close) { event.preventDefault(); closeTicket(close.dataset.v7CloseTicket); return; }
      const del = event.target.closest("[data-v7-delete-ticket]");
      if (del) { event.preventDefault(); deleteTicket(del.dataset.v7DeleteTicket); }
    });
    const observer = new MutationObserver(() => enhance());
    observer.observe(document.body, { childList: true, subtree: true });
    enhance();
  }
  async function init() { await loadRole(); bind(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
