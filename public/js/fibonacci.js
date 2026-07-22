/* ======================================
   FIBONACCI.JS • TURMA BLACK
   Antigo Crazy Spin
====================================== */

(() => {
  const roletaFibonacci = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30,
    8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
    28, 12, 35, 3, 26
  ];

  const posicoesFibonacci = {
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

  function iniciarFibonacci() {
    protegerPagina();
    configurarNavegacao();
    configurarBotoes();
    carregarHistoricoFibonacci();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarFibonacci);
  } else {
    iniciarFibonacci();
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
    $("btnCalcularCrazy")?.addEventListener("click", calcularFibonacci);
    $("btnLimparCrazy")?.addEventListener("click", limparMarcacoesFibonacci);
    $("btnLimparHistoricoCrazy")?.addEventListener("click", limparHistoricoFibonacci);

    ["numero1", "numero2"].forEach((id) => {
      const input = $(id);

      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") calcularFibonacci();
      });

      input?.addEventListener("input", validarInputFibonacci);
    });
  }

  function validarInputFibonacci(event) {
    const input = event.target;

    if (input.value === "") return;

    let valor = Number(input.value);

    if (valor < 0) valor = 0;
    if (valor > 36) valor = 36;

    input.value = valor;
  }

  function numeroValidoFibonacci(numero) {
    return Number.isInteger(numero) && numero >= 0 && numero <= 36;
  }

  function distanciaFibonacci(n1, n2) {
    const i1 = roletaFibonacci.indexOf(n1);
    const i2 = roletaFibonacci.indexOf(n2);

    if (i1 === -1 || i2 === -1) return "--";

    const direta = Math.abs(i1 - i2);
    const circular = roletaFibonacci.length - direta;

    return Math.min(direta, circular);
  }

  function pegarVizinhosFibonacci(numero, qtd = 1) {
    const index = roletaFibonacci.indexOf(numero);
    if (index === -1) return [];

    const lista = [];

    for (let i = qtd; i >= 1; i--) {
      lista.push(roletaFibonacci[(index - i + roletaFibonacci.length) % roletaFibonacci.length]);
    }

    lista.push(numero);

    for (let i = 1; i <= qtd; i++) {
      lista.push(roletaFibonacci[(index + i) % roletaFibonacci.length]);
    }

    return lista;
  }

  function calcularFibonacci() {
    const input1 = $("numero1");
    const input2 = $("numero2");

    if (!input1 || !input2) return;

    const n1 = Number(input1.value);
    const n2 = Number(input2.value);

    if (!numeroValidoFibonacci(n1) || !numeroValidoFibonacci(n2)) {
      alert("Digite dois números válidos entre 0 e 36.");
      return;
    }

    const somaBruta = n1 + n2;
    const soma = somaBruta <= 36 ? somaBruta : null;
    const subtracao = Math.abs(n1 - n2);
    const distancia = distanciaFibonacci(n1, n2);

    setText("resultadoSoma", soma !== null ? soma : "Passou de 36");
    setText("resultadoSubtracao", subtracao);
    setText("resultadoDistancia", distancia);

    const leitura = gerarLeituraFibonacci(n1, n2, soma, subtracao, distancia);

    setText("crazyLeitura", leitura);

    marcarFibonacci(n1, n2, soma, subtracao);
    salvarHistoricoFibonacci(n1, n2, soma, subtracao, distancia, leitura);
    carregarHistoricoFibonacci();
    registrarAtividadeFibonacci(n1, n2, soma, subtracao);
  }

  function gerarLeituraFibonacci(n1, n2, soma, subtracao, distancia) {
    const pontos = [];

    if (soma !== null) pontos.push(soma);

    pontos.push(subtracao);

    const vizinhos = pontos
      .flatMap((num) => pegarVizinhosFibonacci(num, 1))
      .filter((num, index, arr) => arr.indexOf(num) === index);

    if (soma === null) {
      return `A soma passou de 36. Use a subtração ${subtracao} como ponto principal. Vizinhos úteis: ${vizinhos.join(", ")}.`;
    }

    if (distancia <= 5) {
      return `Os números estão próximos na race. Trabalhe soma ${soma} e subtração ${subtracao}. Vizinhos úteis: ${vizinhos.join(", ")}.`;
    }

    if (distancia <= 12) {
      return `Distância média na race. Use ${soma} e ${subtracao} como pontos de equilíbrio. Vizinhos úteis: ${vizinhos.join(", ")}.`;
    }

    return `Números afastados na race. Use ${soma} e ${subtracao} como pontos de referência. Vizinhos úteis: ${vizinhos.join(", ")}.`;
  }

  function marcarFibonacci(n1, n2, soma, subtracao) {
    const container = $("crazyMarcacoes");
    const svg = $("crazyLinhas");

    if (!container || !svg) return;

    container.innerHTML = "";
    svg.innerHTML = "";

    const pontos = [
      { numero: n1, tipo: "entrada1", texto: "1" },
      { numero: n2, tipo: "entrada2", texto: "2" },
      { numero: subtracao, tipo: "subtracao", texto: "-" }
    ];

    if (soma !== null) {
      pontos.push({ numero: soma, tipo: "soma", texto: "+" });
    }

    const pontosValidos = [];

    pontos.forEach((ponto) => {
      const pos = posicoesFibonacci[ponto.numero];

      if (!pos) return;

      criarMarcacaoFibonacci(container, pos, ponto.tipo, ponto.texto, ponto.numero);
      pontosValidos.push(pos);
    });

    for (let i = 0; i < pontosValidos.length - 1; i++) {
      desenharLinhaFibonacci(svg, pontosValidos[i], pontosValidos[i + 1]);
    }
  }

  function criarMarcacaoFibonacci(container, pos, tipo, texto, numero) {
    const div = document.createElement("div");

    div.className = `fibonacci-marcacao ${tipo}`;
    div.style.left = `${pos.x}%`;
    div.style.top = `${pos.y}%`;

    div.innerHTML = `
      <strong>${escapeHTML(texto)}</strong>
      <small>${escapeHTML(numero)}</small>
    `;

    container.appendChild(div);
  }

  function desenharLinhaFibonacci(svg, p1, p2) {
    const linha = document.createElementNS("http://www.w3.org/2000/svg", "line");

    linha.setAttribute("x1", `${p1.x}%`);
    linha.setAttribute("y1", `${p1.y}%`);
    linha.setAttribute("x2", `${p2.x}%`);
    linha.setAttribute("y2", `${p2.y}%`);
    linha.setAttribute("class", "fibonacci-linha");

    svg.appendChild(linha);
  }

  function salvarHistoricoFibonacci(n1, n2, soma, subtracao, distancia, leitura) {
    let historico = [];

    try {
      historico = JSON.parse(localStorage.getItem("fibonacciHistorico") || "[]");
    } catch {
      historico = [];
    }

    historico.unshift({
      n1,
      n2,
      soma,
      subtracao,
      distancia,
      leitura,
      data: new Date().toLocaleString("pt-BR")
    });

    historico = historico.slice(0, 20);

    localStorage.setItem("fibonacciHistorico", JSON.stringify(historico));
  }

  function carregarHistoricoFibonacci() {
    const box = $("crazyHistorico");
    if (!box) return;

    let historico = [];

    try {
      historico = JSON.parse(localStorage.getItem("fibonacciHistorico") || "[]");
    } catch {
      historico = [];
    }

    if (!historico.length) {
      box.innerHTML = `
        <div class="fibonacci-empty">
          Nenhum cálculo realizado ainda.
        </div>
      `;
      return;
    }

    box.innerHTML = historico.map((item, index) => `
      <div class="fibonacci-history-item">
        <div class="fibonacci-history-number">${index + 1}</div>

        <div>
          <strong>${escapeHTML(item.n1)} + ${escapeHTML(item.n2)}</strong>

          <p>
            Soma:
            <b>${item.soma !== null ? escapeHTML(item.soma) : "passou de 36"}</b>
            • Subtração:
            <b>${escapeHTML(item.subtracao)}</b>
            • Distância:
            <b>${escapeHTML(item.distancia)}</b>
          </p>

          <small>${escapeHTML(item.data)}</small>
        </div>
      </div>
    `).join("");
  }

  function limparMarcacoesFibonacci() {
    const container = $("crazyMarcacoes");
    const svg = $("crazyLinhas");

    if (container) container.innerHTML = "";
    if (svg) svg.innerHTML = "";

    setText("resultadoSoma", "--");
    setText("resultadoSubtracao", "--");
    setText("resultadoDistancia", "--");
    setText("crazyLeitura", "Aguardando cálculo...");
  }

  function limparHistoricoFibonacci() {
    localStorage.removeItem("fibonacciHistorico");
    carregarHistoricoFibonacci();
  }

  function registrarAtividadeFibonacci(n1, n2, soma, subtracao) {
    let atividades = [];

    try {
      atividades = JSON.parse(localStorage.getItem("atividadesRecentes") || "[]");
    } catch {
      atividades = [];
    }

    atividades.unshift({
      icone: "🔢",
      titulo: "Fibonacci",
      descricao: `${n1} e ${n2} • Soma: ${soma !== null ? soma : "passou"} • Subtração: ${subtracao}`,
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
    return String(texto ?? "")
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