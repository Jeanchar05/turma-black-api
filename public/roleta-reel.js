"use strict";
(() => {
  if (window.__TURMA_ROULETA_REEL_V28__) return;
  window.__TURMA_ROULETA_REEL_V28__ = true;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wheel = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const red = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const HISTORY_KEY = "turma_roleta_reel_history_v4";
  const LEGACY_KEYS = ["turma_roleta_reel_history_v3", "turma_roleta_reel_history_v2"];
  const CONTEXT_KEY = "turma_roleta_reel_context_v2";
  const THEME_KEY = "turma_global_theme_v2";
  const duration = 3900;

  let history = loadHistory();
  let spinning = false;
  let currentAngle = 0;
  let pendingSnapshot = null;

  function color(n) {
    return n === 0 ? "green" : red.has(n) ? "red" : "black";
  }

  function secureIndex(length) {
    if (!Number.isInteger(length) || length <= 0) return 0;
    try {
      if (window.crypto?.getRandomValues) {
        const max = 0x100000000;
        const limit = max - (max % length);
        const value = new Uint32Array(1);
        do window.crypto.getRandomValues(value); while (value[0] >= limit);
        return value[0] % length;
      }
    } catch (_) {}
    return Math.floor(Math.random() * length);
  }

  function chooseResult() {
    return { number: wheel[secureIndex(wheel.length)], mode: "Aleatório uniforme" };
  }

  function normalizeHistoryItem(item) {
    if (typeof item === "number") return { number: item, status: "neutral", mode: "Histórico", marked: 0, strategy: "Race", time: Date.now() };
    if (!item || !wheel.includes(Number(item.number))) return null;
    return {
      number: Number(item.number),
      status: ["hit", "miss", "neutral"].includes(item.status) ? item.status : "neutral",
      mode: String(item.mode || "Aleatório uniforme"),
      marked: Number(item.marked) || 0,
      strategy: String(item.strategy || "Race"),
      time: Number(item.time) || Date.now()
    };
  }

  function loadHistory() {
    try {
      let raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) for (const key of LEGACY_KEYS) if ((raw = localStorage.getItem(key))) break;
      const items = JSON.parse(raw || "[]");
      return Array.isArray(items) ? items.map(normalizeHistoryItem).filter(Boolean).slice(0, 24) : [];
    } catch (_) { return []; }
  }

  function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (_) {}
  }

  function saveContext(entry, snapshot) {
    try {
      localStorage.setItem(CONTEXT_KEY, JSON.stringify({ last: entry, selection: snapshot, history: history.slice(0, 12), updatedAt: Date.now() }));
    } catch (_) {}
  }

  function applyTheme(value) {
    const theme = value === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem("theme", theme);
    } catch (_) {}
    window.dispatchEvent(new CustomEvent("turma:theme-change", { detail: { theme } }));
  }

  function createCells() {
    const host = $("#reelCells");
    if (!host) return;
    host.innerHTML = "";
    wheel.forEach((n, i) => {
      const cell = document.createElement("div");
      cell.className = `reel-cell ${color(n)}`;
      cell.dataset.number = n;
      cell.style.setProperty("--angle", `${i * 360 / wheel.length}deg`);
      cell.innerHTML = `<span>${n}</span>`;
      host.appendChild(cell);
    });
  }

  function raceSnapshot() {
    const state = window.TurmaRace?.getState?.() || {};
    const numbers = (window.TurmaRace?.getSelectedNumbers?.() || []).map(Number).filter(n => wheel.includes(n));
    return {
      numbers: [...new Set(numbers)],
      centers: [...new Set((state.centers || []).map(Number).filter(n => wheel.includes(n)))],
      neighbors: Math.max(0, Math.min(9, Number(state.neighbors) || 0)),
      bets: Array.isArray(state.bets) ? [...state.bets] : [],
      view: state.view || "race",
      capturedAt: Date.now()
    };
  }

  function angleFor(n) {
    return wheel.indexOf(n) * 360 / wheel.length;
  }

  function setBall(angle, transition = true) {
    const ball = $("#reelBall"), wheelEl = $("#reelWheel");
    if (!ball || !wheelEl) return;
    const radius = wheelEl.clientWidth * 0.392;
    ball.style.transition = transition ? `transform ${duration}ms cubic-bezier(.10,.78,.12,1)` : "none";
    ball.style.transform = `rotate(${angle}deg) translateY(-${radius}px)`;
  }

  function evaluateSnapshot(n, snapshot) {
    const marked = snapshot?.numbers || [];
    if (!marked.length) return { type: "neutral", title: "Sem marcação", text: "O giro foi aleatório, mas não havia marcação na Race para avaliar." };
    if (marked.includes(Number(n))) return { type: "hit", title: `ACERTO • ${n}`, text: `O número ${n} estava entre os ${marked.length} números marcados antes do giro.` };
    return { type: "miss", title: `ERRO • ${n}`, text: `O número ${n} não estava entre os ${marked.length} números marcados antes do giro.` };
  }

  function detectStrategies(snapshot, n) {
    const centers = snapshot?.centers || [], selected = snapshot?.numbers || [], out = [];
    const add = (id, label, href) => { if (!out.some(x => x.id === id)) out.push({ id, label, href }); };
    const hasCenter = v => centers.includes(v);
    if ([11,22,33].some(hasCenter) || [11,22,33].includes(Number(n))) add("gemeos", "Gêmeos", "/estudo-gemeos");
    const mirrored = centers.some(a => {
      const s = String(a).padStart(2, "0"), b = Number(s.split("").reverse().join(""));
      return b !== a && centers.includes(b) && wheel.includes(b);
    });
    if (mirrored) add("espelhos", "Espelhos", "/estudo-espelhos");
    if (centers.length >= 2 && centers.some((a, i) => centers.slice(i + 1).some(b => [3,5,8].includes(Math.abs(a - b))))) add("fibonacci", "Fibonacci", "/estudo-fibonacci");
    if (centers.length >= 2 && selected.length >= 5) add("magneto", "Magneto", "/estudo-magneto");
    if (snapshot?.bets?.length >= 1 && centers.length >= 1) add("camaleoes", "Camaleões", "/estudo-camaleoes");
    if (centers.length >= 3) add("pitagoras", "Pitágoras", "/estudo-pitagoras");
    const terminal = x => Math.abs(Number(x)) % 10;
    const cavalos = [[1,4,7],[2,5,8],[3,6,9]];
    if (cavalos.some(g => centers.filter(c => g.includes(terminal(c))).length >= 2) || cavalos.some(g => g.includes(terminal(n)))) add("cavalo", "Cavalo", "/estudo-cavalos");
    if (centers.some(c => [0,9].includes(terminal(c))) || [0,9].includes(terminal(n))) add("eclipse", "Eclipse Zero", "/estudo-eclipse-zero");
    if (!out.length) add("race", "Leitura Race", "/estudo");
    return out.slice(0, 4);
  }

  function renderStrategies(snapshot, n = null) {
    const host = $("#reelStrategyChips"), label = $("#reelStrategy");
    if (!host && !label) return;
    const list = detectStrategies(snapshot, n);
    if (label) label.textContent = list.map(x => x.label).join(" + ");
    if (host) host.innerHTML = list.map(x => `<a href="${x.href}" data-strategy="${x.id}">${x.label}</a>`).join("");
  }

  function lockRace(locked) {
    const host = $("[data-race-tool]");
    if (!host) return;
    host.style.pointerEvents = locked ? "none" : "";
    host.style.opacity = locked ? ".72" : "";
    host.setAttribute("aria-busy", locked ? "true" : "false");
  }

  function spin() {
    if (spinning) return;
    pendingSnapshot = raceSnapshot();
    const picked = chooseResult();
    const n = picked.number;
    spinning = true;
    lockRace(true);

    const button = $("#reelSpin");
    if (button) {
      button.disabled = true;
      button.querySelector("span").textContent = "Girando…";
    }
    if ($("#reelStatus")) $("#reelStatus").textContent = pendingSnapshot.numbers.length ? `Conferindo ${pendingSnapshot.numbers.length} marcações` : "Giro sem marcação";
    if ($("#reelEngineMode")) $("#reelEngineMode").textContent = "Aleatório uniforme";
    if ($("#reelLastNumber")) $("#reelLastNumber").textContent = "…";

    const target = angleFor(n);
    const current = ((currentAngle % 360) + 360) % 360;
    let diff = target - current;
    if (diff <= 0) diff += 360;
    currentAngle += 360 * 8 + diff;
    $("#reelBall")?.classList.add("spinning");
    setBall(currentAngle, true);
    setTimeout(() => finish(n, pendingSnapshot), duration + 130);
  }

  function finish(n, snapshot) {
    spinning = false;
    lockRace(false);
    const evaluation = evaluateSnapshot(n, snapshot);
    const strategies = detectStrategies(snapshot, n);
    const entry = {
      number: n,
      status: evaluation.type,
      mode: "Aleatório uniforme",
      marked: snapshot.numbers.length,
      strategy: strategies.map(x => x.label).join(" + "),
      time: Date.now()
    };

    history.unshift(entry);
    history = history.slice(0, 24);
    saveHistory();
    saveContext(entry, snapshot);

    const last = $("#reelLastNumber");
    if (last) { last.textContent = n; last.className = color(n); }
    const wheelCard = $(".reel-wheel-card");
    if (wheelCard) {
      wheelCard.classList.remove("race-hit", "race-miss", "race-neutral");
      wheelCard.classList.add(`race-${evaluation.type}`);
    }
    $("#reelBall")?.classList.remove("spinning");

    const status = $("#reelStatus");
    if (status) {
      status.textContent = evaluation.type === "hit" ? "✓ ACERTO NA RACE" : evaluation.type === "miss" ? "✕ ERRO NA RACE" : "Resultado sem marcação";
      status.className = `reel-status-${evaluation.type}`;
    }

    const button = $("#reelSpin");
    if (button) {
      button.disabled = false;
      button.querySelector("span").textContent = "Girar Roleta";
    }

    markWinner(n);
    renderHistory();
    renderStats();
    renderStrategies(snapshot, n);
    window.dispatchEvent(new CustomEvent("turma:roulette-result", { detail: { number: n, mode: "Aleatório uniforme", source: "roleta-reel", evaluation, snapshot, strategies } }));
    window.TurmaRace?.showResult?.(n);

    const evalEl = $("#reelEvaluation");
    if (evalEl) { evalEl.textContent = evaluation.title; evalEl.className = `reel-evaluation ${evaluation.type}`; }
    if ($("#reelEvaluationDetail")) $("#reelEvaluationDetail").textContent = evaluation.text;
    pendingSnapshot = null;
  }

  function markWinner(n) {
    $$(".reel-cell").forEach(c => c.classList.toggle("winner", Number(c.dataset.number) === n));
    setTimeout(() => $$(".reel-cell.winner").forEach(c => c.classList.remove("winner")), 1600);
  }

  function renderHistory() {
    const host = $("#reelHistory");
    if (!host) return;
    host.innerHTML = "";
    const items = history.slice(0, 12);
    if (!items.length) {
      for (let i = 0; i < 12; i++) {
        const s = document.createElement("span");
        s.textContent = "--";
        host.appendChild(s);
      }
      return;
    }
    items.forEach((item, i) => {
      const s = document.createElement("span");
      s.textContent = item.number;
      s.className = `history-${item.status} ${i === 0 ? "latest" : ""}`;
      s.dataset.rouletteColor = color(item.number);
      s.title = item.status === "hit" ? `Acerto: ${item.number} estava marcado` : item.status === "miss" ? `Erro: ${item.number} não estava marcado` : `${item.number} • sem marcação`;
      s.setAttribute("aria-label", s.title);
      host.appendChild(s);
    });
  }

  function renderStats() {
    const recent = history.slice(0, 8).map(x => x.number);
    if (!recent.length) {
      if ($("#reelDominant")) $("#reelDominant").textContent = "Aguardando";
      if ($("#reelHot")) $("#reelHot").textContent = "--";
      return;
    }
    const counts = {};
    recent.forEach(n => counts[n] = (counts[n] || 0) + 1);
    const r = recent.filter(n => color(n) === "red").length;
    const b = recent.filter(n => color(n) === "black").length;
    const z = recent.filter(n => n === 0).length;
    $("#reelDominant").textContent = z >= 2 ? "Zona do Zero" : r > b ? "Vermelhos" : b > r ? "Pretos" : "Equilibrado";
    const hot = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    $("#reelHot").textContent = hot && hot[1] > 1 ? `${hot[0]} (${hot[1]}x)` : "--";
    const graded = history.slice(0, 12).filter(x => x.status !== "neutral");
    const hits = graded.filter(x => x.status === "hit").length;
    if ($("#reelHitRate")) $("#reelHitRate").textContent = graded.length ? `${Math.round(hits / graded.length * 100)}% (${hits}/${graded.length})` : "--";
  }

  function updateConnection(event) {
    const base = raceSnapshot();
    const snapshot = event?.detail ? { ...base, ...event.detail, numbers: (event.detail.numbers || base.numbers).map(Number) } : base;
    const count = snapshot.numbers.length;
    if ($("#reelConnectionText")) $("#reelConnectionText").textContent = count ? `${count} número${count === 1 ? "" : "s"} na leitura atual` : "Aguardando marcações";
    renderStrategies(snapshot);
  }

  function clearHistory() {
    history = [];
    saveHistory();
    try { localStorage.removeItem(CONTEXT_KEY); } catch (_) {}
    const last = $("#reelLastNumber");
    if (last) { last.textContent = "--"; last.className = ""; }
    const evaluation = $("#reelEvaluation");
    if (evaluation) { evaluation.textContent = "Aguardando"; evaluation.className = ""; }
    if ($("#reelEvaluationDetail")) $("#reelEvaluationDetail").textContent = "Marque a Race antes do próximo giro.";
    if ($("#reelEngineMode")) $("#reelEngineMode").textContent = "Aleatório uniforme";
    if ($("#reelHitRate")) $("#reelHitRate").textContent = "--";
    renderHistory();
    renderStats();
    renderStrategies(raceSnapshot());
  }

  function bind() {
    $("#reelSpin")?.addEventListener("click", spin);
    $("#reelClear")?.addEventListener("click", clearHistory);
    $("#reelThemeToggle")?.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"));
    $("#reelMenuToggle")?.addEventListener("click", () => {
      $("#reelSidebar")?.classList.add("open");
      if ($("#reelMobileOverlay")) $("#reelMobileOverlay").hidden = false;
    });
    $("#reelMobileOverlay")?.addEventListener("click", () => {
      $("#reelSidebar")?.classList.remove("open");
      $("#reelMobileOverlay").hidden = true;
    });
    window.addEventListener("resize", () => setBall(currentAngle, false));
    window.addEventListener("turma:race-selection", updateConnection);
    window.addEventListener("turma:race-ready", () => {
      window.TurmaRace?.mountAll?.();
      updateConnection();
    });
  }

  function release() {
    document.body.style.setProperty("opacity", "1", "important");
    document.body.style.setProperty("visibility", "visible", "important");
    document.body.classList.add("protected-ready", "reel-ready");
    $("#reelLoading")?.remove();
  }

  function init() {
    let theme = "dark";
    try { theme = localStorage.getItem(THEME_KEY) || localStorage.getItem("theme") || "dark"; } catch (_) {}
    applyTheme(theme);
    createCells();
    renderHistory();
    renderStats();
    bind();
    setBall(0, false);
    window.TurmaRace?.mountAll?.();
    updateConnection();
    document.addEventListener("turma:protected-ready", release, { once: true });
    setTimeout(release, 1700);
    if (document.body.classList.contains("protected-ready")) release();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
