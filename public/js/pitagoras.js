/* ======================================
   PITAGORAS.JS • TURMA BLACK
   Conexão Geométrica / Triangulação
====================================== */

(() => {
  const numerosRoletaPitagoras = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27,
    13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33,
    1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12,
    35, 3, 26
  ];

  const posicoesPitagoras = {
    10:{x:8.33,y:17.96}, 23:{x:3.59,y:43.51}, 8:{x:8.10,y:69.89},
    5:{x:14.00,y:16.85}, 24:{x:18.88,y:16.85}, 16:{x:23.71,y:16.85},
    33:{x:28.55,y:16.85}, 1:{x:33.33,y:16.85}, 20:{x:38.21,y:16.85},
    14:{x:43.05,y:16.85}, 31:{x:47.84,y:16.85}, 9:{x:52.67,y:16.85},
    22:{x:57.50,y:16.85}, 18:{x:62.34,y:16.85}, 29:{x:67.17,y:16.85},
    7:{x:72.01,y:16.85}, 28:{x:76.84,y:16.85}, 12:{x:81.63,y:16.85},
    35:{x:86.46,y:16.85}, 3:{x:92.31,y:17.68}, 26:{x:96.32,y:43.92},

    30:{x:14.09,y:70.72}, 11:{x:18.92,y:70.72}, 36:{x:23.76,y:70.72},
    13:{x:28.59,y:70.72}, 27:{x:33.43,y:70.72}, 6:{x:38.26,y:70.72},
    34:{x:43.09,y:70.72}, 17:{x:47.93,y:70.72}, 25:{x:52.76,y:70.72},
    2:{x:57.60,y:70.72}, 21:{x:62.43,y:70.72}, 4:{x:67.27,y:70.72},
    19:{x:72.10,y:70.72}, 15:{x:76.93,y:70.72}, 32:{x:81.77,y:70.72},
    0:{x:89.92,y:69.89}
  };

  function iniciarPitagoras() {
    protegerPagina();
    configurarNavegacao();
    configurarBotoes();
    criarGradePitagoras();
    atualizarPainelInicial();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarPitagoras);
  } else {
    iniciarPitagoras();
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
    $("btnMarcarPitagoras")?.addEventListener("click", marcarPitagoras);
    $("btnSugestaoPitagoras")?.addEventListener("click", sugestaoPitagoras);
    $("btnLimparPitagoras")?.addEventListener("click", limparPitagoras);

    ["pitaNum1", "pitaNum2", "pitaNum3"].forEach((id) => {
      const input = $(id);

      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") marcarPitagoras();
      });

      input?.addEventListener("input", validarInputPitagoras);
    });
  }

  function validarInputPitagoras(event) {
    const input = event.target;
    let valor = Number(input.value);

    if (input.value === "") return;

    if (valor < 0) valor = 0;
    if (valor > 36) valor = 36;

    input.value = valor;
  }

  function atualizarPainelInicial() {
    setTexto("pitaSelecionados", "---");
    setTexto("pitaTipo", "---");
    setTexto("pitaStatus", "Aguardando");
    setTexto("pitaTexto", "Digite os números para iniciar a leitura.");
  }

  function numeroValidoPitagoras(numero) {
    return Number.isInteger(numero) && numero >= 0 && numero <= 36;
  }

  function pegarNumerosPitagoras() {
    const ids = ["pitaNum1", "pitaNum2", "pitaNum3"];

    return ids
      .map((id) => $(id)?.value)
      .filter((valor) => valor !== "" && valor !== undefined)
      .map(Number)
      .filter(numeroValidoPitagoras);
  }

  function pontosAlinhadosPitagoras(numeros) {
    if (numeros.length < 3) return false;

    const pontos = numeros
      .map((numero) => posicoesPitagoras[numero])
      .filter(Boolean);

    if (pontos.length < 3) return false;

    const [a, b, c] = pontos;

    const area = Math.abs(
      a.x * (b.y - c.y) +
      b.x * (c.y - a.y) +
      c.x * (a.y - b.y)
    );

    return area < 35;
  }

  function marcarPitagoras() {
    const numeros = [...new Set(pegarNumerosPitagoras())].slice(0, 3);

    if (numeros.length < 2) {
      setTexto("pitaStatus", "Escolha pelo menos 2 números");
      setTexto(
        "pitaTexto",
        "Para usar o Pitágoras, selecione 2 ou 3 números válidos."
      );
      return;
    }

    desenharPitagoras(numeros);
    registrarAtividadePitagoras(numeros);
  }

  function desenharPitagoras(numeros) {
    const svg = $("pitagorasSvg");
    const marcadores = $("marcadoresPitagoras");

    if (!svg || !marcadores) return;

    svg.innerHTML = "";
    marcadores.innerHTML = "";

    const pontos = numeros
      .map((numero) => ({
        numero,
        ...posicoesPitagoras[numero]
      }))
      .filter((ponto) => ponto.x !== undefined && ponto.y !== undefined);

    if (pontos.length < 2) return;

    pontos.forEach((ponto, index) => {
      criarMarcadorPitagoras(
        ponto.numero,
        ponto.x,
        ponto.y,
        index === 0
      );
    });

    const alinhados = pontosAlinhadosPitagoras(numeros);

    if (pontos.length === 2) {
      desenharLinhaPitagoras(pontos[0], pontos[1]);

      atualizarPainelPitagoras(
        numeros,
        "Linha",
        "Conexão criada com 2 pontos. Use um terceiro número para testar triangulação."
      );

      return;
    }

    if (alinhados) {
      desenharLinhaPitagoras(pontos[0], pontos[1]);
      desenharLinhaPitagoras(pontos[1], pontos[2]);

      atualizarPainelPitagoras(
        numeros,
        "Linha alinhada",
        "Os 3 números estão alinhados na race. Por isso, o sistema não fechou triângulo."
      );

      return;
    }

    desenharLinhaPitagoras(pontos[0], pontos[1]);
    desenharLinhaPitagoras(pontos[1], pontos[2]);
    desenharLinhaPitagoras(pontos[2], pontos[0]);

    atualizarPainelPitagoras(
      numeros,
      "Triângulo",
      "Triangulação formada com 3 pontos diferentes na race. Analise se essa conexão faz sentido com o histórico."
    );
  }

  function criarMarcadorPitagoras(numero, x, y, principal = false) {
    const marcadores = $("marcadoresPitagoras");
    if (!marcadores) return;

    const marcador = document.createElement("div");

    marcador.className = principal
      ? "marcador-pitagoras principal-pitagoras"
      : "marcador-pitagoras";

    marcador.style.left = `${x}%`;
    marcador.style.top = `${y}%`;
    marcador.innerText = numero;

    marcadores.appendChild(marcador);
  }

  function desenharLinhaPitagoras(p1, p2) {
    const svg = $("pitagorasSvg");
    if (!svg) return;

    const linha = document.createElementNS("http://www.w3.org/2000/svg", "line");

    linha.setAttribute("x1", `${p1.x}%`);
    linha.setAttribute("y1", `${p1.y}%`);
    linha.setAttribute("x2", `${p2.x}%`);
    linha.setAttribute("y2", `${p2.y}%`);
    linha.setAttribute("class", "linha-pitagoras");

    svg.appendChild(linha);
  }

  function atualizarPainelPitagoras(numeros, tipo, texto) {
    setTexto("pitaSelecionados", numeros.join(", "));
    setTexto("pitaTipo", tipo);
    setTexto("pitaStatus", "Marcado");
    setTexto("pitaTexto", texto);

    marcarGradePitagoras(numeros);
  }

  function limparPitagoras() {
    const svg = $("pitagorasSvg");
    const marcadores = $("marcadoresPitagoras");

    if (svg) svg.innerHTML = "";
    if (marcadores) marcadores.innerHTML = "";

    ["pitaNum1", "pitaNum2", "pitaNum3"].forEach((id) => {
      const input = $(id);
      if (input) input.value = "";
    });

    document.querySelectorAll(".pita-numero-btn").forEach((btn) => {
      btn.classList.remove("ativo", "principal");
    });

    atualizarPainelInicial();
  }

  function criarGradePitagoras() {
    const grade = $("pitaGradeNumeros");
    if (!grade) return;

    grade.innerHTML = "";

    for (let i = 0; i <= 36; i++) {
      const btn = document.createElement("button");

      btn.type = "button";
      btn.className = "pita-numero-btn";
      btn.innerText = i;

      btn.addEventListener("click", () => {
        adicionarNumeroInputPitagoras(i);
      });

      grade.appendChild(btn);
    }
  }

  function adicionarNumeroInputPitagoras(numero) {
    const inputs = [
      $("pitaNum1"),
      $("pitaNum2"),
      $("pitaNum3")
    ];

    const jaExiste = inputs.some((input) => Number(input?.value) === numero);

    if (jaExiste) return;

    const vazio = inputs.find((input) => input && input.value === "");

    if (vazio) {
      vazio.value = numero;
    } else {
      inputs[0].value = numero;
      inputs[1].value = "";
      inputs[2].value = "";
    }

    marcarPitagoras();
  }

  function marcarGradePitagoras(numeros) {
    document.querySelectorAll(".pita-numero-btn").forEach((btn) => {
      const valor = Number(btn.innerText);

      btn.classList.remove("ativo", "principal");

      if (valor === numeros[0]) {
        btn.classList.add("principal");
      } else if (numeros.includes(valor)) {
        btn.classList.add("ativo");
      }
    });
  }

  function sugestaoPitagoras() {
    const escolhidos = [];

    while (escolhidos.length < 3) {
      const numero =
        numerosRoletaPitagoras[
          Math.floor(Math.random() * numerosRoletaPitagoras.length)
        ];

      if (!escolhidos.includes(numero)) {
        escolhidos.push(numero);
      }
    }

    $("pitaNum1").value = escolhidos[0];
    $("pitaNum2").value = escolhidos[1];
    $("pitaNum3").value = escolhidos[2];

    marcarPitagoras();
  }

  function registrarAtividadePitagoras(numeros) {
    let atividades = [];

    try {
      atividades = JSON.parse(localStorage.getItem("atividadesRecentes") || "[]");
    } catch {
      atividades = [];
    }

    atividades.unshift({
      icone: "📐",
      titulo: "Pitágoras",
      descricao: `Conexão marcada: ${numeros.join(", ")}`,
      data: new Date().toISOString()
    });

    localStorage.setItem(
      "atividadesRecentes",
      JSON.stringify(atividades.slice(0, 20))
    );
  }

  function setTexto(id, texto) {
    const el = $(id);
    if (el) el.innerText = texto;
  }

  function $(id) {
    return document.getElementById(id);
  }
})();