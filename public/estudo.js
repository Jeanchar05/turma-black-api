/* ======================================================
   ARQUIVOS.JS / ESTUDO.JS • TURMA BLACK
   TEXTOS + VÍDEO AULAS POR MÓDULO
====================================================== */

(() => {
  let categoriaAtual = "todos";
  let abaAtual = "textos";
  let arquivoSelecionado = null;

  const arquivosConteudo = [
    {
      id: "roleta",
      titulo: "Roleta",
      categoria: "basico",
      tempo: "12 min",
      icone: "🎰",
      videoUrl: "",
      resumo: "Aprenda como funciona a leitura da roleta, comportamento dos números e mentalidade correta antes de qualquer entrada.",
      texto: `
        <div class="leitor-badge">🎰 Básico • 12 min de leitura</div>
        <h2>Roleta</h2>

        <p>A maioria das pessoas entra na roleta pensando apenas em ganhar. O aluno estratégico entra pensando primeiro em entender.</p>

        <p>A roleta não é apenas números girando. Ela envolve comportamento, repetição, ausência, leitura visual, controle emocional e tomada de decisão.</p>

        <div class="leitor-destaque">
          🎯 O objetivo da Turma Black não é ensinar aposta sem direção. É ensinar leitura, controle e inteligência operacional.
        </div>

        <h3>📌 Como funciona</h3>
        <p>A roleta possui números de 0 até 36. Cada giro é independente, mas durante sequências podem surgir comportamentos importantes.</p>

        <ul>
          <li>Regiões repetindo</li>
          <li>Números puxando outros</li>
          <li>Setores aquecidos</li>
          <li>Terminais aparecendo</li>
          <li>Chamadas estratégicas</li>
        </ul>

        <h3>🧠 Quando usar a leitura</h3>
        <p>Use a leitura quando houver contexto: histórico recente, região clara, padrão visual ou confirmação por mais de uma ferramenta.</p>

        <h3>⚠️ Quando NÃO usar</h3>
        <ul>
          <li>Quando estiver tentando recuperar perda</li>
          <li>Quando estiver com pressa</li>
          <li>Quando não houver padrão claro</li>
          <li>Quando a entrada for apenas por emoção</li>
        </ul>

        <h3>🏆 Resumo final</h3>
        <p>A roleta recompensa disciplina, paciência e leitura. Nem toda rodada merece entrada.</p>
      `
    },

    {
      id: "race",
      titulo: "RaceTrack",
      categoria: "basico",
      tempo: "11 min",
      icone: "🏁",
      videoUrl: "",
      resumo: "Aprenda como a race transforma números em leitura visual estratégica.",
      texto: `
        <div class="leitor-badge">🏁 Básico • 11 min de leitura</div>
        <h2>RaceTrack</h2>

        <p>A RaceTrack é uma das ferramentas mais importantes da plataforma. Enquanto muitos enxergam apenas números, o aluno da Turma Black aprende a enxergar regiões.</p>

        <div class="leitor-destaque">
          🏁 A race transforma números soltos em leitura visual.
        </div>

        <h3>📌 O que observar</h3>
        <ul>
          <li>Regiões aquecidas</li>
          <li>Concentração de resultados</li>
          <li>Sequências visuais</li>
          <li>Setores esquecidos</li>
          <li>Números conectados</li>
        </ul>

        <h3>🧠 Como usar corretamente</h3>
        <p>Não marque a race inteira. Marque apenas aquilo que faz sentido dentro do histórico e da estratégia.</p>

        <div class="leitor-destaque">
          🎯 Clareza visual vale mais que excesso de marcação.
        </div>

        <h3>⚠️ Erros comuns</h3>
        <ul>
          <li>Marcar números demais</li>
          <li>Entrar sem confirmação</li>
          <li>Ignorar a gestão</li>
          <li>Operar só porque viu uma região bonita</li>
        </ul>

        <h3>🏆 Resumo final</h3>
        <p>A race não prevê resultado. Ela ajuda o aluno a organizar a leitura e tomar decisões com mais clareza.</p>
      `
    },

    {
      id: "banca",
      titulo: "Gestão de Banca",
      categoria: "basico",
      tempo: "14 min",
      icone: "💰",
      videoUrl: "",
      resumo: "Controle de banca, metas, stop win, stop loss e proteção contra decisões emocionais.",
      texto: `
        <div class="leitor-badge">💰 Básico • 14 min de leitura</div>
        <h2>Gestão de Banca</h2>

        <p>A gestão de banca é o coração da operação. Sem controle, até uma boa leitura pode virar prejuízo.</p>

        <div class="leitor-destaque">
          🔒 Gestão protege você de você mesmo.
        </div>

        <h3>📌 O que controlar</h3>
        <ul>
          <li>Valor da banca inicial</li>
          <li>Valor de entrada</li>
          <li>Meta diária</li>
          <li>Stop win</li>
          <li>Stop loss</li>
          <li>Quantidade máxima de operações</li>
        </ul>

        <h3>📌 Stop Win</h3>
        <p>Stop win é o limite de ganho. Bateu a meta, protege o lucro e encerra ou reduz a exposição.</p>

        <h3>📌 Stop Loss</h3>
        <p>Stop loss é o limite de perda. Ele existe para impedir que uma sequência ruim destrua sua banca.</p>

        <h3>⚠️ Erros comuns</h3>
        <ul>
          <li>Dobrar a entrada depois de perder</li>
          <li>Tentar recuperar loss no emocional</li>
          <li>Operar sem meta</li>
          <li>Aumentar a mão sem regra</li>
        </ul>

        <h3>🏆 Resumo final</h3>
        <p>Quem não controla banca, cedo ou tarde quebra. Sobreviver é mais importante que acelerar.</p>
      `
    },

    {
      id: "alertas",
      titulo: "Alertas",
      categoria: "intermediario",
      tempo: "11 min",
      icone: "🚨",
      videoUrl: "",
      resumo: "Aprenda a interpretar chamadas e sinais estratégicos da plataforma.",
      texto: `
        <div class="leitor-badge">🚨 Intermediário • 11 min de leitura</div>
        <h2>Alertas</h2>

        <p>Alertas são relações observadas entre números. Eles ajudam o aluno a identificar possíveis regiões, conexões e comportamentos estratégicos.</p>

        <div class="leitor-destaque">
          🚨 Alerta não é certeza. É atenção.
        </div>

        <h3>📌 Como funcionam</h3>
        <p>Exemplo: um número pode chamar atenção para outros relacionados. Isso indica uma relação estratégica observada dentro da leitura.</p>

        <h3>🧠 Quando usar</h3>
        <ul>
          <li>Quando o histórico confirma a chamada</li>
          <li>Quando a race mostra região parecida</li>
          <li>Quando há repetição de comportamento</li>
          <li>Quando a banca permite entrada controlada</li>
        </ul>

        <h3>⚠️ Quando NÃO usar</h3>
        <ul>
          <li>Quando for só um número isolado</li>
          <li>Quando estiver tentando recuperar perda</li>
          <li>Quando não houver confirmação</li>
        </ul>

        <h3>🏆 Resumo final</h3>
        <p>Alertas servem para organizar leitura. Quem usa alerta sem contexto vira refém da emoção.</p>
      `
    },

    {
      id: "vizinhos",
      titulo: "Números que se Puxam",
      categoria: "intermediario",
      tempo: "10 min",
      icone: "👥",
      videoUrl: "",
      resumo: "Entenda números relacionados e possíveis puxadas dentro da leitura estratégica.",
      texto: `
        <div class="leitor-badge">👥 Intermediário • 10 min de leitura</div>
        <h2>Números que se Puxam</h2>

        <p>Alguns números podem apresentar relação dentro da leitura da plataforma. A ideia é observar quais números aparecem conectados, próximos ou com comportamento parecido.</p>

        <div class="leitor-destaque">
          🎯 Números que se puxam ajudam a montar leitura, não a prometer resultado.
        </div>

        <h3>📌 Como funciona</h3>
        <p>Quando um número aparece, ele pode indicar atenção em outros números relacionados. Isso ajuda a criar uma cobertura mais inteligente.</p>

        <h3>🧠 Quando usar</h3>
        <ul>
          <li>Quando a relação aparece mais de uma vez</li>
          <li>Quando combina com a race</li>
          <li>Quando existe histórico recente favorável</li>
          <li>Quando a gestão permite uma entrada segura</li>
        </ul>

        <h3>⚠️ Erros comuns</h3>
        <ul>
          <li>Apostar em todos os relacionados sem critério</li>
          <li>Ignorar o saldo da banca</li>
          <li>Forçar entrada sem confirmação</li>
        </ul>

        <h3>🏆 Resumo final</h3>
        <p>O objetivo é sair da aposta aleatória e começar a enxergar conexões.</p>
      `
    },

    {
      id: "espelhos",
      titulo: "Espelhos",
      categoria: "intermediario",
      tempo: "9 min",
      icone: "🪞",
      videoUrl: "",
      resumo: "Estude relações espelhadas e conexões entre números dentro da roleta.",
      texto: `
        <div class="leitor-badge">🪞 Intermediário • 9 min de leitura</div>
        <h2>Espelhos</h2>

        <p>Espelhos são conexões entre números que podem ajudar na leitura de puxadas, regiões e repetições.</p>

        <div class="leitor-destaque">
          🪞 Espelho bom é aquele confirmado por contexto.
        </div>

        <h3>📌 Como usar</h3>
        <p>Use espelhos para ampliar a análise, principalmente quando eles combinam com alertas, vizinhos ou regiões da race.</p>

        <h3>🧠 Quando faz sentido</h3>
        <ul>
          <li>Quando o espelho aparece dentro de uma região ativa</li>
          <li>Quando combina com repetição recente</li>
          <li>Quando ajuda a proteger uma leitura já existente</li>
        </ul>

        <h3>⚠️ Quando evitar</h3>
        <ul>
          <li>Quando o espelho está isolado</li>
          <li>Quando aumenta demais a quantidade de números</li>
          <li>Quando a banca não suporta cobertura maior</li>
        </ul>

        <h3>🏆 Resumo final</h3>
        <p>Espelho é complemento. Ele não deve ser a base única da decisão.</p>
      `
    },

    {
      id: "triangulacao",
      titulo: "Triangulação",
      categoria: "avancado",
      tempo: "13 min",
      icone: "🔺",
      videoUrl: "",
      resumo: "Use 2 ou 3 números para visualizar ligações e possíveis regiões estratégicas.",
      texto: `
        <div class="leitor-badge">🔺 Avançado • 13 min de leitura</div>
        <h2>Triangulação</h2>

        <p>A triangulação usa dois ou três números para formar uma leitura visual na race. Ela ajuda a enxergar ligações entre pontos da roleta.</p>

        <div class="leitor-destaque">
          🔺 Triangulação é leitura visual, não garantia de acerto.
        </div>

        <h3>📌 Como funciona</h3>
        <p>Você escolhe números relevantes e observa a conexão entre eles. Se a ligação forma uma região coerente, pode existir uma área de atenção.</p>

        <h3>🧠 Quando usar</h3>
        <ul>
          <li>Quando há 2 ou 3 números fortes no histórico</li>
          <li>Quando os pontos formam uma região clara</li>
          <li>Quando combina com alertas ou vizinhos</li>
        </ul>

        <h3>⚠️ Erros comuns</h3>
        <ul>
          <li>Marcar números sem critério</li>
          <li>Usar triangulação com muitos números</li>
          <li>Ignorar gestão</li>
          <li>Entrar só porque o desenho ficou bonito</li>
        </ul>

        <h3>🏆 Resumo final</h3>
        <p>A triangulação é poderosa quando usada com clareza, contexto e controle.</p>
      `
    },

    {
      id: "zero",
      titulo: "Setor do Zero",
      categoria: "intermediario",
      tempo: "10 min",
      icone: "🟢",
      videoUrl: "",
      resumo: "Aprenda a leitura do setor do zero, terminais e possíveis chamadas.",
      texto: `
        <div class="leitor-badge">🟢 Intermediário • 10 min de leitura</div>
        <h2>Setor do Zero</h2>

        <p>O setor do zero tem grande importância em muitas leituras de roleta. Ele pode se conectar com terminais, vizinhos e regiões específicas.</p>

        <div class="leitor-destaque">
          🟢 O zero chama atenção, mas precisa de confirmação.
        </div>

        <h3>📌 O que observar</h3>
        <ul>
          <li>Presença do 0</li>
          <li>Terminais ligados ao zero</li>
          <li>Números próximos na race</li>
          <li>Repetição de região</li>
        </ul>

        <h3>🧠 Quando usar</h3>
        <p>Use quando o histórico mostrar aproximação do setor ou quando outros módulos confirmarem a leitura.</p>

        <h3>⚠️ Cuidado</h3>
        <p>Não transforme o zero em superstição. Ele é apenas uma região de análise.</p>

        <h3>🏆 Resumo final</h3>
        <p>O setor do zero pode ser forte, mas só deve ser usado com contexto e gestão.</p>
      `
    },

    {
      id: "terminais",
      titulo: "Terminais",
      categoria: "intermediario",
      tempo: "10 min",
      icone: "🔢",
      videoUrl: "",
      resumo: "Entenda finais de números, repetição de terminais e leitura por agrupamento.",
      texto: `
        <div class="leitor-badge">🔢 Intermediário • 10 min de leitura</div>
        <h2>Terminais</h2>

        <p>Terminais são grupos de números com o mesmo final. Exemplo: terminal 0 pode envolver 0, 10, 20 e 30.</p>

        <div class="leitor-destaque">
          🔢 Terminal é padrão de apoio, não entrada cega.
        </div>

        <h3>📌 Como observar</h3>
        <ul>
          <li>Finais repetindo</li>
          <li>Terminais ausentes</li>
          <li>Concentração de finais parecidos</li>
          <li>Combinação com race e alertas</li>
        </ul>

        <h3>🧠 Quando usar</h3>
        <p>Quando finais parecidos começam a aparecer no histórico, os terminais podem ajudar na organização da leitura.</p>

        <h3>⚠️ Erros comuns</h3>
        <ul>
          <li>Apostar em terminal inteiro sem motivo</li>
          <li>Ignorar o histórico</li>
          <li>Aumentar cobertura sem gestão</li>
        </ul>

        <h3>🏆 Resumo final</h3>
        <p>Terminais ajudam a enxergar padrões por final, mas precisam de confirmação.</p>
      `
    },

    {
      id: "ia",
      titulo: "IA da Roleta",
      categoria: "avancado",
      tempo: "13 min",
      icone: "🤖",
      videoUrl: "",
      resumo: "Entenda como a IA deve apoiar decisões sem prometer resultado garantido.",
      texto: `
        <div class="leitor-badge">🤖 Avançado • 13 min de leitura</div>
        <h2>IA da Roleta</h2>

        <p>A IA da plataforma serve para apoiar a análise. Ela organiza padrões, sugere atenção e ajuda na leitura.</p>

        <div class="leitor-destaque">
          🤖 IA boa não substitui disciplina.
        </div>

        <h3>📌 O que a IA pode ajudar</h3>
        <ul>
          <li>Organizar histórico</li>
          <li>Identificar possíveis regiões</li>
          <li>Combinar alertas e terminais</li>
          <li>Sugerir atenção estratégica</li>
        </ul>

        <h3>⚠️ O que a IA NÃO faz</h3>
        <ul>
          <li>Não garante vitória</li>
          <li>Não elimina risco</li>
          <li>Não substitui gestão</li>
          <li>Não deve ser seguida cegamente</li>
        </ul>

        <h3>🏆 Como usar profissionalmente</h3>
        <p>Use a IA como uma segunda leitura. Compare com race, banca, alertas e sua própria análise.</p>

        <h3>📖 Resumo final</h3>
        <p>A IA é ferramenta. Quem decide é o aluno com disciplina.</p>
      `
    },

    {
      id: "mentalidade",
      titulo: "Controle Emocional",
      categoria: "mentalidade",
      tempo: "12 min",
      icone: "🔥",
      videoUrl: "",
      resumo: "Disciplina, paciência e controle emocional para evitar decisões ruins.",
      texto: `
        <div class="leitor-badge">🔥 Mentalidade • 12 min de leitura</div>
        <h2>Controle Emocional</h2>

        <p>O maior erro do aluno não está na estratégia, mas na falta de controle. Uma estratégia boa nas mãos de alguém emocional vira prejuízo.</p>

        <div class="leitor-destaque">
          🔥 Disciplina vale mais que qualquer padrão.
        </div>

        <h3>📌 O que destrói uma banca</h3>
        <ul>
          <li>Raiva depois de perder</li>
          <li>Ganância depois de ganhar</li>
          <li>Pressa para recuperar</li>
          <li>Falta de stop</li>
          <li>Entradas fora do plano</li>
        </ul>

        <h3>🧠 Mentalidade profissional</h3>
        <p>O aluno profissional aceita perder uma entrada. O que ele não aceita é perder o controle.</p>

        <h3>⚠️ Regras importantes</h3>
        <ul>
          <li>Defina meta antes de começar</li>
          <li>Respeite stop loss</li>
          <li>Proteja lucro</li>
          <li>Pare quando estiver emocional</li>
        </ul>

        <h3>🏆 Resumo final</h3>
        <p>Controle emocional é o que mantém o aluno vivo no longo prazo.</p>
      `
    }
  ];

  function iniciarArquivos() {
    protegerArquivos();
    configurarNavegacao();
    configurarMenuMobile();
    configurarTabs();
    configurarFiltros();
    configurarBusca();
    renderizarArquivos();
    atualizarProgresso();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarArquivos);
  } else {
    iniciarArquivos();
  }

  function protegerArquivos() {
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

    $("btnSair")?.addEventListener("click", () => {
      localStorage.removeItem("usuarioLogado");
      localStorage.removeItem("token");
      window.location.href = "index.html";
    });
  }

  function configurarMenuMobile() {
    const sidebar = $("sidebar");
    const overlay = $("sidebarOverlay");
    const btnMenu = $("btnMenu");

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

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") fecharMenu();
    });
  }

  function configurarTabs() {
    document.querySelectorAll(".arquivo-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".arquivo-tab").forEach((b) => {
          b.classList.remove("active");
        });

        btn.classList.add("active");
        abaAtual = btn.dataset.tab || "textos";

        renderizarArquivos();
        limparLeitor();
      });
    });
  }

  function configurarFiltros() {
    document.querySelectorAll(".arquivo-filtro").forEach((botao) => {
      botao.addEventListener("click", () => {
        document.querySelectorAll(".arquivo-filtro").forEach((b) => {
          b.classList.remove("active");
        });

        botao.classList.add("active");
        categoriaAtual = botao.dataset.categoria || "todos";

        renderizarArquivos();
      });
    });
  }

  function configurarBusca() {
    $("buscarArquivo")?.addEventListener("input", renderizarArquivos);
  }

  function renderizarArquivos() {
    const lista = $("listaArquivos");
    const buscaInput = $("buscarArquivo");

    if (!lista) return;

    const busca = buscaInput ? buscaInput.value.toLowerCase().trim() : "";

    const filtrados = arquivosConteudo.filter((arquivo) => {
      const passaCategoria =
        categoriaAtual === "todos" || arquivo.categoria === categoriaAtual;

      const textoBusca = `
        ${arquivo.titulo}
        ${arquivo.categoria}
        ${arquivo.resumo}
        ${arquivo.texto}
      `.toLowerCase();

      return passaCategoria && textoBusca.includes(busca);
    });

    if (!filtrados.length) {
      lista.innerHTML = `
        <div class="arquivos-empty">
          <span>📭</span>
          <p>Nenhum conteúdo encontrado.</p>
        </div>
      `;
      return;
    }

    lista.innerHTML = filtrados
      .map((arquivo) => {
        const index = arquivosConteudo.findIndex((item) => item.id === arquivo.id);
        const concluido = verificarConcluido(index);

        return `
          <article class="arquivo-card ${concluido ? "concluido" : ""}">
            <div class="arquivo-icon">${arquivo.icone}</div>

            <div class="arquivo-info">
              <h3>${escapeHTML(arquivo.titulo)}</h3>
              <p>${escapeHTML(arquivo.resumo)}</p>

              <span>
                ${formatarCategoria(arquivo.categoria)} • ${escapeHTML(arquivo.tempo)}
              </span>

              ${concluido ? `<small class="arquivo-check">✅ Concluído</small>` : ""}

              <div class="arquivo-acoes">
                <button type="button" data-abrir-arquivo="${index}">
                  ${abaAtual === "textos" ? "📖 Ler texto" : "🎬 Ver aula"}
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    document.querySelectorAll("[data-abrir-arquivo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        abrirConteudo(Number(btn.dataset.abrirArquivo));
      });
    });
  }

  function abrirConteudo(index) {
    if (abaAtual === "videos") abrirVideo(index);
    else abrirTexto(index);
  }

  function abrirTexto(index) {
    const leitor = $("arquivoLeitor");
    if (!leitor || !arquivosConteudo[index]) return;

    arquivoSelecionado = index;
    const concluido = verificarConcluido(index);

    leitor.innerHTML = `
      ${arquivosConteudo[index].texto}

      <button class="btn-concluir-arquivo" type="button" data-concluir-arquivo="${index}">
        ${concluido ? "✅ Arquivo concluído" : "✅ Marcar como concluído"}
      </button>
    `;

    ligarBotaoConcluir();
    registrarAtividadeArquivo(arquivosConteudo[index], "Texto aberto");
  }

  function abrirVideo(index) {
    const leitor = $("arquivoLeitor");
    if (!leitor || !arquivosConteudo[index]) return;

    arquivoSelecionado = index;
    const arquivo = arquivosConteudo[index];

    leitor.innerHTML = `
      <div class="leitor-badge">🎬 Vídeo Aula • ${escapeHTML(arquivo.titulo)}</div>

      <h2>${escapeHTML(arquivo.icone)} ${escapeHTML(arquivo.titulo)}</h2>

      <div class="video-aula-box">
        ${
          arquivo.videoUrl
            ? `<iframe src="${escapeHTML(arquivo.videoUrl)}" allowfullscreen></iframe>`
            : `
              <div class="video-placeholder">
                <span>🎥</span>
                <strong>Vídeo aula em preparação</strong>
                <p>Adicione o link do vídeo em <code>videoUrl</code> no arquivos.js.</p>
              </div>
            `
        }
      </div>

      <p>${escapeHTML(arquivo.resumo)}</p>

      <button class="btn-concluir-arquivo" type="button" data-concluir-arquivo="${index}">
        ${verificarConcluido(index) ? "✅ Aula concluída" : "✅ Marcar aula como concluída"}
      </button>
    `;

    ligarBotaoConcluir();
    registrarAtividadeArquivo(arquivo, "Vídeo aberto");
  }

  function ligarBotaoConcluir() {
    document.querySelectorAll("[data-concluir-arquivo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        marcarConcluido(Number(btn.dataset.concluirArquivo));
      });
    });
  }

  function marcarConcluido(index) {
    let concluidos = JSON.parse(
      localStorage.getItem("arquivosConcluidos") || "[]"
    );

    if (!concluidos.includes(index)) {
      concluidos.push(index);
      localStorage.setItem("arquivosConcluidos", JSON.stringify(concluidos));
    }

    atualizarProgresso();
    renderizarArquivos();

    if (abaAtual === "videos") abrirVideo(index);
    else abrirTexto(index);

    registrarAtividadeArquivo(arquivosConteudo[index], "Conteúdo concluído");
  }

  function verificarConcluido(index) {
    const concluidos = JSON.parse(
      localStorage.getItem("arquivosConcluidos") || "[]"
    );

    return concluidos.includes(index);
  }

  function atualizarProgresso() {
    const progresso = $("progressoArquivos");
    const concluidos = JSON.parse(
      localStorage.getItem("arquivosConcluidos") || "[]"
    );

    const total = arquivosConteudo.length;
    const porcentagem =
      total === 0 ? 0 : Math.round((concluidos.length / total) * 100);

    if (progresso) {
      progresso.innerText = `${porcentagem}%`;
    }
  }

  function limparLeitor() {
    const leitor = $("arquivoLeitor");
    if (!leitor) return;

    leitor.innerHTML = `
      <div class="leitor-badge">📂 Arquivo selecionado</div>

      <h2>${abaAtual === "videos" ? "Central de Vídeo Aulas" : "Biblioteca de Textos"}</h2>

      <p>
        Escolha um conteúdo ao lado para começar.
      </p>

      <div class="leitor-destaque">
        💡 O conteúdo será exibido aqui.
      </div>
    `;
  }

  function registrarAtividadeArquivo(arquivo, acao) {
    if (!arquivo) return;

    const atividades = JSON.parse(
      localStorage.getItem("atividadesRecentes") || "[]"
    );

    atividades.unshift({
      icone: arquivo.icone || "📚",
      titulo: acao,
      descricao: arquivo.titulo,
      data: new Date().toISOString()
    });

    localStorage.setItem(
      "atividadesRecentes",
      JSON.stringify(atividades.slice(0, 20))
    );
  }

  function formatarCategoria(categoria) {
    const nomes = {
      basico: "Básico",
      intermediario: "Intermediário",
      avancado: "Avançado",
      mentalidade: "Mentalidade"
    };

    return nomes[categoria] || categoria;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHTML(texto) {
    return String(texto || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();