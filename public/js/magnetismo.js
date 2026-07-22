/* ======================================
   MAGNETISMO.JS • TURMA BLACK
   Antigo Pull System
====================================== */

(() => {
  const tabelaMagnetismo = {
    0: [10, 20, 30],
    1: [1, 17],
    2: [2, 22],
    3: [3, 33],
    4: [22, 9, 18],
    5: [25, 15, 35],
    6: [20],
    7: [7, 17, 20],
    8: [30, 0, 20],
    9: [9, 19],
    10: [0, 20, 30],
    11: [0, 20],
    12: [33, 15],
    13: [20],
    14: [17],
    15: [9, 35],
    16: [3],
    17: [20, 7],
    18: [2, 22],
    19: [9],
    20: [7],
    21: [22],
    22: [2],
    23: [0],
    24: [35, 15, 25],
    25: [20, 22],
    26: [0, 10, 30],
    27: [20],
    28: [17],
    29: [17],
    30: [0, 20],
    31: [9, 19],
    32: [0, 10, 20, 30],
    33: [3, 33],
    34: [7, 20],
    35: [3, 33, 15],
    36: [20, 30]
  };

  const posicoesRaceMagnetismo = {
    0: { x: 93, y: 69 },
    1: { x: 33, y: 18 },
    2: { x: 60, y: 71 },
    3: { x: 92, y: 24 },
    4: { x: 70, y: 71 },
    5: { x: 14, y: 18 },
    6: { x: 40, y: 71 },
    7: { x: 73, y: 18 },
    8: { x: 10, y: 70 },
    9: { x: 53, y: 18 },
    10: { x: 8, y: 23 },
    11: { x: 20, y: 71 },
    12: { x: 81, y: 16 },
    13: { x: 28, y: 71 },
    14: { x: 44, y: 18 },
    15: { x: 81.5, y: 72.2 },
    16: { x: 23.3, y: 18 },
    17: { x: 49.5, y: 72 },
    18: { x: 63, y: 18 },
    19: { x: 75.5, y: 73 },
    20: { x: 39, y: 18 },
    21: { x: 64, y: 72 },
    22: { x: 57, y: 18 },
    23: { x: 4, y: 42 },
    24: { x: 19, y: 18 },
    25: { x: 54, y: 72 },
    26: { x: 96, y: 42 },
    27: { x: 33, y: 73 },
    28: { x: 77, y: 18 },
    29: { x: 68, y: 18 },
    30: { x: 14.5, y: 73 },
    31: { x: 48, y: 18 },
    32: { x: 85, y: 72 },
    33: { x: 29, y: 18 },
    34: { x: 45, y: 72 },
    35: { x: 85, y: 18 },
    36: { x: 24, y: 72 }
  };

  function iniciarMagnetismo() {
    protegerPagina();
    configurarNavegacao();
    configurarBotoes();
    criarGradeNumerosMagnetismo();
    limparMagnetismo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarMagnetismo);
  } else {
    iniciarMagnetismo();
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
    const input = $("numeroPullInput");

    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        buscarMagnetismo();
      }
    });

    input?.addEventListener("input", validarInputMagnetismo);

    $("btnBuscarPull")?.addEventListener("click", buscarMagnetismo);
    $("btnLimparMagnetismo")?.addEventListener("click", limparMagnetismo);
  }

  function validarInputMagnetismo(event) {
    const input = event.target;

    if (input.value === "") return;

    let valor = Number(input.value);

    if (valor < 0) valor = 0;
    if (valor > 36) valor = 36;

    input.value = valor;
  }

  function criarGradeNumerosMagnetismo() {
    const grade = $("gradeNumerosPull");
    if (!grade) return;

    grade.innerHTML = "";

    for (let i = 0; i <= 36; i++) {
      const btn = document.createElement("button");

      btn.className = "btn-numero-magnetismo";
      btn.type = "button";
      btn.innerText = i;

      btn.addEventListener("click", () => {
        const input = $("numeroPullInput");

        if (input) {
          input.value = i;
        }

        buscarMagnetismo();
      });

      grade.appendChild(btn);
    }
  }

  function buscarMagnetismo() {
    const input = $("numeroPullInput");
    const resultado = $("resultadoPull");

    if (!input || !resultado) return;

    const numero = Number(input.value);

    if (
      input.value === "" ||
      Number.isNaN(numero) ||
      numero < 0 ||
      numero > 36
    ) {
      resultado.innerText = "Número inválido";
      setText("textoPull", "Digite um número entre 0 e 36 para iniciar a leitura.");
      limparMarcadoresMagnetismo();
      limparBotoesMagnetismo();
      return;
    }

    const conexoes = tabelaMagnetismo[numero] || [];

    resultado.innerHTML = conexoes.length
      ? conexoes.map((n) => `<strong>${escapeHTML(n)}</strong>`).join(" <span>•</span> ")
      : "---";

    marcarBotoesMagnetismo(numero, conexoes);
    marcarMagnetismoNaRace(numero, conexoes);
    gerarTextoMagnetismo(numero, conexoes);
    registrarAtividadeMagnetismo(numero, conexoes);
  }

  function marcarMagnetismoNaRace(numeroPrincipal, conexoes) {
    const area = $("marcadoresPull");
    if (!area) return;

    area.innerHTML = "";

    criarMarcadorMagnetismo(numeroPrincipal, true);

    conexoes.forEach((numero) => {
      if (Number(numero) !== Number(numeroPrincipal)) {
        criarMarcadorMagnetismo(numero, false);
      }
    });
  }

  function criarMarcadorMagnetismo(numero, principal = false) {
    const area = $("marcadoresPull");
    const pos = posicoesRaceMagnetismo[numero];

    if (!area || !pos) return;

    const marcador = document.createElement("div");

    marcador.className = principal
      ? "marcador-magnetismo principal-magnetismo"
      : "marcador-magnetismo";

    marcador.innerText = numero;
    marcador.style.left = `${pos.x}%`;
    marcador.style.top = `${pos.y}%`;

    area.appendChild(marcador);
  }

  function marcarBotoesMagnetismo(numeroPrincipal, conexoes) {
    document.querySelectorAll(".btn-numero-magnetismo").forEach((btn) => {
      const valor = Number(btn.innerText);

      btn.classList.remove("ativo", "principal");

      if (valor === Number(numeroPrincipal)) {
        btn.classList.add("principal");
      } else if (conexoes.includes(valor)) {
        btn.classList.add("ativo");
      }
    });
  }

  function gerarTextoMagnetismo(numero, conexoes) {
    if (!conexoes.length) {
      setText(
        "textoPull",
        `O número ${numero} não possui conexões cadastradas no Magnetismo.`
      );
      return;
    }

    const quantidade = conexoes.length;

    let leitura = "";

    if (quantidade >= 4) {
      leitura =
        "puxada forte, com ampla zona de cobertura e várias possibilidades de conexão.";
    } else if (quantidade === 3) {
      leitura =
        "puxada equilibrada, com boa leitura de repetição e conexão.";
    } else {
      leitura =
        "puxada direta, ideal para uma leitura mais seletiva e controlada.";
    }

    setText(
      "textoPull",
      `O número ${numero} ativou ${quantidade} conexão(ões): ${conexoes.join(", ")}. A leitura indica ${leitura}`
    );
  }

  function limparMarcadoresMagnetismo() {
    const marcadores = $("marcadoresPull");

    if (marcadores) {
      marcadores.innerHTML = "";
    }
  }

  function limparBotoesMagnetismo() {
    document.querySelectorAll(".btn-numero-magnetismo").forEach((btn) => {
      btn.classList.remove("ativo", "principal");
    });
  }

  function limparMagnetismo() {
    const input = $("numeroPullInput");
    const resultado = $("resultadoPull");

    if (input) input.value = "";
    if (resultado) resultado.innerText = "---";

    setText("textoPull", "Aguardando leitura estratégica...");

    limparMarcadoresMagnetismo();
    limparBotoesMagnetismo();
  }

  function registrarAtividadeMagnetismo(numero, conexoes) {
    let atividades = [];

    try {
      atividades = JSON.parse(localStorage.getItem("atividadesRecentes") || "[]");
    } catch {
      atividades = [];
    }

    atividades.unshift({
      icone: "🧲",
      titulo: "Magnetismo",
      descricao: `${numero} conecta com ${conexoes.join(", ") || "---"}`,
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