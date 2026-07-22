/* ======================================
   ECLIPSE01.JS • MINIGAME ECLIPSE 0
====================================== */

(() => {
  const ordemEuropeia = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34,
    6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
    29, 7, 28, 12, 35, 3, 26
  ];

  const basesTerminalZero = [0, 10, 20, 30];

  let rodadaAtual = null;
  let podeResponder = false;

  let acertos = Number(localStorage.getItem("eclipse01Acertos")) || 0;
  let erros = Number(localStorage.getItem("eclipse01Erros")) || 0;

  function iniciarEclipse01() {
    protegerPagina();
    configurarNavegacao();
    configurarBotoes();
    renderizarTerminalZero();
    carregarHistorico();
    atualizarPlacar();
    limparTelaResultado();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarEclipse01);
  } else {
    iniciarEclipse01();
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
      const btn = event.target.closest("[data-page]");
      if (!btn) return;

      const page = btn.dataset.page;
      if (page) window.location.href = page;
    });
  }

  function configurarBotoes() {
    $("btnGerarRodadaEclipse01")?.addEventListener("click", gerarRodadaAnimada);

    $("btnSimEclipse01")?.addEventListener("click", () => responderAluno(true));
    $("btnNaoEclipse01")?.addEventListener("click", () => responderAluno(false));

    $("btnResetEclipse01")?.addEventListener("click", resetarTreino);
    $("btnLimparHistoricoEclipse01")?.addEventListener("click", limparHistorico);
  }

  function pegarVizinhos(numero, qtd = 2) {
    const index = ordemEuropeia.indexOf(Number(numero));
    if (index === -1) return [];

    const lista = [];

    for (let i = qtd; i >= 1; i--) {
      lista.push(ordemEuropeia[(index - i + ordemEuropeia.length) % ordemEuropeia.length]);
    }

    lista.push(Number(numero));

    for (let i = 1; i <= qtd; i++) {
      lista.push(ordemEuropeia[(index + i) % ordemEuropeia.length]);
    }

    return lista;
  }

  function gerarTerminalZeroCompleto() {
    return [
      ...new Set(
        basesTerminalZero.flatMap((numero) => pegarVizinhos(numero, 2))
      )
    ];
  }

  function sortearNumero() {
    return ordemEuropeia[Math.floor(Math.random() * ordemEuropeia.length)];
  }

  function gerarRodada() {
    const terminalZero = gerarTerminalZeroCompleto();
    const repetido = sortearNumero();

    const deveSerValida = Math.random() >= 0.5;
    let giros = [];

    if (deveSerValida) {
      const permitidos = ordemEuropeia.filter((n) => !terminalZero.includes(n));

      while (giros.length < 4) {
        giros.push(permitidos[Math.floor(Math.random() * permitidos.length)]);
      }
    } else {
      const invalidador = terminalZero[Math.floor(Math.random() * terminalZero.length)];

      while (giros.length < 4) {
        if (giros.length === 1) {
          giros.push(invalidador);
        } else {
          giros.push(sortearNumero());
        }
      }
    }

    const invalidadores = giros.filter((numero) => terminalZero.includes(numero));
    const fazParte = invalidadores.length === 0;

    return {
      repetido,
      repeticao: [repetido, repetido],
      giros,
      invalidadores,
      fazParte,
      terminalZero
    };
  }

  async function gerarRodadaAnimada() {
    const btn = $("btnGerarRodadaEclipse01");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "🎰 Roletando...";
    }

    podeResponder = false;
    rodadaAtual = gerarRodada();

    limparTelaResultado();
    limparSequencia();

    await animarNumero(rodadaAtual.repetido);
    mostrarRepeticao(rodadaAtual.repeticao);

    for (let i = 0; i < rodadaAtual.giros.length; i++) {
      await animarNumero(rodadaAtual.giros[i]);
      mostrarGiro(i, rodadaAtual.giros[i]);
    }

    podeResponder = true;

    setResultado("aguardando", "Rodada gerada. Responda se faz parte do Eclipse 0.");

    if (btn) {
      btn.disabled = false;
      btn.textContent = "▶ Gerar nova rodada";
    }
  }

  function animarNumero(numeroFinal) {
    return new Promise((resolve) => {
      const numeroBox = $("numeroAtualEclipse01");
      const wheel = $("eclipse01Wheel");

      if (wheel) {
        wheel.classList.add("girando");
      }

      let contador = 0;
      const intervalo = setInterval(() => {
        const fake = sortearNumero();

        if (numeroBox) numeroBox.textContent = fake;

        contador++;

        if (contador >= 14) {
          clearInterval(intervalo);

          if (numeroBox) numeroBox.textContent = numeroFinal;

          if (wheel) {
            wheel.classList.remove("girando");
          }

          setTimeout(resolve, 250);
        }
      }, 60);
    });
  }

  function mostrarRepeticao(repeticao) {
    const box = $("repeticaoEclipse01");
    if (!box) return;

    box.innerHTML = repeticao
      .map((numero) => `<span class="repeat">${escapeHTML(numero)}</span>`)
      .join("");
  }

  function mostrarGiro(index, numero) {
    const box = $("girosEclipse01");
    if (!box) return;

    const spans = box.querySelectorAll("span");

    if (spans[index]) {
      spans[index].textContent = numero;
      spans[index].classList.add("filled");
    }
  }

  function responderAluno(respostaAluno) {
    if (!rodadaAtual || !podeResponder) {
      setResultado("erro", "Gere uma rodada antes de responder.");
      return;
    }

    const correto = rodadaAtual.fazParte;
    const acertou = respostaAluno === correto;

    if (acertou) acertos++;
    else erros++;

    localStorage.setItem("eclipse01Acertos", String(acertos));
    localStorage.setItem("eclipse01Erros", String(erros));

    atualizarPlacar();

    const titulo = acertou ? "✅ Acertou!" : "❌ Errou!";
    let texto = "";

    if (rodadaAtual.fazParte) {
      texto =
        "Essa rodada faz parte do Eclipse 0. Os 4 giros passaram limpos, sem Terminal 0 + 2 vizinhos.";
    } else {
      texto =
        `Essa rodada NÃO faz parte. Apareceu invalidador nos 4 giros: ${rodadaAtual.invalidadores.join(", ")}.`;
    }

    setResultado(acertou ? "sucesso" : "erro", `${titulo} ${texto}`);

    salvarHistorico({
      acertou,
      respostaAluno,
      correto,
      repeticao: rodadaAtual.repeticao,
      giros: rodadaAtual.giros,
      invalidadores: rodadaAtual.invalidadores,
      data: new Date().toLocaleString("pt-BR")
    });

    podeResponder = false;
  }

  function renderizarTerminalZero() {
    const box = $("terminalZeroEclipse01");
    if (!box) return;

    box.innerHTML = basesTerminalZero.map((base) => {
      const numeros = pegarVizinhos(base, 2);

      return `
        <div class="eclipse01-terminal-item">
          <strong>${escapeHTML(base)}</strong>
          <span>${numeros.map(escapeHTML).join(", ")}</span>
        </div>
      `;
    }).join("");
  }

  function atualizarPlacar() {
    const total = acertos + erros;

    setText("acertosEclipse01", acertos);
    setText("errosEclipse01", erros);
    setText("totalEclipse01", total);
  }

  function salvarHistorico(item) {
    let historico = [];

    try {
      historico = JSON.parse(localStorage.getItem("eclipse01Historico") || "[]");
    } catch {
      historico = [];
    }

    historico.unshift(item);
    localStorage.setItem("eclipse01Historico", JSON.stringify(historico.slice(0, 20)));

    carregarHistorico();
    registrarAtividade(item);
  }

  function carregarHistorico() {
    const box = $("historicoEclipse01Lista");
    if (!box) return;

    let historico = [];

    try {
      historico = JSON.parse(localStorage.getItem("eclipse01Historico") || "[]");
    } catch {
      historico = [];
    }

    if (!historico.length) {
      box.innerHTML = `<div class="eclipse01-empty">Nenhuma rodada ainda.</div>`;
      return;
    }

    box.innerHTML = historico.map((item) => `
      <div class="eclipse01-history-item ${item.acertou ? "ok" : "erro"}">
        <div>
          <strong>${item.acertou ? "✅ Acerto" : "❌ Erro"}</strong>
          <p>
            Rep: ${escapeHTML(item.repeticao.join(", "))} |
            Giros: ${escapeHTML(item.giros.join(", "))}
          </p>
          <small>${escapeHTML(item.data)}</small>
        </div>

        <span>
          ${item.correto ? "Faz parte" : "Não faz parte"}
        </span>
      </div>
    `).join("");
  }

  function limparHistorico() {
    localStorage.removeItem("eclipse01Historico");
    carregarHistorico();
  }

  function resetarTreino() {
    acertos = 0;
    erros = 0;
    rodadaAtual = null;
    podeResponder = false;

    localStorage.removeItem("eclipse01Acertos");
    localStorage.removeItem("eclipse01Erros");

    atualizarPlacar();
    limparTelaResultado();
    limparSequencia();

    setText("numeroAtualEclipse01", "--");
  }

  function limparTelaResultado() {
    setResultado("neutro", "Gere uma rodada para começar.");
  }

  function limparSequencia() {
    const repeticao = $("repeticaoEclipse01");
    const giros = $("girosEclipse01");

    if (repeticao) {
      repeticao.innerHTML = `<span>--</span><span>--</span>`;
    }

    if (giros) {
      giros.innerHTML = `<span>--</span><span>--</span><span>--</span><span>--</span>`;
    }
  }

  function setResultado(tipo, texto) {
    const box = $("resultadoEclipse01");
    if (!box) return;

    box.className = `eclipse01-result ${tipo}`;
    box.textContent = texto;
  }

  function registrarAtividade(item) {
    let atividades = [];

    try {
      atividades = JSON.parse(localStorage.getItem("atividadesRecentes") || "[]");
    } catch {
      atividades = [];
    }

    atividades.unshift({
      icone: "🌑",
      titulo: "Minigame Eclipse 0",
      descricao: item.acertou ? "Acertou a análise" : "Errou a análise",
      data: new Date().toISOString()
    });

    localStorage.setItem(
      "atividadesRecentes",
      JSON.stringify(atividades.slice(0, 20))
    );
  }

  function setText(id, texto) {
    const el = $(id);
    if (el) el.textContent = texto;
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