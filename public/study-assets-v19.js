"use strict";
(() => {
  if (window.__TURMA_STUDY_ASSETS_V19__) return;
  window.__TURMA_STUDY_ASSETS_V19__ = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const BASE = "/assets/elite-v19/modules/";
  const FALLBACK = "/assets/imperial-v14/modules/";
  const modules = [
    { key: "gemeos", names: ["gemeos", "gêmeos"], file: "gemeos.svg", fallback: "gemeos.svg", label: "Gêmeos" },
    { key: "espelhos", names: ["espelho", "espelhos"], file: "espelhos.svg", fallback: "espelhos.svg", label: "Espelhos" },
    { key: "fibonacci", names: ["fibonacci"], file: "fibonacci.svg", fallback: "fibonacci.svg", label: "Fibonacci" },
    { key: "magneto", names: ["magneto"], file: "magneto.svg", fallback: "magneto.svg", label: "Magneto" },
    { key: "camaleoes", names: ["camaleoes", "camaleões"], file: "camaleoes.svg", fallback: "camaleoes.svg", label: "Camaleões" },
    { key: "pitagoras", names: ["pitagoras", "pitágoras", "triangulacao", "triangulação"], file: "pitagoras.svg", fallback: "pitagoras.svg", label: "Pitágoras" },
    { key: "cavalo", names: ["cavalo", "cavalos"], file: "cavalo.svg", fallback: "cavalo.svg", label: "Cavalo" },
    { key: "eclipse-zero", names: ["eclipse zero", "eclipse-zero", "eclipse"], file: "eclipse-zero.svg", fallback: "eclipse-zero.svg", label: "Eclipse Zero" }
  ];

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function identify(element) {
    const raw = [
      element?.dataset?.module,
      element?.dataset?.moduleId,
      element?.getAttribute?.("href"),
      element?.textContent
    ].filter(Boolean).join(" ");
    const text = normalize(raw);
    return modules.find((item) => item.names.some((name) => text.includes(normalize(name)))) || null;
  }

  function setImage(image, item) {
    if (!image || !item) return;
    const desired = BASE + item.file;
    if (image.dataset.eliteCover === item.key && image.getAttribute("src") === desired) return;
    image.dataset.eliteCover = item.key;
    image.classList.remove("image-load-failed");
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.alt = `Capa do módulo ${item.label}`;
    image.decoding = "async";
    image.loading = image.closest(".dash-hero,.m16-hero") ? "eager" : "lazy";
    image.onerror = () => {
      image.onerror = null;
      image.src = FALLBACK + item.fallback;
    };
    image.src = desired;
  }

  function fixLabels(root = document) {
    $$('h1,h2,h3,strong,b,span,a,button', root).forEach((node) => {
      if (node.children.length) return;
      const value = node.textContent || "";
      if (/\bCavalos\b/i.test(value)) node.textContent = value.replace(/\bCavalos\b/gi, "Cavalo");
    });
  }

  function applyStudy() {
    $$(".study-module-card,[data-module-card]").forEach((card) => {
      const item = identify(card);
      if (!item) return;
      let image = $(".study-module-art img", card) || $("img", card);
      if (!image) {
        const art = $(".study-module-art", card);
        if (art) {
          image = document.createElement("img");
          art.prepend(image);
        }
      }
      setImage(image, item);
    });
  }

  function applyModules() {
    $$(".module-video-item,[data-module-id]").forEach((card) => {
      const item = identify(card);
      if (!item) return;
      let cover = $(".module-video-cover", card);
      if (!cover) return;
      let image = $("img", cover);
      if (!image) {
        image = document.createElement("img");
        cover.prepend(image);
      }
      setImage(image, item);
    });
  }

  function applyDashboard() {
    $$(".dash-module-tile").forEach((card) => {
      const item = identify(card);
      if (!item) return;
      setImage($("img", card), item);
    });
  }

  function applyInternal() {
    const path = normalize(location.pathname);
    const item = modules.find((module) => module.names.some((name) => path.includes(normalize(name)))) || (path.includes("triangulacao") ? modules.find((m) => m.key === "pitagoras") : null);
    if (!item) return;
    setImage($(".m16-hero-art"), item);
    setImage($(".m16-official img"), item);
  }

  function apply() {
    applyStudy();
    applyModules();
    applyDashboard();
    applyInternal();
    fixLabels();
  }

  function start() {
    apply();
    let timer = 0;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(apply, 45);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 12000);
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start, { once: true }) : start();
})();
