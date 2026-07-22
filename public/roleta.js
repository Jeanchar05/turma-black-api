/* ======================================
   ROLETA.JS • TURMA BLACK
   Acesso operacional EsportivaBet
====================================== */

(() => {
  const LINK_ROLETA = "https://go.aff.esportiva.bet/aeg41h8f";

  document.addEventListener("DOMContentLoaded", () => {
    protegerPagina();
    configurarNavegacao();
    configurarMenuMobile();
    configurarBotoesRoleta();
  });

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

  function configurarNavegacao() {
    document.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = btn.dataset.page;

        if (page) {
          window.location.href = page;
        }
      });
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
  }

  function configurarBotoesRoleta() {
    const botoes = [
      "btnAcessarRoleta",
      "btnAcessarRoletaCard"
    ];

    botoes.forEach((id) => {
      document.getElementById(id)?.addEventListener("click", acessarRoleta);
    });
  }

  function acessarRoleta() {
    registrarAtividadeRoleta();

    window.open(
      LINK_ROLETA,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function registrarAtividadeRoleta() {
    const atividades = JSON.parse(
      localStorage.getItem("atividadesRecentes") || "[]"
    );

    atividades.unshift({
      icone: "🎰",
      titulo: "Roleta acessada",
      descricao: "Acesso realizado para a plataforma EsportivaBet.",
      data: new Date().toISOString()
    });

    localStorage.setItem(
      "atividadesRecentes",
      JSON.stringify(atividades.slice(0, 20))
    );
  }
})();