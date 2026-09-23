"use strict";
(() => {
  if (window.__TURMA_GESTAO_CORE__) return;
  window.__TURMA_GESTAO_CORE__ = true;
  const Bank = window.TurmaBankrollModel;
  if (!Bank) { console.error("TurmaBankrollModel não carregado."); return; }
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = "turma_bankroll_management_v8";
  const money = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));
  const signed = (v) => `${Number(v) > 0 ? "+" : Number(v) < 0 ? "−" : ""}${money(Math.abs(Number(v) || 0))}`;
  const n = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
  const localDate = (s) => new Date(`${s}T12:00:00`);
  let state = load();
  let calendarCursor = new Date();

  function load() {
    try { return Bank.normalizeState(JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (_) { return Bank.normalizeState({}); }
  }
  function save(next = state) {
    state = Bank.normalizeState(next);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
    window.dispatchEvent(new CustomEvent("turma:bankroll-updated", { detail: { state } }));
    render();
  }
  function toast(text, type = "success") {
    const el = $("#bankrollMessage"); if (!el) return;
    el.textContent = text; el.className = `bank-toast ${type} show`;
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2600);
  }
  function openModal(id) { const modal = $("#" + id); if (!modal) return; try { modal.showModal(); } catch (_) { modal.setAttribute("open", ""); } }
  function closeModal(id) { const modal = $("#" + id); if (!modal) return; try { modal.close(); } catch (_) { modal.removeAttribute("open"); } }

  function elapsedDays() {
    if (!state.startDate) return 0;
    const start = localDate(state.startDate), today = localDate(Bank.dateKey());
    return Math.max(0, Math.min(state.goalDays || 0, Math.floor((today - start) / 86400000) + 1));
  }

  function renderSummary() {
    const summary = Bank.summarize(state);
    const total = summary.accumulated;
    const targetTotal = (state.target || 0) * (state.goalDays || 0);
    const progress = targetTotal ? Math.max(0, Math.min(100, total / targetTotal * 100)) : 0;
    const day = elapsedDays(), remaining = Math.max(0, (state.goalDays || 0) - day), unit = summary.current * (state.unit || 0) / 100;
    $("#currentBankrollValue") && ($("#currentBankrollValue").textContent = money(summary.current));
    const variation = $("#bankrollVariationLabel");
    if (variation) variation.textContent = summary.initial ? `${total >= 0 ? "+" : ""}${(total / summary.initial * 100).toFixed(1).replace(".", ",")}% desde o início` : "Configure sua banca para começar";
    const todayEl = $("#todayResultValue");
    if (todayEl) { todayEl.textContent = signed(summary.today); todayEl.className = summary.today > 0 ? "positive" : summary.today < 0 ? "negative" : ""; }
    $("#dailyTargetValue") && ($("#dailyTargetValue").textContent = money(state.target));
    $("#dailyStopValue") && ($("#dailyStopValue").textContent = money(state.stop));
    $("#unitValue") && ($("#unitValue").textContent = money(unit));
    $("#daysRemainingValue") && ($("#daysRemainingValue").textContent = String(remaining));
    $("#planDayLabel") && ($("#planDayLabel").textContent = summary.initial ? `Dia ${day} de ${state.goalDays}` : "Planejamento não iniciado");
    $("#planGoalValue") && ($("#planGoalValue").textContent = money(targetTotal));
    $("#planProfitValue") && ($("#planProfitValue").textContent = signed(total));
    $("#planGoalBar")?.style.setProperty("width", `${progress}%`);
    const goalText = $("#planGoalText");
    if (goalText) goalText.textContent = !summary.initial ? "Configure o planejamento para acompanhar sua evolução." : total >= targetTotal && targetTotal > 0 ? "Meta do planejamento alcançada. Proteja o resultado e respeite seus limites." : `${Math.round(progress)}% da meta acumulada • ${remaining} ${remaining === 1 ? "dia restante" : "dias restantes"}.`;
  }

  function fillPlan() {
    const summary = Bank.summarize(state);
    const map = { initialBankrollInput: state.initial || "", currentBankrollInput: summary.current || "", sessionTargetInput: state.target || "", sessionStopInput: state.stop || "", goalDaysInput: state.goalDays || 30, goalStartInput: state.startDate || Bank.dateKey(), unitPercentInput: state.unit || 1 };
    Object.entries(map).forEach(([id, value]) => { const el = $("#" + id); if (el) el.value = value; });
    $("#unitPercentLabel") && ($("#unitPercentLabel").textContent = `${Number(state.unit || 1).toFixed(1).replace(".", ",")}%`);
  }

  function renderChart() {
    const host = $("#bankrollChart"); if (!host) return;
    const points = Bank.series(state).slice(-31);
    if (points.length < 2) { host.innerHTML = '<div class="bank-chart-empty">Registre lucros e perdas para visualizar a curva da banca.</div>'; return; }
    const values = points.map((p) => p.value), w = 760, h = 194, px = 22, py = 20;
    const min = Math.min(...values), max = Math.max(...values), span = max - min || Math.max(1, Math.abs(max) * .02 || 1);
    const x = (i) => px + i * (w - px * 2) / Math.max(1, values.length - 1), y = (v) => py + (max - v) * (h - py * 2) / span;
    const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    const area = `${path} L${x(values.length - 1)} ${h - py} L${x(0)} ${h - py} Z`;
    const grids = [0,1,2,3].map((i) => `<line class="bank-grid" x1="${px}" y1="${py + i * (h - py * 2) / 3}" x2="${w - px}" y2="${py + i * (h - py * 2) / 3}"/>`).join("");
    const dots = values.map((v, i) => `<circle class="bank-dot" cx="${x(i)}" cy="${y(v)}" r="4"/>`).join("");
    host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Curva da banca"><defs><linearGradient id="bankAreaCore" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a45cff" stop-opacity=".28"/><stop offset="1" stop-color="#a45cff" stop-opacity="0"/></linearGradient></defs>${grids}<path class="bank-area" d="${area}"/><path class="bank-line" d="${path}"/>${dots}</svg>`;
    const label = $("#chartPeriodLabel"); if (label) label.textContent = `${points.length - 1} dias registrados`;
  }

  function renderCalendar() {
    const host = $("#bankCalendar"); if (!host) return;
    const year = calendarCursor.getFullYear(), month = calendarCursor.getMonth(), first = new Date(year, month, 1), last = new Date(year, month + 1, 0);
    const buckets = new Map(Bank.dailyBuckets(state).map((item) => [item.date, item]));
    const target = Number(state.target || 0);
    $("#calendarTitle") && ($("#calendarTitle").textContent = first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push('<button class="bank-calendar-day empty" type="button" disabled></button>');
    for (let d = 1; d <= last.getDate(); d++) {
      const key = `${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const bucket = buckets.get(key), result = Number(bucket?.result || 0);
      const cls = result >= target && target > 0 ? "goal" : result > 0 ? "profit" : result < 0 ? "loss" : "";
      cells.push(`<button class="bank-calendar-day ${cls} ${key === Bank.dateKey() ? "today" : ""}" type="button" data-day="${key}" title="${result ? signed(result) : "Sem lançamento"}"><span>${d}</span>${result ? `<b>${signed(result)}</b>` : ""}</button>`);
    }
    host.innerHTML = cells.join("");
    $$('[data-day]', host).forEach((button) => button.addEventListener("click", () => openDay(button.dataset.day)));
  }

  function renderMovements() {
    const host = $("#bankrollHistoryList"); if (!host) return;
    const list = [...Bank.dailyBuckets(state)].reverse().slice(0, 12);
    host.innerHTML = list.length ? list.map((item) => `<article class="bank-movement ${item.result < 0 ? "loss" : "profit"}"><span class="bank-movement-icon">${item.result < 0 ? "−" : "+"}</span><div><strong>${item.source === "journal" ? "Resultado diário" : item.result < 0 ? "Perda registrada" : "Lucro registrado"}</strong><small>${item.day?.notes || item.entries?.map((e) => e.note).filter(Boolean).join(" • ") || "Sem observação"}</small></div><time>${localDate(item.date).toLocaleDateString("pt-BR")}</time><em>${signed(item.result)}</em></article>`).join("") : '<div class="bank-empty">Nenhum resultado registrado ainda.</div>';
  }

  function ensureJournal() {
    if ($("#bankDailyJournalV6")) return;
    const section = document.createElement("section");
    section.id = "bankDailyJournalV6"; section.className = "bank-card bank-journal-v6";
    section.innerHTML = '<header><div><span>DIÁRIO DA BANCA</span><h2>Registro diário</h2><p>Entradas, greens, reds e observações conectados ao calendário.</p></div><div class="bank-journal-actions-v6"><button id="shareBankMonthV6" type="button">Compartilhar mês</button><button id="newBankDayV6" type="button">+ Registrar hoje</button></div></header><div class="bank-journal-summary-v6" id="bankJournalSummaryV6"></div><div class="bank-journal-list-v6" id="bankJournalListV6"></div>';
    $(".bank-calendar-card")?.insertAdjacentElement("afterend", section);
    $("#newBankDayV6")?.addEventListener("click", () => openDay(Bank.dateKey()));
    $("#shareBankMonthV6")?.addEventListener("click", shareMonth);
  }

  function ensureDayModal() {
    let modal = $("#bankDayModalV6"); if (modal) return modal;
    modal = document.createElement("dialog"); modal.id = "bankDayModalV6"; modal.className = "bank-modal bank-day-modal-v6";
    modal.innerHTML = `<form method="dialog" id="bankDayFormV6" class="bank-modal-box"><header><div><span>REGISTRO DIÁRIO</span><h2 id="bankDayTitleV6">Registrar dia</h2></div><button type="button" data-close-bank-day>×</button></header><input type="hidden" id="bankDayDateV6"><div class="bank-day-date-v6" id="bankDayDateLabelV6"></div><div class="bank-form-grid bank-day-form-grid-v6"><label><span>Banca inicial do dia</span><div class="bank-input"><b>R$</b><input id="bankDayInitialV6" type="number" min="0" step="0.01" required></div></label><div class="bank-day-outcome-core wide"><span>Resultado</span><div><button type="button" data-day-outcome="profit">✓ Lucro</button><button type="button" data-day-outcome="loss">− Perda</button></div></div><label class="wide"><span id="bankDayAmountLabel">Valor do lucro</span><div class="bank-input"><b>R$</b><input id="bankDayAmountCore" type="number" min="0" step="0.01" inputmode="decimal" required></div></label><label><span>Entradas realizadas</span><div class="bank-input"><b>#</b><input id="bankDayEntriesV6" type="number" min="0" step="1"></div></label><label><span>Greens</span><div class="bank-input"><b>✓</b><input id="bankDayGreensV6" type="number" min="0" step="1"></div></label><label><span>Reds</span><div class="bank-input"><b>×</b><input id="bankDayRedsV6" type="number" min="0" step="1"></div></label><label class="wide"><span>Observações</span><textarea id="bankDayNotesV6" maxlength="500" rows="4" placeholder="Ex.: sessão da noite, respeitei o stop…"></textarea></label></div><div class="bank-day-help-v6"><span>A banca final é calculada automaticamente a partir do resultado informado.</span><b id="bankDayFinalPreview">—</b></div><footer><button type="button" class="secondary" id="deleteBankDayV6">Excluir registro</button><span></span><button type="button" class="secondary" data-close-bank-day>Cancelar</button><button type="submit" class="primary">Salvar dia</button></footer></form>`;
    document.body.appendChild(modal);
    $$('[data-close-bank-day]', modal).forEach((b) => b.addEventListener("click", () => closeModal(modal.id)));
    $("#bankDayFormV6", modal).addEventListener("submit", saveDay);
    $("#deleteBankDayV6", modal).addEventListener("click", deleteDay);
    $$('[data-day-outcome]', modal).forEach((b) => b.addEventListener("click", () => setDayOutcome(b.dataset.dayOutcome)));
    $("#bankDayAmountCore", modal).addEventListener("input", updateDayPreview);
    $("#bankDayInitialV6", modal).addEventListener("input", updateDayPreview);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(modal.id); });
    return modal;
  }

  function dayRecord(date) { return state.days.find((item) => item.date === date) || null; }
  function inferredInitial(date) {
    const summary = Bank.summarize(state);
    let balance = state.initial || summary.current;
    for (const bucket of summary.buckets) { if (bucket.date >= date) break; balance = Math.max(0, balance + bucket.result); }
    return balance;
  }
  function setDayOutcome(type) {
    const modal = ensureDayModal(); modal.dataset.outcome = type === "loss" ? "loss" : "profit";
    $$('[data-day-outcome]', modal).forEach((b) => b.classList.toggle("active", b.dataset.dayOutcome === modal.dataset.outcome));
    $("#bankDayAmountLabel", modal).textContent = modal.dataset.outcome === "loss" ? "Valor da perda" : "Valor do lucro";
    updateDayPreview();
  }
  function updateDayPreview() {
    const modal = ensureDayModal(), initial = Math.max(0, n($("#bankDayInitialV6", modal).value)), amount = Math.max(0, n($("#bankDayAmountCore", modal).value));
    const result = modal.dataset.outcome === "loss" ? -amount : amount;
    $("#bankDayFinalPreview", modal).textContent = `Banca final: ${money(Math.max(0, initial + result))}`;
  }
  function openDay(date) {
    const modal = ensureDayModal(), existing = dayRecord(date), initial = existing ? existing.initialBankroll : inferredInitial(date), result = Number(existing?.result || 0);
    $("#bankDayDateV6", modal).value = date;
    $("#bankDayDateLabelV6", modal).textContent = localDate(date).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    $("#bankDayTitleV6", modal).textContent = existing ? "Editar registro do dia" : "Registrar resultado do dia";
    $("#bankDayInitialV6", modal).value = initial || "";
    $("#bankDayAmountCore", modal).value = Math.abs(result) || "";
    $("#bankDayEntriesV6", modal).value = existing?.entries || 0; $("#bankDayGreensV6", modal).value = existing?.greens || 0; $("#bankDayRedsV6", modal).value = existing?.reds || 0; $("#bankDayNotesV6", modal).value = existing?.notes || "";
    $("#deleteBankDayV6", modal).hidden = !existing; setDayOutcome(result < 0 ? "loss" : "profit"); openModal(modal.id);
  }
  function saveDay(event) {
    event.preventDefault(); const modal = ensureDayModal(), date = $("#bankDayDateV6", modal).value, initial = Math.max(0, n($("#bankDayInitialV6", modal).value)), amount = Math.max(0, n($("#bankDayAmountCore", modal).value));
    if (!amount) return toast("Informe o valor do resultado.", "error");
    const result = modal.dataset.outcome === "loss" ? -amount : amount;
    state = Bank.upsertDay(state, { date, initialBankroll: initial, finalBankroll: Math.max(0, initial + result), result, entries: n($("#bankDayEntriesV6", modal).value), greens: n($("#bankDayGreensV6", modal).value), reds: n($("#bankDayRedsV6", modal).value), notes: $("#bankDayNotesV6", modal).value.trim(), updatedAt: Date.now() });
    save(state); closeModal(modal.id); toast(result < 0 ? "Perda registrada. Respeite seu stop." : "Lucro registrado.");
  }
  function deleteDay() { const date = $("#bankDayDateV6")?.value; if (!date || !confirm("Excluir o registro deste dia?")) return; state = Bank.removeDay(state, date); save(state); closeModal("bankDayModalV6"); toast("Registro removido."); }

  function renderJournal() {
    ensureJournal(); const prefix = `${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth() + 1).padStart(2,"0")}-`, records = state.days.filter((day) => day.date.startsWith(prefix)).sort((a,b) => b.date.localeCompare(a.date));
    const summary = $("#bankJournalSummaryV6"), list = $("#bankJournalListV6"); if (!summary || !list) return;
    const total = records.reduce((s,d) => s + Number(d.result || 0), 0), entries = records.reduce((s,d) => s + Number(d.entries || 0), 0), greens = records.reduce((s,d) => s + Number(d.greens || 0), 0), reds = records.reduce((s,d) => s + Number(d.reds || 0), 0), accuracy = entries ? greens / entries * 100 : 0;
    summary.innerHTML = `<article><small>Dias registrados</small><strong>${records.length}</strong></article><article><small>Entradas</small><strong>${entries}</strong></article><article><small>Greens / Reds</small><strong>${greens} / ${reds}</strong></article><article class="${total > 0 ? "positive" : total < 0 ? "negative" : ""}"><small>Resultado do mês</small><strong>${signed(total)}</strong></article><article><small>Taxa de greens</small><strong>${accuracy.toFixed(1).replace(".",",")}%</strong></article>`;
    list.innerHTML = records.length ? records.map((item) => `<button type="button" data-open-bank-day="${item.date}"><time>${localDate(item.date).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" })}</time><div><strong>${item.entries} entradas • ${item.greens}G / ${item.reds}R</strong><small>${item.notes || "Sem observação"}</small></div><b class="${item.result > 0 ? "positive" : item.result < 0 ? "negative" : ""}">${signed(item.result)}</b><span>→</span></button>`).join("") : '<div class="bank-journal-empty-v6"><strong>Nenhum registro neste mês</strong><span>Toque em um dia do calendário ou use “Registrar hoje”.</span></div>';
    $$('[data-open-bank-day]', list).forEach((b) => b.addEventListener("click", () => openDay(b.dataset.openBankDay)));
  }

  async function shareMonth() {
    const prefix = `${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth() + 1).padStart(2,"0")}-`, records = state.days.filter((d) => d.date.startsWith(prefix)); if (!records.length) return toast("Não há registros neste mês.", "error");
    const total = records.reduce((s,d) => s + Number(d.result || 0), 0), text = `Turma do Primo • Gestão\n${calendarCursor.toLocaleDateString("pt-BR", { month:"long", year:"numeric" })}\nDias registrados: ${records.length}\nResultado: ${signed(total)}`;
    try { if (navigator.share) await navigator.share({ title: "Gestão • Turma do Primo", text }); else { await navigator.clipboard.writeText(text); toast("Resumo copiado."); } } catch (_) {}
  }

  function savePlan(e) {
    e.preventDefault(); const initial = Math.max(0, n($("#initialBankrollInput")?.value)), target = Math.max(0, n($("#sessionTargetInput")?.value)), stop = Math.max(0, n($("#sessionStopInput")?.value));
    if (!initial) return toast("Informe a banca inicial.", "error");
    state = Bank.normalizeState({ ...state, initial, target, stop, goalDays: Math.max(1, Math.min(365, Math.round(n($("#goalDaysInput")?.value, 30)))), unit: Math.max(.1, Math.min(5, n($("#unitPercentInput")?.value, 1))), startDate: $("#goalStartInput")?.value || Bank.dateKey() });
    save(state); closeModal("bankPlanModal"); toast("Planejamento salvo.");
  }
  function openEntry(type) { if (!state.initial) { fillPlan(); openModal("bankPlanModal"); return toast("Configure sua banca primeiro.", "error"); } const loss = type === "loss"; $("#entryTypeInput").value = loss ? "loss" : "profit"; $("#entryDateInput").value = Bank.dateKey(); $("#entryAmountInput").value = ""; $("#entryNoteInput").value = ""; $("#entryModalTitle").textContent = loss ? "Registrar perda" : "Registrar lucro"; $("#entrySubmitButton").textContent = loss ? "Registrar perda" : "Registrar lucro"; openModal("bankEntryModal"); }
  function addEntry(e) { e.preventDefault(); const amount = Math.max(0, n($("#entryAmountInput")?.value)); if (!amount) return toast("Informe o valor do resultado.", "error"); state = Bank.addEntry(state, { type: $("#entryTypeInput").value === "loss" ? "loss" : "profit", amount, date: $("#entryDateInput").value || Bank.dateKey(), note: $("#entryNoteInput").value.trim() }); save(state); closeModal("bankEntryModal"); toast($("#entryTypeInput").value === "loss" ? "Perda registrada." : "Lucro registrado."); }
  function clearHistory() { if (!Bank.dailyBuckets(state).length || !confirm("Limpar os resultados registrados?")) return; state = Bank.normalizeState({ ...state, entries: [], days: [] }); save(state); toast("Histórico reiniciado."); }

  function render() { state = Bank.normalizeState(state); renderSummary(); fillPlan(); renderChart(); renderCalendar(); renderMovements(); renderJournal(); }
  function bind() {
    $("#openPlanButton")?.addEventListener("click", () => { fillPlan(); openModal("bankPlanModal"); }); $("#openPlanButtonSecondary")?.addEventListener("click", () => { fillPlan(); openModal("bankPlanModal"); });
    $$('[data-open-entry]').forEach((b) => b.addEventListener("click", () => openEntry(b.dataset.openEntry))); $$('[data-close-modal]').forEach((b) => b.addEventListener("click", () => closeModal(b.dataset.closeModal)));
    $("#bankrollConfigForm")?.addEventListener("submit", savePlan); $("#bankrollEntryForm")?.addEventListener("submit", addEntry); $("#unitPercentInput")?.addEventListener("input", (e) => { $("#unitPercentLabel").textContent = `${Number(e.target.value).toFixed(1).replace(".",",")}%`; });
    $("#calendarPrev")?.addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1); renderCalendar(); renderJournal(); }); $("#calendarNext")?.addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1); renderCalendar(); renderJournal(); }); $("#clearHistoryButton")?.addEventListener("click", clearHistory);
    window.addEventListener("storage", (e) => { if (e.key === KEY) { state = load(); render(); } }); window.addEventListener("turma:bankroll-remote", (e) => { if (e.detail?.state) { state = Bank.normalizeState(e.detail.state); render(); } });
  }
  function init() { calendarCursor = new Date(); ensureJournal(); ensureDayModal(); bind(); render(); document.body.classList.add("protected-ready"); $("#studyLoading")?.remove(); }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once:true }) : init();
})();
