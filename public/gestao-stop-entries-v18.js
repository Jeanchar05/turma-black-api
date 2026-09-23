"use strict";
(() => {
  if (window.__TURMA_STOP_ENTRIES_V18__) return;
  window.__TURMA_STOP_ENTRIES_V18__ = true;

  const KEY = "turma_bankroll_management_v8";
  const $ = (selector, root = document) => root.querySelector(selector);
  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

  function readState() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch (_) { return {}; }
  }

  function ensureStyle() {
    if ($("#stopEntriesV18Style")) return;
    const style = document.createElement("style");
    style.id = "stopEntriesV18Style";
    style.textContent = `
      .bank-mini-grid{grid-template-columns:repeat(5,minmax(0,1fr));}
      .bank-stop-entries-v18 strong{display:flex;align-items:baseline;gap:6px;}
      .bank-stop-entries-v18 strong small{font-size:.64em;font-weight:700;opacity:.7;text-transform:none;letter-spacing:0;}
      .bank-stop-entries-v18 .stop-ratio-v18{display:block;margin-top:4px;font-size:11px;line-height:1.25;color:var(--bank-muted,#81778b);font-weight:600;}
      @media(max-width:1180px){.bank-mini-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}
      @media(max-width:720px){.bank-mini-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.bank-stop-entries-v18{grid-column:span 2;}}
    `;
    document.head.appendChild(style);
  }

  function ensureCard() {
    const grid = $(".bank-mini-grid");
    if (!grid) return null;
    let card = $("#stopEntriesCardV18");
    if (card) return card;
    card = document.createElement("article");
    card.id = "stopEntriesCardV18";
    card.className = "bank-stop-entries-v18";
    card.innerHTML = `
      <span><svg><use href="/assets/dashboard-icons.svg#i-activity"></use></svg></span>
      <div>
        <small>Entradas até o stop</small>
        <strong id="stopEntriesValueV18">—</strong>
        <em class="stop-ratio-v18" id="stopEntriesRatioV18">Configure stop e unidade</em>
      </div>`;
    const unitCard = $("#unitValue")?.closest("article");
    if (unitCard?.nextSibling) grid.insertBefore(card, unitCard.nextSibling);
    else grid.appendChild(card);
    return card;
  }

  function calculate() {
    ensureStyle();
    ensureCard();
    const state = readState();
    const stop = Math.max(0, num(state.stop));
    const initial = Math.max(0, num(state.initial));
    const entries = Array.isArray(state.entries) ? state.entries : [];
    const days = Array.isArray(state.days) ? state.days : [];
    const accumulatedEntries = entries.reduce((sum, item) => sum + (item.type === "loss" ? -Math.abs(num(item.amount)) : Math.abs(num(item.amount))), 0);
    const accumulatedDays = days.reduce((sum, item) => sum + num(item.result), 0);
    const current = Math.max(0, num(state.current) || initial + accumulatedEntries + accumulatedDays);
    const unitPercent = Math.max(0, num(state.unit));
    const unit = current * unitPercent / 100;
    const exact = unit > 0 ? stop / unit : 0;
    const operational = exact > 0 ? Math.ceil(exact) : 0;

    const value = $("#stopEntriesValueV18");
    const ratio = $("#stopEntriesRatioV18");
    if (!value || !ratio) return;

    if (!stop || !unit) {
      value.textContent = "—";
      ratio.textContent = "Configure stop e unidade";
      return;
    }

    value.innerHTML = `${operational} <small>${operational === 1 ? "entrada" : "entradas"}</small>`;
    ratio.textContent = `${exact.toFixed(2).replace(".", ",")} unidades • R$ ${unit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por entrada`;
    cardTitle(operational, stop, unit, exact);
  }

  function cardTitle(entries, stop, unit, exact) {
    const card = $("#stopEntriesCardV18");
    if (!card) return;
    card.title = `Stop diário ÷ unidade: R$ ${stop.toFixed(2)} ÷ R$ ${unit.toFixed(2)} = ${exact.toFixed(2)}. Limite operacional: ${entries} entrada(s).`;
  }

  function init() {
    if ((window.TurmaNavigation?.pathname || location.pathname) !== "/gestao") return;
    calculate();
    window.addEventListener("turma:bankroll-updated", calculate);
    window.addEventListener("turma:bankroll-days-updated", calculate);
    window.addEventListener("storage", (event) => { if (event.key === KEY) calculate(); });
    new MutationObserver(() => ensureCard()).observe(document.body, { childList: true, subtree: true });
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
