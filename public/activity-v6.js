"use strict";
(() => {
  if (window.__TURMA_ACTIVITY_V6__) return;
  window.__TURMA_ACTIVITY_V6__ = true;

  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  let activityTimer = null;

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
    if (!response.ok || data.erro || data.error) throw new Error(data.erro || data.error || data.mensagem || `Erro ${response.status}`);
    return data;
  }

  function formatDate(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function icon(type) {
    return { exam_started: "i-exam", exam_finished: "i-exam", bankroll: "i-activity", management_day: "i-activity" }[String(type || "")] || "i-activity";
  }

  async function logManagementActivity() {
    clearTimeout(activityTimer);
    activityTimer = setTimeout(async () => {
      try {
        await api("/dashboard-premium/atividades", {
          method: "POST",
          body: { tipo: "gestao", titulo: "Diário de gestão atualizado", descricao: "Registro diário da banca salvo e sincronizado." }
        });
      } catch (_) {}
    }, 900);
  }

  async function enrichProfileActivity() {
    const path = window.TurmaNavigation?.pathname || location.pathname;
    if (path !== "/perfil") return;
    try {
      const data = await api("/student/atividades");
      const activities = Array.isArray(data.activities) ? data.activities : [];
      if (!activities.length) return;
      const container = $("#profileActivityList");
      if (!container) return;
      const academic = activities.slice(0, 30).map((item) => `<div class="profile-activity-row activity-v6-row"><span class="profile-activity-icon"><svg><use href="assets/dashboard-icons.svg#${esc(icon(item.type))}"></use></svg></span><div><strong>${esc(item.title || "Atividade")}</strong><small>${item.type === "exam_finished" ? `Resultado registrado: ${Number(item.metadata?.score || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : item.type === "exam_started" ? "Avaliação iniciada na plataforma." : "Movimentação registrada na sua evolução."}</small></div><small>${esc(formatDate(item.createdAt))}</small></div>`).join("");
      setTimeout(() => {
        if (!container.querySelector(".activity-v6-row")) container.insertAdjacentHTML("afterbegin", academic);
      }, 650);
    } catch (_) {}
  }

  function init() {
    window.addEventListener("turma:bankroll-days-updated", logManagementActivity);
    enrichProfileActivity();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
