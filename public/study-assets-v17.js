"use strict";
(() => {
  if (window.__STUDY_ASSETS_V17__) return;
  window.__STUDY_ASSETS_V17__ = true;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const route = (location.pathname.replace(/\/$/, "") || "/").replace(/\.html$/, "").toLowerCase();
  if (route !== "/estudo" && route !== "/modulos") return;

  const base = "/assets/imperial-v14/modules/";
  const covers = {
    gemeos: "gemeos.svg",
    espelhos: "espelhos.svg",
    fibonacci: "fibonacci.svg",
    magneto: "magneto.svg",
    camaleoes: "camaleoes.svg",
    pitagoras: "pitagoras.svg",
    triangulacao: "pitagoras.svg",
    cavalos: "cavalo.svg",
    cavalo: "cavalo.svg",
    eclipse: "eclipse-zero.svg",
    "eclipse-zero": "eclipse-zero.svg"
  };

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function identify(element) {
    const direct = element.dataset.module || element.dataset.moduleId || "";
    if (covers[direct]) return direct;
    const text = normalize(element.textContent);
    return Object.keys(covers).find((key) => text.includes(normalize(key))) || "";
  }

  function applyStudy() {
    $$(".study-module-card,[data-module-card]").forEach((card) => {
      const id = identify(card), file = covers[id], image = $(".study-module-art img,img", card);
      if (!file || !image) return;
      image.classList.remove("image-load-failed");
      image.src = base + file;
      image.removeAttribute("srcset");
      image.alt = `Capa do módulo ${id === "cavalos" ? "Cavalo" : id}`;
    });
  }

  function applyModules() {
    $$("[data-module-id],.module-video-item").forEach((card) => {
      const id = identify(card), file = covers[id];
      if (!file) return;
      let image = $(".module-video-cover img", card);
      if (!image) {
        const cover = $(".module-video-cover", card);
        if (!cover) return;
        image = document.createElement("img");
        cover.appendChild(image);
      }
      image.hidden = false;
      image.classList.remove("image-load-failed");
      image.src = base + file;
      image.alt = `Capa do módulo ${id === "cavalos" ? "Cavalo" : id}`;
      image.loading = "lazy";
      image.decoding = "async";
      if (id === "cavalos") {
        const title = $(".module-video-copy strong", card);
        if (title) title.textContent = "Cavalo";
      }
    });
  }

  function apply() {
    if (route === "/estudo") applyStudy();
    if (route === "/modulos") applyModules();
  }

  const start = () => {
    apply();
    setTimeout(apply, 250);
    setTimeout(apply, 900);
    setTimeout(apply, 2200);
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start, { once: true }) : start();
})();
