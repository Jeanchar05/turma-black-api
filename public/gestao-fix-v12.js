"use strict";
(() => {
  if (window.__TURMA_GESTAO_FIX_V12__) return;
  window.__TURMA_GESTAO_FIX_V12__ = true;
  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  if (route() !== "/gestao") return;

  const KEY = "turma_bankroll_management_v8";
  const DAYS_BACKUP_KEY = "turma_bankroll_days_v12";
  const $ = (selector, root = document) => root.querySelector(selector);
  const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  const pad = (value) => String(value).padStart(2, "0");
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  let lastRaw = "";

  function read() {
    try {
      const state = JSON.parse(localStorage.getItem(KEY) || "{}");
      state.entries = Array.isArray(state.entries) ? state.entries : [];
      state.days = Array.isArray(state.days) ? state.days : [];
      if (!state.days.length) {
        const backup = JSON.parse(localStorage.getItem(DAYS_BACKUP_KEY) || "[]");
        if (Array.isArray(backup) && backup.length) state.days = backup;
      }
      return state;
    } catch (_) { return { entries: [], days: [] }; }
  }

  function write(state) {
    const serialized = JSON.stringify(state);
    localStorage.setItem(KEY, serialized);
    try { localStorage.setItem(DAYS_BACKUP_KEY, JSON.stringify(state.days || [])); } catch (_) {}
    lastRaw = serialized;
  }

  function signed(value) {
    const number = Number(value || 0);
    return `${number > 0 ? "+" : number < 0 ? "−" : ""}${money(Math.abs(number))}`;
  }

  function journalEntry(day) {
    const result = Number(day.result || 0);
    return {
      id: `journal:${day.date}`,
      type: result < 0 ? "loss" : "profit",
      amount: Math.abs(result),
      delta: result,
      date: `${day.date}T12:00:00`,
      note: day.notes ? `Diário: ${String(day.notes).slice(0, 130)}` : "Resultado do diário da banca",
      balance: Math.max(0, Number(day.finalBankroll || 0)),
    };
  }

  function synchronizeJournal(state) {
    const days = (Array.isArray(state.days) ? state.days : [])
      .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(String(day?.date || "")))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const manual = (Array.isArray(state.entries) ? state.entries : []).filter((entry) => !String(entry?.id || "").startsWith("journal:"));
    state.days = days;
    state.entries = [...manual, ...days.map(journalEntry)].sort((a, b) => new Date(a.date) - new Date(b.date));

    const latest = days.at(-1);
    if (latest && Number.isFinite(Number(latest.finalBankroll))) {
      state.current = Math.max(0, Number(latest.finalBankroll));
    } else if (Number(state.initial || 0) > 0) {
      state.current = Math.max(0, Number(state.initial || 0) + state.entries.reduce((sum, entry) => sum + Number(entry.delta || 0), 0));
    }
    return state;
  }

  function renderChart(state) {
    const host = $("#bankrollChart");
    if (!host) return;
    const entries = [...(state.entries || [])].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-30);
    const initial = Number(state.initial || state.current || 0);
    if (!initial || !entries.length) {
      host.innerHTML = '<div class="bank-chart-empty">Registre um resultado para visualizar a evolução da banca.</div>';
      return;
    }
    const values = [initial];
    let balance = initial;
    entries.forEach((entry) => { balance = Number.isFinite(Number(entry.balance)) && Number(entry.balance) > 0 ? Number(entry.balance) : balance + Number(entry.delta || 0); values.push(balance); });
    const w = 760, h = 194, p = 18, min = Math.min(...values), max = Math.max(...values), span = max - min || Math.max(1, max * .02);
    const x = (i) => p + i * (w - p * 2) / Math.max(1, values.length - 1);
    const y = (v) => p + (max - v) * (h - p * 2) / span;
    const lines = values.slice(1).map((value, index) => `<line x1="${x(index)}" y1="${y(values[index])}" x2="${x(index + 1)}" y2="${y(value)}" stroke="${value >= values[index] ? "#2ed487" : "#ff5d73"}" stroke-width="4" stroke-linecap="round"/>`).join("");
    const dots = values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="4" fill="${index && value < values[index - 1] ? "#ff5d73" : "#2ed487"}" stroke="var(--bank-chart-dot-stroke,#09040e)" stroke-width="2"/>`).join("");
    host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Curva atualizada da banca">${lines}${dots}</svg>`;
  }

  function renderCurrent(state) {
    const current = Number(state.current || 0);
    const currentEl = $("#currentBankrollValue");
    if (currentEl) currentEl.textContent = money(current);
    const today = (state.entries || []).filter((entry) => String(entry.date || "").startsWith(todayKey())).reduce((sum, entry) => sum + Number(entry.delta || 0), 0);
    const todayEl = $("#todayResultValue");
    if (todayEl) {
      todayEl.textContent = signed(today);
      todayEl.className = today > 0 ? "positive" : today < 0 ? "negative" : "";
    }
    renderChart(state);
  }

  function syncAndRender() {
    const state = synchronizeJournal(read());
    write(state);
    renderCurrent(state);
  }

  function resultControls() {
    const modal = $("#bankDayModalV6");
    const result = $("#bankDayResultV6", modal || document);
    if (!modal || !result) return null;
    let wrap = $("#bankDayOutcomeWrapV12", modal);
    if (!wrap) {
      wrap = document.createElement("label");
      wrap.id = "bankDayOutcomeWrapV12";
      wrap.className = "wide gestao-v12-outcome";
      wrap.innerHTML = `<span>Como terminou o dia?</span><div class="gestao-v12-outcome-grid"><select id="bankDayOutcomeV6"><option value="profit">Positivo</option><option value="loss">Negativo</option><option value="neutral">Neutro</option></select><div class="bank-input"><b>R$</b><input id="bankDayOutcomeAmountV12" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></div></div><small>Escolha se o resultado foi positivo ou negativo e informe quanto.</small>`;
      result.closest("label")?.insertAdjacentElement("beforebegin", wrap);
      result.closest("label")?.classList.add("gestao-v12-calculated-result");
      const update = () => applyOutcomeToLegacy();
      $("#bankDayOutcomeV6", modal)?.addEventListener("change", update);
      $("#bankDayOutcomeAmountV12", modal)?.addEventListener("input", update);
      ["#bankDayInitialV6", "#bankDayFinalV6"].forEach((selector) => $(selector, modal)?.addEventListener("input", () => setTimeout(syncOutcomeFromLegacy, 0)));
    }
    return wrap;
  }

  function syncOutcomeFromLegacy() {
    const modal = $("#bankDayModalV6");
    if (!modal) return;
    resultControls();
    const value = Number($("#bankDayResultV6", modal)?.value || 0);
    const select = $("#bankDayOutcomeV6", modal);
    const amount = $("#bankDayOutcomeAmountV12", modal);
    if (select) select.value = value < 0 ? "loss" : value > 0 ? "profit" : "neutral";
    if (amount) amount.value = Math.abs(value).toFixed(2);
  }

  function applyOutcomeToLegacy() {
    const modal = $("#bankDayModalV6");
    if (!modal) return;
    const outcome = $("#bankDayOutcomeV6", modal)?.value || "neutral";
    const amount = Math.max(0, Number($("#bankDayOutcomeAmountV12", modal)?.value || 0));
    const signedResult = outcome === "loss" ? -amount : outcome === "profit" ? amount : 0;
    const result = $("#bankDayResultV6", modal);
    if (result) result.value = signedResult.toFixed(2);
    const initial = Number($("#bankDayInitialV6", modal)?.value || 0);
    const final = $("#bankDayFinalV6", modal);
    if (final && Number.isFinite(initial)) final.value = Math.max(0, initial + signedResult).toFixed(2);
  }

  function prepareModal() {
    resultControls();
    setTimeout(syncOutcomeFromLegacy, 20);
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("#newBankDayV6,[data-open-bank-day],.bank-calendar-day-v6")) setTimeout(prepareModal, 40);
  });
  document.addEventListener("submit", (event) => {
    if (event.target?.id === "bankDayFormV6") applyOutcomeToLegacy();
  }, true);
  window.addEventListener("turma:bankroll-days-updated", () => setTimeout(syncAndRender, 0));
  window.addEventListener("storage", (event) => { if (event.key === KEY) { lastRaw = event.newValue || ""; renderCurrent(read()); } });
  document.addEventListener("turma:protected-ready", () => setTimeout(syncAndRender, 250));

  const observer = new MutationObserver(() => { if ($("#bankDayModalV6")) resultControls(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(() => {
    const raw = localStorage.getItem(KEY) || "";
    if (raw !== lastRaw) { lastRaw = raw; renderCurrent(read()); }
  }, 900);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", syncAndRender, { once: true });
  else syncAndRender();
})();
