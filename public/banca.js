/* ======================================
   BANCA.JS • GESTÃO TURMA BLACK
====================================== */

let graficoBancaPremium = null;
let planoBanca = [];
let resultadosReais = [];

function moedaBanca(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function numBanca(id) {
  return parseFloat(String(document.getElementById(id)?.value || "0").replace(",", ".")) || 0;
}

function setText(id, valor) {
  const el = document.getElementById(id);
  if (el) el.innerText = valor;
}

function hojeBR() {
  return new Date().toLocaleDateString("pt-BR");
}

function somarDias(data, dias) {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova.toLocaleDateString("pt-BR");
}

function protegerBanca() {
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  const token = localStorage.getItem("token");

  if (!usuario || !token) {
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("token");
    window.location.href = "index.html";
  }
}

function configurarNavegacaoBanca() {
  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-page]");
    if (!btn) return;

    const page = btn.dataset.page;
    if (page) window.location.href = page;
  });

  document.getElementById("btnSair")?.addEventListener("click", () => {
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("token");
    window.location.href = "index.html";
  });
}

function salvarPlanoPremium() {
  const dados = {
    bancaInicial: numBanca("bancaInicial"),
    periodoDias: numBanca("periodoDias"),
    metaFinal: numBanca("metaFinal"),
    stopLoss: numBanca("stopLoss"),
    resultadosReais
  };

  localStorage.setItem("bancaPremiumDados", JSON.stringify(dados));
}

function carregarPlanoPremium() {
  try {
    const dados = JSON.parse(localStorage.getItem("bancaPremiumDados") || "null");

    if (dados) {
      document.getElementById("bancaInicial").value = dados.bancaInicial || 10000;
      document.getElementById("periodoDias").value = dados.periodoDias || 20;
      document.getElementById("metaFinal").value = dados.metaFinal || 50000;
      document.getElementById("stopLoss").value = dados.stopLoss || 9;

      resultadosReais = Array.isArray(dados.resultadosReais) ? dados.resultadosReais : [];
    }
  } catch {
    resultadosReais = [];
  }

  calcularPlanoBanca(false);
}

function calcularPlanoBanca(resetResultados = false) {
  const bancaInicial = numBanca("bancaInicial");
  const periodo = Math.max(1, Math.floor(numBanca("periodoDias")));
  const metaFinal = numBanca("metaFinal");
  const stopLoss = Math.max(0, numBanca("stopLoss"));

  if (resetResultados) resultadosReais = [];

  planoBanca = [];

  if (bancaInicial <= 0 || periodo <= 0 || metaFinal <= bancaInicial) {
    atualizarTelaBanca();
    desenharGraficoPremium();
    montarTabelaControle();
    salvarPlanoPremium();
    return;
  }

  const lucroTotal = metaFinal - bancaInicial;
  const metaValorFixo = lucroTotal / periodo;

  let bancaAtual = bancaInicial;

  for (let dia = 1; dia <= periodo; dia++) {
    const metaValor = metaValorFixo;
    const riscoValor = bancaAtual * (stopLoss / 100);
    const bancaFinal = bancaAtual + metaValor;
    const metaPct = bancaAtual > 0 ? (metaValor / bancaAtual) * 100 : 0;

    planoBanca.push({
      dia,
      data: somarDias(new Date(), dia - 1),
      bancaInicial: bancaAtual,
      metaValor,
      riscoValor,
      bancaFinal,
      metaPct
    });

    bancaAtual = bancaFinal;
  }

  atualizarTelaBanca();
  desenharGraficoPremium();
  montarTabelaControle();
  salvarPlanoPremium();
}

function atualizarTelaBanca() {
  const bancaInicial = numBanca("bancaInicial");
  const periodo = Math.max(1, Math.floor(numBanca("periodoDias")));
  const metaFinal = numBanca("metaFinal");
  const stopLoss = Math.max(0, numBanca("stopLoss"));
  const bancaAtual = getBancaAtualReal();

  const metaValorFixo =
    metaFinal > bancaInicial && periodo > 0
      ? (metaFinal - bancaInicial) / periodo
      : 0;

  const taxaDiaria = bancaInicial > 0 ? (metaValorFixo / bancaInicial) * 100 : 0;
  const crescimentoTotal = bancaInicial > 0 && metaFinal > bancaInicial
    ? ((metaFinal - bancaInicial) / bancaInicial) * 100
    : 0;

  const riscoDiario = bancaAtual * (stopLoss / 100);
  const desempenho = bancaInicial > 0 ? ((bancaAtual - bancaInicial) / bancaInicial) * 100 : 0;

  const progressoMeta = metaFinal > bancaInicial
    ? ((bancaAtual - bancaInicial) / (metaFinal - bancaInicial)) * 100
    : 0;

  const progressoLimitado = Math.max(0, Math.min(progressoMeta, 100));
  const distancia = Math.max(metaFinal - bancaAtual, 0);
  const distanciaPct = metaFinal > 0 ? (distancia / metaFinal) * 100 : 0;

  const positivos = resultadosReais.filter((r) => r.resultado > 0).length;
  const negativos = resultadosReais.filter((r) => r.resultado < 0).length;

  setText("precisaDia", moedaBanca(metaValorFixo));
  setText("precisaDiaPct", `(${taxaDiaria.toFixed(2)}% da banca inicial ao dia)`);
  setText("crescimentoTotal", `${crescimentoTotal.toFixed(2)}%`);
  setText("projecaoFinal", moedaBanca(metaFinal));
  setText("riscoDiario", moedaBanca(riscoDiario));

  setText("frasePlano", gerarFrasePlano({
    bancaInicial,
    bancaAtual,
    metaFinal,
    periodo,
    precisaDia: metaValorFixo,
    taxaDiaria
  }));

  setText("statusPercent", `${progressoLimitado.toFixed(0)}%`);
  setText("evolucaoAtual", moedaBanca(bancaAtual));
  setText("desempenhoAtual", `${desempenho.toFixed(2)}%`);
  setText("diasRestantes", `Faltam ${Math.max(periodo - resultadosReais.length, 0)} dias para sua meta`);

  setText("sequenciaPositiva", calcularSequenciaPositiva());
  setText("diasPositivos", positivos);
  setText("diasNegativos", negativos);
  setText("diasTotalPositivos", `de ${resultadosReais.length}`);
  setText("diasTotalNegativos", `de ${resultadosReais.length}`);

  setText("distanciaMeta", moedaBanca(distancia));
  setText("distanciaPercent", `${distanciaPct.toFixed(2)}%`);

  const barra = document.getElementById("barraMeta");
  if (barra) barra.style.width = `${progressoLimitado}%`;

  const circulo = document.querySelector(".banca-circle");
  if (circulo) circulo.style.setProperty("--percent", `${progressoLimitado * 3.6}deg`);

  setText("resBancaInicial", moedaBanca(bancaInicial));
  setText("resMetaFinal", moedaBanca(metaFinal));
  setText("resPeriodo", `${periodo} dias`);
  setText("resMetaDia", `${moedaBanca(metaValorFixo)} por dia`);
  setText("resStop", `-${stopLoss}%`);
  setText("resMetodo", "Meta fixa diária");
  setText("resInicio", hojeBR());
  setText("resFim", somarDias(new Date(), periodo - 1));
}

function gerarFrasePlano(dados) {
  const { bancaInicial, bancaAtual, metaFinal, periodo, precisaDia, taxaDiaria } = dados;

  if (bancaInicial <= 0) return "Informe uma banca inicial válida.";
  if (metaFinal <= bancaInicial) return "A meta final precisa ser maior que a banca inicial.";
  if (bancaAtual >= metaFinal) return "Meta atingida. Proteja o lucro e evite exposição desnecessária.";

  if (!resultadosReais.length) {
    return `Para atingir ${moedaBanca(metaFinal)} em ${periodo} dias, busque ${moedaBanca(precisaDia)} por dia. Isso representa ${taxaDiaria.toFixed(2)}% da banca inicial.`;
  }

  const desempenho = bancaInicial > 0 ? ((bancaAtual - bancaInicial) / bancaInicial) * 100 : 0;

  if (desempenho > 0) {
    return `Sua banca está positiva em ${desempenho.toFixed(2)}%. Continue respeitando meta e stop loss.`;
  }

  return "Sua banca está abaixo do ponto inicial. Reduza exposição e proteja o saldo.";
}

function getBancaAtualReal() {
  const bancaInicial = numBanca("bancaInicial");

  if (!resultadosReais.length) return bancaInicial;

  return resultadosReais.reduce((total, item) => total + Number(item.resultado || 0), bancaInicial);
}

function calcularSequenciaPositiva() {
  let sequencia = 0;

  for (let i = resultadosReais.length - 1; i >= 0; i--) {
    if (resultadosReais[i].resultado > 0) sequencia++;
    else break;
  }

  return sequencia;
}

function montarTabelaControle() {
  const tbody = document.getElementById("tabelaControleBanca");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!resultadosReais.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="tabela-vazia">Nenhum resultado lançado ainda.</td>
      </tr>
    `;
    return;
  }

  resultadosReais.forEach((item, index) => {
    const bancaBase = item.bancaAntes;
    const bancaFinal = item.bancaDepois;
    const resultado = item.resultado;
    const pct = bancaBase > 0 ? (resultado / bancaBase) * 100 : 0;
    const metaValor = planoBanca[index]?.metaValor || 0;

    let status = "Abaixo da Meta";
    let classeStatus = "alerta";

    if (resultado >= metaValor) {
      status = "Meta Atingida";
      classeStatus = "positivo";
    }

    if (resultado < 0) {
      status = "Negativo";
      classeStatus = "negativo";
    }

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.data}</td>
      <td>${moedaBanca(bancaBase)}</td>
      <td>${moedaBanca(bancaFinal)}</td>
      <td class="${resultado >= 0 ? "green" : "red"}">
        ${moedaBanca(resultado)}
        <small>(${pct.toFixed(2)}%)</small>
      </td>
      <td><span class="status-banca ${classeStatus}">${status}</span></td>
      <td>
        <button class="edit-dia" data-edit-dia="${index}" type="button">Editar</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  document.querySelectorAll("[data-edit-dia]").forEach((btn) => {
    btn.addEventListener("click", () => editarDia(Number(btn.dataset.editDia)));
  });
}

function abrirModalResultado() {
  const modal = document.getElementById("modalResultadoBanca");
  const input = document.getElementById("valorResultadoDia");
  const bancaAntesEl = document.getElementById("bancaAntesModal");
  const bancaAntes = getBancaAtualReal();

  if (bancaAntesEl) bancaAntesEl.innerText = moedaBanca(bancaAntes);
  if (input) input.value = "";
  if (modal) modal.classList.add("active");
}

function fecharModalResultado() {
  document.getElementById("modalResultadoBanca")?.classList.remove("active");
}

function salvarResultadoDia() {
  const input = document.getElementById("valorResultadoDia");
  const bancaAtualInformada = parseFloat(String(input?.value || "").replace(",", "."));

  if (!bancaAtualInformada || bancaAtualInformada <= 0) {
    alert("Informe a banca atual corretamente.");
    return;
  }

  const index = resultadosReais.length;

  if (index >= planoBanca.length) {
    alert("Você já preencheu todos os dias do período.");
    return;
  }

  const bancaAntes = getBancaAtualReal();
  const resultado = bancaAtualInformada - bancaAntes;

  resultadosReais.push({
    dia: index + 1,
    data: hojeBR(),
    bancaAntes,
    bancaDepois: bancaAtualInformada,
    resultado
  });

  fecharModalResultado();
  atualizarTudoBanca();
  registrarAtividadeBanca(resultado, bancaAtualInformada);
}

function editarDia(index) {
  const atual = resultadosReais[index];
  if (!atual) return;

  const valor = prompt("Digite a banca final deste dia:", atual.bancaDepois);
  if (valor === null) return;

  const bancaDepois = parseFloat(String(valor).replace(",", "."));

  if (isNaN(bancaDepois) || bancaDepois <= 0) {
    alert("Valor inválido.");
    return;
  }

  resultadosReais[index].bancaDepois = bancaDepois;
  recalcularResultadosAPartir(index);
  atualizarTudoBanca();
}

function recalcularResultadosAPartir(indexInicial) {
  let banca = numBanca("bancaInicial");

  resultadosReais.forEach((item, index) => {
    if (index < indexInicial) {
      banca = item.bancaDepois;
      return;
    }

    const resultado = item.bancaDepois - banca;

    resultadosReais[index] = {
      ...item,
      bancaAntes: banca,
      resultado
    };

    banca = item.bancaDepois;
  });
}

function limparControleDiario() {
  if (!confirm("Deseja limpar todo o controle diário?")) return;

  resultadosReais = [];
  atualizarTudoBanca();
}

function desenharGraficoPremium() {
  const canvas = document.getElementById("graficoBancaPremium");

  if (!canvas || typeof Chart === "undefined") return;

  if (graficoBancaPremium) graficoBancaPremium.destroy();

  const bancaInicial = numBanca("bancaInicial");

  const labels = ["Início", ...planoBanca.map((p) => `Dia ${p.dia}`)];
  const dadosProjetados = [bancaInicial, ...planoBanca.map((p) => p.bancaFinal)];

  let acumulado = bancaInicial;
  const dadosReais = [bancaInicial];

  planoBanca.forEach((_, index) => {
    if (resultadosReais[index]) {
      acumulado = resultadosReais[index].bancaDepois;
      dadosReais.push(acumulado);
    } else {
      dadosReais.push(null);
    }
  });

  graficoBancaPremium = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Plano",
          data: dadosProjetados,
          borderWidth: 3,
          tension: 0.35,
          fill: true
        },
        {
          label: "Real",
          data: dadosReais,
          borderWidth: 3,
          tension: 0.35,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { labels: { color: "#ddd" } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${moedaBanca(ctx.raw || 0)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#bbb" },
          grid: { color: "rgba(255,255,255,0.05)" }
        },
        y: {
          ticks: {
            color: "#bbb",
            callback: (value) => moedaBanca(value)
          },
          grid: { color: "rgba(255,255,255,0.07)" }
        }
      }
    }
  });
}

function atualizarTudoBanca() {
  atualizarTelaBanca();
  desenharGraficoPremium();
  montarTabelaControle();
  salvarPlanoPremium();
}

function ativarCalculoAutomaticoBanca() {
  ["bancaInicial", "periodoDias", "metaFinal", "stopLoss"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("input", () => calcularPlanoBanca(false));
    el.addEventListener("change", () => calcularPlanoBanca(false));
  });
}

function iniciarEventosBanca() {
  document.getElementById("btnAdicionarResultado")?.addEventListener("click", abrirModalResultado);
  document.getElementById("btnLimparControle")?.addEventListener("click", limparControleDiario);
  document.getElementById("btnSalvarResultado")?.addEventListener("click", salvarResultadoDia);
  document.getElementById("btnCancelarResultado")?.addEventListener("click", fecharModalResultado);

  document.getElementById("modalResultadoBanca")?.addEventListener("click", (event) => {
    if (event.target.id === "modalResultadoBanca") fecharModalResultado();
  });
}

function registrarAtividadeBanca(resultado, bancaAtual) {
  let atividades = [];

  try {
    atividades = JSON.parse(localStorage.getItem("atividadesRecentes") || "[]");
  } catch {
    atividades = [];
  }

  atividades.unshift({
    icone: resultado >= 0 ? "💚" : "🔻",
    titulo: "Gestão de Banca",
    descricao: `${resultado >= 0 ? "Lucro" : "Prejuízo"}: ${moedaBanca(resultado)} • Banca atual: ${moedaBanca(bancaAtual)}`,
    data: new Date().toISOString()
  });

  localStorage.setItem("atividadesRecentes", JSON.stringify(atividades.slice(0, 20)));
}

document.addEventListener("DOMContentLoaded", () => {
  protegerBanca();
  configurarNavegacaoBanca();
  ativarCalculoAutomaticoBanca();
  carregarPlanoPremium();
  iniciarEventosBanca();
});