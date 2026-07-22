/* ======================================
   FAVORITOS.JS • TURMA BLACK
   Favoritos Premium
====================================== */

(() => {
  let favoritos = [];

  function iniciarFavoritos() {
    protegerPagina();
    carregarFavoritos();
    configurarNavegacao();
    configurarMenuMobile();
    configurarFiltros();
    configurarModalLimpar();
    configurarFavoritoGlobal();
    renderizarFavoritos();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarFavoritos);
  } else {
    iniciarFavoritos();
  }

  /* ======================================
     SEGURANÇA
  ======================================= */

  function protegerPagina() {
    const usuario = JSON.parse(
      localStorage.getItem("usuarioLogado") || "null"
    );

    const token = localStorage.getItem("token");

    if (!usuario || !token) {
      localStorage.removeItem("usuarioLogado");
      localStorage.removeItem("token");
      window.location.href = "index.html";
    }
  }

  /* ======================================
     STORAGE
  ======================================= */

  function carregarFavoritos() {
    try {
      favoritos = JSON.parse(
        localStorage.getItem("favoritos") || "[]"
      );

      if (!Array.isArray(favoritos)) {
        favoritos = [];
      }
    } catch {
      favoritos = [];
    }
  }

  function salvarFavoritos() {
    localStorage.setItem(
      "favoritos",
      JSON.stringify(favoritos)
    );
  }

  /* ======================================
     MENU / NAVEGAÇÃO
  ======================================= */

  function configurarNavegacao() {
    document.addEventListener("click", (event) => {
      const botao = event.target.closest("[data-page]");

      if (!botao) return;

      const page = botao.dataset.page;

      if (page) {
        window.location.href = page;
      }
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
      sidebar?.classList.contains("active")
        ? fecharMenu()
        : abrirMenu();
    });

    overlay?.addEventListener("click", fecharMenu);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        fecharMenu();
        fecharModalFavoritos();
      }
    });
  }

  /* ======================================
     FILTROS
  ======================================= */

  function configurarFiltros() {
    $("buscarFavorito")?.addEventListener(
      "input",
      renderizarFavoritos
    );

    $("filtroFavorito")?.addEventListener(
      "change",
      renderizarFavoritos
    );
  }

  function obterFavoritosFiltrados() {
    const busca = ($("buscarFavorito")?.value || "")
      .toLowerCase()
      .trim();

    const filtro = $("filtroFavorito")?.value || "Todos";

    return favoritos.filter((item) => {
      const texto = `
        ${item.titulo || ""}
        ${item.descricao || ""}
        ${item.tipo || ""}
      `.toLowerCase();

      const bateBusca = texto.includes(busca);
      const bateFiltro =
        filtro === "Todos" ||
        String(item.tipo || "").toLowerCase() === filtro.toLowerCase();

      return bateBusca && bateFiltro;
    });
  }

  /* ======================================
     RENDER
  ======================================= */

  function renderizarFavoritos() {
    const lista = $("listaFavoritos");

    if (!lista) return;

    const filtrados = obterFavoritosFiltrados();

    atualizarResumo();

    if (!filtrados.length) {
      lista.innerHTML = `
        <div class="empty-favoritos">
          <span>⭐</span>
          <p>Nenhum favorito encontrado.</p>
        </div>
      `;
      return;
    }

    lista.innerHTML = filtrados
      .map((item) => {
        return `
          <article class="favorito-card">

            <div class="favorito-top">
              <h3>
                ${escapeHTML(item.titulo || "Favorito")}
              </h3>

              <span class="favorito-star">
                ⭐
              </span>
            </div>

            <div class="favorito-tipo">
              ${escapeHTML(normalizarTipo(item.tipo || "Geral"))}
            </div>

            <p>
              ${escapeHTML(item.descricao || "Item salvo como favorito.")}
            </p>

            ${
              item.criadoEm
                ? `<small class="favorito-data">${escapeHTML(item.criadoEm)}</small>`
                : ""
            }

            <div class="favorito-actions">

              <button
                class="btn-abrir"
                type="button"
                data-abrir="${escapeHTML(item.id)}"
              >
                Abrir
              </button>

              <button
                class="btn-remover"
                type="button"
                data-remover="${escapeHTML(item.id)}"
              >
                Remover
              </button>

            </div>

          </article>
        `;
      })
      .join("");

    ativarAcoesCards();
  }

  function atualizarResumo() {
    const total = favoritos.length;

    setText("totalFavoritosPage", total);

    if (!$("tipoMaisSalvo")) return;

    if (!favoritos.length) {
      setText("tipoMaisSalvo", "Nenhum item ainda");
      return;
    }

    const contagem = {};

    favoritos.forEach((item) => {
      const tipo = normalizarTipo(item.tipo || "Geral");
      contagem[tipo] = (contagem[tipo] || 0) + 1;
    });

    const maisSalvo = Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])[0];

    setText("tipoMaisSalvo", `Mais salvo: ${maisSalvo[0]}`);
  }

  function ativarAcoesCards() {
    document.querySelectorAll("[data-remover]").forEach((btn) => {
      btn.addEventListener("click", () => {
        removerFavorito(btn.dataset.remover);
      });
    });

    document.querySelectorAll("[data-abrir]").forEach((btn) => {
      btn.addEventListener("click", () => {
        abrirFavorito(btn.dataset.abrir);
      });
    });
  }

  /* ======================================
     AÇÕES
  ======================================= */

  function removerFavorito(id) {
    const item = favoritos.find(
      (fav) => String(fav.id) === String(id)
    );

    favoritos = favoritos.filter(
      (fav) => String(fav.id) !== String(id)
    );

    salvarFavoritos();
    renderizarFavoritos();

    registrarAtividade({
      icone: "⭐",
      titulo: "Favorito removido",
      descricao: item?.titulo || "Um item foi removido dos favoritos."
    });
  }

  function abrirFavorito(id) {
    const item = favoritos.find(
      (fav) => String(fav.id) === String(id)
    );

    if (!item) return;

    registrarAtividade({
      icone: "⭐",
      titulo: "Favorito aberto",
      descricao: item.titulo || "Favorito"
    });

    if (item.page) {
      window.location.href = item.page;
      return;
    }

    const tipo = String(item.tipo || "").toLowerCase();

    if (tipo.includes("nota") || tipo.includes("anota")) {
      window.location.href = "notas.html";
      return;
    }

    if (tipo.includes("prova")) {
      window.location.href = "provas.html";
      return;
    }

    if (tipo.includes("módulo") || tipo.includes("modulo")) {
      window.location.href = "modulos.html";
      return;
    }

    if (tipo.includes("estudo")) {
      window.location.href = "estudo.html";
      return;
    }

    if (tipo.includes("minigame")) {
      window.location.href = "minigames.html";
      return;
    }

    if (tipo.includes("roleta")) {
      window.location.href = "roleta.html";
      return;
    }

    if (tipo.includes("ferramenta") || tipo.includes("estratégia")) {
      window.location.href = "minigames.html";
      return;
    }

    window.location.href = "dashboard.html";
  }

  /* ======================================
     MODAL LIMPAR
  ======================================= */

  function configurarModalLimpar() {
    $("btnLimparFavoritos")?.addEventListener("click", () => {
      if (!favoritos.length) {
        alert("Você ainda não possui favoritos para limpar.");
        return;
      }

      abrirModalFavoritos();
    });

    $("btnCancelarFavoritos")?.addEventListener(
      "click",
      fecharModalFavoritos
    );

    $("btnConfirmarFavoritos")?.addEventListener("click", () => {
      favoritos = [];

      salvarFavoritos();
      renderizarFavoritos();
      fecharModalFavoritos();

      registrarAtividade({
        icone: "🧹",
        titulo: "Favoritos apagados",
        descricao: "Todos os favoritos foram removidos."
      });
    });

    $("modalFavoritos")?.addEventListener("click", (event) => {
      if (event.target === $("modalFavoritos")) {
        fecharModalFavoritos();
      }
    });
  }

  function abrirModalFavoritos() {
    $("modalFavoritos")?.classList.add("active");
  }

  function fecharModalFavoritos() {
    $("modalFavoritos")?.classList.remove("active");
  }

  /* ======================================
     FUNÇÃO GLOBAL
  ======================================= */

  function configurarFavoritoGlobal() {
    window.adicionarFavorito = function (item) {
      if (!item || !item.titulo) return;

      const novoFavorito = {
        id: item.id || gerarId(),
        titulo: item.titulo,
        descricao: item.descricao || "Item salvo como favorito.",
        tipo: item.tipo || "Geral",
        page: item.page || "",
        criadoEm: new Date().toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short"
        })
      };

      const jaExiste = favoritos.some((fav) => {
        return (
          String(fav.titulo || "").toLowerCase() ===
            String(novoFavorito.titulo).toLowerCase() &&
          String(fav.tipo || "").toLowerCase() ===
            String(novoFavorito.tipo).toLowerCase()
        );
      });

      if (jaExiste) {
        alert("Esse item já está nos favoritos.");
        return;
      }

      favoritos.unshift(novoFavorito);

      salvarFavoritos();
      renderizarFavoritos();

      registrarAtividade({
        icone: "⭐",
        titulo: "Novo favorito",
        descricao: novoFavorito.titulo
      });

      alert("Adicionado aos favoritos!");
    };
  }

  /* ======================================
     HELPERS
  ======================================= */

  function registrarAtividade(atividade) {
    const atividades = JSON.parse(
      localStorage.getItem("atividadesRecentes") || "[]"
    );

    atividades.unshift({
      ...atividade,
      data: new Date().toISOString()
    });

    localStorage.setItem(
      "atividadesRecentes",
      JSON.stringify(atividades.slice(0, 20))
    );
  }

  function normalizarTipo(tipo) {
    const t = String(tipo || "").toLowerCase();

    if (t.includes("nota") || t.includes("anota")) return "Anotação";
    if (t.includes("modulo") || t.includes("módulo")) return "Módulo";
    if (t.includes("prova")) return "Prova";
    if (t.includes("estudo")) return "Estudo";
    if (t.includes("minigame")) return "Minigame";
    if (t.includes("roleta")) return "Roleta";
    if (t.includes("estratégia") || t.includes("estrategia")) return "Estratégia";
    if (t.includes("ferramenta")) return "Ferramenta";

    return tipo || "Geral";
  }

  function gerarId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function setText(id, valor) {
    const el = $(id);

    if (el) {
      el.textContent = valor;
    }
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