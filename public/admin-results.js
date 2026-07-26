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

  function removerControlesAntigos() {
    document
      .querySelectorAll(
        '#newExamButton, #examModal, [data-open-modal="exam"], [data-exam-action], [data-section="exams"]'
      )
      .forEach((elemento) => elemento.remove());

    const botaoAtual = document.querySelector('[data-section="exam-results"]');
    if (botaoAtual) {
      const texto = botaoAtual.querySelector("span:last-of-type");
      if (texto) texto.textContent = "Relatórios de Provas";
    }
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
        </tr>
      `;
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
      const disposicao = resposta.headers.get("content-disposition") || "";
      const encontrado = disposicao.match(/filename="?([^";]+)"?/i);
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
    removerControlesAntigos();
    registrarEventos();

    const observador = new MutationObserver(removerControlesAntigos);
    observador.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observador.disconnect(), 6000);
  }
})();
