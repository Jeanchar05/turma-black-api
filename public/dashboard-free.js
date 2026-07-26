"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init, { once: true });

  function getToken() {
    for (const key of TOKEN_KEYS) {
      try {
        const token = sessionStorage.getItem(key);
        if (token) return token;
      } catch (_) {}
    }
    return "";
  }

  async function api(endpoint, options = {}) {
    const token = getToken();
    if (!token) throw new Error("Sua sessão expirou.");

    const response = await fetch(`${window.location.origin}${endpoint}`, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {})
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch (_) { data = { mensagem: text || "Resposta inválida." }; }

    if (!response.ok || data.erro) {
      throw new Error(data.erro || data.mensagem || `Erro ${response.status}.`);
    }

    return data;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function planLabel(plan) {
    return {
      black30: "Turma Premium — 30 dias",
      black90: "Turma Premium — 90 dias",
      black180: "Turma Premium — 180 dias",
      black360: "Turma Premium — 360 dias"
    }[plan] || plan;
  }

  function statusLabel(status) {
    return {
      pendente: "Aguardando aprovação",
      aprovado: "Aprovado",
      recusado: "Recusado",
      cancelado: "Cancelado"
    }[status] || status;
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function showMessage(message, type = "sucesso") {
    const box = $("premiumRequestMessage");
    if (!box) return;
    box.textContent = String(message || "");
    box.className = `auth-message ${type} active`;
  }

  async function loadRequests() {
    const list = $("premiumRequestsList");
    if (!list) return;

    try {
      const response = await api("/liberacoes/minha");
      const requests = response.solicitacoes || [];

      if (!requests.length) {
        list.innerHTML = '<div class="admin-empty-state">Você ainda não gerou nenhum código Premium.</div>';
        return;
      }

      list.innerHTML = requests.map((item) => `
        <div class="admin-list-row">
          <span class="admin-row-avatar">#</span>
          <div>
            <strong class="admin-code">${escapeHTML(item.codigo)}</strong>
            <small>${escapeHTML(planLabel(item.plano))} • ${formatDate(item.createdAt)}</small>
          </div>
          <span>${escapeHTML(statusLabel(item.status))}</span>
          <span class="admin-status-badge ${escapeHTML(item.status)}">${escapeHTML(item.status)}</span>
        </div>
      `).join("");
    } catch (error) {
      list.innerHTML = `<div class="admin-empty-state">${escapeHTML(error.message)}</div>`;
    }
  }

  async function submitRequest(event) {
    event.preventDefault();

    const button = $("generatePremiumCode");
    const select = $("premiumPlan");
    const selected = select?.selectedOptions?.[0];
    const plan = select?.value || "black30";
    const value = Number(selected?.dataset?.value || 0);
    const reference = String($("paymentReference")?.value || "").trim();

    if (!reference) {
      showMessage("Informe a referência do pagamento.", "erro");
      return;
    }

    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Gerando código…";

    try {
      const response = await api("/liberacoes/solicitar", {
        method: "POST",
        body: {
          plano: plan,
          valor: value,
          referenciaPagamento: reference
        }
      });

      const code = response.solicitacao?.codigo || "";
      showMessage(
        code
          ? `${response.mensagem} Código: ${code}`
          : response.mensagem || "Solicitação criada.",
        "sucesso"
      );

      event.currentTarget.reset();
      await loadRequests();
    } catch (error) {
      showMessage(error.message || "Não foi possível gerar o código.", "erro");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function init() {
    $("premiumRequestForm")?.addEventListener("submit", submitRequest);
    loadRequests();
  }
})();
