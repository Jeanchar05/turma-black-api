"use strict";
(() => {
  if (window.__TURMA_EVOLUTION_V6__) return;
  window.__TURMA_EVOLUTION_V6__ = true;

  const RELEASE = "20260921-1";
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const BANK_KEY = "turma_bankroll_management_v8";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const number = (value, digits = 0) => Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const route = () => window.TurmaNavigation?.pathname || location.pathname;

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
    if (!jwt) throw new Error("Sessão expirada. Entre novamente.");
    const response = await fetch(path, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${jwt}`,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || data.erro || data.mensagem || `Erro ${response.status}.`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function toast(message, type = "success") {
    let stack = $("#evolutionV6ToastStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "evolutionV6ToastStack";
      stack.className = "evolution-v6-toast-stack";
      document.body.appendChild(stack);
    }
    const item = document.createElement("div");
    item.className = `evolution-v6-toast ${type}`;
    item.textContent = message;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 3200);
  }

  function injectCss() {
    if ($('link[data-evolution-v6-style]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `/student-evolution-v6.css?v=${RELEASE}`;
    link.dataset.evolutionV6Style = "1";
    document.head.appendChild(link);
  }

  function safeJson(raw, fallback = null) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function examScheduleLabel(type) {
    return type === "daily" ? "Segunda a sexta" : type === "weekly" ? "Todo sábado" : "Todo domingo";
  }

  function examTypeLabel(type) {
    return type === "daily" ? "Prova Diária" : type === "weekly" ? "Prova Semanal" : "Desafio do Primo";
  }

  async function enhanceManagement() {
    if (route() !== "/gestao") return;
    let revision = 0;
    let busy = false;
    let lastSerialized = "";
    let queuedTimer = null;

    function readLocal() {
      return safeJson(localStorage.getItem(BANK_KEY) || "{}", {});
    }
    function hasUsefulLocal(state) {
      return Number(state?.initial || 0) > 0 || Number(state?.current || 0) > 0 || (Array.isArray(state?.entries) && state.entries.length > 0);
    }
    function setSyncBadge(text, state = "ok") {
      let badge = $("#bankrollCloudSyncV6");
      if (!badge) {
        badge = document.createElement("div");
        badge.id = "bankrollCloudSyncV6";
        badge.className = "evolution-v6-sync";
        const host = $(".bank-overview-head") || $(".bank-overview");
        host?.appendChild(badge);
      }
      if (badge) { badge.dataset.state = state; badge.textContent = text; }
    }
    function reloadWithRemote(remote, nextRevision) {
      const normalized = JSON.stringify(remote || {});
      if (normalized === JSON.stringify(readLocal())) return false;
      localStorage.setItem(BANK_KEY, normalized);
      sessionStorage.setItem("turmaBankV6Revision", String(nextRevision || 0));
      sessionStorage.setItem("turmaBankV6Synced", normalized.slice(0, 160));
      location.reload();
      return true;
    }
    async function pushLocal() {
      if (busy) return;
      const current = readLocal();
      const serialized = JSON.stringify(current);
      if (!hasUsefulLocal(current) || serialized === lastSerialized) return;
      busy = true;
      setSyncBadge("Sincronizando…", "syncing");
      try {
        const saved = await api("/student/gestao", { method: "PUT", body: { revision, state: current } });
        revision = Number(saved.revision || revision);
        lastSerialized = JSON.stringify(saved.state || current);
        setSyncBadge("Salvo na conta", "ok");
      } catch (error) {
        if (error.status === 409 && error.data?.state) {
          revision = Number(error.data.revision || revision);
          setSyncBadge("Atualizando deste dispositivo…", "syncing");
          reloadWithRemote(error.data.state, revision);
          return;
        }
        setSyncBadge("Sem sincronização agora", "error");
      } finally { busy = false; }
    }
    function schedulePush() {
      clearTimeout(queuedTimer);
      queuedTimer = setTimeout(pushLocal, 700);
    }

    try {
      setSyncBadge("Conectando à conta…", "syncing");
      const remote = await api("/student/gestao");
      revision = Number(remote.revision || 0);
      const local = readLocal();
      if (remote.exists && remote.state) {
        lastSerialized = JSON.stringify(remote.state);
        if (reloadWithRemote(remote.state, revision)) return;
        setSyncBadge("Sincronizado com a conta", "ok");
      } else if (hasUsefulLocal(local)) {
        lastSerialized = "";
        await pushLocal();
      } else {
        lastSerialized = JSON.stringify(local);
        setSyncBadge("Pronto para sincronizar", "ok");
      }
      setInterval(() => {
        const serialized = JSON.stringify(readLocal());
        if (serialized !== lastSerialized) schedulePush();
      }, 850);
    } catch (_) {
      setSyncBadge("Modo local • reconectará automaticamente", "error");
    }
  }

  function renderExamWorkspace(exam) {
    const workspace = $("#examWorkspace");
    if (!workspace) return;
    workspace.hidden = false;
    workspace.setAttribute("aria-hidden", "false");
    workspace.innerHTML = `<section class="evolution-v6-exam-shell">
      <header class="evolution-v6-exam-head">
        <div><span>AVALIAÇÃO ATIVA</span><h2>${esc(exam.title)}</h2><p>${esc(exam.difficulty)} • ${exam.totalQuestions} questões • nota mínima ${number(exam.minScore)}%</p></div>
        <div class="evolution-v6-exam-progress"><strong id="evolutionExamAnswered">0/${exam.totalQuestions}</strong><small>respondidas</small></div>
      </header>
      <form id="evolutionExamForm" class="evolution-v6-question-list">
        ${exam.questions.map((question, index) => `<fieldset class="evolution-v6-question" data-question="${esc(question.id)}">
          <legend><span>${String(index + 1).padStart(2, "0")}</span><div><small>${esc(question.moduleName)}</small><strong>${esc(question.prompt)}</strong></div></legend>
          <div class="evolution-v6-options">${question.alternatives.map((alternative) => `<label><input type="radio" name="${esc(question.id)}" value="${esc(alternative.id)}"><span>${esc(alternative.text)}</span></label>`).join("")}</div>
        </fieldset>`).join("")}
        <footer class="evolution-v6-exam-footer"><div><strong>Revise antes de enviar</strong><small>O resultado é calculado no servidor e entra na sua evolução.</small></div><button type="submit" class="evolution-v6-primary">Finalizar prova</button></footer>
      </form>
    </section>`;
    const form = $("#evolutionExamForm", workspace);
    const updateAnswered = () => {
      const answered = new Set($$('input[type="radio"]:checked', form).map((input) => input.name)).size;
      const label = $("#evolutionExamAnswered", workspace);
      if (label) label.textContent = `${answered}/${exam.totalQuestions}`;
    };
    form.addEventListener("change", updateAnswered);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const answers = exam.questions.map((question) => {
        const checked = $(`input[name="${CSS.escape(question.id)}"]:checked`, form);
        return checked ? { questionId: question.id, alternativeId: checked.value } : null;
      }).filter(Boolean);
      if (answers.length !== exam.totalQuestions) return toast(`Responda as ${exam.totalQuestions} questões antes de finalizar.`, "error");
      const button = $('button[type="submit"]', form);
      button.disabled = true;
      button.textContent = "Corrigindo…";
      try {
        const data = await api("/student/provas/finalizar", { method: "POST", body: { attemptId: exam.id, answers } });
        renderExamResult(data.result);
        await refreshExamAgenda();
      } catch (error) {
        toast(error.message, "error");
        button.disabled = false;
        button.textContent = "Finalizar prova";
      }
    });
    workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderExamResult(result) {
    const workspace = $("#examWorkspace");
    if (!workspace) return;
    const review = Array.isArray(result.review) ? result.review : [];
    workspace.innerHTML = `<section class="evolution-v6-result ${result.approved ? "approved" : "retry"}">
      <div class="evolution-v6-result-score"><span>${result.approved ? "✓" : "↻"}</span><strong>${number(result.score, 1)}%</strong><small>${result.approved ? "Aprovado" : "Continue estudando"}</small></div>
      <div class="evolution-v6-result-copy"><span>RESULTADO • ${esc(result.title)}</span><h2>${result.correct} acertos de ${result.total}</h2><p>Nota mínima: ${number(result.minScore)}%. O histórico e a Jornada do Primo já foram atualizados na sua conta.</p></div>
    </section>
    <section class="evolution-v6-review"><header><span>CORREÇÃO COMENTADA</span><h3>Revise os pontos da prova</h3></header>
      ${review.map((item, index) => `<article class="${item.ok ? "ok" : "wrong"}"><b>${index + 1}</b><div><strong>${esc(item.moduleName)} • ${item.ok ? "Acertou" : "Revise"}</strong><p>Resposta correta: <em>${esc(item.correctAnswer)}</em></p><small>${esc(item.explanation)}</small></div></article>`).join("")}
    </section>`;
    workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderExamHistory(data) {
    const workspace = $("#examWorkspace");
    if (!workspace) return;
    workspace.hidden = false;
    workspace.setAttribute("aria-hidden", "false");
    const items = data.history || [];
    workspace.innerHTML = `<section class="evolution-v6-history"><header><div><span>HISTÓRICO</span><h2>Suas provas</h2></div><div class="evolution-v6-history-summary"><b>${data.summary?.taken || 0}</b><small>realizadas</small><b>${number(data.summary?.average || 0, 1)}%</b><small>média</small></div></header>
      <div class="evolution-v6-history-list">${items.length ? items.map((item) => `<article><span class="type ${esc(item.type)}">${esc(examTypeLabel(item.type))}</span><div><strong>${esc(item.title)}</strong><small>${esc(String(item.date || ""))} • ${esc(item.difficulty || "")}</small></div><b>${item.status === "finished" ? `${number(item.score, 1)}%` : "Em andamento"}</b></article>`).join("") : '<div class="evolution-v6-empty">Você ainda não realizou nenhuma prova.</div>'}</div>
    </section>`;
    workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateExamMetrics(summary = {}) {
    const ring = $(".exam-score-ring strong");
    if (ring) ring.textContent = `${Math.round(Number(summary.average || 0))}%`;
    const ringLabel = $(".exam-score-ring small");
    if (ringLabel) ringLabel.textContent = summary.taken ? "Média geral" : "Aguardando provas";
    const stats = $$(".exam-stat-list span b");
    if (stats[0]) stats[0].textContent = String(summary.taken || 0);
    if (stats[1]) stats[1].textContent = String(summary.correct || 0);
    if (stats[2]) stats[2].textContent = `${number(summary.accuracy || 0, 0)}% acerto`;
    const caption = $(".exam-score-caption");
    if (caption) caption.textContent = summary.taken ? `Melhor nota: ${number(summary.best || 0, 1)}% • ${summary.questions || 0} questões respondidas.` : "Faça a prova disponível hoje para iniciar seu histórico de evolução.";
  }

  async function startExam(type, button) {
    const previous = button.textContent;
    button.disabled = true;
    button.textContent = "Montando sua prova…";
    try {
      const data = await api("/student/provas/iniciar", { method: "POST", body: { type } });
      renderExamWorkspace(data.exam);
      toast("Prova gerada. Boa avaliação!");
    } catch (error) {
      toast(error.message, "error");
      button.disabled = false;
      button.textContent = previous;
    }
  }

  function decorateExamCard(config) {
    const button = $(`[data-exam-locked="${config.type}"]`) || $(`[data-evolution-exam-type="${config.type}"]`);
    if (!button) return;
    const card = button.closest(".exam-card");
    if (!card) return;
    const meta = $$(".exam-card-meta span", card);
    if (meta[0]) meta[0].textContent = `${config.questions} questões`;
    if (meta[1]) meta[1].textContent = config.difficulty;
    const schedule = $(".exam-schedule", card);
    if (schedule) schedule.textContent = examScheduleLabel(config.type);
    const description = $(".exam-card-desc", card);
    if (description) description.textContent = config.type === "daily"
      ? `Avaliação de segunda a sexta com dificuldade progressiva. Hoje: ${config.difficulty}.`
      : config.type === "weekly"
        ? "Revisão de sábado com 20 questões misturando os módulos estudados na semana."
        : "O desafio máximo de domingo: 25 questões diferentes baseadas nos conteúdos da plataforma.";
    const replacement = button.cloneNode(true);
    button.replaceWith(replacement);
    replacement.removeAttribute("data-exam-locked");
    replacement.dataset.evolutionExamType = config.type;
    replacement.disabled = !config.available || config.attemptsRemaining <= 0;
    replacement.classList.toggle("evolution-v6-available", config.available && config.attemptsRemaining > 0);
    replacement.textContent = config.available
      ? config.attemptsRemaining > 0
        ? `Começar • ${config.attemptsRemaining} tentativa${config.attemptsRemaining === 1 ? "" : "s"}`
        : "Tentativas de hoje concluídas"
      : `Disponível ${config.type === "daily" ? "de segunda a sexta" : config.type === "weekly" ? "no sábado" : "no domingo"}`;
    if (config.available && config.attemptsRemaining > 0) replacement.addEventListener("click", () => startExam(config.type, replacement));
    card.classList.toggle("evolution-v6-today", config.available);
  }

  async function refreshExamAgenda() {
    if (route() !== "/provas") return;
    const data = await api("/student/provas/agenda");
    data.cards.forEach(decorateExamCard);
    updateExamMetrics(data.summary);
    return data;
  }

  async function enhanceExams() {
    if (route() !== "/provas") return;
    await new Promise((resolve) => setTimeout(resolve, 650));
    try {
      const data = await refreshExamAgenda();
      const note = $(".exam-note");
      if (note) note.innerHTML = `<span>✓</span><div><strong>Sistema de provas ativo</strong><p>As questões são montadas a partir dos módulos da plataforma, sem expor o gabarito no navegador. Cada tentativa entra no seu histórico e na Jornada do Primo.</p></div>`;
      const oldHistory = $("#examHistoryBtn");
      if (oldHistory) {
        const history = oldHistory.cloneNode(true);
        oldHistory.replaceWith(history);
        history.addEventListener("click", () => renderExamHistory(data));
      }
    } catch (error) {
      toast(`Provas: ${error.message}`, "error");
    }
  }

  function journeyMarkup(data, compact = false) {
    const journey = data.journey || {};
    const levels = Array.isArray(journey.levels) ? journey.levels : [];
    const current = journey.current || { title: "Nível 01 — Fundamentos" };
    const today = data.today || {};
    return `<section class="evolution-v6-journey ${compact ? "compact" : ""}">
      <div class="evolution-v6-journey-head"><div><span>JORNADA DO PRIMO</span><h2>${esc(current.title)}</h2><p>Estudo, provas e consistência agora formam uma única evolução.</p></div><div class="evolution-v6-score"><strong>${journey.score || 0}%</strong><small>evolução geral</small></div></div>
      <div class="evolution-v6-levels">${levels.map((level, index) => `<div class="${esc(level.status)}"><span>${level.status === "completed" ? "✓" : String(index + 1).padStart(2, "0")}</span><small>${esc(level.title.replace(/^Nível \d+ — /, ""))}</small></div>`).join("")}</div>
      <div class="evolution-v6-journey-bottom"><div><small>ESTUDO</small><strong>${data.study?.progressoGeral || 0}%</strong><span>${data.study?.modulosConcluidos || 0}/${data.study?.totalModulos || 8} módulos</span></div><div><small>PROVAS</small><strong>${number(data.exams?.average || 0, 1)}%</strong><span>${data.exams?.taken || 0} realizadas</span></div><a href="/provas"><small>HOJE</small><strong>${esc(today.title || "Provas")}</strong><span>${today.available ? `${today.questions} questões • ${esc(today.difficulty)}` : "Veja a agenda"} →</span></a></div>
    </section>`;
  }

  async function enhanceDashboard() {
    if (route() !== "/dashboard") return;
    try {
      const data = await api("/student/evolution/home");
      if (!$("#evolutionJourneyDashboard")) {
        const wrapper = document.createElement("div");
        wrapper.id = "evolutionJourneyDashboard";
        wrapper.innerHTML = journeyMarkup(data);
        const tools = $(".tools-section");
        tools?.parentNode?.insertBefore(wrapper, tools);
      }
      const average = $("#averageStat");
      if (average) average.textContent = data.exams?.taken ? `${number(data.exams.average, 1)}%` : "—";
      const examLabel = $("#examLabel");
      if (examLabel) examLabel.textContent = data.exams?.taken ? `${data.exams.taken} prova${data.exams.taken === 1 ? "" : "s"} realizada${data.exams.taken === 1 ? "" : "s"}` : `${data.today?.title || "Prova"} • ${data.today?.questions || 0} questões`;
    } catch (_) {}
  }

  async function enhanceProfile() {
    if (route() !== "/perfil") return;
    try {
      const data = await api("/student/evolution/home");
      if ($("#profileStatModules")) $("#profileStatModules").textContent = String(data.study?.modulosConcluidos || 0);
      if ($("#profileStatModulesTotal")) $("#profileStatModulesTotal").textContent = `de ${data.study?.totalModulos || 8}`;
      if ($("#profileStatAverage")) $("#profileStatAverage").textContent = number(data.exams?.average || 0, 1);
      if ($("#profileStatProgress")) $("#profileStatProgress").textContent = `${data.journey?.score || 0}%`;
      if ($("#profileStatFocus")) $("#profileStatFocus").textContent = String(data.study?.diasFoco || 0);
      if (!$("#profileEvolutionV6")) {
        const card = document.createElement("section");
        card.id = "profileEvolutionV6";
        card.className = "profile-card evolution-v6-profile-card";
        card.innerHTML = `<div class="evolution-v6-profile-title"><span>MINHA EVOLUÇÃO</span><h2>${esc(data.journey?.current?.title || "Jornada do Primo")}</h2><p>Seu relatório cruza aprendizado, foco e desempenho nas avaliações.</p></div><div class="evolution-v6-profile-metrics"><article><small>Provas realizadas</small><strong>${data.exams?.taken || 0}</strong></article><article><small>Melhor nota</small><strong>${number(data.exams?.best || 0, 1)}%</strong></article><article><small>Taxa de acerto</small><strong>${number(data.exams?.accuracy || 0, 1)}%</strong></article><article><small>Questões respondidas</small><strong>${data.exams?.questions || 0}</strong></article></div><a href="/provas">Abrir histórico de provas →</a>`;
        $(".profile-identity-card")?.insertAdjacentElement("afterend", card);
      }
    } catch (_) {}
  }

  function normalizeFavoritePracticeCards() {
    const legacyFilter = $('[data-favorite-filter="minigame"]');
    legacyFilter?.remove();
    $$('.favorite-card.minigame').forEach((card) => {
      const type = $(".favorite-card-type", card);
      if (type) type.textContent = "PRÁTICA DO MÓDULO";
      const link = $("a.favorite-card-open", card);
      if (link) link.href = "/estudo";
    });
  }

  function enhanceFavorites() {
    if (route() !== "/favoritos") return;
    normalizeFavoritePracticeCards();
    const observer = new MutationObserver(normalizeFavoritePracticeCards);
    const grid = $("#favoritesGrid");
    if (grid) observer.observe(grid, { childList: true, subtree: true });
  }

  async function renderAdminAcademy(section) {
    try {
      const [overview, exams] = await Promise.all([api("/admin/evolution/overview"), api("/admin/evolution/exams?limit=100")]);
      section.innerHTML = `<div class="evolution-v6-admin-head"><div><span>ACADEMIA & JORNADA</span><h2>Aprendizado em tempo real</h2><p>Provas, evolução e gestão dos alunos em uma visão operacional.</p></div><a href="/provas">Ver experiência do aluno ↗</a></div>
      <div class="evolution-v6-admin-kpis"><article><small>Tentativas</small><strong>${overview.exams?.attempts || 0}</strong><span>${overview.exams?.finished || 0} finalizadas</span></article><article><small>Média geral</small><strong>${number(overview.exams?.averageScore || 0, 1)}%</strong><span>avaliações concluídas</span></article><article><small>Alunos em provas</small><strong>${overview.exams?.students || 0}</strong><span>contas com tentativa</span></article><article><small>Gestão configurada</small><strong>${overview.management?.configured || 0}</strong><span>contas sincronizadas</span></article></div>
      <div class="evolution-v6-admin-table"><header><div><span>RESULTADOS RECENTES</span><h3>Provas geradas pela plataforma</h3></div></header><div class="evolution-v6-table-scroll"><table><thead><tr><th>Aluno</th><th>Prova</th><th>Dificuldade</th><th>Data</th><th>Resultado</th><th>Status</th></tr></thead><tbody>${(exams.attempts || []).map((item) => `<tr><td><strong>${esc(item.userName || "Aluno")}</strong><small>${esc(item.userEmail || "")}</small></td><td>${esc(examTypeLabel(item.type))}</td><td>${esc(item.difficulty || "")}</td><td>${esc(String(item.date || ""))}</td><td><b>${item.status === "finished" ? `${number(item.score, 1)}%` : "—"}</b><small>${item.correct || 0}/${item.total || 0}</small></td><td><span class="status ${esc(item.status)}">${item.status === "finished" ? "Finalizada" : "Em andamento"}</span></td></tr>`).join("") || '<tr><td colspan="6">Nenhuma prova realizada ainda.</td></tr>'}</tbody></table></div></div>`;
    } catch (error) {
      section.innerHTML = `<div class="evolution-v6-admin-error"><strong>Academia indisponível para este perfil</strong><p>${esc(error.message)}</p></div>`;
      throw error;
    }
  }

  async function enhanceAdmin() {
    if (!route().includes("/admin") && route() !== "/painel-admin") return;
    await new Promise((resolve) => setTimeout(resolve, 500));
    const nav = $("#adminNav");
    const content = $(".admin-content");
    if (!nav || !content || $("[data-v6-academy]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-nav-item";
    button.dataset.v6Academy = "1";
    button.innerHTML = '<span class="admin-nav-icon">⌁</span><span>Academia & Jornada</span>';
    const platformLabel = $$(".admin-nav-label", nav).find((item) => item.textContent.includes("PLATAFORMA"));
    platformLabel?.insertAdjacentElement("afterend", button);
    if (!platformLabel) nav.appendChild(button);
    const section = document.createElement("section");
    section.className = "admin-section evolution-v6-admin-section";
    section.id = "section-academy-v6";
    content.appendChild(section);
    button.addEventListener("click", async () => {
      $$(".admin-nav-item", nav).forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      $$(".admin-section", content).forEach((item) => item.classList.remove("active"));
      section.classList.add("active");
      const title = $("#adminPageTitle");
      if (title) title.textContent = "Academia & Jornada";
      section.innerHTML = '<div class="evolution-v6-admin-loading">Carregando evolução dos alunos…</div>';
      try { await renderAdminAcademy(section); } catch (error) {
        if (error.status === 403) { button.remove(); section.remove(); }
      }
    });
  }

  function markRelease() {
    document.documentElement.dataset.evolutionRelease = RELEASE;
  }

  async function init() {
    injectCss();
    markRelease();
    const tasks = [enhanceManagement(), enhanceExams(), enhanceDashboard(), enhanceProfile(), enhanceFavorites(), enhanceAdmin()];
    await Promise.allSettled(tasks);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
