/* ======================================
   GATILHOS.JS • TURMA BLACK
   Sistema de Alertas / Triggers
====================================== */

(() => {
  const gatilhos = {
    36: {
      principal: 36,
      chamados: [18, 19, 9],
      tipo: "Alerta direto",
      analise:
        "O 36 costuma chamar atenção para 18, 19 e 9. Use como leitura de apoio junto ao histórico recente."
    },

    3: {
      principal: 3,
      chamados: [22, 31],
      tipo: "Alerta de conexão",
      analise:
        "O 3 aponta conexão com 22 e 31. Observe se a região está aquecida antes de considerar entrada."
    },

    11: {
      principal: 11,
      chamados: [22, 33],
      tipo: "Alerta espelhado",
      analise:
        "O 11 se conecta com 22 e 33. Essa leitura funciona melhor quando há confirmação pela race."
    }
  };

  const posicoesRaceGatilhos = {
    10: { x: 8.33, y: 17.96 },
    23: { x: 3.59, y: 43.51 },
    8: { x: 8.10, y: 69.89 },

    5: { x: 14.00, y: 16.85 },
    24: { x: 18.88, y: 16.85 },
    16: { x: 23.71, y: 13 },
    33: { x: 28.55, y: 13 },
    1: { x: 33.33, y: 13 },
    20: { x: 38.21, y: 13 },
    14: { x: 43.05, y: 16.85 },
    31: { x: 47.84, y: 13 },
    9: { x: 52.67, y: 16.85 },
    22: { x: 57.50, y: 13 },
    18: { x: 62.34, y: 16.85 },
    29: { x: 67.17, y: 13 },
    7: { x: 72.01, y: 16.85 },
    28: { x: 76.84, y: 16.85 },
    12: { x: 81.63, y: 13 },
    35: { x: 86.46, y: 16.85 },
    3: { x: 92.31, y: 17.68 },
    26: { x: 96.32, y: 43.92 },

    30: { x: 14.09, y: 70.72 },
    11: { x: 18.92, y: 70.72 },
    36: { x: 23.76, y: 70.72 },
    13: { x: 28.59, y: 70.72 },
    27: { x: 33.43, y: 70.72 },
    6: { x: 40, y: 70.72 },
    34: { x: 43.09, y: 70.72 },
    17: { x: 47.93, y: 70.72 },
    25: { x: 52.76, y: 70.72 },
    2: { x: 60, y: 70.72 },
    21: { x: 65, y: 70.72 },
    4: { x: 67.27, y: 70.72 },
    19: { x: 75, y: 70.72 },
    15: { x: 76.93, y: 70.72 },
    32: { x: 85, y: 70.72 },
    0: { x: 92, y: 69.89 }
  };

  function iniciarGatilhos() {
    protegerPagina();
    configurarNavegacao();
    configurarBotoes();
    limparGatilhos();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarGatilhos);
  } else {
    iniciarGatilhos();
  }

  function protegerPagina() {
    const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
    const token = localStorage.getItem("token");

    if (!usuario || !token) {
      localStorage.removeItem("usuarioLogado");
      localStorage.removeItem("token");
      window.location.href = "../index.html";
    }
  }

  function configurarNavegacao() {
    document.addEventListener("click", (event) => {
      const botao = event.target.closest("[data-page]");
      if (!botao) return;

      const page = botao.dataset.page;
      if (page) window.location.href = page;
    });
  }

  function configurarBotoes() {
    document.querySelectorAll("[data-trigger]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const trigger = btn.dataset.trigger;

        document.querySelectorAll("[data-trigger]").forEach((item) => {
          item.classList.remove("active");
        });

        btn.classList.add("active");
        aplicarGatilho(trigger);
      });
    });

    $("btnLimparTriggers")?.addEventListener("click", limparGatilhos);
  }

  function aplicarGatilho(triggerId) {
    const gatilho = gatilhos[triggerId];

    if (!gatilho) {
      alert("Gatilho não encontrado.");
      return;
    }

    const numeros = [gatilho.principal, ...gatilho.chamados];

    desenharMarcadores(gatilho.principal, gatilho.chamados);
    atualizarPainel(gatilho, numeros);
    registrarAtividadeGatilho(gatilho, numeros);
  }

  function desenharMarcadores(principal, chamados) {
    const area = $("marcadoresTriggers");
    if (!area) return;

    area.innerHTML = "";

    const todos = [principal, ...chamados];

    todos.forEach((numero, index) => {
      const pos = posicoesRaceGatilhos[numero];

      if (!pos) {
        console.warn(`Número ${numero} sem posição cadastrada.`);
        return;
      }

      setTimeout(() => {
        const marcador = document.createElement("div");

        marcador.className =
          numero === principal
            ? "gatilho-marker principal-gatilho"
            : "gatilho-marker alerta-gatilho";

        marcador.style.left = `${pos.x}%`;
        marcador.style.top = `${pos.y}%`;
        marcador.dataset.numero = String(numero);
        marcador.innerHTML = `<span>${numero}</span>`;

        area.appendChild(marcador);
      }, index * 100);
    });
  }

  function atualizarPainel(gatilho, numeros) {
    setText("triggerAtual", gatilho.principal);
    setText("totalMarcadoTriggers", `${numeros.length} números`);
    setText("entradaPrincipalTriggers", gatilho.principal);
    setText("tipoTriggers", gatilho.tipo);
    setText("coberturaTriggers", gatilho.chamados.join(", "));
    setText("analiseTriggers", gatilho.analise);

    const lista = $("listaNumerosTriggers");

    if (lista) {
      lista.innerHTML = numeros
        .map((numero, index) => {
          const principal = index === 0;

          return `
            <span class="${principal ? "numero-principal" : "numero-alerta"}">
              ${principal ? "Principal" : "Chamado"}: ${escapeHTML(numero)}
            </span>
          `;
        })
        .join("");
    }
  }

  function limparGatilhos() {
    const area = $("marcadoresTriggers");

    if (area) {
      area.innerHTML = "";
    }

    document.querySelectorAll("[data-trigger]").forEach((btn) => {
      btn.classList.remove("active");
    });

    setText("triggerAtual", "Nenhum");
    setText("totalMarcadoTriggers", "0 números");
    setText("entradaPrincipalTriggers", "---");
    setText("tipoTriggers", "Alerta");
    setText("coberturaTriggers", "---");
    setText("analiseTriggers", "Selecione um gatilho para visualizar a leitura.");

    const lista = $("listaNumerosTriggers");

    if (lista) {
      lista.innerHTML = "Nenhum número marcado ainda.";
    }
  }

  function registrarAtividadeGatilho(gatilho, numeros) {
    let atividades = [];

    try {
      atividades = JSON.parse(localStorage.getItem("atividadesRecentes") || "[]");
    } catch {
      atividades = [];
    }

    atividades.unshift({
      icone: "🚨",
      titulo: "Gatilhos",
      descricao: `${gatilho.principal} chama ${gatilho.chamados.join(", ")}`,
      data: new Date().toISOString()
    });

    localStorage.setItem(
      "atividadesRecentes",
      JSON.stringify(atividades.slice(0, 20))
    );
  }

  function setText(id, texto) {
    const el = $(id);

    if (el) {
      el.textContent = texto;
    }
  }

  function escapeHTML(texto) {
    return String(texto || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function $(id) {
    return document.getElementById(id);
  }
})();