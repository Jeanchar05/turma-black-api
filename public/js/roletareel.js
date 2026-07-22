/* ======================================
   ROLETA REEL.JS • TURMA BLACK
   Versão premium corrigida
====================================== */

(() => {
  const ordemEuropeia = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27,
    13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33,
    1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];

  const vermelhos = [
    1, 3, 5, 7, 9, 12, 14, 16, 18,
    19, 21, 23, 25, 27, 30, 32, 34, 36
  ];

  const CHIP_URL =
    "https://res.cloudinary.com/dfesh6s7i/image/upload/v1777757719/ficha-preta.png_sroftv.png";

  window.estrategiasIA = window.estrategiasIA || {
    espelhos: [],
    flow: [],
    triangulacao: [],
    terminais: [],
    alertas: []
  };

  let numerosMarcados = [];
  let historicoRoleta = [];
  let totalGiros = 0;
  let totalAcertos = 0;
  let totalErros = 0;
  let girando = false;
  let sugestoesIAAtual = [];
  let audioCtx = null;

  const posicoesRace = {
    10: { x: 9.5, y: 23 },
    5: { x: 15.5, y: 20 },
    24: { x: 20, y: 20 },
    16: { x: 25.1, y: 20 },
    33: { x: 29.5, y: 20 },
    1: { x: 34, y: 20 },
    20: { x: 38.5, y: 20 },
    14: { x: 43.5, y: 20 },
    31: { x: 48.5, y: 20 },
    9: { x: 53.3, y: 20 },
    22: { x: 58.3, y: 20 },
    18: { x: 63.5, y: 20 },
    29: { x: 67.5, y: 20 },
    7: { x: 72.5, y: 20 },
    28: { x: 77.5, y: 20 },
    12: { x: 82, y: 20 },
    35: { x: 86.5, y: 20 },
    3: { x: 92, y: 22 },
    26: { x: 96, y: 44 },
    0: { x: 91.5, y: 75.5 },
    32: { x: 86.0, y: 75.5 },
    15: { x: 80.5, y: 75.5 },
    19: { x: 75.0, y: 75.5 },
    4: { x: 71.5, y: 75.5 },
    21: { x: 66, y: 75.5 },
    2: { x: 60, y: 75.5 },
    25: { x: 55, y: 75.5 },
    17: { x: 50, y: 75.5 },
    34: { x: 45, y: 75.5 },
    6: { x: 40, y: 75.5 },
    27: { x: 35, y: 75.5 },
    13: { x: 30, y: 75.5 },
    36: { x: 25, y: 75.5 },
    11: { x: 20, y: 75.5 },
    30: { x: 15, y: 75.5 },
    8: { x: 8, y: 72 },
    23: { x: 4.5, y: 44 }
  };

  /* ======================================
     INICIALIZAR
  ======================================= */

  function iniciarRoletaPro() {
    protegerPagina();
    configurarNavegacao();

    ligarBotao("btnGirarRoleta", girarRoleta);
    ligarBotao("btnLimparMarcacoesRoleta", limparMarcacoesRoleta);
    ligarBotao("btnAplicarIaRoleta", aplicarSugestoesIA);
    ligarBotao("btnAplicarRaceRoleta", atualizarFichasRace);
    ligarBotao("btnAtualizarRadarEstrategias", atualizarRadarEstrategias);

    iniciarRaceRoleta();
    restaurarEstadoLocal();
    atualizarMarcados();
    atualizarHistorico();
    atualizarStats();
    analisarIARoleta();
    atualizarRadarEstrategias();

    registrarAtividade("🎡", "Roleta Reel acessada", "Entrou no minigame Roleta Reel.");
  }

  function ligarBotao(id, funcao) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", funcao);
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

  /* ======================================
     GIRO
  ======================================= */

  function girarRoleta() {
    if (girando) return;

    const wheel = document.getElementById("rouletteWheel");
    const ballTrack = document.getElementById("rouletteBallTrack");

    if (!wheel || !ballTrack) return;

    girando = true;

    setText("roletaStatus", "Girando...");
    setVerificacao("neutro", "🎰 Girando...");

    limparResultadoNaRace();

    const numero = ordemEuropeia[Math.floor(Math.random() * ordemEuropeia.length)];
    const index = ordemEuropeia.indexOf(numero);

    const anguloPorNumero = 360 / ordemEuropeia.length;
    const pontoFixo = 286;
    const destino = pontoFixo - index * anguloPorNumero;

    tocarSomGiro();

    wheel.style.transition = "none";
    ballTrack.style.transition = "none";
    wheel.style.transform = "rotate(0deg)";
    ballTrack.style.transform = "rotate(0deg)";

    wheel.offsetHeight;

    wheel.style.transition = "transform 5.5s cubic-bezier(.16,.84,.29,1)";
    ballTrack.style.transition = "transform 6.5s cubic-bezier(.12,.78,.22,1)";

    wheel.style.transform = `rotate(${360 * 8 + destino}deg)`;
    ballTrack.style.transform = `rotate(${-(360 * 12 + pontoFixo)}deg)`;

    setTimeout(() => {
      wheel.style.transition = "none";
      ballTrack.style.transition = "none";

      wheel.style.transform = `rotate(${destino}deg)`;
      ballTrack.style.transform = `rotate(${-pontoFixo}deg)`;

      finalizarGiro(numero);
    }, 6500);
  }

  function finalizarGiro(numero) {
    girando = false;

    const cor = pegarCor(numero);
    const acertou = numerosMarcados.includes(numero);

    setText("roletaStatus", "Finalizado");

    const ultimoNumero = document.getElementById("ultimoNumeroRoleta");
    if (ultimoNumero) {
      ultimoNumero.textContent = numero;
      ultimoNumero.className = `ultimo-numero-roleta ${cor}`;
    }

    setText("ultimaCorRoleta", cor.toUpperCase());
    setText("resultadoDataRoleta", new Date().toLocaleString("pt-BR"));

    if (acertou) {
      totalAcertos++;
      setVerificacao("acertou", `🔥 ACERTOU! O número ${numero} estava marcado.`);
      tocarSomAcerto();
    } else {
      totalErros++;
      setVerificacao("errou", `❌ ERROU! Caiu ${numero}, mas ele não estava marcado.`);
      tocarSomErro();
    }

    totalGiros++;

    historicoRoleta.unshift({
      numero,
      cor,
      acertou,
      data: new Date().toISOString()
    });

    historicoRoleta = historicoRoleta.slice(0, 30);

    salvarEstadoLocal();
    atualizarHistorico();
    atualizarStats();
    analisarIARoleta();
    atualizarRadarEstrategias();
    destacarResultadoNaRace(numero, acertou);

    registrarAtividade(
      "🎰",
      "Giro realizado",
      `Resultado ${numero} ${cor.toUpperCase()} • ${acertou ? "Acerto" : "Erro"}`
    );
  }

  /* ======================================
     RACETRACK
  ======================================= */

  function iniciarRaceRoleta() {
    const raceClickLayer = document.getElementById("raceClickLayer");
    if (!raceClickLayer) return;

    raceClickLayer.innerHTML = "";

    Object.entries(posicoesRace).forEach(([numero, pos]) => {
      const btn = document.createElement("button");

      btn.type = "button";
      btn.className = "race-num-click";
      btn.dataset.numero = numero;
      btn.style.left = `${pos.x}%`;
      btn.style.top = `${pos.y}%`;

      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        marcarNumeroRace(Number(numero));
      });

      raceClickLayer.appendChild(btn);
    });
  }

  function marcarNumeroRace(numero) {
    if (girando) return;

    if (numerosMarcados.includes(numero)) {
      numerosMarcados = numerosMarcados.filter((n) => n !== numero);
    } else {
      numerosMarcados.push(numero);
    }

    atualizarFichasRace();
    atualizarMarcados();
    salvarEstadoLocal();
  }

  function atualizarFichasRace() {
    const raceFichasLayer = document.getElementById("raceFichasLayer");
    if (!raceFichasLayer) return;

    raceFichasLayer.innerHTML = "";

    numerosMarcados.forEach((numero) => {
      const pos = posicoesRace[numero];
      if (!pos) return;

      const ficha = document.createElement("div");
      ficha.className = "ficha-roleta-pro";
      ficha.style.left = `${pos.x}%`;
      ficha.style.top = `${pos.y}%`;

      ficha.innerHTML = `
        <img src="${CHIP_URL}" alt="Ficha">
        <span>${numero}</span>
      `;

      raceFichasLayer.appendChild(ficha);
    });
  }

  function atualizarMarcados() {
    const contadorMarcados = document.getElementById("contadorMarcados");
    const marcadosLista = document.getElementById("numerosMarcadosLista");

    if (contadorMarcados) {
      contadorMarcados.textContent = `${numerosMarcados.length} selecionado(s)`;
    }

    if (!marcadosLista) return;

    if (!numerosMarcados.length) {
      marcadosLista.innerHTML = `<span class="numero-marcado-empty">Nenhum número marcado</span>`;
      return;
    }

    marcadosLista.innerHTML = "";

    numerosMarcados
      .slice()
      .sort((a, b) => a - b)
      .forEach((numero) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `numero-marcado-pill ${pegarCor(numero)}`;
        item.textContent = numero;
        item.addEventListener("click", () => marcarNumeroRace(numero));
        marcadosLista.appendChild(item);
      });
  }

  function limparMarcacoesRoleta() {
    if (girando) return;

    numerosMarcados = [];

    const raceFichasLayer = document.getElementById("raceFichasLayer");
    if (raceFichasLayer) raceFichasLayer.innerHTML = "";

    limparResultadoNaRace();
    atualizarMarcados();
    salvarEstadoLocal();

    setVerificacao("neutro", "Marcações limpas.");
  }

  function destacarResultadoNaRace(numero, acertou) {
    const layer = document.getElementById("raceResultadoLayer");
    const pos = posicoesRace[numero];

    if (!layer || !pos) return;

    layer.innerHTML = "";

    const destaque = document.createElement("div");
    destaque.className = acertou
      ? "resultado-race-chip acerto"
      : "resultado-race-chip erro";

    destaque.style.left = `${pos.x}%`;
    destaque.style.top = `${pos.y}%`;
    destaque.textContent = numero;

    layer.appendChild(destaque);
  }

  function limparResultadoNaRace() {
    const layer = document.getElementById("raceResultadoLayer");
    if (layer) layer.innerHTML = "";
  }

  /* ======================================
     HISTÓRICO / STATS
  ======================================= */

  function atualizarHistorico() {
    const historicoBox = document.getElementById("historicoRoleta");
    if (!historicoBox) return;

    if (!historicoRoleta.length) {
      historicoBox.innerHTML = `<span class="historico-vazio">Sem giros ainda</span>`;
      return;
    }

    historicoBox.innerHTML = "";

    historicoRoleta.slice(0, 18).forEach((item) => {
      const bolinha = document.createElement("span");
      bolinha.className = `historico-numero ${item.cor}`;

      if (item.acertou) bolinha.classList.add("hit");

      bolinha.textContent = item.numero;
      historicoBox.appendChild(bolinha);
    });
  }

  function atualizarStats() {
    setText("statTotalGiros", totalGiros);
    setText("statTotalGirosSide", totalGiros);
    setText("statAcertos", totalAcertos);
    setText("statErros", totalErros);

    const sequencia = calcularSequencia();

    setText("statSequencia", sequencia);
    setText("statSequenciaSide", sequencia);
  }

  function calcularSequencia() {
    if (!historicoRoleta.length) return "--";

    const corAtual = historicoRoleta[0].cor;
    let seq = 0;

    for (const item of historicoRoleta) {
      if (item.cor === corAtual) seq++;
      else break;
    }

    return `${seq} ${corAtual}`;
  }

  /* ======================================
     IA
  ======================================= */

  function analisarIARoleta() {
    const iaStatus = document.getElementById("iaStatusRoleta");
    const iaNums = document.getElementById("iaNumerosSugeridos");
    const iaTexto = document.getElementById("iaAnaliseTexto");

    if (!iaStatus || !iaNums || !iaTexto) return;

    iaNums.innerHTML = "";
    sugestoesIAAtual = [];

    const historicoValido = historicoRoleta
      .filter((item) => item && typeof item.numero !== "undefined")
      .slice(0, 12);

    if (historicoValido.length < 3) {
      iaStatus.textContent = "Coletando dados...";
      iaTexto.textContent =
        `A IA já analisou ${historicoValido.length} giro(s). Gire pelo menos 3 vezes para identificar padrões.`;
      return;
    }

    const ultimos = historicoValido.map((item) => Number(item.numero));
    const ultimo = ultimos[0];
    const idxUltimo = ordemEuropeia.indexOf(ultimo);

    const vizinhos = getVizinhos(idxUltimo, 2);

    const frequencia = {};
    ultimos.forEach((numero) => {
      frequencia[numero] = (frequencia[numero] || 0) + 1;
    });

    const repetidos = Object.entries(frequencia)
      .filter(([, qtd]) => qtd >= 2)
      .map(([numero]) => Number(numero));

    const ult8 = historicoValido.slice(0, 8);
    const qtdVermelho = ult8.filter((item) => item.cor === "vermelho").length;
    const qtdPreto = ult8.filter((item) => item.cor === "preto").length;
    const qtdZero = ult8.filter((item) => item.cor === "verde").length;

    let sugestoes = [];
    let motivo = "";

    if (repetidos.length > 0) {
      sugestoes = [...new Set([...repetidos, ...vizinhos])];
      motivo =
        `A IA encontrou repetição recente em ${repetidos.join(", ")} e conectou com vizinhos do último resultado (${ultimo}).`;
    } else if (qtdVermelho >= 5) {
      sugestoes = vizinhos;
      motivo =
        `Força nos vermelhos: ${qtdVermelho} dos últimos ${ult8.length} giros. A IA está observando o setor do último número (${ultimo}).`;
    } else if (qtdPreto >= 5) {
      sugestoes = vizinhos;
      motivo =
        `Força nos pretos: ${qtdPreto} dos últimos ${ult8.length} giros. Sugestão focada nos vizinhos do último número (${ultimo}).`;
    } else if (qtdZero > 0) {
      const idxZero = ordemEuropeia.indexOf(0);
      sugestoes = getVizinhos(idxZero, 2);
      motivo = "A IA detectou presença recente do zero e está observando a região dos vizinhos diretos dele.";
    } else {
      sugestoes = vizinhos;
      motivo =
        `Padrão misto. Melhor leitura agora: trabalhar a região dos vizinhos do último número (${ultimo}).`;
    }

    sugestoesIAAtual = [...new Set(sugestoes)].slice(0, 7);

    sugestoesIAAtual.forEach((numero) => {
      const span = document.createElement("button");
      span.type = "button";
      span.className = `ia-numero ${pegarCor(numero)}`;
      span.textContent = numero;
      span.addEventListener("click", () => marcarNumeroRace(numero));
      iaNums.appendChild(span);
    });

    iaStatus.textContent = "Padrão identificado";
    iaTexto.textContent = motivo;
  }

  function aplicarSugestoesIA() {
    if (!sugestoesIAAtual.length) {
      setVerificacao("neutro", "Gire pelo menos 3 vezes para gerar sugestões da IA.");
      return;
    }

    numerosMarcados = [...new Set([...numerosMarcados, ...sugestoesIAAtual])];

    atualizarFichasRace();
    atualizarMarcados();
    salvarEstadoLocal();

    setVerificacao("neutro", "Sugestões da IA aplicadas na race.");
  }

  function getVizinhos(index, alcance = 2) {
    if (index < 0) return [];

    const resultado = [];

    for (let i = -alcance; i <= alcance; i++) {
      const pos = (index + i + ordemEuropeia.length) % ordemEuropeia.length;
      resultado.push(ordemEuropeia[pos]);
    }

    return resultado;
  }

  /* ======================================
     RADAR
  ======================================= */

  function atualizarRadarEstrategias() {
    const dados = {
      espelhos: window.estrategiasIA.espelhos || [],
      flow: window.estrategiasIA.flow || [],
      triangulacao: window.estrategiasIA.triangulacao || [],
      terminais: window.estrategiasIA.terminais || [],
      alertas: window.estrategiasIA.alertas || []
    };

    const ultimos = historicoRoleta.slice(0, 8).map((item) => item.numero);

    const pontuacoes = {
      espelhos: calcularForcaEstrategia(dados.espelhos, ultimos, 78),
      flow: calcularForcaEstrategia(dados.flow, ultimos, 70),
      triangulacao: calcularForcaEstrategia(dados.triangulacao, ultimos, 64),
      terminais: calcularForcaEstrategia(dados.terminais, ultimos, 58),
      alertas: calcularForcaEstrategia(dados.alertas, ultimos, 74)
    };

    atualizarBarraRadar("Espelhos", pontuacoes.espelhos);
    atualizarBarraRadar("Flow", pontuacoes.flow);
    atualizarBarraRadar("Triangulacao", pontuacoes.triangulacao);
    atualizarBarraRadar("Terminais", pontuacoes.terminais);
    atualizarBarraRadar("Alertas", pontuacoes.alertas);

    gerarMelhorEstrategia(pontuacoes, dados);
    gerarNumerosFortesRadar(dados, ultimos);
  }

  function calcularForcaEstrategia(numeros, ultimos, base) {
    if (!numeros || numeros.length === 0) {
      return Math.max(8, Math.floor(Math.random() * 18));
    }

    let score = base;
    const numerosUnicos = [...new Set(numeros)];

    score += numerosUnicos.length * 3;

    numerosUnicos.forEach((numero) => {
      if (ultimos.includes(numero)) score += 12;

      const idx = ordemEuropeia.indexOf(numero);

      if (idx !== -1) {
        const vizinhos = [
          ordemEuropeia[(idx - 1 + ordemEuropeia.length) % ordemEuropeia.length],
          ordemEuropeia[(idx + 1) % ordemEuropeia.length]
        ];

        if (vizinhos.some((v) => ultimos.includes(v))) {
          score += 8;
        }
      }
    });

    if (historicoRoleta.length >= 3) score += 6;
    if (historicoRoleta.length >= 6) score += 4;

    return Math.min(score, 98);
  }

  function atualizarBarraRadar(nome, valor) {
    setText(`percent${nome}`, `${valor}%`);

    const barraEl = document.getElementById(`barra${nome}`);

    if (barraEl) {
      barraEl.style.width = `${valor}%`;
    }
  }

  function gerarMelhorEstrategia(pontuacoes, dados) {
    const nomeEl = document.getElementById("estrategiaRecomendadaNome");
    const textoEl = document.getElementById("estrategiaRecomendadaTexto");

    if (!nomeEl || !textoEl) return;

    const nomes = {
      espelhos: "Espelhos",
      flow: "Flow IA",
      triangulacao: "Triangulação",
      terminais: "Terminais",
      alertas: "Alertas"
    };

    const melhor = Object.entries(pontuacoes).sort((a, b) => b[1] - a[1])[0];

    const chave = melhor[0];
    const valor = melhor[1];
    const numeros = dados[chave] || [];

    nomeEl.textContent = `${nomes[chave]} — ${valor}%`;

    if (numeros.length > 0) {
      textoEl.textContent =
        `A IA recomenda observar ${nomes[chave]}. Força atual: ${valor}%. Números conectados: ${[...new Set(numeros)].join(", ")}.`;
    } else {
      textoEl.textContent =
        `A IA recomenda observar ${nomes[chave]} por leitura estatística. Ainda faltam dados vindos dos outros módulos.`;
    }
  }

  function gerarNumerosFortesRadar(dados, ultimos) {
    const box = document.getElementById("radarNumerosFortes");
    if (!box) return;

    box.innerHTML = "";

    const ranking = {};

    Object.values(dados).forEach((numeros) => {
      numeros.forEach((numero) => {
        ranking[numero] = (ranking[numero] || 0) + 1;
      });
    });

    ultimos.forEach((numero) => {
      ranking[numero] = (ranking[numero] || 0) + 0.5;
    });

    const fortes = Object.entries(ranking)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([numero]) => Number(numero));

    if (!fortes.length) {
      box.innerHTML = `<span class="radar-numero-vazio">Aguardando módulos...</span>`;
      return;
    }

    fortes.forEach((numero) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `radar-numero-forte ${pegarCor(numero)}`;
      btn.textContent = numero;
      btn.addEventListener("click", () => marcarNumeroRace(numero));
      box.appendChild(btn);
    });
  }

  /* ======================================
     LOCAL STORAGE
  ======================================= */

  function salvarEstadoLocal() {
    localStorage.setItem(
      "roletareelEstado",
      JSON.stringify({
        numerosMarcados,
        historicoRoleta,
        totalGiros,
        totalAcertos,
        totalErros
      })
    );
  }

  function restaurarEstadoLocal() {
    try {
      const estado = JSON.parse(localStorage.getItem("roletareelEstado") || "null");

      if (!estado) return;

      numerosMarcados = Array.isArray(estado.numerosMarcados)
        ? estado.numerosMarcados
        : [];

      historicoRoleta = Array.isArray(estado.historicoRoleta)
        ? estado.historicoRoleta
        : [];

      totalGiros = Number(estado.totalGiros || 0);
      totalAcertos = Number(estado.totalAcertos || 0);
      totalErros = Number(estado.totalErros || 0);

      atualizarFichasRace();
    } catch {
      localStorage.removeItem("roletareelEstado");
    }
  }

  function registrarAtividade(icone, titulo, descricao) {
    const atividades = JSON.parse(localStorage.getItem("atividadesRecentes") || "[]");

    atividades.unshift({
      icone,
      titulo,
      descricao,
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

  function pegarCor(numero) {
    if (numero === 0) return "verde";
    if (vermelhos.includes(numero)) return "vermelho";
    return "preto";
  }

  function setText(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  }

  function setVerificacao(tipo, texto) {
    const resultadoVerificacao = document.getElementById("resultadoVerificacao");
    if (!resultadoVerificacao) return;

    resultadoVerificacao.className = `resultado-verificacao ${tipo}`;
    resultadoVerificacao.textContent = texto;
  }

  /* ======================================
     SONS
  ======================================= */

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    return audioCtx;
  }

  function tocarSomGiro() {
    tocarSom(600, 0.5, "triangle", 0.02);
  }

  function tocarSomAcerto() {
    tocarSom(900, 0.25, "sine", 0.03);
  }

  function tocarSomErro() {
    tocarSom(200, 0.25, "sawtooth", 0.025);
  }

  function tocarSom(frequencia, duracao, tipo, volume) {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = tipo;
      osc.frequency.value = frequencia;
      gain.gain.value = volume;

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duracao);
    } catch {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarRoletaPro);
  } else {
    iniciarRoletaPro();
  }
})();