"use strict";
(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  let lastSignature = "";
  let timer = null;
  let running = false;

  function token() {
    for (const key of TOKEN_KEYS) {
      try {
        const value = sessionStorage.getItem(key);
        if (value) return value;
      } catch (_) {}
    }
    return "";
  }

  function updateBadge(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    const total = Number(value || 0);
    element.textContent = String(total);
    if ("hidden" in element) element.hidden = total <= 0;
  }

  function updateDashboard(summary) {
    updateBadge("supportMenuBadge", summary.abertos);
    const openTickets = document.getElementById("statOpenTickets");
    if (openTickets) openTickets.textContent = String(Number(summary.abertos || 0));

    const open = document.getElementById("supportCenterOpen");
    const progress = document.getElementById("supportCenterProgress");
    const answered = document.getElementById("supportCenterAnswered");
    const urgent = document.getElementById("supportCenterUrgent");
    if (open) open.textContent = String(Number(summary.abertos || 0));
    if (progress) progress.textContent = String(Number(summary.atendimento || 0));
    if (answered) answered.textContent = String(Number(summary.respondidos || 0));
    if (urgent) urgent.textContent = String(Number(summary.urgentes || 0));
  }

  function isSupportOpen() {
    return document.getElementById("section-support")?.classList.contains("active");
  }

  function refreshVisibleQueue() {
    if (!isSupportOpen()) return;
    const button = document.getElementById("supportCenterRefresh");
    if (button && !button.disabled) button.click();
  }

  async function poll() {
    if (running || document.hidden) return;
    const jwt = token();
    if (!jwt) return;
    running = true;

    try {
      const response = await fetch(`${location.origin}/admin/suporte/resumo`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${jwt}` },
        cache: "no-store"
      });
      if (!response.ok) return;

      const data = await response.json().catch(() => ({}));
      const summary = data.resumo || {};
      updateDashboard(summary);

      const signature = [
        Number(summary.abertos || 0),
        Number(summary.atendimento || 0),
        Number(summary.respondidos || 0),
        Number(summary.resolvidos || 0),
        Number(summary.urgentes || 0)
      ].join(":");

      if (lastSignature && signature !== lastSignature) refreshVisibleQueue();
      lastSignature = signature;
    } catch (_) {
      // A central principal já apresenta os erros de conexão quando necessário.
    } finally {
      running = false;
    }
  }

  function schedule() {
    clearInterval(timer);
    timer = setInterval(poll, 7000);
  }

  function init() {
    poll();
    schedule();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) poll();
    });
    window.addEventListener("focus", poll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();