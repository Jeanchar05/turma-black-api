"use strict";
(() => {
  if (window.__TURMA_STOP_ENTRIES_V18__) return;
  window.__TURMA_STOP_ENTRIES_V18__ = true;

  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  if (route() !== "/gestao") return;

  const KEY = "turma_bankroll_management_v8";
  const $ = (selector, root = document) => root.querySelector(selector);
  const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

  function readState() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      return window.TurmaBankrollModel?.normalizeState ? window.TurmaBankrollModel.normalizeState(raw) : raw;
    } catch (_) {
      return {};
    }
  }

  function metrics() {
    const state = readState();
    const summary = window.TurmaBankrollModel?.summarize ? window.TurmaBankrollModel.summarize(state) : { current: Number(state.current || state.initial || 0) };
    const current = Math.max(0, Number(summary.current || 0));
    const unitPercent = Math.max(0, Number(state.unit || 0));
    const unitValue = current * unitPercent / 100;
    const stop = Math.max(0, Number(state.stop || 0));
    const exact = unitValue > 0 && stop > 0 ? stop / unitValue : 0;
    const entries = exact > 0 ? Math.ceil(exact - Number.EPSILON) : 0;
    return { unitValue, stop, exact, entries };
  }

  function ensureCard() {
    const grid = $(".bank-mini-grid");
    if (!grid) return null;
    let card = $("#stopEntriesCardV18");
    if (card) return card;
    card = document.createElement("article");
    card.id = "stopEntriesCardV18";
    card.className = "bank-stop-entries-v18";
    card.innerHTML = `<span class="bank-stop-entries-icon" aria-hidden="true"><svg><use href="/assets/dashboard-icons.svg#i-shield"></use></svg></span><div><small>Entradas até o stop</small><strong id="stopEntriesValueV18">—</strong><em id="stopEntriesDetailV18">Configure unidade e stop</em></div>`;
    const daysCard = $("#daysRemainingValue")?.closest("article");
    if (daysCard) grid.insertBefore(card, daysCard);
    else grid.appendChild(card);
    return card;
  }

  function render() {
    const card = ensureCard();
    if (!card) return;
    const { unitValue, stop, entries } = metrics();
    const value = $("#stopEntriesValueV18");
    const detail = $("#stopEntriesDetailV18");
    if (value) value.textContent = entries ? `${entries} ${entries === 1 ? "entrada" : "entradas"}` : "—";
    if (detail) detail.textContent = entries ? `${money(stop)} ÷ ${money(unitValue)} • arredondado para cima` : "Configure unidade e stop diário";
    card.dataset.ready = entries ? "true" : "false";
  }

  function installStyle() {
    if ($("#managementStopEntriesV18Style")) return;
    const style = document.createElement("style");
    style.id = "managementStopEntriesV18Style";
    style.textContent = `
      @media(min-width:981px){.bank-mini-grid:has(#stopEntriesCardV18){grid-template-columns:repeat(5,minmax(0,1fr))}}
      .bank-stop-entries-v18>div{min-width:0}.bank-stop-entries-v18 em{display:block;margin-top:4px;color:#756a7d;font-size:8px;font-style:normal;line-height:1.35;white-space:normal}.bank-stop-entries-v18[data-ready="true"] strong{color:#d9a6ff}.bank-stop-entries-icon{color:#efc65f!important;background:rgba(239,198,95,.1)!important}
      html[data-theme="light"] .bank-stop-entries-v18 em{color:#7a6f81}
      @media(max-width:1180px) and (min-width:981px){.bank-mini-grid:has(#stopEntriesCardV18){grid-template-columns:repeat(3,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function livePreview() {
    const stopInput = $("#sessionStopInput");
    const unitInput = $("#unitPercentInput");
    const currentInput = $("#currentBankrollInput");
    if (!stopInput || !unitInput) return;
    const update = () => {
      const stop = Math.max(0, Number(stopInput.value || 0));
      const current = Math.max(0, Number(currentInput?.value || readState().current || readState().initial || 0));
      const unit = current * Math.max(0, Number(unitInput.value || 0)) / 100;
      const count = stop > 0 && unit > 0 ? Math.ceil(stop / unit - Number.EPSILON) : 0;
      const value = $("#stopEntriesValueV18");
      const detail = $("#stopEntriesDetailV18");
      if (value) value.textContent = count ? `${count} ${count === 1 ? "entrada" : "entradas"}` : "—";
      if (detail) detail.textContent = count ? `${money(stop)} ÷ ${money(unit)} • arredondado para cima` : "Configure unidade e stop diário";
    };
    stopInput.addEventListener("input", update);
    unitInput.addEventListener("input", update);
    currentInput?.addEventListener("input", update);
  }

  function init() {
    installStyle();
    ensureCard();
    render();
    livePreview();
    window.addEventListener("turma:bankroll-updated", render);
    window.addEventListener("turma:bankroll-days-updated", render);
    window.addEventListener("storage", (event) => { if (event.key === KEY) render(); });
    const observer = new MutationObserver(() => { if (!$("#stopEntriesCardV18")) { ensureCard(); render(); } });
    const host = $(".bankroll-v24");
    if (host) observer.observe(host, { childList: true, subtree: true });
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
