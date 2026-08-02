"use strict";
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEY = "turma_bankroll_management_v1";
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];

  const defaultState = {
    initialBankroll: 0,
    currentBankroll: 0,
    sessionTarget: 0,
    sessionStop: 0,
    unitPercent: 1,
    sessionOpen: false,
    sessionId: "",
    sessionStartBankroll: 0,
    sessionStartedAt: "",
    sessionEndedAt: "",
    sessionCloseReason: "",
    selectedResultType: "profit",
    entries: []
  };

  let state = loadState();

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function money(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function signedMoney(value) {
    const amount = Number(value || 0);
    return `${amount > 0 ? "+" : amount < 0 ? "−" : ""}${money(Math.abs(amount))}`;
  }

  function dateTime(value) {
    if (!value) return "Agora";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Agora";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return { ...defaultState };
      return sanitizeState({ ...defaultState, ...saved });
    } catch (_) {
      return { ...defaultState };
    }
  }

  function sanitizeState(value) {
    return {
      ...defaultState,
      ...value,
      initialBankroll: number(value.initialBankroll),
      currentBankroll: number(value.currentBankroll),
      sessionTarget: number(value.sessionTarget),
      sessionStop: number(value.sessionStop),
      unitPercent: clamp(number(value.unitPercent, 1), 0.1, 5),
      sessionOpen: Boolean(value.sessionOpen),
      entries: Array.isArray(value.entries) ? value.entries.slice(-500) : []
    };
  }

  function saveState() {
    state = sanitizeState(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function sessionResult() {
    if (!state.sessionId && !state.sessionStartedAt) return 0;
    return Number((state.currentBankroll - state.sessionStartBankroll).toFixed(2));
  }

  function sessionEntries() {
    if (!state.sessionId) return [];
    return state.entries.filter(entry => entry.sessionId === state.sessionId);
  }

  function unitValue() {
    return Number((state.currentBankroll * state.unitPercent / 100).toFixed(2));
  }

  function stopUsed() {
    return Math.max(0, -sessionResult());
  }

  function stopRemaining() {
    return Math.max(0, state.sessionStop - stopUsed());
  }

  function targetProgress() {
    if (!state.sessionTarget) return 0;
    return clamp(sessionResult() / state.sessionTarget * 100, 0, 100);
  }

  function stopProgress() {
    if (!state.sessionStop) return 0;
    return clamp(stopUsed() / state.sessionStop * 100, 0, 100);
  }

  function canStartSession() {
    return state.currentBankroll > 0 && state.sessionTarget > 0 && state.sessionStop > 0 && state.unitPercent > 0;
  }

  function showMessage(text, type = "") {
    const element = $("#bankrollMessage");
    if (!element) return;
    element.textContent = text;
    element.className = `bankroll-form-message ${type}`.trim();
  }

  function fillInputs() {
    const values = {
      initialBankrollInput: state.initialBankroll || "",
      currentBankrollInput: state.currentBankroll || "",
      sessionTargetInput: state.sessionTarget || "",
      sessionStopInput: state.sessionStop || "",
      unitPercentInput: state.unitPercent
    };

    Object.entries(values).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input && document.activeElement !== input) input.value = value;
    });

    const label = $("#unitPercentLabel");
    if (label) label.textContent = `${state.unitPercent.toFixed(1).replace(".", ",")}%`;
  }

  function renderSummary() {
    const result = sessionResult();
    const variation = state.initialBankroll > 0
      ? ((state.currentBankroll - state.initialBankroll) / state.initialBankroll) * 100
      : 0;

    $("#currentBankrollValue").textContent = money(state.currentBankroll);
    $("#bankrollVariationLabel").textContent = state.initialBankroll > 0
      ? `${variation >= 0 ? "+" : ""}${variation.toFixed(1).replace(".", ",")}% desde o início`
      : "Configure sua banca";

    $("#sessionResultValue").textContent = signedMoney(result);
    const resultCard = $("#sessionResultCard");
    resultCard?.classList.toggle("is-positive", result > 0);
    resultCard?.classList.toggle("is-negative", result < 0);

    const statusText = state.sessionOpen
      ? "Sessão ativa"
      : state.sessionCloseReason || "Nenhuma sessão ativa";
    $("#sessionStatusLabel").textContent = statusText;

    const progress = targetProgress();
    $("#targetProgressValue").textContent = `${Math.round(progress)}%`;
    $("#targetRemainingLabel").textContent = state.sessionTarget > 0
      ? result >= state.sessionTarget
        ? "Meta atingida"
        : `Faltam ${money(Math.max(0, state.sessionTarget - result))}`
      : "Meta não configurada";

    $("#stopRemainingValue").textContent = money(stopRemaining());
    $("#riskStatusLabel").textContent = state.sessionStop > 0
      ? stopUsed() >= state.sessionStop
        ? "Stop-loss atingido"
        : `${Math.round(stopProgress())}% do limite utilizado`
      : "Limite não configurado";

    const riskCard = $("#riskSummaryCard");
    riskCard?.classList.toggle("is-warning", stopProgress() >= 70);
  }

  function renderSession() {
    const result = sessionResult();
    const unit = unitValue();
    const entriesUntilStop = unit > 0 ? Math.max(0, Math.floor(stopRemaining() / unit)) : 0;

    $("#recommendedUnitValue").textContent = money(unit);
    $("#entriesUntilStopValue").textContent = String(entriesUntilStop);
    $("#sessionEntriesValue").textContent = String(sessionEntries().length);

    $("#targetBarLabel").textContent = `${money(Math.max(0, result))} / ${money(state.sessionTarget)}`;
    $("#stopBarLabel").textContent = `${money(stopUsed())} / ${money(state.sessionStop)}`;
    $("#targetProgressBar").style.width = `${targetProgress()}%`;
    $("#stopProgressBar").style.width = `${stopProgress()}%`;

    const pill = $("#sessionStatusPill");
    if (pill) {
      pill.className = "bankroll-status-pill";
      if (state.sessionOpen) {
        pill.textContent = "Ativa";
        pill.classList.add("active");
      } else if (state.sessionCloseReason) {
        pill.textContent = "Encerrada";
        pill.classList.add("closed");
      } else {
        pill.textContent = "Inativa";
      }
    }

    $("#startSessionButton").disabled = state.sessionOpen || !canStartSession();
    $("#closeSessionButton").disabled = !state.sessionOpen;
    $("#addEntryButton").disabled = !state.sessionOpen;
    $("#entryAmountInput").disabled = !state.sessionOpen;
    $("#entryNoteInput").disabled = !state.sessionOpen;
    $$('[data-result-type]').forEach(button => button.disabled = !state.sessionOpen);
  }

  function renderHistory() {
    const container = $("#bankrollHistoryList");
    if (!container) return;
    const entries = [...state.entries].reverse().slice(0, 30);

    if (!entries.length) {
      container.innerHTML = '<div class="bankroll-history-empty">Nenhum lançamento ainda.<br>Configure o plano, inicie uma sessão e registre seus resultados.</div>';
      return;
    }

    container.innerHTML = entries.map(entry => {
      const isProfit = entry.type === "profit";
      const amount = number(entry.amount);
      return `<article class="bankroll-history-item ${isProfit ? "profit" : "loss"}">
        <span>${isProfit ? "+" : "−"}</span>
        <div>
          <strong>${escapeHtml(entry.note || (isProfit ? "Lucro registrado" : "Perda registrada"))}</strong>
          <small>${dateTime(entry.createdAt)} · Banca após: ${money(entry.balanceAfter)}</small>
        </div>
        <b>${isProfit ? "+" : "−"}${money(amount)}</b>
      </article>`;
    }).join("");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderChart() {
    const container = $("#bankrollChart");
    if (!container) return;

    const recent = state.entries.slice(-20);
    if (!recent.length) {
      container.innerHTML = '<div class="bankroll-chart-empty">O gráfico aparecerá após o primeiro lançamento.<br>Ele acompanha a evolução da banca, não a quantidade de entradas.</div>';
      return;
    }

    const values = [
      recent[0].balanceBefore ?? state.sessionStartBankroll,
      ...recent.map(entry => number(entry.balanceAfter))
    ].map(Number);

    const width = 760;
    const height = 240;
    const padX = 38;
    const padY = 28;
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= Math.max(1, min * 0.02);
      max += Math.max(1, max * 0.02);
    }

    const x = index => padX + index * ((width - padX * 2) / Math.max(1, values.length - 1));
    const y = value => padY + (max - value) * ((height - padY * 2) / (max - min));
    const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    const areaPoints = `${padX},${height - padY} ${points} ${width - padX},${height - padY}`;
    const gridLines = [0, 1, 2, 3].map(index => {
      const gy = padY + index * ((height - padY * 2) / 3);
      const labelValue = max - index * ((max - min) / 3);
      return `<line class="bankroll-chart-grid" x1="${padX}" y1="${gy}" x2="${width - padX}" y2="${gy}"></line><text class="bankroll-chart-label" x="${padX}" y="${gy - 6}">${money(labelValue)}</text>`;
    }).join("");

    container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Curva de evolução da banca">
      <defs><linearGradient id="bankrollArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#bd62ff" stop-opacity=".34"></stop><stop offset="1" stop-color="#bd62ff" stop-opacity="0"></stop></linearGradient></defs>
      ${gridLines}
      <polygon class="bankroll-chart-area" points="${areaPoints}"></polygon>
      <polyline class="bankroll-chart-line" points="${points}"></polyline>
      ${values.map((value, index) => `<circle class="bankroll-chart-dot" cx="${x(index)}" cy="${y(value)}" r="4"></circle>`).join("")}
    </svg>`;
  }

  function render() {
    fillInputs();
    renderSummary();
    renderSession();
    renderHistory();
    renderChart();
  }

  function saveConfig(event) {
    event.preventDefault();
    const initial = number($("#initialBankrollInput").value);
    const current = number($("#currentBankrollInput").value);
    const target = number($("#sessionTargetInput").value);
    const stop = number($("#sessionStopInput").value);
    const unitPercent = clamp(number($("#unitPercentInput").value, 1), 0.1, 5);

    if (current <= 0 || target <= 0 || stop <= 0) {
      showMessage("Preencha banca atual, meta e stop-loss com valores maiores que zero.", "error");
      return;
    }

    if (state.sessionOpen && current !== state.currentBankroll) {
      showMessage("Encerre a sessão antes de alterar manualmente a banca atual.", "error");
      return;
    }

    state.initialBankroll = initial || current;
    state.currentBankroll = current;
    state.sessionTarget = target;
    state.sessionStop = stop;
    state.unitPercent = unitPercent;
    saveState();
    render();
    showMessage("Plano de banca salvo com sucesso.", "success");
  }

  function startSession(forceNew = false) {
    if (state.sessionOpen && !forceNew) return;
    if (!canStartSession()) {
      showMessage("Salve banca, meta e stop-loss antes de iniciar a sessão.", "error");
      return;
    }

    state.sessionOpen = true;
    state.sessionId = `session-${Date.now()}`;
    state.sessionStartBankroll = state.currentBankroll;
    state.sessionStartedAt = new Date().toISOString();
    state.sessionEndedAt = "";
    state.sessionCloseReason = "";
    saveState();
    render();
    showMessage("Sessão iniciada. Os limites agora estão ativos.", "success");
  }

  function closeSession(reason = "Sessão encerrada manualmente") {
    if (!state.sessionOpen) return;
    state.sessionOpen = false;
    state.sessionEndedAt = new Date().toISOString();
    state.sessionCloseReason = reason;
    saveState();
    render();
    showMessage(reason, reason.includes("Meta") ? "success" : "");
  }

  function addEntry(event) {
    event.preventDefault();
    if (!state.sessionOpen) {
      showMessage("Inicie uma sessão antes de registrar resultados.", "error");
      return;
    }

    const amount = number($("#entryAmountInput").value);
    const note = $("#entryNoteInput").value.trim();
    if (amount <= 0) {
      showMessage("Informe um valor maior que zero.", "error");
      return;
    }

    const type = state.selectedResultType === "loss" ? "loss" : "profit";
    const before = state.currentBankroll;
    const after = type === "profit" ? before + amount : Math.max(0, before - amount);
    state.currentBankroll = Number(after.toFixed(2));
    state.entries.push({
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sessionId: state.sessionId,
      type,
      amount: Number(amount.toFixed(2)),
      note,
      balanceBefore: Number(before.toFixed(2)),
      balanceAfter: state.currentBankroll,
      createdAt: new Date().toISOString()
    });

    const result = sessionResult();
    if (state.sessionTarget > 0 && result >= state.sessionTarget) {
      state.sessionOpen = false;
      state.sessionEndedAt = new Date().toISOString();
      state.sessionCloseReason = "Meta atingida — sessão encerrada automaticamente";
    } else if (state.sessionStop > 0 && -result >= state.sessionStop) {
      state.sessionOpen = false;
      state.sessionEndedAt = new Date().toISOString();
      state.sessionCloseReason = "Stop-loss atingido — sessão encerrada automaticamente";
    } else if (state.currentBankroll <= 0) {
      state.sessionOpen = false;
      state.sessionEndedAt = new Date().toISOString();
      state.sessionCloseReason = "Banca zerada — sessão encerrada automaticamente";
    }

    saveState();
    $("#entryAmountInput").value = "";
    $("#entryNoteInput").value = "";
    render();
    showMessage(
      state.sessionOpen ? "Resultado registrado." : state.sessionCloseReason,
      type === "profit" ? "success" : ""
    );
  }

  function selectResultType(button) {
    state.selectedResultType = button.dataset.resultType === "loss" ? "loss" : "profit";
    $$('[data-result-type]').forEach(item => item.classList.toggle("active", item === button));
    saveState();
  }

  function clearHistory() {
    if (!state.entries.length) return;
    if (!window.confirm("Limpar todo o histórico de lançamentos? A banca atual será mantida.")) return;
    state.entries = [];
    state.sessionId = "";
    state.sessionOpen = false;
    state.sessionStartBankroll = state.currentBankroll;
    state.sessionStartedAt = "";
    state.sessionEndedAt = "";
    state.sessionCloseReason = "";
    saveState();
    render();
    showMessage("Histórico limpo.", "success");
  }

  function exportHistory() {
    if (!state.entries.length) {
      showMessage("Ainda não há lançamentos para exportar.", "error");
      return;
    }

    const rows = [
      ["Data", "Sessão", "Tipo", "Valor", "Banca antes", "Banca depois", "Observação"],
      ...state.entries.map(entry => [
        dateTime(entry.createdAt),
        entry.sessionId,
        entry.type === "profit" ? "Lucro" : "Perda",
        Number(entry.amount).toFixed(2).replace(".", ","),
        Number(entry.balanceBefore).toFixed(2).replace(".", ","),
        Number(entry.balanceAfter).toFixed(2).replace(".", ","),
        entry.note || ""
      ])
    ];

    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gestao-banca-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showMessage("Histórico exportado em CSV.", "success");
  }

  function loadUser() {
    let name = "Primo";
    let photo = "";
    try {
      name = localStorage.getItem("turma_user_name") || localStorage.getItem("userName") || name;
      photo = localStorage.getItem("turma_user_photo") || "";
    } catch (_) {}
    const first = String(name).trim().split(/\s+/)[0] || "Primo";
    $$('[data-bankroll-name]').forEach(element => element.textContent = first);
    $$('[data-bankroll-avatar]').forEach(element => {
      if (photo) element.innerHTML = `<img src="${escapeHtml(photo)}" alt="${escapeHtml(first)}">`;
      else element.textContent = first.charAt(0).toUpperCase();
    });
  }

  function logout() {
    for (const storage of [sessionStorage, localStorage]) {
      TOKEN_KEYS.forEach(key => {
        try { storage.removeItem(key); } catch (_) {}
      });
    }
    location.replace("/");
  }

  function bind() {
    $("#bankrollConfigForm")?.addEventListener("submit", saveConfig);
    $("#bankrollEntryForm")?.addEventListener("submit", addEntry);
    $("#startSessionButton")?.addEventListener("click", () => startSession(false));
    $("#newSessionButton")?.addEventListener("click", () => {
      if (state.sessionOpen && !window.confirm("Encerrar a sessão atual e iniciar uma nova?")) return;
      if (state.sessionOpen) closeSession("Sessão encerrada para iniciar uma nova");
      startSession(true);
    });
    $("#closeSessionButton")?.addEventListener("click", () => closeSession());
    $("#clearHistoryButton")?.addEventListener("click", clearHistory);
    $("#exportBankrollButton")?.addEventListener("click", exportHistory);
    $("#studyLogout")?.addEventListener("click", logout);

    $$('[data-result-type]').forEach(button => {
      button.addEventListener("click", () => selectResultType(button));
      button.classList.toggle("active", button.dataset.resultType === state.selectedResultType);
    });

    $("#unitPercentInput")?.addEventListener("input", event => {
      const value = clamp(number(event.target.value, 1), 0.1, 5);
      $("#unitPercentLabel").textContent = `${value.toFixed(1).replace(".", ",")}%`;
    });

    $("#studyMenuToggle")?.addEventListener("click", () => {
      $("#studySidebar")?.classList.add("open");
      const overlay = $("#studyMobileOverlay");
      if (overlay) overlay.hidden = false;
    });

    $("#studyMobileOverlay")?.addEventListener("click", () => {
      $("#studySidebar")?.classList.remove("open");
      $("#studyMobileOverlay").hidden = true;
    });
  }

  function init() {
    loadUser();
    bind();
    render();
    document.body.classList.add("protected-ready");
    $("#studyLoading")?.remove();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();
})();
