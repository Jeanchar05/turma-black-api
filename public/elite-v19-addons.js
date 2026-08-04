"use strict";
(() => {
  if (window.__TURMA_ELITE_V19_ADDONS__) return;
  window.__TURMA_ELITE_V19_ADDONS__ = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const route = (location.pathname.replace(/\/$/, "") || "/").replace(/\.html$/, "").toLowerCase();

  function bindDrawer(sidebar, button, overlay) {
    if (!sidebar || !button || button.dataset.eliteAddonDrawer === "1") return;
    button.dataset.eliteAddonDrawer = "1";
    const close = () => {
      sidebar.classList.remove("open");
      if (overlay) overlay.hidden = true;
      document.body.classList.remove("elite-menu-open");
    };
    button.addEventListener("click", (event) => {
      if (!matchMedia("(max-width:860px)").matches) return;
      event.preventDefault();
      sidebar.classList.add("open");
      if (overlay) overlay.hidden = false;
      document.body.classList.add("elite-menu-open");
    });
    overlay?.addEventListener("click", close);
    sidebar.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
  }

  function freeMobileBar() {
    if (!route.includes("dashboard-free") || document.querySelector(".tp-free-mobile-nav")) return;
    const bar = document.createElement("nav");
    bar.className = "tp-mobile-bottom-nav tp-free-mobile-nav";
    bar.setAttribute("aria-label", "Navegação gratuita no celular");
    bar.innerHTML = [
      ["/dashboard-free", "Início", "i-home"],
      ["#freeStudy", "Estudo", "i-book"],
      ["/suporte", "Suporte", "i-support"],
      ["/perfil", "Perfil", "i-user"],
      ["#premiumCheckout", "Premium", "i-crown"]
    ].map(([href, label, icon], index) => `<a href="${href}" class="${index === 0 ? "active" : ""}"><svg><use href="/assets/dashboard-icons.svg#${icon}"></use></svg><span>${label}</span></a>`).join("");
    document.body.appendChild(bar);
  }

  function rouletteTheme() {
    const top = $("#rouletteThemeTop");
    const hidden = $("#rouletteThemeToggle");
    if (!top || !hidden || top.dataset.eliteThemeProxy === "1") return;
    top.dataset.eliteThemeProxy = "1";
    top.addEventListener("click", (event) => {
      event.preventDefault();
      hidden.click();
    });
  }

  function init() {
    bindDrawer($("#freeSidebar"), $("#freeMenu"), $("#freeOverlay"));
    bindDrawer($("#rouletteSidebar"), $("#rouletteMenuToggle"), $("#rouletteMobileOverlay"));
    rouletteTheme();
    freeMobileBar();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
