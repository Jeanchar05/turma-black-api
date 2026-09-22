"use strict";
(() => {
  if (window.__TURMA_MANAGEMENT_V6__) return;
  window.__TURMA_MANAGEMENT_V6__ = true;
  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  if (route() !== "/gestao") return;

  const KEY = "turma_bankroll_management_v8";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  const pad = (value) => String(value).padStart(2, "0");
  let cursor = new Date();

  function todayKey() {
    const date = new Date();
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  function load() {
    try {
      const state = JSON.parse(localStorage.getItem(KEY) || "{}");
      state.days = Array.isArray(state.days) ? state.days : [];
      return state;
    } catch (_) { return { days: [] }; }
  }
  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("turma:bankroll-days-updated"));
  }
  function dayByDate(date) { return load().days.find((item) => item.date === date) || null; }
  function isoFor(day) { return `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(day)}`; }
  function signed(value) { const number = Number(value || 0); return `${number > 0 ? "+" : ""}${money(number)}`; }
  function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

  function injectSection() {
    if ($("#bankDailyJournalV6")) return;
    const section = document.createElement("section");
    section.id = "bankDailyJournalV6";
    section.className = "bank-card bank-journal-v6";
    section.innerHTML = `
      <header>
        <div><span>DIÁRIO DA BANCA</span><h2>Registro diário</h2><p>Entradas, greens, reds e observações conectados ao calendário.</p></div>
        <div class="bank-journal-actions-v6"><button id="shareBankMonthV6" type="button">Compartilhar mês</button><button id="newBankDayV6" type="button">+ Registrar hoje</button></div>
      </header>
      <div class="bank-journal-summary-v6" id="bankJournalSummaryV6"></div>
      <div class="bank-journal-list-v6" id="bankJournalListV6"></div>`;
    const calendar = $(".bank-calendar-card");
    if (calendar) calendar.insertAdjacentElement("afterend", section);
    else $(".bankroll-v24")?.appendChild(section);
    $("#newBankDayV6")?.addEventListener("click", () => openDay(todayKey()));
    $("#shareBankMonthV6")?.addEventListener("click", shareMonth);
  }

  function ensureModal() {
    if ($("#bankDayModalV6")) return $("#bankDayModalV6");
    const modal = document.createElement("dialog");
    modal.id = "bankDayModalV6";
    modal.className = "bank-modal bank-day-modal-v6";
    modal.innerHTML = `<form method="dialog" id="bankDayFormV6" class="bank-modal-box">
      <header><div><span>REGISTRO DIÁRIO</span><h2 id="bankDayTitleV6">Registrar dia</h2></div><button type="button" data-close-bank-day>×</button></header>
      <input type="hidden" id="bankDayDateV6">
      <div class="bank-day-date-v6" id="bankDayDateLabelV6"></div>
      <div class="bank-form-grid bank-day-form-grid-v6">
        <label><span>Banca inicial do dia</span><div class="bank-input"><b>R$</b><input id="bankDayInitialV6" type="number" min="0" step="0.01" required></div></label>
        <label><span>Banca final do dia</span><div class="bank-input"><b>R$</b><input id="bankDayFinalV6" type="number" min="0" step="0.01" required></div></label>
        <label><span>Entradas realizadas</span><div class="bank-input"><b>#</b><input id="bankDayEntriesV6" type="number" min="0" max="10000" step="1" required></div></label>
        <label><span>Greens</span><div class="bank-input"><b>✓</b><input id="bankDayGreensV6" type="number" min="0" max="10000" step="1" required></div></label>
        <label><span>Reds</span><div class="bank-input"><b>×</b><input id="bankDayRedsV6" type="number" min="0" max="10000" step="1" required></div></label>
        <label><span>Resultado do dia</span><div class="bank-input"><b>R$</b><input id="bankDayResultV6" type="number" step="0.01" required></div></label>
        <label class="wide"><span>Observações</span><textarea id="bankDayNotesV6" maxlength="500" rows="4" placeholder="Ex.: sessão da noite, respeitei o stop, conteúdo aplicado…"></textarea></label>
      </div>
      <div class="bank-day-help-v6"><span>O resultado é calculado automaticamente pela diferença entre banca final e inicial, mas você pode ajustá-lo.</span><b id="bankDayAccuracyV6">—</b></div>
      <footer><button type="button" class="secondary" id="deleteBankDayV6">Excluir registro</button><span></span><button type="button" class="secondary" data-close-bank-day>Cancelar</button><button type="submit" class="primary">Salvar dia</button></footer>
    </form>`;
    document.body.appendChild(modal);
    $$('[data-close-bank-day]', modal).forEach((button) => button.addEventListener("click", () => modal.close()));
    $("#bankDayFormV6", modal).addEventListener("submit", saveDay);
    $("#deleteBankDayV6", modal).addEventListener("click", deleteDay);
    ["#bankDayInitialV6", "#bankDayFinalV6"].forEach((selector) => $(selector, modal)?.addEventListener("input", calculateResult));
    ["#bankDayEntriesV6", "#bankDayGreensV6", "#bankDayRedsV6"].forEach((selector) => $(selector, modal)?.addEventListener("input", updateAccuracy));
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.close(); });
    return modal;
  }

  function dateLabel(date) {
    const parsed = new Date(`${date}T12:00:00`);
    return parsed.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }

  function inferredInitial(date, state) {
    const previous = [...state.days]
      .filter((day) => day.date < date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (previous?.finalBankroll) return Number(previous.finalBankroll);
    return Number(state.current || state.initial || 0);
  }

  function openDay(date) {
    const modal = ensureModal();
    const state = load();
    const existing = state.days.find((item) => item.date === date);
    const initial = existing ? Number(existing.initialBankroll || 0) : inferredInitial(date, state);
    $("#bankDayDateV6", modal).value = date;
    $("#bankDayDateLabelV6", modal).textContent = dateLabel(date);
    $("#bankDayTitleV6", modal).textContent = existing ? "Editar registro do dia" : "Registrar resultado do dia";
    $("#bankDayInitialV6", modal).value = initial || "";
    $("#bankDayFinalV6", modal).value = existing ? Number(existing.finalBankroll || 0) : initial || "";
    $("#bankDayEntriesV6", modal).value = existing ? Number(existing.entries || 0) : 0;
    $("#bankDayGreensV6", modal).value = existing ? Number(existing.greens || 0) : 0;
    $("#bankDayRedsV6", modal).value = existing ? Number(existing.reds || 0) : 0;
    $("#bankDayResultV6", modal).value = existing ? Number(existing.result || 0) : 0;
    $("#bankDayNotesV6", modal).value = existing?.notes || "";
    $("#deleteBankDayV6", modal).hidden = !existing;
    updateAccuracy();
    try { modal.showModal(); } catch (_) { modal.setAttribute("open", ""); }
  }

  function calculateResult() {
    const initial = Number($("#bankDayInitialV6")?.value || 0);
    const final = Number($("#bankDayFinalV6")?.value || 0);
    if (Number.isFinite(initial) && Number.isFinite(final)) $("#bankDayResultV6").value = (final - initial).toFixed(2);
  }

  function updateAccuracy() {
    const entries = Math.max(0, Number($("#bankDayEntriesV6")?.value || 0));
    const greens = Math.max(0, Number($("#bankDayGreensV6")?.value || 0));
    const reds = Math.max(0, Number($("#bankDayRedsV6")?.value || 0));
    const label = $("#bankDayAccuracyV6");
    if (!label) return;
    const rate = entries ? Math.min(100, (greens / entries) * 100) : 0;
    label.textContent = entries ? `${rate.toFixed(1).replace(".", ",")}% de greens • ${reds} red${reds === 1 ? "" : "s"}` : "Sem entradas";
  }

  function saveDay(event) {
    event.preventDefault();
    const state = load();
    const date = $("#bankDayDateV6").value;
    const item = {
      date,
      initialBankroll: Math.max(0, Number($("#bankDayInitialV6").value || 0)),
      entries: Math.max(0, Math.floor(Number($("#bankDayEntriesV6").value || 0))),
      greens: Math.max(0, Math.floor(Number($("#bankDayGreensV6").value || 0))),
      reds: Math.max(0, Math.floor(Number($("#bankDayRedsV6").value || 0))),
      result: Number($("#bankDayResultV6").value || 0),
      finalBankroll: Math.max(0, Number($("#bankDayFinalV6").value || 0)),
      notes: $("#bankDayNotesV6").value.trim(),
      updatedAt: Date.now(),
    };
    const index = state.days.findIndex((day) => day.date === date);
    if (index >= 0) state.days[index] = item; else state.days.push(item);
    state.days.sort((a, b) => a.date.localeCompare(b.date));
    save(state);
    ensureModal().close();
    renderAll();
  }

  function deleteDay() {
    const date = $("#bankDayDateV6")?.value;
    if (!date) return;
    const state = load();
    state.days = state.days.filter((day) => day.date !== date);
    save(state);
    ensureModal().close();
    renderAll();
  }

  function decorateCalendar() {
    const cells = $$("#bankCalendar .bank-calendar-day:not(.empty)");
    cells.forEach((cell) => {
      const day = Number($("span", cell)?.textContent || 0);
      if (!day) return;
      const date = isoFor(day);
      cell.dataset.journalDate = date;
      cell.classList.add("bank-calendar-day-v6");
      let marker = $(".bank-day-marker-v6", cell);
      const record = dayByDate(date);
      if (record) {
        if (!marker) { marker = document.createElement("small"); marker.className = "bank-day-marker-v6"; cell.appendChild(marker); }
        marker.textContent = `${record.greens}G · ${record.reds}R`;
        cell.classList.toggle("journal-profit", Number(record.result) > 0);
        cell.classList.toggle("journal-loss", Number(record.result) < 0);
        cell.title = `${cell.title ? `${cell.title} • ` : ""}${record.entries} entradas • ${record.greens} greens • ${record.reds} reds`;
      } else {
        marker?.remove();
        cell.classList.remove("journal-profit", "journal-loss");
      }
    });
  }

  function monthRecords() {
    const prefix = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-`;
    return load().days.filter((day) => day.date.startsWith(prefix)).sort((a, b) => b.date.localeCompare(a.date));
  }

  function renderJournal() {
    const records = monthRecords();
    const summary = $("#bankJournalSummaryV6");
    const list = $("#bankJournalListV6");
    if (!summary || !list) return;
    const totalResult = records.reduce((sum, item) => sum + Number(item.result || 0), 0);
    const entries = records.reduce((sum, item) => sum + Number(item.entries || 0), 0);
    const greens = records.reduce((sum, item) => sum + Number(item.greens || 0), 0);
    const reds = records.reduce((sum, item) => sum + Number(item.reds || 0), 0);
    const accuracy = entries ? (greens / entries) * 100 : 0;
    summary.innerHTML = `<article><small>Dias registrados</small><strong>${records.length}</strong></article><article><small>Entradas</small><strong>${entries}</strong></article><article><small>Greens / Reds</small><strong>${greens} / ${reds}</strong></article><article class="${totalResult > 0 ? "positive" : totalResult < 0 ? "negative" : ""}"><small>Resultado do mês</small><strong>${signed(totalResult)}</strong></article><article><small>Taxa de greens</small><strong>${accuracy.toFixed(1).replace(".", ",")}%</strong></article>`;
    list.innerHTML = records.length ? records.map((item) => `<button type="button" data-open-bank-day="${esc(item.date)}"><time>${new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</time><div><strong>${item.entries} entradas • ${item.greens}G / ${item.reds}R</strong><small>${esc(item.notes || "Sem observação")}</small></div><b class="${Number(item.result) > 0 ? "positive" : Number(item.result) < 0 ? "negative" : ""}">${signed(item.result)}</b><span>→</span></button>`).join("") : '<div class="bank-journal-empty-v6"><strong>Nenhum registro neste mês</strong><span>Clique em um dia do calendário ou use “Registrar hoje”.</span></div>';
  }

  async function shareMonth() {
    const records = monthRecords();
    const title = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    if (!records.length) return;
    const total = records.reduce((sum, item) => sum + Number(item.result || 0), 0);
    const entries = records.reduce((sum, item) => sum + Number(item.entries || 0), 0);
    const greens = records.reduce((sum, item) => sum + Number(item.greens || 0), 0);
    const reds = records.reduce((sum, item) => sum + Number(item.reds || 0), 0);
    const text = `Turma do Primo — Gestão de ${title}\nDias registrados: ${records.length}\nEntradas: ${entries}\nGreens: ${greens} • Reds: ${reds}\nResultado: ${signed(total)}\n\nRegistro pessoal de gestão.`;
    try {
      if (navigator.share) await navigator.share({ title: `Gestão — ${title}`, text });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); window.alert("Resumo do mês copiado."); }
    } catch (_) {}
  }

  function renderAll() {
    requestAnimationFrame(() => { decorateCalendar(); renderJournal(); });
  }

  function bind() {
    $("#bankCalendar")?.addEventListener("click", (event) => {
      const cell = event.target.closest("[data-journal-date]");
      if (cell?.dataset.journalDate) openDay(cell.dataset.journalDate);
    });
    $("#calendarPrev")?.addEventListener("click", () => { cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1); setTimeout(renderAll, 40); });
    $("#calendarNext")?.addEventListener("click", () => { cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1); setTimeout(renderAll, 40); });
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-open-bank-day]");
      if (button) openDay(button.dataset.openBankDay);
    });
    window.addEventListener("storage", (event) => { if (event.key === KEY) renderAll(); });
    window.addEventListener("turma:bankroll-days-updated", renderAll);
  }

  function init() {
    injectSection(); ensureModal(); bind(); setTimeout(renderAll, 260); setTimeout(renderAll, 900);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
