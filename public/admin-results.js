"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const state = { resultados: [], timer: null };
  const $ = (id) => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", iniciar, { once: true });

  function token() {
    for (const chave of TOKEN_KEYS) {
      try {
        const valor = sessionStorage.getItem(chave);
        if (valor) return valor;
      } catch (_) {}
    }
    return "";
  }

  async function api(endpoint) {
    const resposta = await fetch(`${window.location.origin}${endpoint}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token()}`
      },
      cache: "no-store"
    });

    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok || dados.erro) {
      throw new Error(dados.erro || "Não foi possível carregar os resultados.");
    }
    return dados;
  }

  function escapar(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function numero(valor) {
    return new Intl.NumberFormat("pt-BR").format(Number(valor || 0));
  }

  function data(valor) {
    if (!valor) return "-";
    const final = new Date(valor);
    if (Number.isNaN(final.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(final);
  }

  function rotuloStatus(status) {
    const mapa = {
      aprovado: "Aprovado",
      reprovado: "Reprovado",
      em_analise: "Em análise",
      pendente: "Pendente"
    };
    return mapa[status] || status || "Pendente";
  }

  function avisar(mensagem, tipo = "success") {
    const pilha = $("adminToastStack");
    if (!pilha) return;

    const item = document.createElement("div");
    item.className = `admin-toast ${tipo}`;
    item.innerHTML = `<b>${tipo === "error" ? "!" : "✓"}</b><span>${escapar(mensagem)}</span>`;
    pilha.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => {
      item.classList.remove("show");
      setTimeout(() => item.remove(), 220);
    }, 3800);
  }

  function markupResultados() {
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

  function prepararInterface() {
    const botaoAntigo = document.querySelector('[data-section="exams"]');
    if (botaoAntigo) {
      botaoAntigo.dataset.section = "exam-results";
      const rotulo = botaoAntigo.querySelector("span:last-of-type");
      if (rotulo) rotulo.textContent = "Relatórios de Provas";
    }

    const secaoAntiga = $("section-exams");
    if (secaoAntiga) {
      secaoAntiga.id = "section-exam-results";
      secaoAntiga.dataset.title = "Relatórios de Provas";
      secaoAntiga.innerHTML = markupResultados();
    }

    document
      .querySelectorAll('#newExamButton, #examModal, [data-open-modal="exam"], [data-exam-action]')
      .forEach((elemento) => elemento.remove());
  }

  async function carregar() {
    const corpo = $("examResultsTableBody");
    if (!corpo) return;

    corpo.innerHTML = '<tr><td colspan="8"><div class="admin-empty-state">Carregando resultados…</div></td></tr>';
    const busca = encodeURIComponent($("examResultSearch")?.value.trim() || "");
    const status = encodeURIComponent($("examResultStatus")?.value || "");

    try {
      const [resumo, lista] = await Promise.all([
        api("/admin/provas/resumo"),
        api(`/admin/provas/resultados-v2?busca=${busca}&status=${status}&limite=300`)
      ]);

      const dadosResumo = resumo.resumo || {};
      if ($("examResultTotal")) $("examResultTotal").textContent = numero(dadosResumo.resultados || 0);
      if ($("examResultApproved")) $("examResultApproved").textContent = numero(dadosResumo.aprovados || 0);
      if ($("examResultFailed")) $("examResultFailed").textContent = numero(dadosResumo.reprovados || 0);
      if ($("examResultReview")) $("examResultReview").textContent = numero(dadosResumo.emAnalise || 0);

      state.resultados = lista.resultados || [];
      renderizar();
    } catch (erro) {
      corpo.innerHTML = `<tr><td colspan="8"><div class="admin-empty-state">${escapar(erro.message)}</div></td></tr>`;
      avisar(erro.message, "error");
    }
  }

  function renderizar() {
    const corpo = $("examResultsTableBody");
    if (!corpo) return;

    if (!state.resultados.length) {
      corpo.innerHTML = '<tr><td colspan="8"><div class="admin-empty-state">Nenhum resultado encontrado.</div></td></tr>';
      return;
    }

    corpo.innerHTML = state.resultados.map((item) => {
      const id = item.id || item._id;
      const nota = Number(item.nota || 0);
      const status = String(item.status || "pendente");
      const aprovado = nota >= Number(item.notaMinima || 70);

      return `
        <tr>
          <td data-label="Aluno"><div class="admin-result-person"><b>${escapar(item.usuarioNome || "Aluno")}</b><small>${escapar(item.usuarioEmail || "")}</small></div></td>
          <td data-label="Módulo"><span class="admin-chip">${escapar(item.provaModulo || "Sem módulo")}</span></td>
          <td data-label="Prova"><strong>${escapar(item.provaTitulo || "Prova")}</strong></td>
          <td data-label="Nota"><span class="admin-result-score ${aprovado ? "approved" : "failed"}">${nota.toFixed(0)}%</span></td>
          <td data-label="Acertos / erros"><span class="admin-result-count good">${numero(item.acertos)} acerto(s)</span><span class="admin-result-count bad">${numero(item.erros)} erro(s)</span></td>
          <td data-label="Status"><span class="admin-result-status ${escapar(status)}">${escapar(rotuloStatus(status))}</span></td>
          <td data-label="Data">${escapar(data(item.finalizadoEm || item.createdAt))}</td>
          <td data-label="Relatório"><button class="admin-primary-btn admin-pdf-button" type="button" data-download-result="${escapar(id)}">Baixar PDF</button></td>
        </tr>`;
    }).join("");
  }

  async function baixar(id, botao) {
    if (!id || !botao) return;
    const original = botao.textContent;
    botao.disabled = true;
    botao.textContent = "Gerando…";

    try {
      const resposta = await fetch(
        `${window.location.origin}/admin/provas/resultados/${encodeURIComponent(id)}/relatorio.pdf`,
        {
          headers: {
            Accept: "application/pdf",
            Authorization: `Bearer ${token()}`
          },
          cache: "no-store"
        }
      );

      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        throw new Error(dados.erro || "Não foi possível gerar o PDF.");
      }

      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `resultado-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      avisar("PDF gerado com sucesso.");
    } catch (erro) {
      avisar(erro.message, "error");
    } finally {
      botao.disabled = false;
      botao.textContent = original;
    }
  }

  function iniciar() {
    prepararInterface();

    document.addEventListener("click", (evento) => {
      const secao = evento.target.closest('[data-section="exam-results"]');
      if (secao) setTimeout(carregar, 0);

      if (evento.target.closest("#refreshExamResults")) carregar();

      const botao = evento.target.closest("[data-download-result]");
      if (botao) baixar(botao.dataset.downloadResult, botao);
    });

    document.addEventListener("input", (evento) => {
      if (evento.target.id !== "examResultSearch") return;
      clearTimeout(state.timer);
      state.timer = setTimeout(carregar, 350);
    });

    document.addEventListener("change", (evento) => {
      if (evento.target.id === "examResultStatus") carregar();
    });
  }
})();
