/* ======================================
   REFLEXIVOS.JS • TURMA BLACK
   Sistema de Espelhos / Reflexivos
====================================== */

(() => {
  const reflexivos = [
    { nome: "01 / 10 / 11 / 0", numeros: [1, 10, 11, 0] },
    { nome: "22 / 20 / 02 / 11", numeros: [22, 20, 2, 11] },
    { nome: "30 / 03 / 33", numeros: [30, 3, 33] },
    { nome: "06 / 09", numeros: [6, 9] },
    { nome: "31 / 13", numeros: [31, 13] },
    { nome: "12 / 21", numeros: [12, 21] },
    { nome: "26 / 29", numeros: [26, 29] },
    { nome: "23 / 32", numeros: [23, 32] },
    { nome: "16 / 19", numeros: [16, 19] }
  ];

  const posicoesRaceReflexivos = {
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

  function iniciarReflexivos() {
    protegerPagina();
    configurarNavegacao();
    configurarBotoes();
    gerarOpcoesReflexivos();
    limparReflexivos();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarReflexivos);
  } else {
    iniciarReflexivos();
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
    $("btnLimparReflexivos")?.addEventListener("click", limparReflexivos);
  }

  function gerarOpcoesReflexivos() {
    const box = $("espelhosOptions");
    if (!box) return;

    box.innerHTML = "";

    reflexivos.forEach((reflexivo, index) => {
      const btn = document.createElement("button");

      btn.className = "reflexivo-btn";
      btn.type = "button";
      btn.dataset.reflexivo = String(index);

      btn.innerHTML = `
        <div class="reflexivo-info">
          <small>Reflexivo</small>
          <strong>${escapeHTML(reflexivo.nome)}</strong>
        </div>

        <span class="reflexivo-qtd">
          ${reflexivo.numeros.length} nums
        </span>
      `;

      btn.addEventListener("click", () => {
        document.querySelectorAll(".reflexivo-btn").forEach((item) => {
          item.classList.remove("active");
        });

        btn.classList.add("active");
        marcarReflexivoNaRace(reflexivo.numeros, reflexivo.nome);
      });

      box.appendChild(btn);
    });
  }

  function marcarReflexivoNaRace(numeros, nomeReflexivo = "") {
    const area = $("raceMarkers");
    if (!area) return;

    area.innerHTML = "";

    numeros.forEach((numero, index) => {
      const pos = posicoesRaceReflexivos[numero];

      if (!pos) {
        console.warn(`Número ${numero} sem posição cadastrada.`);
        return;
      }

      setTimeout(() => {
        const marker = document.createElement("div");

        marker.className = index === 0
          ? "reflexivo-marker principal-reflexivo"
          : "reflexivo-marker";

        marker.dataset.numero = String(numero);
        marker.style.left = `${pos.x}%`;
        marker.style.top = `${pos.y}%`;
        marker.innerHTML = `<span>${numero}</span>`;

        area.appendChild(marker);
      }, index * 100);
    });

    atualizarInfoReflexivo(nomeReflexivo, numeros);
    registrarAtividadeReflexivo(nomeReflexivo, numeros);
  }

  function atualizarInfoReflexivo(nome, numeros) {
    const info = $("espelhoSelecionadoInfo");
    if (!info) return;

    info.innerHTML = `
      <strong>Reflexivo selecionado</strong>
      <span>${escapeHTML(nome || "Nenhum")}</span>
      <small>Números marcados: ${escapeHTML(numeros.join(", "))}</small>
    `;
  }

  function limparReflexivos() {
    const area = $("raceMarkers");

    if (area) {
      area.innerHTML = "";
    }

    document.querySelectorAll(".reflexivo-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    const info = $("espelhoSelecionadoInfo");

    if (info) {
      info.innerHTML = `
        <strong>Reflexivo selecionado</strong>
        <span>Nenhum</span>
        <small>Escolha uma opção acima para marcar os números na race.</small>
      `;
    }
  }

  function registrarAtividadeReflexivo(nome, numeros) {
    let atividades = [];

    try {
      atividades = JSON.parse(localStorage.getItem("atividadesRecentes") || "[]");
    } catch {
      atividades = [];
    }

    atividades.unshift({
      icone: "🧠",
      titulo: "Reflexivos",
      descricao: `${nome} • ${numeros.join(", ")}`,
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