"use strict";
(() => {
  if (window.__TURMA_REFERENCE_V15__) return;
  window.__TURMA_REFERENCE_V15__ = true;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const path = (location.pathname.replace(/\/$/, "") || "/").replace(/\.html$/, "").toLowerCase();
  const isFree = path === "/dashboard-free" || document.body.classList.contains("free-dashboard-page");
  const premiumNav = [
    ["/dashboard", "Início", "i-home"],
    ["/estudo", "Estudos", "i-book"],
    ["/modulos", "Módulos", "i-layers"],
    ["/gestao", "Gestão", "i-activity"],
    ["/perfil", "Perfil", "i-user"]
  ];
  const freeNav = [
    ["/dashboard-free", "Início", "i-home"],
    ["/dashboard-free#freeStudy", "Estudo", "i-book"],
    ["/roleta", "Roleta", "i-roulette"],
    ["/suporte", "Suporte", "i-support"],
    ["/perfil", "Perfil", "i-user"]
  ];

  const progressModules = [
    ["Gêmeos", "Leitura e construção", 75, "Ⅱ"],
    ["Espelhos", "Reflexos e inversões", 60, "◇"],
    ["Fibonacci", "Sequência natural", 80, "Φ"],
    ["Magneto", "Atração e influência", 65, "∩"],
    ["Camaleões", "Adaptação e leitura", 70, "◉"]
  ];

  function active(href) {
    const clean = href.split("#")[0];
    if (clean === "/dashboard") return path === "/" || path === "/dashboard";
    if (clean === "/dashboard-free") return path === "/dashboard-free";
    if (clean === "/estudo") return path === "/estudo" || path.startsWith("/estudo-");
    return path === clean;
  }

  function populateProgress() {
    const host = $("#tpV10ModuleProgress");
    if (!host || host.dataset.reference15) return;
    host.dataset.reference15 = "1";
    host.innerHTML = progressModules.map(([name, sub, pct, symbol]) => `
      <article>
        <span class="tp-v10-mini-icon">${symbol}</span>
        <div><b>${name}</b><small>${sub}</small><i style="--p:${pct}%"></i></div>
        <small>${pct}%</small>
      </article>`).join("");
  }

  function installMobileBottom() {
    if ($(".dash-mobile-bottom")) return;
    const items = isFree ? freeNav : premiumNav;
    const el = document.createElement("nav");
    el.className = "dash-mobile-bottom";
    el.setAttribute("aria-label", "Navegação mobile");
    el.innerHTML = items.map(([href, label, icon]) => `<a class="${active(href) ? "active" : ""}" href="${href}"><svg><use href="/assets/dashboard-icons.svg#${icon}"></use></svg><span>${label}</span></a>`).join("");
    document.body.appendChild(el);
  }

  function improveHeader() {
    const topbar = $(".dash-topbar,.notes-topbar,.support-topbar,.roulette-topbar,.favorites-topbar,.exam-topbar,.modules-topbar,.study-topbar,.reel-topbar");
    topbar?.classList.add("reference-topbar");
  }

  function bindMenu() {
    document.addEventListener("click", event => {
      const trigger = event.target.closest("#dashMenuToggle,.dash-menu-toggle,.notes-menu-button,.roulette-menu,[data-menu-toggle]");
      if (trigger) {
        event.preventDefault();
        const side = $(".dash-sidebar,.notes-sidebar,.support-sidebar,.roulette-sidebar,.favorites-sidebar");
        side?.classList.toggle("open");
        document.body.classList.toggle("menu-open", side?.classList.contains("open"));
        return;
      }
      if (event.target.closest(".dash-nav-item,.notes-main-nav a,.support-nav a,.roulette-nav a,.favorites-nav a")) {
        $(".dash-sidebar.open,.notes-sidebar.open,.support-sidebar.open,.roulette-sidebar.open,.favorites-sidebar.open")?.classList.remove("open");
        document.body.classList.remove("menu-open");
      }
    }, true);
  }

  function syncProgressRing() {
    const value = parseInt(String($("#statProgress")?.textContent || "25").replace(/\D/g, ""), 10) || 25;
    $(".dash-progress-icon")?.style.setProperty("--progress", `${Math.min(100, value)}%`);
  }

  function normalizeImages() {
    $$("img").forEach(img => {
      if (img.dataset.referenceBound) return;
      img.dataset.referenceBound = "1";
      img.addEventListener("error", () => {
        const fallback = img.closest("[data-module]")?.dataset.module;
        if (fallback) img.src = `/assets/imperial-v14/modules/${fallback}.svg`;
      }, { once: true });
    });
  }

  function reveal() {
    const items = $$(".reference-card,.dash-stat-grid article,.dash-module-tile,.study-module-card,.module-video-item,.tp14-page-hero");
    if (!("IntersectionObserver" in window)) {
      items.forEach(el => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }), { threshold: .08 });
    items.forEach((el, index) => {
      el.classList.add("tp14-reveal");
      el.style.animationDelay = `${Math.min(index * 28, 280)}ms`;
      observer.observe(el);
    });
  }

  function init() {
    document.body.classList.add("reference-v15");
    populateProgress();
    installMobileBottom();
    improveHeader();
    bindMenu();
    syncProgressRing();
    normalizeImages();
    reveal();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
