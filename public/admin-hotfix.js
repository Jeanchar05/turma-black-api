"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (id) => document.getElementById(id);

  const state = {
    dev: false,
    currentUserId: "",
    fallbackResults: false,
    resultTimer: null,
    results: []
  };

  document.addEventListener("DOMContentLoaded", init, { once: true });

  function getToken() {
    for (const key of TOKEN_KEYS) {
      try {
        const value = sessionStorage.getItem(key);
        if (value) return value;
      } catch (_) {}
    }
    return "";
  }

  async function request(endpoint, options = {}) {
    const token = getToken();
    if (!token) throw new Error("Sessão expirada.");

    const response = await fetch(`${window.location.origin}${endpoint}`, {
      method: options.method || "GET",
      headers: {
        Accept: options.accept || "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });

    if (options.raw) return response;

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) {
      throw new Error(data.erro || data.mensagem || `Erro ${response.status}.`);
    }
    return data;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message, type = "success") {
    const stack = $("adminToastStack");
    if (!stack) return;

    const item = document.createElement("div");
    item.className = `admin-toast ${type}`;
    item.innerHTML = `<b>${type === "error" ? "!" : "✓"}</b><span>${escapeHTML(message)}</span>`;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => {
      item.classList.remove("show");
      setTimeout(() => item.remove(), 220);
    }, 4200);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function statusLabel(status) {
    const labels = {
      aprovado: "Aprovado",
      reprovado: "Reprovado",
      em_analise: "Em análise",
      pendente: "Pendente"
    };
    return labels[status] || status || "Pendente";
  }

  async function init() {
    setTimeout(ensureResultsInterface, 120);

    try {
      const context = await request("/admin/painel/contexto");
      state.dev = Boolean(context.centralDev || context.cargo === "dev");
      state.currentUserId = String(context.usuario?.id || context.usuario?._id || "");
    } catch (_) {
      state.dev = false;
    }

    if (state.dev) {
      enhanceDeleteControls();
      observeDynamicLists();
    }

    registerEvents();
  }

  function resultsMarkup() {
    return `
      <div class="admin-section-head">
        <div>
          <span class="admin-kicker">MÓDULOS DE ESTUDO</span>
          <h2>Resultados dos alunos</h2>
          <p>Consulte as tentativas por módulo e baixe o PDF corrigido com as respostas do aluno e o gabarito nas questões erradas.</p>
        </div>
        <button class="admin-primary-btn" type="button" id="refreshExamResults">↻ Atualizar</button>
      </div>

      <div class="admin-mini-stat-grid">
        <article><small>Resultados</small><strong id="examResultTotal">0</strong></article>
        <article><small>Aprovados</small><strong id="examResultApproved">0</strong></article>
        <article><small>Reprovados</small><strong id="examResultFailed">0</strong></article>
        <article><small>Em análise</small><strong id="examResultReview">0</strong></article>
      </div>

      <div class="admin-panel-card">
        <div class="admin-filterbar">
          <div class="admin-search">
            <span>⌕</span>
            <input id="examResultSearch" type="search" placeholder="Buscar aluno, módulo, e-mail ou prova" />
          </div>
          <select id="examResultStatus">
            <option value="">Todos os resultados</option>
            <option value="aprovado">Aprovados</option>
            <option value="reprovado">Reprovados</option>
            <option value="em_analise">Em análise</option>
            <option value="pendente">Pendentes</option>
          </select>
        </div>

        <div class="admin-results-help">
          <span>PDF</span>
          <div>
            <strong>Relatório corrigido automaticamente</strong>
            <p>As provas são vinculadas aos módulos de estudo. Questões erradas recebem uma seta indicando a resposta correta.</p>
          </div>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table admin-results-table">
            <thead>
              <tr>
                <th>Aluno</th><th>Módulo</th><th>Prova</th><th>Nota</th>
                <th>Acertos / erros</th><th>Status</th><th>Data</th><th>Relatório</th>
              </tr>
            </thead>
            <tbody id="examResultsTableBody">
              <tr><td colspan="8"><div class="admin-empty-state">Carregando resultados…</div></td></tr>
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function ensureResultsInterface() {
    const oldButton = document.querySelector('[data-section="exams"]');
    const currentButton = document.querySelector('[data-section="exam-results"]');
    const navButton = currentButton || oldButton;

    if (navButton) {
      navButton.dataset.section = "exam-results";
      const label = navButton.querySelector("span:last-of-type");
      if (label) label.textContent = "Relatórios de Provas";
    }

    const oldSection = $("section-exams");
    const currentSection = $("section-exam-results");
    const section = currentSection || oldSection;

    if (section) {
      section.id = "section-exam-results";
      section.dataset.title = "Relatórios de Provas";

      if (!$("examResultsTableBody")) {
        section.innerHTML = resultsMarkup();
        state.fallbackResults = true;
      }
    }

    document
      .querySelectorAll('#newExamButton, #examModal, [data-open-modal="exam"], [data-exam-action]')
      .forEach((element) => element.remove());
  }

  async function loadResultsFallback() {
    if (!state.fallbackResults || !$("examResultsTableBody")) return;

    const body = $("examResultsTableBody");
    body.innerHTML = '<tr><td colspan="8"><div class="admin-empty-state">Carregando resultados…</div></td></tr>';

    const search = encodeURIComponent($("examResultSearch")?.value.trim() || "");
    const status = encodeURIComponent($("examResultStatus")?.value || "");

    try {
      const [summaryResponse, listResponse] = await Promise.all([
        request("/admin/provas/resumo"),
        request(`/admin/provas/resultados-v2?busca=${search}&status=${status}&limite=300`)
      ]);

      const summary = summaryResponse.resumo || {};
      if ($("examResultTotal")) $("examResultTotal").textContent = formatNumber(summary.resultados || 0);
      if ($("examResultApproved")) $("examResultApproved").textContent = formatNumber(summary.aprovados || 0);
      if ($("examResultFailed")) $("examResultFailed").textContent = formatNumber(summary.reprovados || 0);
      if ($("examResultReview")) $("examResultReview").textContent = formatNumber(summary.emAnalise || 0);

      state.results = listResponse.resultados || [];
      renderResultsFallback();
    } catch (error) {
      body.innerHTML = `<tr><td colspan="8"><div class="admin-empty-state">${escapeHTML(error.message)}</div></td></tr>`;
      toast(error.message, "error");
    }
  }

  function renderResultsFallback() {
    const body = $("examResultsTableBody");
    if (!body) return;

    if (!state.results.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="admin-empty-state">Nenhum resultado encontrado.</div></td></tr>';
      return;
    }

    body.innerHTML = state.results.map((item) => {
      const id = item.id || item._id;
      const score = Number(item.nota || 0);
      const status = String(item.status || "pendente");
      const approved = score >= Number(item.notaMinima || 70);

      return `
        <tr>
          <td data-label="Aluno"><div class="admin-result-person"><b>${escapeHTML(item.usuarioNome || "Aluno")}</b><small>${escapeHTML(item.usuarioEmail || "")}</small></div></td>
          <td data-label="Módulo"><span class="admin-chip">${escapeHTML(item.provaModulo || "Sem módulo")}</span></td>
          <td data-label="Prova"><strong>${escapeHTML(item.provaTitulo || "Prova")}</strong></td>
          <td data-label="Nota"><span class="admin-result-score ${approved ? "approved" : "failed"}">${score.toFixed(0)}%</span></td>
          <td data-label="Acertos / erros"><span class="admin-result-count good">${formatNumber(item.acertos)} acerto(s)</span><span class="admin-result-count bad">${formatNumber(item.erros)} erro(s)</span></td>
          <td data-label="Status"><span class="admin-result-status ${escapeHTML(status)}">${escapeHTML(statusLabel(status))}</span></td>
          <td data-label="Data">${escapeHTML(formatDate(item.finalizadoEm || item.createdAt))}</td>
          <td data-label="Relatório"><button class="admin-primary-btn admin-pdf-button" type="button" data-hotfix-download-result="${escapeHTML(id)}">Baixar PDF</button></td>
        </tr>`;
    }).join("");
  }

  async function downloadResult(id, button) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Gerando…";

    try {
      const response = await request(
        `/admin/provas/resultados/${encodeURIComponent(id)}/relatorio.pdf`,
        { accept: "application/pdf", raw: true }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.erro || "Não foi possível gerar o PDF.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `resultado-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast("PDF gerado com sucesso.");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function observeDynamicLists() {
    const observer = new MutationObserver(() => enhanceDeleteControls());
    const students = $("studentsTableBody");
    const team = $("teamGrid");
    if (students) observer.observe(students, { childList: true, subtree: true });
    if (team) observer.observe(team, { childList: true, subtree: true });
  }

  function enhanceDeleteControls() {
    if (!state.dev) return;

    document.querySelectorAll("#studentsTableBody tr").forEach((row) => {
      const source = row.querySelector("[data-action][data-id]");
      const actions = row.querySelector(".admin-table-actions");
      const id = source?.dataset.id;
      if (!actions || !id || String(id) === state.currentUserId || actions.querySelector("[data-dev-delete-user]")) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-dev-delete-btn";
      button.dataset.devDeleteUser = id;
      button.dataset.devDeleteScope = "student";
      button.textContent = "Apagar usuário";
      actions.appendChild(button);
    });

    document.querySelectorAll("#teamGrid .admin-team-card").forEach((card) => {
      const source = card.querySelector("[data-action][data-id]");
      const actions = card.querySelector(".admin-team-actions");
      const id = source?.dataset.id;
      if (!actions || !id || String(id) === state.currentUserId || actions.querySelector("[data-dev-delete-user]")) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-dev-delete-btn";
      button.dataset.devDeleteUser = id;
      button.dataset.devDeleteScope = "team";
      button.textContent = "Apagar membro";
      actions.appendChild(button);
    });
  }

  async function deleteUser(id, scope, button) {
    if (!state.dev || !id) return;

    const label = scope === "team" ? "membro da equipe" : "usuário";
    const accepted = window.confirm(
      `Apagar definitivamente este ${label}?\n\nEsta ação remove a conta do banco de dados e não pode ser desfeita.`
    );
    if (!accepted) return;

    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Apagando…";

    try {
      const data = await request(`/admin/dev/usuarios/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast(data.mensagem || "Conta apagada com sucesso.");

      if (scope === "team") $("refreshTeam")?.click();
      else $("refreshStudents")?.click();
    } catch (error) {
      toast(error.message, "error");
      button.disabled = false;
      button.textContent = original;
    }
  }

  function registerEvents() {
    document.addEventListener("click", (event) => {
      const resultSection = event.target.closest('[data-section="exam-results"]');
      if (resultSection && state.fallbackResults) setTimeout(loadResultsFallback, 0);

      if (event.target.closest("#refreshExamResults") && state.fallbackResults) {
        loadResultsFallback();
      }

      const downloadButton = event.target.closest("[data-hotfix-download-result]");
      if (downloadButton) {
        downloadResult(downloadButton.dataset.hotfixDownloadResult, downloadButton);
      }

      const deleteButton = event.target.closest("[data-dev-delete-user]");
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        deleteUser(
          deleteButton.dataset.devDeleteUser,
          deleteButton.dataset.devDeleteScope,
          deleteButton
        );
      }
    });

    document.addEventListener("input", (event) => {
      if (event.target.id !== "examResultSearch" || !state.fallbackResults) return;
      clearTimeout(state.resultTimer);
      state.resultTimer = setTimeout(loadResultsFallback, 350);
    });

    document.addEventListener("change", (event) => {
      if (event.target.id === "examResultStatus" && state.fallbackResults) {
        loadResultsFallback();
      }
    });
  }
})();
