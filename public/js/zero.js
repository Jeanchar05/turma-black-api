/* ======================================
   ZERO.JS • TURMA BLACK
   Zero For One Premium + Editor X/Y
====================================== */

(() => {

  const numerosRoletaZero = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34,
    6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
    29, 7, 28, 12, 35, 3, 26
  ];

  const setoresZeroForOne = {
    0: [32, 15, 0, 26, 3],
    10: [5, 24, 10, 23, 8],
    20: [1, 33, 20, 14, 31],
    30: [8, 23, 30, 11, 36]
  };

  const numerosZeroForOne = [
    ...new Set(Object.values(setoresZeroForOne).flat())
  ];

  const posicoesRacePadrao = {
    0: { x: 92, y: 70 },
    32: { x: 85, y: 70 },
    15: { x: 80, y: 70 },
    19: { x: 75, y: 70 },
    4: { x: 70, y: 70 },
    21: { x: 65, y: 70 },
    2: { x: 60, y: 70 },
    25: { x: 55, y: 70 },
    17: { x: 50, y: 70 },
    34: { x: 45, y: 70 },
    6: { x: 39.9, y: 70 },
    27: { x: 34, y: 70 },
    13: { x: 31, y: 57.6 },
    36: { x: 25, y: 70 },
    11: { x: 20, y: 70 },
    30: { x: 15, y: 70 },
    8: { x: 9.5, y: 67 },
    23: { x: 5, y: 47.6 },
    10: { x: 10.6, y: 21 },
    5: { x: 15.5, y: 22 },
    24: { x: 20.6, y: 22 },
    16: { x: 24.5, y: 22 },
    33: { x: 29, y: 21 },
    1: { x: 34, y: 21 },
    20: { x: 39, y: 22 },
    14: { x: 43.8, y: 22 },
    31: { x: 48.5, y: 21 },
    9: { x: 53, y: 22 },
    22: { x: 58, y: 22 },
    18: { x: 63, y: 22 },
    29: { x: 67.6, y: 21 },
    7: { x: 72, y: 21 },
    28: { x: 77, y: 21 },
    12: { x: 82, y: 22 },
    35: { x: 85, y: 22 },
    3: { x: 91, y: 23 },
    26: { x: 95, y: 47 }
  };

  let posicoesRace = carregarPosicoesSalvas();
  let numeroAtualZero = null;
  let aguardandoResposta = false;

  let historicoZero = [];
  let acertosZero = 0;
  let errosZero = 0;

  /* ======================================
     INICIALIZAR
  ======================================= */

  function iniciarZero() {
    protegerPagina();
    restaurarEstado();
    configurarNavegacao();
    configurarEventos();
    montarTabelaPosicoes();

    esconderResposta();
    atualizarPainelZero();
  }

  function protegerPagina() {
    const usuario = JSON.parse(
      localStorage.getItem("usuarioLogado") || "null"
    );

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

      if (page) {
        window.location.href = page;
      }
    });
  }

  function configurarEventos() {
    $("btnGirarZero")?.addEventListener("click", girarRoletaZero);

    $("btnSimZero")?.addEventListener("click", () => {
      responderZero(true);
    });

    $("btnNaoZero")?.addEventListener("click", () => {
      responderZero(false);
    });

    $("btnVoltarEstudoZero")?.addEventListener("click", () => {
      window.location.href = "../minigames.html";
    });

    $("btnSalvarPosicoesZero")?.addEventListener("click", salvarPosicoesZero);
    $("btnResetarPosicoesZero")?.addEventListener("click", resetarPosicoesZero);
  }

  /* ======================================
     LÓGICA ZERO FOR ONE
  ======================================= */

  function sortearNumero() {
    return numerosRoletaZero[
      Math.floor(Math.random() * numerosRoletaZero.length)
    ];
  }

  function pertenceZeroForOne(numero) {
    return numerosZeroForOne.includes(Number(numero));
  }

  function buscarSetor(numero) {
    numero = Number(numero);

    for (const [base, numeros] of Object.entries(setoresZeroForOne)) {
      if (numeros.includes(numero)) {
        return `Setor ${base} • Zero For One`;
      }
    }

    return "Fora do Zero For One";
  }

  function girarRoletaZero() {
    const btn = $("btnGirarZero");

    if (aguardandoResposta) {
      mostrarStatus(
        "Responda o número atual antes de girar novamente.",
        "aviso"
      );
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = "🎰 Girando...";
    }

    mostrarStatus("Girando número...", "info");

    esconderResposta();
    limparMarcador();

    setTimeout(() => {
      numeroAtualZero = sortearNumero();
      aguardandoResposta = true;

      setText("numeroAtualZero", numeroAtualZero);
      setText("resultadoZero", `🎯 Número sorteado: ${numeroAtualZero}`);

      marcarNumeroNaRace(numeroAtualZero);
      prepararPergunta(numeroAtualZero);

      if (btn) {
        btn.disabled = false;
        btn.innerText = "🎰 Girar novo número";
      }
    }, 700);
  }

  function prepararPergunta(numero) {
    setText(
      "perguntaZero",
      `O número ${numero} pertence ao Zero For One?`
    );

    setText(
      "dicaZero",
      "Lembre: são 2 vizinhos antes e 2 vizinhos depois das bases 0, 10, 20 e 30."
    );

    const respostaBox = $("respostaZeroBox");

    if (respostaBox) {
      respostaBox.classList.add("active");
      respostaBox.style.display = "block";
    }
  }

  function esconderResposta() {
    const respostaBox = $("respostaZeroBox");

    if (respostaBox) {
      respostaBox.classList.remove("active");
      respostaBox.style.display = "none";
    }
  }

  function responderZero(respostaAluno) {
    if (numeroAtualZero === null || !aguardandoResposta) {
      mostrarStatus("Gire um número antes de responder.", "aviso");
      return;
    }

    const correto = pertenceZeroForOne(numeroAtualZero);
    const acertou = respostaAluno === correto;

    if (acertou) {
      acertosZero++;
    } else {
      errosZero++;
    }

    const registro = {
      numero: numeroAtualZero,
      respostaAluno,
      correto,
      acertou,
      tipo: buscarSetor(numeroAtualZero),
      data: new Date().toLocaleString("pt-BR")
    };

    historicoZero.unshift(registro);
    historicoZero = historicoZero.slice(0, 12);

    aguardandoResposta = false;

    mostrarResultadoResposta(registro);
    esconderResposta();
    salvarEstado();
    atualizarPainelZero();
    registrarAtividadeZero(registro);
  }

  function mostrarResultadoResposta(registro) {
    const resultado = $("resultadoZero");

    if (!resultado) return;

    resultado.classList.remove("quente", "frio");

    if (registro.acertou) {
      resultado.classList.add("quente");
      resultado.innerText =
        `✅ Acertou! ${registro.numero} = ${registro.tipo}`;
    } else {
      resultado.classList.add("frio");
      resultado.innerText =
        `❌ Errou! ${registro.numero} = ${registro.tipo}`;
    }
  }

  /* ======================================
     RACE / MARCADOR
  ======================================= */

  function marcarNumeroNaRace(numero) {
    const marker = $("marcadorNumeroZero");
    const texto = $("marcadorNumeroTexto");
    const posicao = posicoesRace[numero];

    if (!marker || !texto || !posicao) return;

    marker.style.left = `${posicao.x}%`;
    marker.style.top = `${posicao.y}%`;

    marker.classList.add("active");
    texto.innerText = numero;
  }

  function limparMarcador() {
    const marker = $("marcadorNumeroZero");
    const texto = $("marcadorNumeroTexto");

    if (marker) {
      marker.classList.remove("active");
    }

    if (texto) {
      texto.innerText = "--";
    }
  }

  /* ======================================
     EDITOR DE POSIÇÃO
  ======================================= */

  function clonar(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function carregarPosicoesSalvas() {
    try {
      const salvas = JSON.parse(
        localStorage.getItem("zeroPosicoesRace") || "null"
      );

      return salvas || clonar(posicoesRacePadrao);
    } catch {
      return clonar(posicoesRacePadrao);
    }
  }

  function montarTabelaPosicoes() {
    const tbody = $("tabelaPosicoesZero");

    if (!tbody) return;

    tbody.innerHTML = Object.entries(posicoesRace)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([numero, pos]) => {
        return `
          <tr>
            <td>
              <strong>${escapeHTML(numero)}</strong>
            </td>

            <td>
              <input
                type="number"
                step="0.1"
                value="${Number(pos.x)}"
                data-numero="${escapeHTML(numero)}"
                data-eixo="x"
                class="input-pos-zero"
              >
            </td>

            <td>
              <input
                type="number"
                step="0.1"
                value="${Number(pos.y)}"
                data-numero="${escapeHTML(numero)}"
                data-eixo="y"
                class="input-pos-zero"
              >
            </td>

            <td>
              <button
                type="button"
                class="btn-testar-pos-zero"
                data-numero="${escapeHTML(numero)}"
              >
                Testar
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    document.querySelectorAll(".input-pos-zero").forEach((input) => {
      input.addEventListener("input", () => {
        const numero = input.dataset.numero;
        const eixo = input.dataset.eixo;
        const valor = Number(input.value);

        if (!posicoesRace[numero]) return;

        posicoesRace[numero][eixo] = valor;

        if (Number(numero) === Number(numeroAtualZero)) {
          marcarNumeroNaRace(numeroAtualZero);
        }
      });
    });

    document.querySelectorAll(".btn-testar-pos-zero").forEach((btn) => {
      btn.addEventListener("click", () => {
        const numero = Number(btn.dataset.numero);

        numeroAtualZero = numero;

        setText("numeroAtualZero", numeroAtualZero);
        setText("resultadoZero", `Testando posição do número ${numeroAtualZero}`);

        marcarNumeroNaRace(numeroAtualZero);
      });
    });
  }

  function salvarPosicoesZero() {
    localStorage.setItem(
      "zeroPosicoesRace",
      JSON.stringify(posicoesRace)
    );

    mostrarStatus("Posições salvas com sucesso.", "info");
  }

  function resetarPosicoesZero() {
    if (!confirm("Deseja resetar todas as posições para o padrão?")) return;

    localStorage.removeItem("zeroPosicoesRace");

    posicoesRace = clonar(posicoesRacePadrao);

    montarTabelaPosicoes();
    limparMarcador();

    numeroAtualZero = null;

    setText("numeroAtualZero", "--");
    mostrarStatus("Posições resetadas para o padrão.", "info");
  }

  /* ======================================
     PAINEL / HISTÓRICO
  ======================================= */

  function atualizarPainelZero() {
    setText("zeroAcertos", acertosZero);
    setText("zeroErros", errosZero);

    const historicoBox = $("historicoZero");

    if (!historicoBox) return;

    if (!historicoZero.length) {
      historicoBox.innerHTML = `
        <div class="zero-empty-history">
          Nenhum número analisado ainda.
        </div>
      `;
      return;
    }

    historicoBox.innerHTML = historicoZero.map((item) => {
      return `
        <div class="zero-history-item ${item.acertou ? "ok" : "erro"}">

          <div>
            <strong>
              ${item.acertou ? "✅" : "❌"} Número ${escapeHTML(item.numero)}
            </strong>

            <p>
              ${escapeHTML(item.tipo)}
            </p>

            <small>
              ${escapeHTML(item.data)}
            </small>
          </div>

          <span>
            ${item.correto ? "Zero For One" : "Fora"}
          </span>

        </div>
      `;
    }).join("");
  }

  function mostrarStatus(texto, tipo = "info") {
    const resultado = $("resultadoZero");

    if (!resultado) return;

    resultado.classList.remove("quente", "frio");

    if (tipo === "aviso") {
      resultado.classList.add("frio");
    }

    resultado.innerText = texto;
  }

  /* ======================================
     STORAGE
  ======================================= */

  function salvarEstado() {
    localStorage.setItem(
      "historicoTreinoZeroForOne",
      JSON.stringify(historicoZero)
    );

    localStorage.setItem(
      "zeroForOneAcertos",
      String(acertosZero)
    );

    localStorage.setItem(
      "zeroForOneErros",
      String(errosZero)
    );
  }

  function restaurarEstado() {
    try {
      historicoZero = JSON.parse(
        localStorage.getItem("historicoTreinoZeroForOne") ||
        localStorage.getItem("historicoTreinoZeroForOn") ||
        "[]"
      );

      acertosZero = Number(
        localStorage.getItem("zeroForOneAcertos") ||
        localStorage.getItem("zeroForOnAcertos") ||
        0
      );

      errosZero = Number(
        localStorage.getItem("zeroForOneErros") ||
        localStorage.getItem("zeroForOnErros") ||
        0
      );

      if (!Array.isArray(historicoZero)) {
        historicoZero = [];
      }
    } catch {
      historicoZero = [];
      acertosZero = 0;
      errosZero = 0;
    }
  }

  function registrarAtividadeZero(registro) {
    const atividades = JSON.parse(
      localStorage.getItem("atividadesRecentes") || "[]"
    );

    atividades.unshift({
      icone: "⚡",
      titulo: "Zero For One",
      descricao:
        `${registro.acertou ? "Acerto" : "Erro"} no número ${registro.numero}`,
      data: new Date().toISOString()
    });

    localStorage.setItem(
      "atividadesRecentes",
      JSON.stringify(atividades.slice(0, 20))
    );
  }

  /* ======================================
     HELPERS
  ======================================= */

  function setText(id, valor) {
    const el = $(id);

    if (el) {
      el.innerText = valor;
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarZero);
  } else {
    iniciarZero();
  }

})();