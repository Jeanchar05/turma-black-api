// ======================================
// DASHBOARD.JS • TURMA BLACK PREMIUM
// NOVA VERSÃO REFORMULADA
// ======================================

const API_URL = "https://turma-black-api-es3u.onrender.com";

document.addEventListener("DOMContentLoaded", async () => {

  const $ = (id) => document.getElementById(id);

  let usuario = null;

  const token = sessionStorage.getItem("token");

  function limparSessao() {
    ["token", "adminToken", "authToken", "accessToken", "jwt", "usuarioLogado"]
      .forEach((key) => sessionStorage.removeItem(key));
  }

  try {
    usuario = JSON.parse(
      sessionStorage.getItem("usuarioLogado") || "null"
    );
  } catch {
    usuario = null;
  }

  // ======================================
  // PROTEÇÃO
  // ======================================

  if (!token) {
    limparSessao();
    window.location.href = "index.html";
    return;
  }

  // ======================================
  // MODULOS PREMIUM
  // ======================================

  const MODULOS = [

    {
      id: "reflexivos",
      nome: "Reflexivos",
      icone: "🧠",
      page: "modules/reflexivos.html",
      desc: "Reflexos e leitura estratégica."
    },

    {
      id: "gatilhos",
      nome: "Gatilhos",
      icone: "🚨",
      page: "modules/gatilhos.html",
      desc: "Chamadas e sinais inteligentes."
    },

    {
      id: "camaleoes",
      nome: "Camaleões",
      icone: "🦎",
      page: "modules/camaleoes.html",
      desc: "Adaptação e leitura dinâmica."
    },

    {
      id: "eclipse0",
      nome: "Eclipse 0",
      icone: "🌑",
      page: "modules/eclipse0.html",
      desc: "Operações premium ocultas."
    },

    {
      id: "magnetismo",
      nome: "Magnetismo",
      icone: "🧲",
      page: "modules/magnetismo.html",
      desc: "Atração de padrões estratégicos."
    },

    {
      id: "fibonacci",
      nome: "Fibonacci",
      icone: "🌀",
      page: "modules/fibonacci.html",
      desc: "Sequências numéricas avançadas."
    },

    {
      id: "pitagoras",
      nome: "Pitágoras",
      icone: "📐",
      page: "modules/pitagoras.html",
      desc: "Conexões matemáticas estratégicas."
    }

  ];

  // ======================================
  // USUÁRIO
  // ======================================

  if ($("nomeAluno")) {
    $("nomeAluno").textContent =
      usuario.nome ||
      usuario.email ||
      "Aluno";
  }

  // ======================================
  // NAVEGAÇÃO
  // ======================================

  document.querySelectorAll("[data-page]").forEach((btn) => {

    btn.addEventListener("click", () => {

      const page = btn.dataset.page;

      if (page) {
        window.location.href = page;
      }
    });
  });

  // ======================================
  // MENU MOBILE
  // ======================================

  const sidebar = $("sidebar");
  const btnMenu = $("btnMenu");
  const overlay = $("sidebarOverlay");

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

    sidebar?.classList.contains("active")
      ? fecharMenu()
      : abrirMenu();
  });

  overlay?.addEventListener("click", fecharMenu);

  document.addEventListener("keydown", (e) => {

    if (e.key === "Escape") {
      fecharMenu();
    }
  });

  document.querySelectorAll(".menu-item").forEach((item) => {

    item.addEventListener("click", () => {

      if (window.innerWidth <= 900) {
        fecharMenu();
      }
    });
  });

  // ======================================
  // SAIR
  // ======================================

  $("btnSair")?.addEventListener("click", () => {

    limparSessao();

    window.location.href = "index.html";
  });

  // ======================================
  // VALIDAR PLANO
  // ======================================

  const liberado = await validarPremium();

  if (!liberado) return;

  // ======================================
  // INICIALIZAR
  // ======================================

  await carregarProvasOnline();

  renderizarFavoritosRapidos();

  carregarAtividades();

  registrarEntradaDashboard();

  // ======================================
  // API
  // ======================================

  async function validarPremium() {

    try {

      const resposta = await fetch(`${API_URL}/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!resposta.ok) {

        limparSessao();

        window.location.href = "index.html";

        return false;
      }

      const dados = await resposta.json();

      if (!dados.usuario) {

        limparSessao();

        window.location.href = "index.html";

        return false;
      }

      const usuarioAntigo = JSON.parse(
        sessionStorage.getItem("usuarioLogado") || "null"
      );

      usuario = {
        ...usuarioAntigo,
        ...dados.usuario
      };

      sessionStorage.setItem(
        "usuarioLogado",
        JSON.stringify(usuario)
      );

      if (
        !usuario.aprovado ||
        usuario.suspenso ||
        usuario.status === "suspenso"
      ) {

        alert("Sua conta não está liberada.");

        limparSessao();

        window.location.href = "index.html";

        return false;
      }

      return true;

    } catch (erro) {

      console.error(erro);

      return false;
    }
  }

  // ======================================
  // DASHBOARD
  // ======================================

  async function carregarProvasOnline() {

    try {

      const resposta = await fetch(
        `${API_URL}/minhas-provas`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!resposta.ok) {
        atualizarDashboard();
        return;
      }

      const dados = await resposta.json();

      const provasOnline = dados.resultados || [];

      localStorage.setItem(
        "provasFeitas",
        JSON.stringify(provasOnline)
      );

      atualizarDashboardComProvasOnline(provasOnline);

    } catch (error) {

      console.error(error);

      atualizarDashboard();
    }
  }

  function atualizarDashboardComProvasOnline(provasOnline) {

    const modulosEstudados = getArray("modulosEstudados");
    const arquivosLidos = getArray("arquivosLidos");
    const favoritos = getArray("favoritos");

    setText("modulosEstudados", modulosEstudados.length);
    setText("arquivosLidos", arquivosLidos.length);
    setText("provasFeitas", provasOnline.length);
    setText("totalFavoritos", favoritos.length);

    const progresso = calcularProgresso({
      modulos: modulosEstudados.length,
      arquivos: arquivosLidos.length,
      provas: provasOnline.length,
      favoritos: favoritos.length
    });

    setText("progressoGeral", `${progresso}%`);

    const barra = $("barraProgresso");

    if (barra) {
      barra.style.width = `${progresso}%`;
    }

    const texto = $("textoProgresso");

    if (texto) {

      if (!provasOnline.length) {

        texto.textContent =
          "Faça provas e avance seu nível.";

        return;
      }

      const notas = provasOnline.map((p) =>
        Number(p.percentual || p.nota || 0)
      );

      const media = Math.round(
        notas.reduce((a, b) => a + b, 0) / notas.length
      );

      texto.textContent =
        `Provas: ${provasOnline.length} • Média: ${media}%`;
    }
  }

  function atualizarDashboard() {

    const modulosEstudados = getArray("modulosEstudados");
    const arquivosLidos = getArray("arquivosLidos");
    const provasFeitas = getArray("provasFeitas");
    const favoritos = getArray("favoritos");

    setText("modulosEstudados", modulosEstudados.length);
    setText("arquivosLidos", arquivosLidos.length);
    setText("provasFeitas", provasFeitas.length);
    setText("totalFavoritos", favoritos.length);

    const progresso = calcularProgresso({
      modulos: modulosEstudados.length,
      arquivos: arquivosLidos.length,
      provas: provasFeitas.length,
      favoritos: favoritos.length
    });

    setText("progressoGeral", `${progresso}%`);

    const barra = $("barraProgresso");

    if (barra) {
      barra.style.width = `${progresso}%`;
    }

    const texto = $("textoProgresso");

    if (texto) {

      if (progresso < 30) {

        texto.textContent =
          "Comece acessando os módulos premium.";

      } else if (progresso < 70) {

        texto.textContent =
          "Boa evolução. Continue praticando.";

      } else {

        texto.textContent =
          "Nível avançado alcançado.";
      }
    }
  }

  // ======================================
  // FAVORITOS RÁPIDOS
  // ======================================

  function renderizarFavoritosRapidos() {

    const lista = $("listaModulosDashboard");

    if (!lista) return;

    const favoritos = getArray("favoritos");

    const favoritosFiltrados = MODULOS.filter((modulo) =>
      favoritos.includes(modulo.id)
    );

    const listaFinal =
      favoritosFiltrados.length
        ? favoritosFiltrados
        : MODULOS.slice(0, 4);

    lista.innerHTML = listaFinal.map((modulo) => {

      return `
        <button
          class="module-item"
          data-page="${modulo.page}"
          data-modulo="${modulo.id}"
        >

          <div>

            <span>${modulo.icone}</span>

            <strong>${modulo.nome}</strong>

            <p>${modulo.desc}</p>

          </div>

          <b>Entrar</b>

        </button>
      `;

    }).join("");

    lista.querySelectorAll(".module-item").forEach((btn) => {

      btn.addEventListener("click", () => {

        const moduloId = btn.dataset.modulo;
        const page = btn.dataset.page;

        marcarModuloVisto(moduloId);

        if (page) {
          window.location.href = page;
        }
      });
    });
  }

  // ======================================
  // MODULO VISTO
  // ======================================

  function marcarModuloVisto(id) {

    if (!id) return;

    const modulos = getArray("modulosEstudados");

    if (!modulos.includes(id)) {

      modulos.push(id);

      localStorage.setItem(
        "modulosEstudados",
        JSON.stringify(modulos)
      );

      registrarAtividade({
        icone: "📚",
        titulo: "Módulo acessado",
        descricao: `${formatarNomeModulo(id)} acessado.`
      });
    }
  }

  // ======================================
  // ATIVIDADES
  // ======================================

  function carregarAtividades() {

    const lista = $("listaAtividades");

    if (!lista) return;

    const atividades = getArray("atividadesRecentes");

    if (!atividades.length) {

      lista.innerHTML = `

        <div class="activity-item">

          <span>🚀</span>

          <div>
            <strong>Dashboard carregado</strong>
            <p>Sistema iniciado com sucesso.</p>
          </div>

        </div>

        <div class="activity-item">

          <span>📚</span>

          <div>
            <strong>Comece pelos módulos</strong>
            <p>Acesse os aprendizados premium.</p>
          </div>

        </div>
      `;

      return;
    }

    lista.innerHTML = atividades
      .slice(0, 6)
      .map((item) => {

        return `
          <div class="activity-item">

            <span>${item.icone || "✅"}</span>

            <div>

              <strong>
                ${item.titulo || "Atividade"}
              </strong>

              <p>
                ${item.descricao || ""}
              </p>

            </div>

          </div>
        `;

      })
      .join("");
  }

  function registrarAtividade(item) {

    const atividades = getArray("atividadesRecentes");

    atividades.unshift({
      icone: item.icone || "✅",
      titulo: item.titulo || "Atividade",
      descricao: item.descricao || "",
      data: new Date().toISOString()
    });

    localStorage.setItem(
      "atividadesRecentes",
      JSON.stringify(atividades.slice(0, 20))
    );
  }

  function registrarEntradaDashboard() {

    registrarAtividade({
      icone: "🏠",
      titulo: "Dashboard acessada",
      descricao: "Painel premium carregado."
    });
  }

  // ======================================
  // PROGRESSO
  // ======================================

  function calcularProgresso({
    modulos,
    arquivos,
    provas,
    favoritos
  }) {

    const totalModulos = MODULOS.length || 1;

    const progressoModulos =
      (modulos / totalModulos) * 55;

    const progressoArquivos =
      Math.min(arquivos * 5, 20);

    const progressoProvas =
      Math.min(provas * 8, 15);

    const progressoFavoritos =
      Math.min(favoritos * 2, 10);

    return Math.min(
      100,
      Math.round(
        progressoModulos +
        progressoArquivos +
        progressoProvas +
        progressoFavoritos
      )
    );
  }

  // ======================================
  // HELPERS
  // ======================================

  function formatarNomeModulo(id) {

    const modulo = MODULOS.find(
      (item) => item.id === id
    );

    return modulo
      ? modulo.nome
      : id;
  }

  function getArray(chave) {

    try {

      const valor = JSON.parse(
        localStorage.getItem(chave) || "[]"
      );

      return Array.isArray(valor)
        ? valor
        : [];

    } catch {

      return [];
    }
  }

  function setText(id, valor) {

    const el = $(id);

    if (el) {
      el.textContent = valor;
    }
  }

});
