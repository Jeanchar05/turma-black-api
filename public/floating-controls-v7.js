"use strict";
(() => {
  if (window.__TURMA_FLOATING_CONTROLS_V7__) return;
  window.__TURMA_FLOATING_CONTROLS_V7__ = true;

  const path = (window.TurmaNavigation?.pathname || location.pathname).toLowerCase();
  const SUPPORT_KEY = "turma_support_float_v7_enabled";
  const SUPPORT_TICKET_KEY = "turma_support_float_v7_ticket";
  const FOCUS_DISMISSED_KEY = "turma_focus_float_v7_dismissed";
  const $ = (selector, root = document) => root.querySelector(selector);

  function setSupportEnabled(enabled, ticketId = "") {
    try {
      localStorage.setItem(SUPPORT_KEY, enabled ? "1" : "0");
      if (ticketId) localStorage.setItem(SUPPORT_TICKET_KEY, ticketId);
      if (!enabled) localStorage.removeItem(SUPPORT_TICKET_KEY);
    } catch (_) {}
    applySupportVisibility();
  }
  function supportEnabled() {
    try { return localStorage.getItem(SUPPORT_KEY) === "1"; } catch (_) { return false; }
  }
  function applySupportVisibility() {
    const host = $("#supportFloatV6");
    if (!host) return;
    const enabled = supportEnabled();
    host.dataset.floatingEnabled = enabled ? "true" : "false";
    host.dataset.centralPage = path === "/suporte" ? "true" : "false";
    if (!enabled || path === "/suporte") host.style.setProperty("display", "none", "important");
    else host.style.removeProperty("display");
  }
  function addSupportTrash() {
    const controls = $("#supportFloatV6 .support-float-controls");
    if (!controls || $("#supportFloatDiscard")) return;
    const button = document.createElement("button");
    button.id = "supportFloatDiscard";
    button.type = "button";
    button.title = "Ocultar este atendimento flutuante";
    button.setAttribute("aria-label", "Ocultar atendimento flutuante até abrir outro chamado");
    button.dataset.supportAction = "discard";
    button.textContent = "⌫";
    controls.insertBefore(button, controls.firstChild);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setSupportEnabled(false);
    }, true);
  }
  function enableTicket(ticketId) {
    if (!ticketId) return;
    setSupportEnabled(true, String(ticketId));
    window.dispatchEvent(new CustomEvent("turma:support-ticket-open", { detail: { ticketId: String(ticketId) } }));
  }
  function bindSupportCentral() {
    if (path !== "/suporte") return;
    document.addEventListener("click", (event) => {
      const ticket = event.target.closest("[data-open-ticket]");
      if (ticket?.dataset.openTicket) enableTicket(ticket.dataset.openTicket);
    }, true);
    $("#supportForm")?.addEventListener("submit", () => {
      const attempt = async () => {
        try {
          const token = [sessionStorage, localStorage].flatMap((storage) => ["token","adminToken","authToken","accessToken","jwt"].map((key) => { try { return storage.getItem(key); } catch (_) { return ""; } })).find(Boolean);
          if (!token) return;
          const response = await fetch("/meus-chamados", { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
          const data = await response.json().catch(() => ({}));
          const active = (data.chamados || []).find((item) => !["fechado", "resolvido"].includes(item.status));
          if (active?.id) enableTicket(active.id);
        } catch (_) {}
      };
      setTimeout(attempt, 1000);
      setTimeout(attempt, 2600);
    }, true);
  }

  function focusDismissed() {
    try { return localStorage.getItem(FOCUS_DISMISSED_KEY) === "1"; } catch (_) { return false; }
  }
  function setFocusDismissed(value) {
    try { localStorage.setItem(FOCUS_DISMISSED_KEY, value ? "1" : "0"); } catch (_) {}
    applyFocusVisibility();
  }
  function applyFocusVisibility() {
    if (!focusDismissed()) return;
    $("#floatingFocus")?.style.setProperty("display", "none", "important");
    $("#focusBubble")?.style.setProperty("display", "none", "important");
  }
  function restoreFocusVisibility() {
    const panel = $("#floatingFocus"); const bubble = $("#focusBubble");
    panel?.style.removeProperty("display"); bubble?.style.removeProperty("display");
  }
  function addFocusTrash() {
    const header = $("#floatingFocus header");
    if (!header || $("#focusDiscard")) return;
    const button = document.createElement("button");
    button.id = "focusDiscard";
    button.className = "floating-focus-close focus-discard-v7";
    button.type = "button";
    button.title = "Encerrar e ocultar timer";
    button.setAttribute("aria-label", "Encerrar e ocultar timer até iniciar outra sessão");
    button.textContent = "⌫";
    const minimize = $("#focusMinimize");
    header.insertBefore(button, minimize || null);
    button.addEventListener("click", async () => {
      setFocusDismissed(true);
      const sync = window.TurmaStudySync;
      try {
        if (sync?.focus) await sync.focus("reset", Number(sync.state?.focus?.duration || 1500));
        else $("#focusReset")?.click();
      } catch (_) {}
      applyFocusVisibility();
    });
  }
  function bindFocusStart() {
    document.addEventListener("click", (event) => {
      if (event.target.closest("#focusStart,#floatingFocusAction")) {
        setFocusDismissed(false);
        restoreFocusVisibility();
      }
    }, true);
    addEventListener("turma:study-change", () => {
      const focus = window.TurmaStudySync?.state?.focus;
      if (focus?.status === "running" && focusDismissed()) {
        setFocusDismissed(false);
        restoreFocusVisibility();
      }
    });
  }

  function watch() {
    const observer = new MutationObserver(() => {
      addSupportTrash(); applySupportVisibility(); addFocusTrash(); applyFocusVisibility();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    addSupportTrash(); applySupportVisibility(); addFocusTrash(); applyFocusVisibility();
  }
  bindSupportCentral();
  bindFocusStart();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch, { once: true }); else watch();
})();
