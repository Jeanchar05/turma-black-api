"use strict";
(() => {
  if (window.__TURMA_FINAL_FIXES_V12__) return;
  window.__TURMA_FINAL_FIXES_V12__ = true;

  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const BANK_KEY = "turma_bankroll_management_v8";
  const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  const pad = (value) => String(value).padStart(2, "0");
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

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
    if (!response.ok) throw Object.assign(new Error(data.error || data.erro || data.mensagem || `Erro ${response.status}`), { status: response.status, data });
    return data;
  }

  function currentTheme() { return document.documentElement.dataset.theme === "light" ? "light" : "dark"; }

  /* ======================== GESTÃO ======================== */
  function readBank() {
    try {
      const state = JSON.parse(localStorage.getItem(BANK_KEY) || "{}");
      state.entries = Array.isArray(state.entries) ? state.entries : [];
      state.days = Array.isArray(state.days) ? state.days : [];
      return state;
    } catch (_) { return { entries: [], days: [] }; }
  }

  function writeBank(state) {
    try { localStorage.setItem(BANK_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function syncCurrentFromJournal() {
    const state = readBank();
    const days = [...state.days].filter((day) => day?.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (days.length) {
      const latest = days[days.length - 1];
      if (Number.isFinite(Number(latest.finalBankroll))) state.current = Math.max(0, Number(latest.finalBankroll));
      else if (Number.isFinite(Number(latest.result))) state.current = Math.max(0, Number(state.initial || 0) + days.reduce((sum, day) => sum + Number(day.result || 0), 0));
      writeBank(state);
    }
    return state;
  }

  function renderBankV12() {
    if (route() !== "/gestao") return;
    const state = syncCurrentFromJournal();
    const days = [...state.days].filter((day) => day?.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const entries = [...state.entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    const todayDay = days.find((day) => day.date === todayKey());
    const todayEntries = entries.filter((entry) => String(entry.date || "").slice(0, 10) === todayKey());
    const todayResult = todayDay ? Number(todayDay.result || 0) : todayEntries.reduce((sum, entry) => sum + Number(entry.delta || 0), 0);

    const current = Number(state.current || state.initial || 0);
    const initial = Number(state.initial || 0);
    const currentEl = $("#currentBankrollValue");
    if (currentEl) currentEl.textContent = money(current);
    const todayEl = $("#todayResultValue");
    if (todayEl) {
      todayEl.textContent = `${todayResult > 0 ? "+" : todayResult < 0 ? "−" : ""}${money(Math.abs(todayResult))}`;
      todayEl.className = todayResult > 0 ? "positive" : todayResult < 0 ? "negative" : "";
    }
    const variation = $("#bankrollVariationLabel");
    if (variation && initial > 0) {
      const pct = ((current - initial) / initial) * 100;
      variation.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}% desde o início`;
    }

    renderBankChartV12(state, days, entries);
  }

  function renderBankChartV12(state, days, entries) {
    const host = $("#bankrollChart");
    if (!host) return;
    const initial = Number(state.initial || 0);
    let series = [];
    if (days.length) {
      series = [{ label: "Início", value: initial || Number(days[0].initialBankroll || 0) }];
      days.slice(-30).forEach((day) => series.push({ label: day.date, value: Number(day.finalBankroll || 0) }));
    } else if (entries.length) {
      let balance = initial || Number(state.current || 0);
      series = [{ label: "Início", value: balance }];
      entries.slice(-30).forEach((entry) => { balance += Number(entry.delta || 0); series.push({ label: String(entry.date || ""), value: balance }); });
    }
    if (series.length < 2 || series.every((item) => !Number(item.value))) {
      host.innerHTML = '<div class="bank-chart-empty">Registre um resultado para visualizar a evolução da banca.</div>';
      return;
    }
    const width = 760, height = 194, padX = 20, padY = 20;
    const values = series.map((item) => Number(item.value || 0));
    const min = Math.min(...values), max = Math.max(...values), span = max - min || Math.max(1, max * .02 || 1);
    const x = (index) => padX + index * (width - padX * 2) / Math.max(1, values.length - 1);
    const y = (value) => padY + (max - value) * (height - padY * 2) / span;
    const line = values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");
    const area = `${line} L${x(values.length - 1).toFixed(1)} ${height - padY} L${x(0).toFixed(1)} ${height - padY} Z`;
    const grids = [0, 1, 2, 3].map((i) => `<line class="v12-grid" x1="${padX}" y1="${padY + i * (height - padY * 2) / 3}" x2="${width - padX}" y2="${padY + i * (height - padY * 2) / 3}"/>`).join("");
    const dots = values.map((value, index) => `<circle class="v12-dot" cx="${x(index)}" cy="${y(value)}" r="4"/>`).join("");
    host.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Evolução da banca"><defs><linearGradient id="v12BankArea" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a45cff" stop-opacity=".28"/><stop offset="1" stop-color="#a45cff" stop-opacity="0"/></linearGradient></defs>${grids}<path class="v12-area" d="${area}"/><path class="v12-line" d="${line}"/>${dots}</svg>`;
    const period = $("#chartPeriodLabel");
    if (period) period.innerHTML = `<span class="bank-chart-v12-badge">${days.length ? `${days.length} dias registrados` : `${entries.length} lançamentos`}</span>`;
  }

  function enhanceDailyJournalModal() {
    const modal = $("#bankDayModalV6");
    if (!modal || $("#bankDayOutcomeV12", modal)) return;
    const resultLabel = $("#bankDayResultV6", modal)?.closest("label");
    if (!resultLabel) return;
    resultLabel.style.display = "none";

    const outcome = document.createElement("div");
    outcome.id = "bankDayOutcomeV12";
    outcome.className = "bank-day-outcome-v12";
    outcome.innerHTML = '<button type="button" data-outcome="profit">✓ Saiu positivo</button><button type="button" data-outcome="loss">− Saiu negativo</button>';
    resultLabel.insertAdjacentElement("beforebegin", outcome);

    const amountLabel = document.createElement("label");
    amountLabel.className = "wide bank-day-amount-v12";
    amountLabel.innerHTML = '<span>Quanto foi o resultado?</span><div class="bank-input"><b>R$</b><input id="bankDayAmountV12" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00" required></div><small>Escolha acima se o resultado foi positivo ou negativo.</small>';
    outcome.insertAdjacentElement("afterend", amountLabel);

    let type = Number($("#bankDayResultV6", modal)?.value || 0) < 0 ? "loss" : "profit";
    function syncButtons() { $$('[data-outcome]', outcome).forEach((button) => button.classList.toggle("active", button.dataset.outcome === type)); }
    function syncResult() {
      const amount = Math.max(0, Number($("#bankDayAmountV12", modal)?.value || 0));
      const result = type === "loss" ? -amount : amount;
      const hidden = $("#bankDayResultV6", modal); if (hidden) hidden.value = result.toFixed(2);
      const initial = Number($("#bankDayInitialV6", modal)?.value || 0);
      const finalInput = $("#bankDayFinalV6", modal); if (finalInput) finalInput.value = Math.max(0, initial + result).toFixed(2);
    }
    outcome.addEventListener("click", (event) => { const button = event.target.closest("[data-outcome]"); if (!button) return; type = button.dataset.outcome; syncButtons(); syncResult(); });
    $("#bankDayAmountV12", modal)?.addEventListener("input", syncResult);
    $("#bankDayInitialV6", modal)?.addEventListener("input", syncResult);
    modal.addEventListener("close", () => setTimeout(renderBankV12, 80));
    modal.addEventListener("input", (event) => {
      if (event.target?.id === "bankDayResultV6") {
        const value = Number(event.target.value || 0); type = value < 0 ? "loss" : "profit";
        const amount = $("#bankDayAmountV12", modal); if (amount) amount.value = Math.abs(value || 0) || "";
        syncButtons();
      }
    });
    syncButtons();
    const current = Number($("#bankDayResultV6", modal)?.value || 0); $("#bankDayAmountV12", modal).value = Math.abs(current || 0) || "";
  }

  function initGestao() {
    if (route() !== "/gestao") return;
    const observe = new MutationObserver(() => { enhanceDailyJournalModal(); renderBankV12(); });
    observe.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("turma:bankroll-days-updated", () => setTimeout(renderBankV12, 60));
    window.addEventListener("storage", (event) => { if (event.key === BANK_KEY) renderBankV12(); });
    setTimeout(renderBankV12, 250);
    setTimeout(renderBankV12, 1000);
    setInterval(renderBankV12, 2500);
  }

  /* ======================== ROLETA ======================== */
  const AFFILIATE_URL = "https://go.aff.esportiva.bet/bhotuu7q";
  const toolImages = {
    "Roleta Reel": { dark: "/assets/roulette/tools/reel-dark.svg?v=12", light: "/assets/roulette/tools/reel-light.svg?v=12" },
    "Gêmeos": { dark: "/assets/roulette/tools/gemeos-dark.svg?v=12", light: "/assets/roulette/tools/gemeos-light.svg?v=12" },
    "Pitágoras": { dark: "/assets/roulette/tools/pitagoras-dark.svg?v=12", light: "/assets/roulette/tools/pitagoras-light.svg?v=12" }
  };

  function installRouletteHero() {
    const old = $(".roulette-hero-new");
    if (!old || old.classList.contains("roulette-v12-hero")) return;
    const hero = document.createElement("section");
    hero.className = "roulette-v12-hero";
    hero.innerHTML = `<div class="roulette-v12-hero-copy"><span class="roulette-v12-kicker">ROLETA OPERACIONAL</span><h2>Prática com <strong>disciplina</strong> e acesso rápido.</h2><p>Acesse as mesas usadas pela Turma, continue seus estudos e entre na Esportiva pelo link oficial de indicação.</p><div class="roulette-v12-actions"><a class="primary" href="${AFFILIATE_URL}" target="_blank" rel="noopener noreferrer sponsored">Acessar Esportiva ↗</a><a class="secondary" href="#rouletteTablesV12">Ver roletas ↓</a></div></div><div class="roulette-v12-photo"><img src="/assets/roulette/primo-portrait.svg?v=12" alt="Primo da Roleta" loading="eager"></div>`;
    old.replaceWith(hero);
    const tables = $(".roulette-casino-grid")?.closest(".roulette-panel-new"); if (tables) tables.id = "rouletteTablesV12";
  }

  function normalizeRouletteCards() {
    const cards = $$(".roulette-casino-card");
    cards.forEach((card) => {
      const text = card.textContent || "";
      if (/turkish|turistas|tukias|imagine/i.test(text)) {
        const title = $("h3", card); if (title) title.textContent = "Tukias roullet";
        const badge = $(".roulette-badge", card); if (badge) badge.textContent = "TUKIAS";
        card.dataset.rouletteArt = "Tukias roullet";
      }
    });
  }

  function updateRouletteLinks() {
    $("#esportivaAccess")?.setAttribute("href", AFFILIATE_URL);
    $$('a[href*="esportiva.bet.br?ref="]').forEach((link) => { link.href = AFFILIATE_URL; link.target = "_blank"; link.rel = "noopener noreferrer sponsored"; });
  }

  function updateQuickToolImages() {
    const theme = currentTheme();
    $$(".roulette-tool-card-new").forEach((card) => {
      const title = $("h3", card)?.textContent?.trim();
      const config = toolImages[title];
      const img = $("img", card);
      if (config && img) { img.src = config[theme]; img.alt = title; }
    });
  }

  function initRoleta() {
    if (route() !== "/roleta") return;
    installRouletteHero(); normalizeRouletteCards(); updateRouletteLinks(); updateQuickToolImages();
    window.addEventListener("turma:theme-change", updateQuickToolImages);
    new MutationObserver((records) => { if (records.some((record) => record.attributeName === "data-theme")) updateQuickToolImages(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    setTimeout(() => { installRouletteHero(); normalizeRouletteCards(); updateRouletteLinks(); updateQuickToolImages(); }, 700);
  }

  /* ======================== PROVAS ======================== */
  const examArt = {
    daily: { dark: "/assets/exams/daily-v12-dark.svg?v=12", light: "/assets/exams/daily-v12-light.svg?v=12" },
    weekly: { dark: "/assets/exams/weekly-v12-dark.svg?v=12", light: "/assets/exams/weekly-v12-light.svg?v=12" },
    primo: { dark: "/assets/exams/primo-v12-dark.svg?v=12", light: "/assets/exams/primo-v12-light.svg?v=12" }
  };
  function updateExamArt() {
    if (route() !== "/provas") return;
    const theme = currentTheme();
    Object.entries(examArt).forEach(([type, config]) => { const img = $(`[data-exam-type="${type}"] .exam-art img`); if (img) img.src = config[theme]; });
  }

  function markDailyOnline(config) {
    const card = $('[data-exam-type="daily"]');
    if (!card) return;
    let badge = $(".exam-online-v12", card);
    if (!badge && config?.available) { badge = document.createElement("span"); badge.className = "exam-online-v12"; badge.textContent = "Online agora"; $(".exam-card-body", card)?.prepend(badge); }
  }

  async function ensureDailyOnline() {
    if (route() !== "/provas") return;
    try {
      const data = await api("/student/provas/agenda");
      const daily = (data.cards || []).find((item) => item.type === "daily");
      if (!daily) return;
      markDailyOnline(daily);
      if (!daily.available || daily.attemptsRemaining <= 0) return;
      const existing = $('[data-evolution-exam-type="daily"]');
      if (existing && !existing.disabled) return;
      const locked = $('[data-exam-locked="daily"]');
      if (!locked) return;
      locked.disabled = false;
      locked.classList.add("evolution-v6-available");
      locked.textContent = `Começar • ${daily.attemptsRemaining} tentativa${daily.attemptsRemaining === 1 ? "" : "s"}`;
      locked.dataset.finalDailyFallback = "1";
      locked.addEventListener("click", async () => {
        if (locked.dataset.fallbackBusy === "1") return;
        locked.dataset.fallbackBusy = "1"; locked.disabled = true; locked.textContent = "Montando sua prova…";
        try {
          const started = await api("/student/provas/iniciar", { method: "POST", body: { type: "daily" } });
          renderDailyFallback(started.exam);
        } catch (error) {
          locked.disabled = false; locked.textContent = "Começar Prova Diária"; alert(error.message);
        } finally { locked.dataset.fallbackBusy = "0"; }
      }, { once: true });
    } catch (_) {}
  }

  function renderDailyFallback(exam) {
    const workspace = $("#examWorkspace");
    if (!workspace || !exam) return;
    workspace.hidden = false; workspace.setAttribute("aria-hidden", "false");
    workspace.innerHTML = `<section class="evolution-v6-exam-shell"><header class="evolution-v6-exam-head"><div><span>PROVA DIÁRIA ATIVA</span><h2>${exam.title}</h2><p>${exam.difficulty} • ${exam.totalQuestions} questões</p></div></header><form id="finalDailyExamV12" class="evolution-v6-question-list">${exam.questions.map((q, i) => `<fieldset class="evolution-v6-question"><legend><span>${String(i + 1).padStart(2, "0")}</span><div><small>${q.moduleName}</small><strong>${q.prompt}</strong></div></legend><div class="evolution-v6-options">${q.alternatives.map((a) => `<label><input type="radio" name="${q.id}" value="${a.id}"><span>${a.text}</span></label>`).join("")}</div></fieldset>`).join("")}<footer class="evolution-v6-exam-footer"><div><strong>Revise antes de enviar</strong><small>O resultado será corrigido no servidor.</small></div><button type="submit" class="evolution-v6-primary">Finalizar prova</button></footer></form></section>`;
    $("#finalDailyExamV12", workspace)?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const answers = exam.questions.map((q) => { const checked = $(`input[name="${CSS.escape(q.id)}"]:checked`, event.currentTarget); return checked ? { questionId: q.id, alternativeId: checked.value } : null; }).filter(Boolean);
      if (answers.length !== exam.totalQuestions) return alert(`Responda as ${exam.totalQuestions} questões.`);
      const result = await api("/student/provas/finalizar", { method: "POST", body: { attemptId: exam.id, answers } });
      workspace.innerHTML = `<section class="evolution-v6-result ${result.result?.approved ? "approved" : "retry"}"><div class="evolution-v6-result-score"><strong>${Number(result.result?.score || 0).toFixed(1)}%</strong><small>${result.result?.approved ? "Aprovado" : "Continue estudando"}</small></div><div class="evolution-v6-result-copy"><span>RESULTADO • PROVA DIÁRIA</span><h2>${result.result?.correct || 0} acertos de ${result.result?.total || exam.totalQuestions}</h2><p>Seu histórico e sua evolução foram atualizados.</p></div></section>`;
      ensureDailyOnline();
    });
    workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function initProvas() {
    if (route() !== "/provas") return;
    updateExamArt(); ensureDailyOnline();
    window.addEventListener("turma:theme-change", updateExamArt);
    new MutationObserver((records) => { if (records.some((record) => record.attributeName === "data-theme")) updateExamArt(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    setTimeout(() => { updateExamArt(); ensureDailyOnline(); }, 900);
    setTimeout(() => ensureDailyOnline(), 2200);
  }

  /* ======================== PERFIL ======================== */
  async function syncProfileWorkspace() {
    if (route() !== "/perfil") return;
    try {
      const data = await api("/dashboard-premium/home");
      const user = data.usuario || {};
      $$('[data-workspace-name]').forEach((el) => { el.textContent = user.nome || "Aluno"; });
      $$('[data-workspace-avatar]').forEach((el) => {
        const photo = user.foto || "";
        if (photo) { el.textContent = ""; el.style.backgroundImage = `url(${JSON.stringify(photo)})`; el.style.backgroundSize = "cover"; el.style.backgroundPosition = "center"; }
        else el.textContent = String(user.nome || "A").trim().charAt(0).toUpperCase() || "A";
      });
      let linked = $(".profile-linked-v12");
      if (!linked) { linked = document.createElement("div"); linked.className = "profile-linked-v12"; linked.textContent = "Perfil sincronizado com sua conta"; $(".profile-identity-card")?.appendChild(linked); }
      document.dispatchEvent(new CustomEvent("turma:profile-synced", { detail: { usuario: user } }));
    } catch (_) {}
  }

  function initProfile() {
    if (route() !== "/perfil") return;
    syncProfileWorkspace();
    $("#profileForm")?.addEventListener("submit", () => setTimeout(syncProfileWorkspace, 900));
    document.addEventListener("turma:phone-verified", () => setTimeout(syncProfileWorkspace, 250));
  }

  function init() {
    initGestao(); initRoleta(); initProvas(); initProfile();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
