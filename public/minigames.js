/* ======================================
   MINIGAMES.JS • TURMA BLACK
   Segurança + Navegação + Mobile
====================================== */

(() => {

  /* ======================================
     INICIALIZAR
  ======================================= */

  function iniciarMinigames() {

    protegerPagina();

    configurarNavegacao();

    configurarMenuMobile();

    registrarEntradaPagina();
  }

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      iniciarMinigames
    );

  } else {

    iniciarMinigames();
  }

  /* ======================================
     PROTEGER PÁGINA
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
     NAVEGAÇÃO
  ======================================= */

  function configurarNavegacao() {

    document.addEventListener("click", (event) => {

      const botao = event.target.closest("[data-page]");

      if (!botao) return;

      const page = botao.dataset.page;

      if (!page) return;

      registrarAtividade(
        "🎮",
        "Minigame acessado",
        `Acesso realizado para ${page}`
      );

      window.location.href = page;
    });

    document.getElementById("btnSair")
    ?.addEventListener("click", () => {

      localStorage.removeItem("usuarioLogado");
      localStorage.removeItem("token");

      window.location.href = "index.html";
    });
  }

  /* ======================================
     MENU MOBILE
  ======================================= */

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

      const aberto =
        sidebar?.classList.contains("active");

      aberto
        ? fecharMenu()
        : abrirMenu();
    });

    overlay?.addEventListener(
      "click",
      fecharMenu
    );

    document.addEventListener("keydown", (e) => {

      if (e.key === "Escape") {

        fecharMenu();
      }
    });

    document.querySelectorAll(".menu-item")
    .forEach((item) => {

      item.addEventListener("click", () => {

        if (window.innerWidth <= 900) {

          fecharMenu();
        }
      });

    });
  }

  /* ======================================
     REGISTRAR ENTRADA
  ======================================= */

  function registrarEntradaPagina() {

    registrarAtividade(
      "🎮",
      "Central Minigames",
      "Entrou na central premium de minigames."
    );
  }

  /* ======================================
     REGISTRAR ATIVIDADE
  ======================================= */

  function registrarAtividade(
    icone,
    titulo,
    descricao
  ) {

    const atividades = JSON.parse(
      localStorage.getItem("atividadesRecentes") || "[]"
    );

    atividades.unshift({
      icone,
      titulo,
      descricao,
      data: new Date().toISOString()
    });

    localStorage.setItem(
      "atividadesRecentes",
      JSON.stringify(
        atividades.slice(0, 20)
      )
    );
  }

})();