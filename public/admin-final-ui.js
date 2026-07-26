"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const state = { results: [], timer: null, applying: false };
  const $ = (id) => document.getElementById(id);

  function getToken() {
    for (const key of TOKEN_KEYS) {
      try {
        const value = sessionStorage.getItem(key);
        if (value) return value;
      } catch (_) {}
    }
    return "";
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  async function api(endpoint, options = {}) {
    const response = await fetch(`${window.location.origin}${endpoint}`, {
      method: options.method || "GET",
      headers: {
        Accept: options.accept || "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      cache: "no-store"
    });

    if (options.raw) return response;

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) {
      throw new Error(data.erro || data.mensagem || `Erro ${response.status}.`);
    }
    return data;
  }

  function resultsMarkup() {
    return `
      <div class="admin-section-head admin-results-heading">
        <div>
          <span class="admin-kicker">DESEMPENHO DOS MÓDULOS</span>
          <h2>Relatórios de Provas</h2>
          <p>Acompanhe cada tentativa, nota, acertos e erros. Os relatórios corrigidos ficam disponíveis por aluno.</p>
        </div>
        <button class="admin-primary-btn" type="button" id="refreshExamResults">↻ Atualizar resultados</button>
      </div>

      <div class="admin-mini-stat-grid admin-results-stats">
        <article><small>Resultados</small><strong id="examResultTotal">0</strong><em>tentativas registradas</em></article>
        <article><small>Aprovados</small><strong id="examResultApproved">0</strong><em>nota mínima atingida</em></article>
        <article><small>Reprovados</small><strong id="examResultFailed">0</strong><em>precisam revisar</em></article>
        <article><small>Em análise</small><strong id="examResultReview">0</strong><em>correção pendente</em></article>
      </div>

      <div class="admin-panel-card admin-results-panel">
        <div class="admin-filterbar admin-results-filterbar">
          <div class="admin-search">
            <span>⌕</span>
            <input id="examResultSearch" type="search" placeholder="Buscar aluno, módulo, e-mail ou prova" />
          </div>
          <select id="examResultStatus" aria-label="Filtrar resultados">
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
            <p>Questões erradas recebem a indicação da alternativa correta para facilitar o acompanhamento do aluno.</p>
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

  function applyResultsUI() {
    const nav = document.querySelector('[data-section="exam-results"]') ||
      document.querySelector('[data-section="exams"]');

    if (nav) {
      nav.dataset.section = "exam-results";
      nav.setAttribute("aria-label", "Relatórios de Provas");
      const label = nav.querySelector("span:last-of-type");
      if (label) label.textContent = "Relatórios de Provas";
    }

    const section = $("section-exam-results") || $("section-exams");
    if (section) {
      section.id = "section-exam-results";
      section.dataset.title = "Relatórios de Provas";
      if (!$("examResultsTableBody") || section.querySelector("#newExamButton")) {
        section.innerHTML = resultsMarkup();
      }
    }

    document
      .querySelectorAll('#newExamButton, #examModal, [data-open-modal="exam"], [data-exam-action]')
      .forEach((element) => element.remove());
  }

  function applyPeriodSwitch() {
    const select = $("overviewChartPeriod");
    if (!select || select.closest(".admin-period-switch")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "admin-period-switch";
    wrapper.setAttribute("role", "group");
    wrapper.setAttribute("aria-label", "Período do gráfico");

    [
      ["7", "7 dias"],
      ["14", "14 dias"],
      ["30", "30 dias"]
    ].forEach(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.overviewDays = value;
      button.textContent = label;
      button.className = value === String(select.value || "7") ? "active" : "";
      wrapper.appendChild(button);
    });

    select.classList.add("admin-period-native");
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
  }

  function applyFinalUI() {
    if (state.applying) return;
    state.applying = true;
    try {
      applyResultsUI();
      applyPeriodSwitch();
    } finally {
      state.applying = false;
    }
  }

  async function loadResults() {
    const body = $("examResultsTableBody");
    if (!body) return;

    body.innerHTML = '<tr><td colspan="8"><div class="admin-empty-state">Carregando resultados…</div></td></tr>';
    const search = encodeURIComponent($("examResultSearch")?.value.trim() || "");
    const status = encodeURIComponent($("examResultStatus")?.value || "");

    try {
      const [summaryResponse, listResponse] = await Promise.all([
        api("/admin/provas/resumo"),
        api(`/admin/provas/resultados-v2?busca=${search}&status=${status}&limite=300`)
      ]);

      const summary = summaryResponse.resumo || {};
      if ($("examResultTotal")) $("examResultTotal").textContent = formatNumber(summary.resultados || 0);
      if ($("examResultApproved")) $("examResultApproved").textContent = formatNumber(summary.aprovados || 0);
      if ($("examResultFailed")) $("examResultFailed").textContent = formatNumber(summary.reprovados || 0);
      if ($("examResultReview")) $("examResultReview").textContent = formatNumber(summary.emAnalise || 0);

      state.results = Array.isArray(listResponse.resultados) ? listResponse.resultados : [];
      renderResults();
    } catch (error) {
      body.innerHTML = `<tr><td colspan="8"><div class="admin-empty-state">${escapeHTML(error.message)}</div></td></tr>`;
    }
  }

  function renderResults() {
    const body = $("examResultsTableBody");
    if (!body) return;

    if (!state.results.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="admin-empty-state admin-results-empty"><b>Nenhum resultado registrado</b><span>Os resultados aparecerão aqui assim que os alunos concluírem as provas dos módulos.</span></div></td></tr>';
      return;
    }

    body.innerHTML = state.results.map((item) => {
      const id = item.id || item._id || "";
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
          <td data-label="Relatório">${id ? `<button class="admin-primary-btn admin-pdf-button" type="button" data-final-download-result="${escapeHTML(id)}">Baixar PDF</button>` : "—"}</td>
        </tr>`;
    }).join("");
  }

  async function downloadResult(id, button) {
    if (!id || !button) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Gerando…";

    try {
      const response = await api(
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
    } catch (error) {
      window.alert(error.message);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function registerEvents() {
    document.addEventListener("click", (event) => {
      const periodButton = event.target.closest("[data-overview-days]");
      if (periodButton) {
        const select = $("overviewChartPeriod");
        if (!select) return;
        select.value = periodButton.dataset.overviewDays;
        document.querySelectorAll("[data-overview-days]").forEach((button) => {
          button.classList.toggle("active", button === periodButton);
        });
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      if (event.target.closest('[data-section="exam-results"]')) {
        setTimeout(loadResults, 40);
      }

      if (event.target.closest("#refreshExamResults")) {
        loadResults();
      }

      const downloadButton = event.target.closest("[data-final-download-result]");
      if (downloadButton) {
        downloadResult(downloadButton.dataset.finalDownloadResult, downloadButton);
      }
    });

    document.addEventListener("input", (event) => {
      if (event.target.id !== "examResultSearch") return;
      clearTimeout(state.timer);
      state.timer = setTimeout(loadResults, 350);
    });

    document.addEventListener("change", (event) => {
      if (event.target.id === "examResultStatus") loadResults();
    });
  }

  function init() {
    registerEvents();
    applyFinalUI();
    setTimeout(applyFinalUI, 100);
    setTimeout(applyFinalUI, 500);

    const observer = new MutationObserver(() => {
      clearTimeout(state.applyTimer);
      state.applyTimer = setTimeout(applyFinalUI, 30);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
