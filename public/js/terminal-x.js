// ===============================
// TERMINAL-X.JS
// ===============================

const terminaisX = {
  0: [0, 10, 20, 30],
  1: [1, 11, 21, 31],
  2: [2, 12, 22, 32],
  3: [3, 13, 23, 33],
  4: [4, 14, 24, 34],
  5: [5, 15, 25, 35],
  6: [6, 16, 26, 36],
  7: [7, 17, 27],
  8: [8, 18, 28],
  9: [9, 19, 29]
};

const posicoesRaceTerminalX = {
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

function terminalXEl(id) {
  return document.getElementById(id);
}

function setTextoTerminalX(id, texto) {
  const el = terminalXEl(id);
  if (el) el.innerText = texto;
}

function limparTerminalX(resetPainel = true) {
  const area = terminalXEl("marcadoresTerminalX");

  if (area) {
    area.innerHTML = "";
  }

  document.querySelectorAll("[data-terminalx]").forEach((btn) => {
    btn.classList.remove("active");
  });

  if (!resetPainel) return;

  setTextoTerminalX("terminalAtualX", "Nenhum");
  setTextoTerminalX("totalMarcadoTerminalX", "0 números");
  setTextoTerminalX("finalEscolhidoTerminalX", "---");
  setTextoTerminalX("coberturaTerminalX", "---");

  const lista = terminalXEl("listaNumerosTerminalX");
  if (lista) lista.innerHTML = "Nenhum terminal selecionado.";

  const analise = terminalXEl("analiseTerminalX");
  if (analise) {
    analise.innerText = "Selecione um terminal para visualizar os números com o mesmo final.";
  }
}

function marcarNumeroTerminalX(numero) {
  const area = terminalXEl("marcadoresTerminalX");
  const pos = posicoesRaceTerminalX[numero];

  if (!area || !pos) return;

  const marcador = document.createElement("div");
  marcador.className = "terminalx-marcador";
  marcador.style.left = `${pos.x}%`;
  marcador.style.top = `${pos.y}%`;
  marcador.innerHTML = `<span>${numero}</span>`;

  area.appendChild(marcador);
}

function atualizarListaTerminalX(numeros) {
  const lista = terminalXEl("listaNumerosTerminalX");
  if (!lista) return;

  lista.innerHTML = numeros
    .map((n) => `<span class="terminalx-numero-pill">${n}</span>`)
    .join("");
}

function coberturaTerminalX(total) {
  if (total <= 3) return "Curta";
  if (total === 4) return "Completa";
  return "Alta";
}

function gerarAnaliseTerminalX(terminal, numeros) {
  return `O Terminal ${terminal} marca todos os números com final ${terminal}: ${numeros.join(", ")}. Use essa leitura quando perceber repetição de finais parecidos na race.`;
}

function selecionarTerminalX(terminal) {
  terminal = Number(terminal);

  const numeros = terminaisX[terminal];

  if (!numeros) return;

  limparTerminalX(false);

  document.querySelectorAll("[data-terminalx]").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.terminalx) === terminal);
  });

  numeros.forEach(marcarNumeroTerminalX);

  setTextoTerminalX("terminalAtualX", `T${terminal}`);
  setTextoTerminalX("totalMarcadoTerminalX", `${numeros.length} números`);
  setTextoTerminalX("finalEscolhidoTerminalX", terminal);
  setTextoTerminalX("coberturaTerminalX", coberturaTerminalX(numeros.length));

  atualizarListaTerminalX(numeros);

  const analise = terminalXEl("analiseTerminalX");
  if (analise) {
    analise.innerText = gerarAnaliseTerminalX(terminal, numeros);
  }

  salvarHistoricoTerminalX(terminal, numeros);
}

function salvarHistoricoTerminalX(terminal, numeros) {
  let historico = [];

  try {
    historico = JSON.parse(localStorage.getItem("terminalXHistorico")) || [];
  } catch {
    historico = [];
  }

  historico.unshift({
    terminal,
    numeros,
    data: new Date().toLocaleString("pt-BR")
  });

  historico = historico.slice(0, 20);
  localStorage.setItem("terminalXHistorico", JSON.stringify(historico));
}

function iniciarTerminalX() {
  const area = terminalXEl("marcadoresTerminalX");

  if (area) {
    area.style.position = "absolute";
    area.style.left = "0";
    area.style.top = "0";
    area.style.width = "100%";
    area.style.height = "100%";
    area.style.pointerEvents = "none";
  }

  const raceArea = document.querySelector(".terminalx-race-area");
  if (raceArea) {
    raceArea.style.position = "relative";
  }

  limparTerminalX(true);
}

document.addEventListener("click", (e) => {
  const btnTerminal = e.target.closest("[data-terminalx]");

  if (btnTerminal) {
    e.preventDefault();
    selecionarTerminalX(btnTerminal.dataset.terminalx);
    return;
  }

  const btnLimpar = e.target.closest("#btnLimparTerminalX");

  if (btnLimpar) {
    e.preventDefault();
    limparTerminalX(true);
  }
});

document.addEventListener("DOMContentLoaded", iniciarTerminalX);
window.addEventListener("load", iniciarTerminalX);