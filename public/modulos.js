/* ======================================
   MODULOS.JS • TURMA BLACK v2.0
   Com popup animado de carregamento
====================================== */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // ── AUTH ──────────────────────────────────────────────
  let usuario = null;
  try {
    usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  } catch { usuario = null; }

  const token = localStorage.getItem("token");
  if (!usuario || !token) {
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("token");
    window.location.href = "index.html";
    return;
  }

  // ── CATÁLOGO DE MÓDULOS ───────────────────────────────
  const modulosEstudo = [
    {
      id: "pitagoras",
      icon: "📐",
      titulo: "Pitágoras",
      descricao: "Conexões geométricas na race com linhas e triângulos inteligentes.",
      subtituloLoader: "Preparando as conexões geométricas…",
      page: "modules/pitagoras.html"
    },
    {
      id: "reflexivos",
      icon: "🧠",
      titulo: "Reflexivos",
      descricao: "Leitura de espelhos, respostas e reflexos estratégicos dentro da roleta.",
      subtituloLoader: "Carregando os espelhos estratégicos…",
      page: "modules/reflexivos.html"
    },
    {
      id: "gatilhos",
      icon: "🚨",
      titulo: "Gatilhos",
      descricao: "Alertas rápidos de números que chamam outros com leitura contextual.",
      subtituloLoader: "Ativando os alertas da leitura…",
      page: "modules/gatilhos.html"
    },
    {
      id: "camaleoes",
      icon: "🦎",
      titulo: "Camaleões",
      descricao: "Números camuflados, conexões escondidas e adaptação de leitura.",
      subtituloLoader: "Revelando as conexões escondidas…",
      page: "modules/camaleoes.html"
    },
    {
      id: "eclipse-0",
      icon: "🌑",
      titulo: "Eclipse 0",
      descricao: "Repetição, ciclos recentes, região do zero e números insistentes.",
      subtituloLoader: "Mapeando os ciclos do zero…",
      page: "modules/eclipse-0.html"
    },
    {
      id: "magnetismo",
      icon: "🧲",
      titulo: "Magnetismo",
      descricao: "Conexões puxadas por número principal e regiões de atração.",
      subtituloLoader: "Carregando as regiões de atração…",
      page: "modules/magnetismo.html"
    },
    {
      id: "fibonacci",
      icon: "🔢",
      titulo: "Fibonacci",
      descricao: "Sequências, soma, subtração e leitura matemática aplicada à race.",
      subtituloLoader: "Calculando as sequências matemáticas…",
      page: "modules/fibonacci.html"
    }
  ];

  // ── POPUP LOADER ──────────────────────────────────────

  function criarLoaderPopup() {
    if ($("moduloLoaderOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "moduloLoaderOverlay";

    overlay.innerHTML = `
      <div class="ml-card">

        <div class="ml-icone-wrap">
          <div class="ml-icone-ring"></div>
          <div class="ml-icone-ring-2"></div>
          <div class="ml-icone-emoji" id="mlEmoji">📚</div>
        </div>

        <span class="ml-label">TURMA BLACK</span>

        <h2 class="ml-titulo" id="mlTitulo">Carregando módulo</h2>

        <p class="ml-subtitulo" id="mlSubtitulo">Aguarde um momento…</p>

        <div class="ml-progress-wrap">
          <div class="ml-progress-bar" id="mlBar"></div>
        </div>

        <span class="ml-percent" id="mlPercent">0%</span>

        <div class="ml-dots">
          <span></span><span></span><span></span>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);
  }

  function mostrarLoader(modulo, onCompleto) {
    criarLoaderPopup();

    // Preenche os dados do módulo
    const emoji    = $("mlEmoji");
    const titulo   = $("mlTitulo");
    const subtitulo = $("mlSubtitulo");
    const bar      = $("mlBar");
    const percent  = $("mlPercent");

    if (emoji)     emoji.textContent    = modulo.icon;
    if (titulo)    titulo.textContent   = `Carregando ${modulo.titulo}`;
    if (subtitulo) subtitulo.textContent = modulo.subtituloLoader || "Aguarde um momento…";
    if (bar)       bar.style.width      = "0%";
    if (percent)   percent.textContent  = "0%";

    // Ativa o overlay
    const overlay = $("moduloLoaderOverlay");
    overlay.classList.add("ativo");

    // Progresso animado
    const duracao = 2000 + Math.random() * 1200; // 2s a 3.2s
    const passos  = 30;
    const stepMs  = duracao / passos;
    let   atual   = 0;

    const intervalo = setInterval(() => {
      // Desacelera nos últimos 15% para dar sensação de "verificando acesso"
      const incremento = atual < 82
        ? (100 / passos) * (1 + Math.random() * 0.4)
        : (100 / passos) * 0.3;

      atual = Math.min(atual + incremento, 100);
      const pct = Math.round(atual);

      if (bar)     bar.style.width    = `${pct}%`;
      if (percent) percent.textContent = `${pct}%`;

      if (atual >= 100) {
        clearInterval(intervalo);
        if (bar)     bar.style.width    = "100%";
        if (percent) percent.textContent = "100%";

        // Pequena pausa antes de navegar
        setTimeout(() => {
          overlay.classList.remove("ativo");
          setTimeout(() => {
            if (onCompleto) onCompleto();
          }, 280);
        }, 320);
      }
    }, stepMs);
  }

  // ── NAVEGAÇÃO PADRÃO ──────────────────────────────────

  document.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      if (page) window.location.href = page;
    });
  });

  $("btnSair")?.addEventListener("click", () => {
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("token");
    window.location.href = "index.html";
  });

  // ── MENU MOBILE ───────────────────────────────────────

  function abrirMenu() {
    $("sidebar")?.classList.add("active");
    $("sidebarOverlay")?.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function fecharMenu() {
    $("sidebar")?.classList.remove("active");
    $("sidebarOverlay")?.classList.remove("active");
    document.body.style.overflow = "";
  }

  $("btnMenu")?.addEventListener("click", () => {
    $("sidebar")?.classList.contains("active") ? fecharMenu() : abrirMenu();
  });

  $("sidebarOverlay")?.addEventListener("click", fecharMenu);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharMenu();
  });

  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 900) fecharMenu();
    });
  });

  // ── RENDERIZAR MÓDULOS ────────────────────────────────

  function renderizarModulos() {
    const lista = $("listaModulosEstudo");
    if (!lista) return;

    const busca  = ($("buscarModuloEstudo")?.value  || "").toLowerCase().trim();
    const filtro = $("filtroModuloEstudo")?.value   || "todos";

    let favoritos = [];
    try { favoritos = JSON.parse(localStorage.getItem("favoritos") || "[]"); }
    catch { favoritos = []; }

    const filtrados = modulosEstudo.filter((m) => {
      const texto = `${m.titulo} ${m.descricao} ${m.id}`.toLowerCase();
      return texto.includes(busca) && (filtro === "todos" || filtro === m.id);
    });

    if (!filtrados.length) {
      lista.innerHTML = `
        <div class="empty-estudo">
          <span class="emoji-normal">📚</span>
          <p>Nenhum módulo encontrado.</p>
        </div>
      `;
      return;
    }

    lista.innerHTML = filtrados.map((modulo) => {
      const favoritado = favoritos.some((fav) => fav.id === `modulo-${modulo.id}`);
      return `
        <article class="estudo-modulo-card" data-module="${modulo.id}">

          <button
            class="btn-favorito-modulo ${favoritado ? "favoritado" : ""}"
            data-fav="${modulo.id}"
            title="Favoritar"
            type="button"
          >
            <span class="emoji-normal">${favoritado ? "🌟" : "⭐"}</span>
          </button>

          <div class="modulo-icon">
            <span class="emoji-normal">${modulo.icon}</span>
          </div>

          <span>${modulo.titulo.toUpperCase()}</span>

          <h3>${modulo.titulo}</h3>

          <p>${modulo.descricao}</p>

          <button
            class="primary-btn btn-abrir-modulo"
            data-module="${modulo.id}"
            type="button"
          >
            Acessar
          </button>

        </article>
      `;
    }).join("");

    ativarBotoesModulos();
  }

  function ativarBotoesModulos() {
    document.querySelectorAll(".btn-abrir-modulo").forEach((btn) => {
      btn.addEventListener("click", () => {
        abrirModulo(btn.dataset.module);
      });
    });

    document.querySelectorAll(".btn-favorito-modulo").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        favoritarModulo(btn.dataset.fav);
      });
    });
  }

  function abrirModulo(id) {
    const modulo = modulosEstudo.find((m) => m.id === id);
    if (!modulo) { alert("Módulo não encontrado."); return; }

    registrarModuloEstudado(modulo);
    registrarAtividadeModulo(modulo);

    // Mostra o popup animado ANTES de navegar
    mostrarLoader(modulo, () => {
      window.location.href = modulo.page;
    });
  }

  // ── FAVORITOS ─────────────────────────────────────────

  function favoritarModulo(id) {
    const modulo = modulosEstudo.find((m) => m.id === id);
    if (!modulo) return;

    let favoritos = [];
    try { favoritos = JSON.parse(localStorage.getItem("favoritos") || "[]"); }
    catch { favoritos = []; }

    const favId = `modulo-${modulo.id}`;
    const existe = favoritos.some((fav) => fav.id === favId);

    if (existe) {
      favoritos = favoritos.filter((fav) => fav.id !== favId);
    } else {
      favoritos.unshift({
        id: favId,
        titulo: modulo.titulo,
        descricao: modulo.descricao,
        tipo: "Módulo",
        page: modulo.page,
        criadoEm: new Date().toLocaleString("pt-BR")
      });
    }

    localStorage.setItem("favoritos", JSON.stringify(favoritos));
    renderizarModulos();
  }

  // ── PROGRESSO ─────────────────────────────────────────

  function registrarModuloEstudado(modulo) {
    let estudados = [];
    try { estudados = JSON.parse(localStorage.getItem("modulosEstudados") || "[]"); }
    catch { estudados = []; }

    if (!estudados.some((item) => item.id === modulo.id)) {
      estudados.push({
        id: modulo.id,
        titulo: modulo.titulo,
        data: new Date().toLocaleString("pt-BR")
      });
      localStorage.setItem("modulosEstudados", JSON.stringify(estudados));
    }
    atualizarResumoEstudo();
  }

  function registrarAtividadeModulo(modulo) {
    let atividades = [];
    try { atividades = JSON.parse(localStorage.getItem("atividadesRecentes") || "[]"); }
    catch { atividades = []; }

    atividades.unshift({
      icone: modulo.icon || "📚",
      titulo: "Módulo acessado",
      descricao: modulo.titulo,
      data: new Date().toISOString()
    });

    localStorage.setItem(
      "atividadesRecentes",
      JSON.stringify(atividades.slice(0, 20))
    );
  }

  function atualizarResumoEstudo() {
    let estudados = [];
    try { estudados = JSON.parse(localStorage.getItem("modulosEstudados") || "[]"); }
    catch { estudados = []; }

    const total     = modulosEstudo.length;
    const concluidos = estudados.filter((item) =>
      modulosEstudo.some((m) => m.id === item.id)
    ).length;
    const progresso = total ? Math.round((concluidos / total) * 100) : 0;

    if ($("progressoEstudo"))     $("progressoEstudo").textContent = `${progresso}%`;
    if ($("barraEstudo"))         $("barraEstudo").style.width     = `${progresso}%`;
    if ($("totalModulosEstudo"))  $("totalModulosEstudo").textContent = `${total} módulos disponíveis`;
  }

  // ── BUSCA / FILTROS / ATALHOS ─────────────────────────

  $("buscarModuloEstudo")?.addEventListener("input",  renderizarModulos);
  $("filtroModuloEstudo")?.addEventListener("change", renderizarModulos);

  document.querySelectorAll(".atalho-estudo").forEach((btn) => {
    btn.addEventListener("click", () => {
      const filtro = $("filtroModuloEstudo");
      if (filtro) filtro.value = btn.dataset.module;
      renderizarModulos();
      $("listaModulosEstudo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // ── INIT ──────────────────────────────────────────────
  criarLoaderPopup();
  renderizarModulos();
  atualizarResumoEstudo();
});