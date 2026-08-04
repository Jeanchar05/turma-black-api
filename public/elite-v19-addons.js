"use strict";
(() => {
  if (window.__TURMA_ELITE_V19_ADDONS__) return;
  window.__TURMA_ELITE_V19_ADDONS__ = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const route = (location.pathname.replace(/\/$/, "") || "/").replace(/\.html$/, "").toLowerCase();
  const VERSION = "20260803-elite-v19-root-3";

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

  function protectFreeMenu() {
    if (!route.includes("dashboard-free")) return;
    const nav = $("#freeSidebar .dash-nav");
    if (!nav) return;
    $$('a[href="/gestao"]', nav).forEach((link) => link.remove());
    if (!nav.querySelector('[data-free-management-guard]')) {
      const guard = document.createElement("a");
      guard.href = "/gestao";
      guard.hidden = true;
      guard.dataset.freeManagementGuard = "1";
      guard.setAttribute("aria-hidden", "true");
      guard.tabIndex = -1;
      nav.appendChild(guard);
    }
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

  function dashboardPortrait() {
    if (!(route === "/dashboard" || route === "/dashboard.html") || document.querySelector('[data-elite-portrait-script]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `/elite-v19-portrait.css?v=${VERSION}`;
    link.dataset.elitePortraitStyle = "1";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = `/dashboard-portrait-final.js?v=${VERSION}`;
    script.defer = true;
    script.dataset.elitePortraitScript = "1";
    document.head.appendChild(script);
  }

  function init() {
    protectFreeMenu();
    bindDrawer($("#freeSidebar"), $("#freeMenu"), $("#freeOverlay"));
    bindDrawer($("#rouletteSidebar"), $("#rouletteMenuToggle"), $("#rouletteMobileOverlay"));
    freeMobileBar();
    dashboardPortrait();
    setTimeout(protectFreeMenu, 250);
    setTimeout(protectFreeMenu, 900);
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
