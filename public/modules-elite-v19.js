"use strict";
(() => {
  if (window.__TURMA_MODULES_ELITE_V19__) return;
  window.__TURMA_MODULES_ELITE_V19__ = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const path = (location.pathname.replace(/\/$/, "") || "/").replace(/\.html$/, "").toLowerCase();
  const BASE = "/assets/elite-v19/modules/";
  const routes = {
    "/estudo-gemeos": ["gemeos.svg", "Gêmeos"],
    "/estudo-espelhos": ["espelhos.svg", "Espelhos"],
    "/estudo-fibonacci": ["fibonacci.svg", "Fibonacci"],
    "/estudo-magneto": ["magneto.svg", "Magneto"],
    "/estudo-camaleoes": ["camaleoes.svg", "Camaleões"],
    "/estudo-triangulacao": ["pitagoras.svg", "Pitágoras"],
    "/estudo-pitagoras": ["pitagoras.svg", "Pitágoras"],
    "/estudo-cavalos": ["cavalo.svg", "Cavalo"],
    "/estudo-cavalo": ["cavalo.svg", "Cavalo"],
    "/estudo-eclipse-zero": ["eclipse-zero.svg", "Eclipse Zero"]
  };
  const moduleInfo = routes[path];

  function updateImages() {
    if (!moduleInfo) return;
    const [file, label] = moduleInfo;
    $$(".m16-hero-art,.m16-official img").forEach((image) => {
      const desired = BASE + file;
      if (image.getAttribute("src") === desired) return;
      image.onerror = null;
      image.src = desired;
      image.alt = `Arte oficial do módulo ${label}`;
      image.decoding = "async";
    });
    $$('h1,h2,h3,strong,b,span').forEach((node) => {
      if (node.children.length) return;
      if (/\bCavalos\b/i.test(node.textContent || "")) node.textContent = node.textContent.replace(/\bCavalos\b/gi, "Cavalo");
    });
  }

  function theme() {
    let value = "dark";
    try { value = localStorage.getItem("turma_global_theme_v2") || localStorage.getItem("theme") || "dark"; } catch (_) {}
    document.documentElement.dataset.theme = value === "light" ? "light" : "dark";
  }

  function reveal() {
    const elements = $$(".m16-hero,.m16-tabs,.m16-card,.m16-race-card,.m16-prompt");
    elements.forEach((element, index) => {
      element.style.opacity = "0";
      element.style.transform = "translateY(16px)";
      element.style.transition = "opacity .55s ease, transform .55s cubic-bezier(.2,.8,.2,1)";
      element.style.transitionDelay = `${Math.min(index, 7) * 42}ms`;
    });
    requestAnimationFrame(() => requestAnimationFrame(() => elements.forEach((element) => {
      element.style.opacity = "1";
      element.style.transform = "none";
    })));
  }

  function enhanceTabs() {
    document.addEventListener("click", (event) => {
      const tab = event.target.closest(".m16-tabs button");
      if (!tab) return;
      setTimeout(() => {
        const active = $(".m16-panel.active");
        if (!active) return;
        active.animate?.([
          { opacity: 0, transform: "translateY(10px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], { duration: 280, easing: "ease-out" });
      }, 20);
    });
  }

  function init() {
    document.documentElement.dataset.uiEliteModule = "v19";
    theme();
    updateImages();
    enhanceTabs();
    setTimeout(reveal, 80);
    let timer = 0;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(updateImages, 45);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
