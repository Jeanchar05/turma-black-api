/* ======================================
   ECLIPSE 0.JS • TURMA BLACK
   Explicação animada sem simulador
====================================== */

(() => {
  const ordemEuropeiaEclipse = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34,
    6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
    29, 7, 28, 12, 35, 3, 26
  ];

  const basesTerminalZero = [0, 10, 20, 30];

  function iniciarEclipse0() {
    protegerPagina();
    configurarNavegacao();
    montarResumoTerminalZero();
    iniciarAnimacaoPassos();
    iniciarAnimacaoTimeline();
    registrarAtividadeEclipse();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarEclipse0);
  } else {
    iniciarEclipse0();
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

  function pegarVizinhos(numero, qtd = 2) {
    const index = ordemEuropeiaEclipse.indexOf(numero);

    if (index === -1) return [];

    const vizinhos = [];

    for (let i = qtd; i >= 1; i--) {
      vizinhos.push(
        ordemEuropeiaEclipse[
          (index - i + ordemEuropeiaEclipse.length) %
            ordemEuropeiaEclipse.length
        ]
      );
    }

    vizinhos.push(numero);

    for (let i = 1; i <= qtd; i++) {
      vizinhos.push(
        ordemEuropeiaEclipse[
          (index + i) % ordemEuropeiaEclipse.length
        ]
      );
    }

    return vizinhos;
  }

  function gerarTerminalZeroCompleto() {
    return [
      ...new Set(
        basesTerminalZero.flatMap((numero) => pegarVizinhos(numero, 2))
      )
    ];
  }

  function montarResumoTerminalZero() {
    const numerosTerminal = gerarTerminalZeroCompleto();

    let atividades = [];

    try {
      atividades = JSON.parse(localStorage.getItem("eclipseTerminalZero") || "[]");
    } catch {
      atividades = [];
    }

    localStorage.setItem(
      "eclipseTerminalZero",
      JSON.stringify(numerosTerminal)
    );
  }

  function iniciarAnimacaoPassos() {
    const passos = document.querySelectorAll(".eclipse-step");
    if (!passos.length) return;

    let index = 0;

    passos.forEach((passo) => passo.classList.remove("active"));
    passos[0]?.classList.add("active");

    setInterval(() => {
      passos.forEach((passo) => passo.classList.remove("active"));

      passos[index]?.classList.add("active");

      index = (index + 1) % passos.length;
    }, 1800);
  }

  function iniciarAnimacaoTimeline() {
    const bolas = document.querySelectorAll(".eclipse-ball");
    const sequencia = document.querySelectorAll(".eclipse-sequence span, .eclipse-sequence strong");

    if (!bolas.length && !sequencia.length) return;

    let indexTimeline = 0;
    let indexSequencia = 0;

    setInterval(() => {
      bolas.forEach((bola) => bola.classList.remove("pulse"));

      bolas[indexTimeline]?.classList.add("pulse");

      indexTimeline = (indexTimeline + 1) % bolas.length;
    }, 900);

    setInterval(() => {
      sequencia.forEach((item) => item.classList.remove("pulse"));

      sequencia[indexSequencia]?.classList.add("pulse");

      indexSequencia = (indexSequencia + 1) % sequencia.length;
    }, 850);
  }

  function registrarAtividadeEclipse() {
    let atividades = [];

    try {
      atividades = JSON.parse(localStorage.getItem("atividadesRecentes") || "[]");
    } catch {
      atividades = [];
    }

    atividades.unshift({
      icone: "🌑",
      titulo: "Eclipse 0",
      descricao: "Módulo explicativo acessado",
      data: new Date().toISOString()
    });

    localStorage.setItem(
      "atividadesRecentes",
      JSON.stringify(atividades.slice(0, 20))
    );
  }
})();