"use strict";
(() => {
  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  if (route() !== "/gestao" || window.__TURMA_MANAGEMENT_FINAL_V12__) return;
  window.__TURMA_MANAGEMENT_FINAL_V12__ = true;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = "turma_bankroll_management_v8";
  const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  const pad = (value) => String(value).padStart(2, "0");
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  function read() {
    try {
      const state = JSON.parse(localStorage.getItem(KEY) || "{}");
      state.entries = Array.isArray(state.entries) ? state.entries : [];
      state.days = Array.isArray(state.days) ? state.days : [];
      return state;
    } catch (_) { return { entries: [], days: [] }; }
  }

  function persist(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }

  function normalizedState() {
    const state = read();
    const days = [...state.days].filter((d) => d?.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (days.length) {
      const latest = days[days.length - 1];
      const before = Number(state.current || 0);
      let next = before;
      if (Number.isFinite(Number(latest.finalBankroll))) next = Math.max(0, Number(latest.finalBankroll));
      else if (Number.isFinite(Number(latest.result))) next = Math.max(0, Number(state.initial || 0) + days.reduce((sum, day) => sum + Number(day.result || 0), 0));
      if (Math.abs(next - before) > 0.001) { state.current = next; persist(state); }
    }
    return state;
  }

  function render() {
    const state = normalizedState();
    const days = [...state.days].filter((d) => d?.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const entries = [...state.entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    const current = Number(state.current || state.initial || 0), initial = Number(state.initial || 0);
    const todayDay = days.find((d) => d.date === todayKey());
    const todayEntries = entries.filter((e) => String(e.date || "").slice(0, 10) === todayKey());
    const todayResult = todayDay ? Number(todayDay.result || 0) : todayEntries.reduce((sum, e) => sum + Number(e.delta || 0), 0);

    const currentEl = $("#currentBankrollValue"); if (currentEl) currentEl.textContent = money(current);
    const todayEl = $("#todayResultValue");
    if (todayEl) { todayEl.textContent = `${todayResult > 0 ? "+" : todayResult < 0 ? "−" : ""}${money(Math.abs(todayResult))}`; todayEl.className = todayResult > 0 ? "positive" : todayResult < 0 ? "negative" : ""; }
    const variation = $("#bankrollVariationLabel");
    if (variation && initial > 0) { const pct = ((current - initial) / initial) * 100; variation.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}% desde o início`; }
    renderChart(state, days, entries);
  }

  function renderChart(state, days, entries) {
    const host = $("#bankrollChart"); if (!host) return;
    const initial = Number(state.initial || 0);
    let values = [];
    if (days.length) values = [initial || Number(days[0].initialBankroll || 0), ...days.slice(-30).map((d) => Number(d.finalBankroll || 0))];
    else if (entries.length) {
      let balance = initial || Number(state.current || 0); values = [balance];
      entries.slice(-30).forEach((e) => { balance += Number(e.delta || 0); values.push(balance); });
    }
    if (values.length < 2 || values.every((v) => !Number(v))) { host.innerHTML = '<div class="bank-chart-empty">Registre um resultado para visualizar a evolução da banca.</div>'; return; }
    const w = 760, h = 194, px = 20, py = 20, min = Math.min(...values), max = Math.max(...values), span = max - min || Math.max(1, max * .02 || 1);
    const x = (i) => px + i * (w - px * 2) / Math.max(1, values.length - 1), y = (v) => py + (max - v) * (h - py * 2) / span;
    const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    const area = `${line} L${x(values.length - 1).toFixed(1)} ${h - py} L${x(0).toFixed(1)} ${h - py} Z`;
    const grids = [0,1,2,3].map((i) => `<line class="v12-grid" x1="${px}" y1="${py + i * (h - py * 2) / 3}" x2="${w - px}" y2="${py + i * (h - py * 2) / 3}"/>`).join("");
    const dots = values.map((v, i) => `<circle class="v12-dot" cx="${x(i)}" cy="${y(v)}" r="4"/>`).join("");
    const markup = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Evolução da banca"><defs><linearGradient id="v12BankArea" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a45cff" stop-opacity=".28"/><stop offset="1" stop-color="#a45cff" stop-opacity="0"/></linearGradient></defs>${grids}<path class="v12-area" d="${area}"/><path class="v12-line" d="${line}"/>${dots}</svg>`;
    if (host.dataset.v12Signature !== JSON.stringify(values)) { host.dataset.v12Signature = JSON.stringify(values); host.innerHTML = markup; }
    const period = $("#chartPeriodLabel"); if (period) period.innerHTML = `<span class="bank-chart-v12-badge">${days.length ? `${days.length} dias registrados` : `${entries.length} lançamentos`}</span>`;
  }

  function enhanceModal() {
    const modal = $("#bankDayModalV6"); if (!modal || $("#bankDayOutcomeV12", modal)) return false;
    const resultInput = $("#bankDayResultV6", modal), resultLabel = resultInput?.closest("label"); if (!resultLabel) return false;
    resultLabel.style.display = "none";
    const chooser = document.createElement("div"); chooser.id = "bankDayOutcomeV12"; chooser.className = "bank-day-outcome-v12";
    chooser.innerHTML = '<button type="button" data-outcome="profit">✓ Saiu positivo</button><button type="button" data-outcome="loss">− Saiu negativo</button>';
    resultLabel.insertAdjacentElement("beforebegin", chooser);
    const label = document.createElement("label"); label.className = "wide bank-day-amount-v12";
    label.innerHTML = '<span>Quanto foi o resultado?</span><div class="bank-input"><b>R$</b><input id="bankDayAmountV12" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00" required></div><small>Escolha se o resultado foi positivo ou negativo.</small>';
    chooser.insertAdjacentElement("afterend", label);
    let type = Number(resultInput.value || 0) < 0 ? "loss" : "profit";
    const amount = $("#bankDayAmountV12", modal);
    const syncButtons = () => $$('[data-outcome]', chooser).forEach((b) => b.classList.toggle("active", b.dataset.outcome === type));
    const sync = () => {
      const value = Math.max(0, Number(amount.value || 0)); const signed = type === "loss" ? -value : value; resultInput.value = signed.toFixed(2);
      const initial = Number($("#bankDayInitialV6", modal)?.value || 0), final = $("#bankDayFinalV6", modal); if (final) final.value = Math.max(0, initial + signed).toFixed(2);
    };
    amount.value = Math.abs(Number(resultInput.value || 0)) || ""; syncButtons();
    chooser.addEventListener("click", (e) => { const b = e.target.closest("[data-outcome]"); if (!b) return; type = b.dataset.outcome; syncButtons(); sync(); });
    amount.addEventListener("input", sync); $("#bankDayInitialV6", modal)?.addEventListener("input", sync);
    modal.addEventListener("close", () => setTimeout(render, 100));
    return true;
  }

  function init() {
    render(); enhanceModal();
    const observer = new MutationObserver(() => { if (enhanceModal()) observer.disconnect(); });
    if (!$("#bankDayOutcomeV12")) observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("turma:bankroll-days-updated", () => setTimeout(render, 80));
    window.addEventListener("storage", (e) => { if (e.key === KEY) render(); });
    setTimeout(render, 800); setTimeout(render, 1800);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
