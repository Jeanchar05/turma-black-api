/* ======================================
   CAMALEÕES.JS • TURMA BLACK
   Números camuflados / conexões escondidas
====================================== */

(() => {
  const tabelaCamaleoes = {
    1: [12, 21, 29],
    2: [11, 20, 29],
    3: [12, 21, 30],
    4: [13, 22, 31],
    5: [14, 23, 32],
    6: [15, 24, 33],
    7: [16, 25, 34],
    8: [17, 26, 35],
    9: [18, 27, 36],
    10: [19, 28, 1]
  };

  const posicoesRaceCamaleoes = {
    0:  { x: 50, y: 7 },
    32: { x: 84.5, y: 71 },
    15: { x: 80, y: 71 },
    19: { x: 75, y: 70 },
    4:  { x: 70, y: 71 },
    21: { x: 65, y: 71 },
    2:  { x: 60, y: 71 },
    25: { x: 55, y: 70 },
    17: { x: 48, y: 71 },
    34: { x: 44, y: 71 },
    6:  { x: 38, y: 71 },
    27: { x: 34, y: 71 },
    13: { x: 28, y: 71 },
    36: { x: 24, y: 71 },
    11: { x: 20, y: 71 },
    30: { x: 14, y: 71 },
    8:  { x: 10, y: 71 },
    23: { x: 4, y: 40 },
    10: { x: 8, y: 17 },
    5:  { x: 16, y: 17 },
    24: { x: 20, y: 17 },
    16: { x: 25, y: 17 },
    33: { x: 28, y: 17 },
    1:  { x: 34, y: 17 },
    20: { x: 38, y: 17 },
    14: { x: 43.4, y: 17 },
    31: { x: 48, y: 17 },
    9:  { x: 53, y: 17 },
    22: { x: 57, y: 17 },
    18: { x: 62, y: 17 },
    29: { x: 68, y: 17 },
    7:  { x: 73, y: 17 },
    28: { x: 77, y: 15 },
    12: { x: 82, y: 17 },
    35: { x: 85, y: 17 },
    3:  { x: 92, y: 17 },
    26: { x: 95, y: 40 }
  };

  function iniciarCamaleoes() {
    protegerPagina();
    configurarNavegacao();
    configurarBotoes();
    renderizarTabelaCamaleoes();
    limparCamaleoes();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarCamaleoes);
  } else {
    iniciarCamaleoes();
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
    $("btnLimparCamaleoes")?.addEventListener("click", limparCamaleoes);
  }

  function renderizarTabelaCamaleoes() {
    const lista = $("listaCamuflados");
    if (!lista) return;

    lista.innerHTML = "";

    Object.entries(tabelaCamaleoes).forEach(([base, camaleoes]) => {
      const card = document.createElement("button");

      card.className = "camaleao-card";
      card.type = "button";
      card.dataset.base = base;

      card.innerHTML = `
        <div class="camaleao-numero">${escapeHTML(base)}</div>

        <div class="camaleao-seta">→</div>

        <div class="camaleao-lista">
          ${camaleoes.map((num) => `<span>${escapeHTML(num)}</span>`).join("")}
        </div>
      `;

      card.addEventListener("click", () => {
        document.querySelectorAll(".camaleao-card").forEach((btn) => {
          btn.classList.remove("active");
        });

        card.classList.add("active");
        mostrarCamaleao(base, camaleoes);
      });

      lista.appendChild(card);
    });
  }

  function mostrarCamaleao(base, camaleoes) {
    marcarRaceCamaleoes(base, camaleoes);
    atualizarAnaliseCamaleao(base, camaleoes);
    registrarAtividadeCamaleao(base, camaleoes);
  }

  function atualizarAnaliseCamaleao(base, camaleoes) {
    const resultado = $("resultadoCamuflado");
    if (!resultado) return;

    resultado.classList.add("ativo");

    resultado.innerHTML = `
      <h2>🔎 Número ${escapeHTML(base)}</h2>

      <p>
        Quando o número <strong>${escapeHTML(base)}</strong> aparece, as conexões
        Camaleões principais para observar são:
      </p>

      <div class="resultado-camaleao-numeros">
        ${camaleoes.map((num) => `<span>${escapeHTML(num)}</span>`).join("")}
      </div>

      <div class="analise-camaleao-box">
        <h3>Como interpretar?</h3>

        <p>
          O número <strong>${escapeHTML(base)}</strong> pode puxar ou se conectar com
          <strong>${escapeHTML(camaleoes.join(", "))}</strong>. Observe no histórico
          se algum desses números aparece logo depois ou em ciclos próximos.
        </p>
      </div>
    `;
  }

  function marcarRaceCamaleoes(base, camaleoes) {
    const container = $("marcadoresCamuflados");
    if (!container) return;

    container.innerHTML = "";

    const numeros = [Number(base), ...camaleoes.map(Number)];

    numeros.forEach((numero, index) => {
      const pos = posicoesRaceCamaleoes[numero];

      if (!pos) {
        console.warn(`Número ${numero} sem posição cadastrada.`);
        return;
      }

      setTimeout(() => {
        const marcador = document.createElement("div");

        marcador.className =
          index === 0
            ? "marcador-camaleao base-camaleao"
            : "marcador-camaleao";

        marcador.style.left = `${pos.x}%`;
        marcador.style.top = `${pos.y}%`;
        marcador.innerText = numero;

        container.appendChild(marcador);
      }, index * 100);
    });
  }

  function limparCamaleoes() {
    const container = $("marcadoresCamuflados");

    if (container) {
      container.innerHTML = "";
    }

    document.querySelectorAll(".camaleao-card").forEach((btn) => {
      btn.classList.remove("active");
    });

    const resultado = $("resultadoCamuflado");

    if (resultado) {
      resultado.classList.remove("ativo");

      resultado.innerHTML = `
        <h2>🔎 Análise Camaleões</h2>
        <p>Escolha um número acima para ver a explicação.</p>
      `;
    }
  }

  function registrarAtividadeCamaleao(base, camaleoes) {
    let atividades = [];

    try {
      atividades = JSON.parse(localStorage.getItem("atividadesRecentes") || "[]");
    } catch {
      atividades = [];
    }

    atividades.unshift({
      icone: "🦎",
      titulo: "Camaleões",
      descricao: `${base} conecta com ${camaleoes.join(", ")}`,
      data: new Date().toISOString()
    });

    localStorage.setItem(
      "atividadesRecentes",
      JSON.stringify(atividades.slice(0, 20))
    );
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