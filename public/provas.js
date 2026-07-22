  /* ======================================
   PROVAS.JS • TURMA BLACK PREMIUM
====================================== */

const API_URL = "https://turma-black-api-es3u.onrender.com";

let provaAtual = [];
let respostasUsuario = [];
let questaoAtual = 0;
let timerInterval = null;
let segundosProva = 0;
let tipoProvaRodando = "";

function criarQuestao(modulo, pergunta, correta, erradas, dificuldade = "normal") {
  return { modulo, pergunta, correta, erradas, dificuldade };
}

const QUESTOES_DIARIAS_BASE = [
  criarQuestao("Gestão de Banca","Você bateu 70% da meta diária, mas percebe que começou a operar por ansiedade. Qual decisão é mais profissional?","Reduzir exposição ou parar, porque preservar a banca é prioridade",["Aumentar a entrada para finalizar a meta mais rápido","Ignorar a emoção e continuar normalmente","Dobrar a próxima entrada para acelerar o lucro"]),
  criarQuestao("Gestão de Banca","Um aluno perdeu duas entradas seguidas, mas ainda não bateu o stop. O que ele deve analisar antes de continuar?","Se a próxima entrada tem contexto real ou se é apenas tentativa de recuperação",["Se consegue dobrar para recuperar tudo","Se a banca permite entrar sem pensar","Se outro aluno está entrando também"]),
  criarQuestao("Reflexivos","Durante uma análise, o aluno vê um padrão parecido com um anterior, mas o contexto atual mudou. Qual é o risco?","Aplicar uma leitura antiga sem confirmar o cenário atual",["Esperar confirmação antes de entrar","Reduzir exposição por cautela","Comparar o padrão com o histórico recente"]),
  criarQuestao("Gatilhos","Um gatilho aparece logo após uma sequência confusa. Qual atitude demonstra melhor leitura?","Esperar confirmação, pois gatilho isolado não basta",["Entrar imediatamente porque o gatilho apareceu","Dobrar a entrada para aproveitar o sinal","Ignorar banca e seguir o alerta"]),
  criarQuestao("Camaleões","O método Camaleões exige adaptação. O que isso significa na prática?","Ajustar a leitura conforme o comportamento atual, sem forçar padrão",["Trocar de estratégia a cada perda","Entrar em qualquer padrão visual","Manter a mesma leitura mesmo com sinais contrários"]),
  criarQuestao("Eclipse 0","O aluno identifica uma possível operação no Eclipse 0, mas a leitura está incompleta. Qual decisão é mais segura?","Não entrar até existir confirmação suficiente",["Entrar pequeno só para testar a sorte","Dobrar porque Eclipse 0 é avançado","Ignorar o histórico e confiar no nome do módulo"]),
  criarQuestao("Magnetismo","Uma região parece estar puxando resultados, mas a banca já está próxima do stop. O que deve prevalecer?","A gestão da banca, mesmo que a leitura pareça boa",["A região quente sempre manda","A vontade de recuperar","A última entrada vencedora"]),
  criarQuestao("Fibonacci","Ao usar Fibonacci, qual erro compromete a análise?","Forçar sequência numérica sem contexto operacional",["Analisar histórico antes","Controlar entrada","Esperar confirmação"]),
  criarQuestao("Pitágoras","A lógica de Pitágoras aponta uma conexão, mas outros sinais estão fracos. O que isso indica?","A entrada ainda precisa de mais confirmação",["A conexão já garante acerto","Deve entrar com valor maior","A gestão pode ser ignorada"]),
  criarQuestao("Revisão Geral","Qual frase representa melhor um aluno evoluído?","Eu só entro quando leitura, gestão e emocional estão alinhados",["Eu entro sempre que aparece um sinal","Eu recupero dobrando depois da perda","Eu sigo qualquer padrão que pareça bonito"])
];

const QUESTOES_DOMINGO_BASE = [
  criarQuestao("Domingo Difícil","A IA indicou uma região, mas a banca já atingiu o stop. Qual decisão demonstra maturidade?","Não entrar, pois gestão tem prioridade sobre leitura",["Entrar porque a IA indicou","Dobrar para recuperar","Trocar de método imediatamente"],"difícil"),
  criarQuestao("Domingo Difícil","Uma sequência positiva pode ser perigosa quando:","Gera excesso de confiança e aumento de exposição",["Faz o aluno respeitar meta","Ajuda a parar no lucro","Mantém disciplina"],"difícil"),
  criarQuestao("Domingo Difícil","Se vários sinais aparecem, mas todos contradizem o histórico recente, o correto é:","Reduzir confiança na entrada e esperar nova confirmação",["Entrar máximo","Ignorar o histórico","Dobrar proteção"],"difícil"),
  criarQuestao("Domingo Difícil","O aluno acertou duas entradas seguidas e quer aumentar muito a próxima. Qual é o ponto crítico?","Sequência positiva não autoriza quebrar gestão",["Vitória anterior garante próxima entrada","O risco diminui depois de acertos","A banca não precisa mais de controle"],"difícil"),
  criarQuestao("Domingo Difícil","O que diferencia leitura profissional de palpite?","Critério, confirmação e controle de risco",["Confiança excessiva","Aposta alta","Pressa para entrar"],"difícil")
];

const MODULOS_PREMIUM = [
  "Gestão de Banca",
  "Reflexivos",
  "Gatilhos",
  "Camaleões",
  "Eclipse 0",
  "Magnetismo",
  "Fibonacci",
  "Pitágoras",
  "Revisão Geral"
];

function completarBancoDiario() {
  const banco = [...QUESTOES_DIARIAS_BASE];
  let contador = banco.length + 1;

  while (banco.length < 100) {
    const modulo = MODULOS_PREMIUM[banco.length % MODULOS_PREMIUM.length];

    banco.push(
      criarQuestao(
        modulo,
        `Situação ${contador}: durante uma análise em ${modulo}, o aluno percebe um possível sinal, mas ainda existe dúvida entre leitura, histórico e gestão. Qual decisão é mais correta?`,
        "Esperar confirmação ou reduzir exposição, porque sinal isolado não basta",
        [
          "Entrar forte porque um sinal apareceu",
          "Ignorar a gestão para aproveitar a chance",
          "Dobrar a entrada para compensar a dúvida"
        ]
      )
    );

    contador++;
  }

  return banco;
}

function completarBancoDomingo() {
  const banco = [...QUESTOES_DOMINGO_BASE];
  let contador = banco.length + 1;

  while (banco.length < 100) {
    banco.push(
      criarQuestao(
        "Domingo Difícil",
        `Situação avançada ${contador}: o aluno identifica uma oportunidade interessante, mas emocional, banca e leitura não estão totalmente alinhados. Qual decisão mostra maior maturidade?`,
        "Não entrar ou esperar nova confirmação, pois operação boa também exige controle emocional",
        [
          "Entrar imediatamente para não perder a chance",
          "Dobrar porque a oportunidade parece forte",
          "Ignorar o emocional e seguir apenas o sinal"
        ],
        "difícil"
      )
    );

    contador++;
  }

  return banco;
}

const BANCO_DIARIO_100 = completarBancoDiario();
const BANCO_DOMINGO_100 = completarBancoDomingo();

function iniciarProvas() {
  protegerProva();
  carregarAlunoProva();
  atualizarStatusDia();
  configurarNavegacao();
  configurarMenuProvas();
  configurarBotoesProva();
  configurarMenuMobile();
  carregarHistoricoProvas();
  carregarHistoricoOnline();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarProvas);
} else {
  iniciarProvas();
}

function protegerProva() {
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  const token = localStorage.getItem("token");

  if (!usuario || !token) {
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("token");
    window.location.href = "index.html";
  }
}

function configurarNavegacao() {
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

function configurarMenuMobile() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const btnMenu = document.getElementById("btnMenu");

  function abrirMenu() {
    sidebar?.classList.add("active");
    overlay?.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function fecharMenu() {
    sidebar?.classList.remove("active");
    overlay?.classList.remove("active");
    document.body.style.overflow = "";
  }

  btnMenu?.addEventListener("click", () => {
    sidebar?.classList.contains("active") ? fecharMenu() : abrirMenu();
  });

  overlay?.addEventListener("click", fecharMenu);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharMenu();
  });
}

function carregarAlunoProva() {
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "{}");
  const nome = usuario.nome || usuario.email || "Aluno";

  const statusNome = document.getElementById("provaStatusDia");
  if (statusNome) statusNome.innerText = nome;
}

function atualizarStatusDia() {
  const hoje = new Date();
  const dia = hoje.getDay();

  const nomes = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado"
  ];

  const diaEl = document.getElementById("provaDiaSemana");
  const infoEl = document.getElementById("provaInfoAcesso");

  if (diaEl) diaEl.innerText = nomes[dia];

  if (infoEl) {
    infoEl.innerText =
      dia === 0
        ? "Hoje a Prova Semanal Difícil está liberada."
        : "Prova Aleatória diária liberada hoje.";
  }
}

function podeFazerNormal() {
  return new Date().getDay() !== 0;
}

function podeFazerSemanal() {
  return new Date().getDay() === 0;
}

function configurarMenuProvas() {
  const botoes = document.querySelectorAll(".prova-menu-btn");

  botoes.forEach((btn) => {
    btn.addEventListener("click", () => {
      const menu = btn.dataset.menuProva;

      botoes.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      document.getElementById("areaProva")?.classList.add("oculto");
      document.getElementById("resultadoProva")?.classList.add("oculto");

      if (menu === "inicio") abrirArea("menuProvaInicio");
      if (menu === "aleatoria") abrirArea("menuProvaAleatoria");
      if (menu === "semanal") abrirArea("menuProvaSemanal");

      if (menu === "historico") {
        carregarHistoricoProvas();
        abrirArea("menuProvaHistorico");
      }

      if (menu === "regras") abrirArea("menuProvaRegras");
    });
  });
}

function abrirArea(id) {
  document.querySelectorAll(".prova-menu-area").forEach((area) => {
    area.classList.remove("active");
  });

  document.getElementById(id)?.classList.add("active");
}

function configurarBotoesProva() {
  ["btnIniciarProvaNormal", "btnIniciarProvaNormal2"].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", iniciarProvaNormal);
  });

  ["btnIniciarProvaSemanal", "btnIniciarProvaSemanal2"].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", iniciarProvaSemanal);
  });

  document.getElementById("btnProximaQuestao")?.addEventListener("click", proximaQuestao);
  document.getElementById("btnAnteriorQuestao")?.addEventListener("click", questaoAnterior);
  document.getElementById("btnFinalizarProva")?.addEventListener("click", finalizarProva);
  document.getElementById("btnNovaProva")?.addEventListener("click", resetarTelaProva);
  document.getElementById("btnLimparHistoricoProvas")?.addEventListener("click", limparHistoricoProvas);
}

function embaralharArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function gerarAlternativas(questao) {
  const alternativas = embaralharArray([questao.correta, ...questao.erradas]);

  return {
    alternativas,
    correta: alternativas.indexOf(questao.correta)
  };
}

function montarQuestaoParaProva(questao, indice) {
  const gerada = gerarAlternativas(questao);

  return {
    id: `${questao.modulo}-${indice}-${Date.now()}-${Math.random()}`,
    modulo: questao.modulo,
    dificuldade: questao.dificuldade || "normal",
    pergunta: questao.pergunta,
    alternativas: gerada.alternativas,
    correta: gerada.correta
  };
}

function gerarProvaAleatoria(quantidade = 10) {
  return embaralharArray(BANCO_DIARIO_100)
    .slice(0, quantidade)
    .map((questao, index) => montarQuestaoParaProva(questao, index));
}

function gerarProvaSemanal(quantidade = 20) {
  return embaralharArray(BANCO_DOMINGO_100)
    .slice(0, quantidade)
    .map((questao, index) => montarQuestaoParaProva(questao, index));
}

function iniciarProvaNormal() {
  if (!podeFazerNormal()) {
    alert("A Prova Aleatória abre apenas de segunda a sábado. Domingo é dia da Prova Semanal Difícil.");
    return;
  }

  tipoProvaRodando = "Prova Aleatória Diária";

  const numeroProva = Math.floor(Math.random() * 40) + 1;
  provaAtual = gerarProvaAleatoria(10);

  iniciarTelaProva(
    `Prova Aleatória #${numeroProva}`,
    "10 questões estratégicas do banco diário"
  );
}

function iniciarProvaSemanal() {
  if (!podeFazerSemanal()) {
    alert("A Prova Semanal Difícil só abre no domingo.");
    return;
  }

  tipoProvaRodando = "Prova Semanal Difícil";
  provaAtual = gerarProvaSemanal(20);

  iniciarTelaProva(
    "Prova Semanal Difícil",
    "20 questões avançadas de raciocínio"
  );
}

function iniciarTelaProva(titulo, tipo) {
  respostasUsuario = new Array(provaAtual.length).fill(null);
  questaoAtual = 0;
  segundosProva = 0;

  document.querySelectorAll(".prova-menu-area").forEach((area) => {
    area.classList.remove("active");
  });

  document.getElementById("resultadoProva")?.classList.add("oculto");
  document.getElementById("areaProva")?.classList.remove("oculto");

  setText("tituloProvaAtual", titulo);
  setText("tipoProvaAtual", tipo);

  iniciarTimer();
  renderizarQuestao();

  setTimeout(() => {
    document.getElementById("areaProva")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 100);
}

function iniciarTimer() {
  clearInterval(timerInterval);
  atualizarTimer();

  timerInterval = setInterval(() => {
    segundosProva++;
    atualizarTimer();
  }, 1000);
}

function atualizarTimer() {
  setText("tempoProva", formatarTempo(segundosProva));
}

function formatarTempo(segundos) {
  const min = String(Math.floor(segundos / 60)).padStart(2, "0");
  const seg = String(segundos % 60).padStart(2, "0");
  return `${min}:${seg}`;
}

function renderizarQuestao() {
  const questao = provaAtual[questaoAtual];
  if (!questao) return;

  setText(
    "contadorQuestao",
    `Questão ${questaoAtual + 1} de ${provaAtual.length} • ${questao.modulo}`
  );

  setText("textoQuestao", questao.pergunta);

  const alternativasBox = document.getElementById("alternativasProva");

  if (alternativasBox) {
    alternativasBox.innerHTML = "";

    questao.alternativas.forEach((alt, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerText = alt;

      if (respostasUsuario[questaoAtual] === index) {
        btn.classList.add("alternativa-selecionada");
      }

      btn.addEventListener("click", () => {
        respostasUsuario[questaoAtual] = index;
        renderizarQuestao();
      });

      alternativasBox.appendChild(btn);
    });
  }

  const barra = document.getElementById("barraProgressoProva");

  if (barra) {
    barra.style.width = `${((questaoAtual + 1) / provaAtual.length) * 100}%`;
  }

  controlarBotoes();
}

function controlarBotoes() {
  const btnAnterior = document.getElementById("btnAnteriorQuestao");
  const btnProxima = document.getElementById("btnProximaQuestao");
  const btnFinalizar = document.getElementById("btnFinalizarProva");

  if (btnAnterior) {
    btnAnterior.style.display = questaoAtual === 0 ? "none" : "inline-block";
  }

  if (questaoAtual === provaAtual.length - 1) {
    btnProxima?.classList.add("oculto");
    btnFinalizar?.classList.remove("oculto");
  } else {
    btnProxima?.classList.remove("oculto");
    btnFinalizar?.classList.add("oculto");
  }
}

function proximaQuestao() {
  if (respostasUsuario[questaoAtual] === null) {
    alert("Selecione uma alternativa antes de continuar.");
    return;
  }

  if (questaoAtual < provaAtual.length - 1) {
    questaoAtual++;
    renderizarQuestao();
  }
}

function questaoAnterior() {
  if (questaoAtual > 0) {
    questaoAtual--;
    renderizarQuestao();
  }
}

function finalizarProva() {
  if (respostasUsuario.includes(null)) {
    alert("Responda todas as questões antes de finalizar.");
    return;
  }

  clearInterval(timerInterval);

  let acertos = 0;

  provaAtual.forEach((questao, index) => {
    if (respostasUsuario[index] === questao.correta) acertos++;
  });

  const erros = provaAtual.length - acertos;
  const nota = Math.round((acertos / provaAtual.length) * 100);

  mostrarResultado(acertos, erros, nota);
  salvarHistoricoProva(acertos, erros, nota);
  salvarResultadoOnline(acertos, erros, nota);
}

function mostrarResultado(acertos, erros, nota) {
  document.getElementById("areaProva")?.classList.add("oculto");
  document.getElementById("resultadoProva")?.classList.remove("oculto");

  setText("notaFinalProva", `${nota}%`);
  setText("totalAcertosProva", acertos);
  setText("totalErrosProva", erros);
  setText("tempoFinalProva", formatarTempo(segundosProva));

  const msgEl = document.getElementById("mensagemResultadoProva");

  if (msgEl) {
    if (nota >= 90) msgEl.innerText = "Excelente! Você domina bem os módulos.";
    else if (nota >= 70) msgEl.innerText = "Muito bom! Continue revisando gestão e leitura.";
    else if (nota >= 50) msgEl.innerText = "Resultado médio. Revise os módulos antes de avançar.";
    else msgEl.innerText = "Atenção: volte aos estudos e revise tomada de decisão.";
  }

  setTimeout(() => {
    document.getElementById("resultadoProva")?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }, 100);
}

async function salvarResultadoOnline(acertos, erros, nota) {
  try {
    const token = localStorage.getItem("token");
    if (!token) return;

    const usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "{}");

    await fetch(`${API_URL}/provas/resultado`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        aluno: usuario.nome || usuario.email || "Aluno",
        email: usuario.email || "",
        tipoProva: tipoProvaRodando,
        titulo: tipoProvaRodando,
        nota,
        acertos,
        erros,
        totalQuestoes: provaAtual.length,
        percentual: nota,
        tempo: formatarTempo(segundosProva),
        data: new Date().toISOString()
      })
    });
  } catch (error) {
    console.error("Erro ao salvar prova online:", error);
  }
}

async function carregarHistoricoOnline() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return;

    const resposta = await fetch(`${API_URL}/minhas-provas`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!resposta.ok) return;

    const dados = await resposta.json();
    if (!dados.resultados) return;

    const historicoFormatado = dados.resultados.map((item) => ({
      tipo: item.tipoProva || item.titulo || "Prova",
      acertos: item.acertos || 0,
      erros: item.erros || 0,
      nota: item.percentual || item.nota || 0,
      tempo: item.tempo || "00:00",
      data: item.criadoEm
        ? new Date(item.criadoEm).toLocaleString("pt-BR")
        : item.data || "Sem data"
    }));

    localStorage.setItem("historicoProvas", JSON.stringify(historicoFormatado));
    carregarHistoricoProvas();
  } catch (error) {
    console.error("Erro histórico online:", error);
  }
}

function salvarHistoricoProva(acertos, erros, nota) {
  const historico = JSON.parse(localStorage.getItem("historicoProvas") || "[]");

  const registro = {
    tipo: tipoProvaRodando,
    acertos,
    erros,
    nota,
    tempo: formatarTempo(segundosProva),
    data: new Date().toLocaleString("pt-BR")
  };

  historico.unshift(registro);

  localStorage.setItem("historicoProvas", JSON.stringify(historico.slice(0, 20)));
  registrarAtividadeProva(registro);
  salvarContadorProvas(registro);
  carregarHistoricoProvas();
}

function salvarContadorProvas(registro) {
  const provasFeitas = JSON.parse(localStorage.getItem("provasFeitas") || "[]");
  provasFeitas.unshift(registro);
  localStorage.setItem("provasFeitas", JSON.stringify(provasFeitas.slice(0, 50)));
}

function registrarAtividadeProva(registro) {
  const atividades = JSON.parse(localStorage.getItem("atividadesRecentes") || "[]");

  atividades.unshift({
    icone: "📝",
    titulo: registro.tipo,
    descricao: `Nota ${registro.nota}% • ${registro.acertos} acertos • ${registro.tempo}`,
    data: new Date().toISOString()
  });

  localStorage.setItem("atividadesRecentes", JSON.stringify(atividades.slice(0, 20)));
}

function carregarHistoricoProvas() {
  const lista = document.getElementById("listaHistoricoProvas");
  if (!lista) return;

  const historico = JSON.parse(localStorage.getItem("historicoProvas") || "[]");

  if (!historico.length) {
    lista.innerHTML = `<p class="vazio">Nenhuma prova realizada ainda.</p>`;
    return;
  }

  lista.innerHTML = historico.map((item) => `
    <div class="item-historico-prova">
      <div>
        <strong>${escapeHTML(item.tipo || "Prova")}</strong>
        <small>${escapeHTML(item.data || "Sem data")}</small>
      </div>

      <div>
        <span>${Number(item.nota || 0)}%</span>
        <small>
          ${Number(item.acertos || 0)} acertos •
          ${Number(item.erros || 0)} erros •
          ${escapeHTML(item.tempo || "00:00")}
        </small>
      </div>
    </div>
  `).join("");
}

function limparHistoricoProvas() {
  if (!confirm("Deseja limpar todo o histórico de provas?")) return;

  localStorage.removeItem("historicoProvas");
  carregarHistoricoProvas();
}

function resetarTelaProva() {
  document.getElementById("resultadoProva")?.classList.add("oculto");
  document.getElementById("areaProva")?.classList.add("oculto");

  abrirArea("menuProvaInicio");

  provaAtual = [];
  respostasUsuario = [];
  questaoAtual = 0;
  segundosProva = 0;

  clearInterval(timerInterval);
  setText("tempoProva", "00:00");
}

function setText(id, valor) {
  const el = document.getElementById(id);
  if (el) el.innerText = valor;
}

function escapeHTML(texto) {
  return String(texto || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}