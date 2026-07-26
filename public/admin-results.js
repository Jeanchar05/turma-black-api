"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const state = { resultados: [], carregado: false, timer: null };
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
      }
    });

    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok || dados.erro) {
      throw new Error(dados.erro || "Nao foi possivel carregar os resultados.");
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
      em_analise: "Em analise",
      pendente: "Pendente"
    };
    return mapa[status] || status || "Pendente";
  }

  function avisar(mensagem, tipo = "success") {
    const pilha = $("adminToastStack");
    if (!pilha) {
      window.alert(mensagem);
      return;
    }

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

  function transformarInterface() {
    const botao = document.querySelector('[data-section="exams"]');
    if (botao) {
      botao.dataset.section = "exam-results";
      const texto = botao.querySelector("span:last-of-type");
      if (texto) texto.textContent = "Relatorios de Provas";
    }

    const secao = $("section-exams");
    if (!secao) return;

    secao.id = "section-exam-results";
    secao.dataset.title = "Relatorios de Provas";
    secao.innerHTML = `
      <div class="admin-section-head">
        <div>
          <span class="admin-kicker">CORRECAO E DOCUMENTOS</span>
          <h2>Resultados dos alunos</h2>
          <p>Consulte cada tentativa e baixe um PDF corrigido com a resposta do aluno e o gabarito nas questoes erradas.</p>
        </div>
        <button class="admin-primary-btn" type="button" id="refreshExamResults">↻ Atualizar</button>
      </div>

      <div class="admin-mini-stat-grid">
        <article><small>Resultados</small><strong id="examResultTotal">0</strong></article>
        <article><small>Aprovados</small><strong id="examResultApproved">0</strong></article>
        <article><small>Reprovados</small><strong id="examResultFailed">0</strong></article>
        <article><small>Em analise</small><strong id="examResultReview">0</strong></article>
      </div>

      <div class="admin-panel-card">
        <div class="admin-filterbar">
          <div class="admin-search">
            <span>⌕</span>
            <input id="examResultSearch" type="search" placeholder="Buscar aluno, e-mail ou nome da prova" />
          </div>
          <select id="examResultStatus">
            <option value="">Todos os resultados</option>
            <option value="aprovado">Aprovados</option>
            <option value="reprovado">Reprovados</option>
            <option value="em_analise">Em analise</option>
            <option value="pendente">Pendentes</option>
          </select>
        </div>

        <div class="admin-results-help">
          <span>PDF</span>
          <div>
            <strong>Relatorio corrigido automaticamente</strong>
            <p>Questoes erradas recebem uma seta indicando a resposta certa. Respostas textuais permanecem sinalizadas para analise.</p>
          </div>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table admin-results-table">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Prova</th>
                <th>Nota</th>
                <th>Acertos / erros</th>
                <th>Status</th>
                <th>Data</th>
                <th>Relatorio</th>
              </tr>
            </thead>
            <tbody id="examResultsTableBody">
              <tr><td colspan="7"><div class="admin-empty-state">Carregando resultados...</div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    $("examModal")?.remove();
  }

  async function carregar() {
    const corpo = $("examResultsTableBody");
    if (!corpo) return;

    corpo.innerHTML = '<tr><td colspan="7"><div class="admin-empty-state">Carregando resultados...</div></td></tr>';

    const busca = encodeURIComponent($("examResultSearch")?.value.trim() || "");
    const status = encodeURIComponent($("examResultStatus")?.value || "");

    try {
      const [resumo, lista] = await Promise.all([
        api("/admin/provas/resumo"),
        api(`/admin/provas/resultados?busca=${busca}&status=${status}&limite=300`)
      ]);

      const dadosResumo = resumo.resumo || {};
      $("examResultTotal").textContent = numero(dadosResumo.resultados || 0);
      $("examResultApproved").textContent = numero(dadosResumo.aprovados || 0);
      $("examResultFailed").textContent = numero(dadosResumo.reprovados || 0);
      $("examResultReview").textContent = numero(dadosResumo.emAnalise || 0);

      state.resultados = lista.resultados || [];
      state.carregado = true;
      renderizar();
    } catch (erro) {
      corpo.innerHTML = `<tr><td colspan="7"><div class="admin-empty-state">${escapar(erro.message)}</div></td></tr>`;
      avisar(erro.message, "error");
    }
  }

  function renderizar() {
    const corpo = $("examResultsTableBody");
    if (!corpo) return;

    if (!state.resultados.length) {
      corpo.innerHTML = '<tr><td colspan="7"><div class="admin-empty-state">Nenhum resultado encontrado.</div></td></tr>';
      return;
    }

    corpo.innerHTML = state.resultados.map((item) => {
      const id = item.id || item._id;
      const nota = Number(item.nota || 0);
      const status = String(item.status || "pendente");
      return `
        <tr>
          <td data-label="Aluno"><div class="admin-result-person"><b>${escapar(item.usuarioNome || "Aluno")}</b><small>${escapar(item.usuarioEmail || "")}</small></div></td>
          <td data-label="Prova"><strong>${escapar(item.provaTitulo || "Prova")}</strong></td>
          <td data-label="Nota"><span class="admin-result-score ${nota >= Number(item.notaMinima || 70) ? "approved" : "failed"}">${nota.toFixed(0)}%</span></td>
          <td data-label="Acertos / erros"><span class="admin-result-count good">${numero(item.acertos)} acerto(s)</span><span class="admin-result-count bad">${numero(item.erros)} erro(s)</span></td>
          <td data-label="Status"><span class="admin-result-status ${escapar(status)}">${escapar(rotuloStatus(status))}</span></td>
          <td data-label="Data">${escapar(data(item.finalizadoEm || item.createdAt))}</td>
          <td data-label="Relatorio"><button class="admin-primary-btn admin-pdf-button" type="button" data-download-result="${escapar(id)}">Baixar PDF</button></td>
        </tr>
      `;
    }).join("");
  }

  async function baixar(id, botao) {
    if (!id || !botao) return;
    const original = botao.textContent;
    botao.disabled = true;
    botao.textContent = "Gerando...";

    try {
      const resposta = await fetch(
        `${window.location.origin}/admin/provas/resultados/${encodeURIComponent(id)}/relatorio.pdf`,
        {
          headers: {
            Accept: "application/pdf",
            Authorization: `Bearer ${token()}`
          }
        }
      );

      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        throw new Error(dados.erro || "Nao foi possivel gerar o PDF.");
      }

      const blob = await resposta.blob();
      const disposicao = resposta.headers.get("content-disposition") || "";
      const encontrado = disposicao.match(/filename=\"?([^\";]+)\"?/i);
      const arquivo = encontrado?.[1] || `resultado-${id}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = arquivo;
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

  function registrarEventos() {
    document.addEventListener("click", (evento) => {
      const secao = evento.target.closest('[data-section="exam-results"]');
      if (secao) setTimeout(() => carregar(), 0);

      const atualizar = evento.target.closest("#refreshExamResults");
      if (atualizar) carregar();

      const baixarBotao = evento.target.closest("[data-download-result]");
      if (baixarBotao) baixar(baixarBotao.dataset.downloadResult, baixarBotao);
    });

    document.addEventListener("input", (evento) => {
      if (evento.target.id !== "examResultSearch") return;
      clearTimeout(state.timer);
      state.timer = setTimeout(() => carregar(), 350);
    });

    document.addEventListener("change", (evento) => {
      if (evento.target.id === "examResultStatus") carregar();
    });
  }

  function iniciar() {
    transformarInterface();
    registrarEventos();
  }
})();
