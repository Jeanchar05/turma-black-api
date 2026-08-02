"use strict";
(() => {
  if (window.__TURMA_STUDY_IMAGES_FINAL__) return;
  window.__TURMA_STUDY_IMAGES_FINAL__ = true;

  const VERSION = "20260802-final-images-1";
  const path = location.pathname.replace(/\/$/, "") || "/";
  const isHome = path === "/estudo" || path === "/estudo.html";

  const modules = {
    gemeos: {
      names: ["gêmeos", "gemeos"],
      routes: ["/estudo-gemeos", "/estudo-gemeos.html"],
      card: "/assets/study/gemeos-card-ai-final-v1.svg?v=" + VERSION,
      internal: "/assets/study/gemeos-hero-v2.svg?v=" + VERSION
    },
    espelhos: {
      names: ["espelhos", "espelho"],
      routes: ["/estudo-espelhos", "/estudo-espelhos.html"],
      cardBase64: "/assets/study/espelhos-card-v5.base64?v=" + VERSION,
      internal: "/assets/study/espelhos-module.webp?v=" + VERSION
    },
    fibonacci: {
      names: ["fibonacci"],
      routes: ["/estudo-fibonacci", "/estudo-fibonacci.html"],
      card: "/assets/study/fibonacci-card-v3.webp?v=" + VERSION,
      internal: "/assets/study/fibonacci-module.webp?v=" + VERSION
    },
    magneto: {
      names: ["magneto"],
      routes: ["/estudo-magneto", "/estudo-magneto.html"],
      dataScript: "/assets/study/final-data/magneto.js?v=" + VERSION
    },
    camaleoes: {
      names: ["camaleões", "camaleoes"],
      routes: ["/estudo-camaleoes", "/estudo-camaleoes.html"],
      dataScript: "/assets/study/final-data/camaleoes.js?v=" + VERSION
    },
    pitagoras: {
      names: ["pitágoras", "pitagoras", "triangulação", "triangulacao"],
      routes: ["/estudo-triangulacao", "/estudo-triangulacao.html", "/estudo-pitagoras", "/estudo-pitagoras.html"],
      dataScript: "/assets/study/final-data/pitagoras.js?v=" + VERSION
    },
    cavalos: {
      names: ["cavalo", "cavalos"],
      routes: ["/estudo-cavalos", "/estudo-cavalos.html"],
      dataScript: "/assets/study/final-data/cavalos-card.js?v=" + VERSION
    },
    eclipse: {
      names: ["eclipse zero", "eclipse", "zero"],
      routes: ["/estudo-eclipse-zero", "/estudo-eclipse-zero.html"],
      card: "/assets/study/eclipse-zero-card.svg?v=" + VERSION,
      internal: "/assets/study/eclipse-zero-module.svg?v=" + VERSION
    }
  };

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  function injectStyles() {
    if (document.getElementById("studyFinalImageStyles")) return;
    const style = document.createElement("style");
    style.id = "studyFinalImageStyles";
    style.textContent = `
      .study-module-art{aspect-ratio:16/9;overflow:hidden;background:#09030f!important}
      .study-module-art>img,.study-final-card-image{width:100%!important;height:100%!important;display:block!important;object-fit:cover!important;object-position:center!important;transform:none!important;filter:none!important}
      .study-final-infographic{position:relative;margin:20px 0 26px;padding:10px;border:1px solid rgba(196,100,255,.36);border-radius:24px;background:linear-gradient(145deg,rgba(16,5,25,.98),rgba(8,3,14,.98));box-shadow:0 24px 70px rgba(58,6,91,.28);overflow:hidden}
      .study-final-infographic button{display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in}
      .study-final-infographic img{display:block;width:100%;height:auto;max-height:none;object-fit:contain;border-radius:16px;background:#050208}
      .study-final-infographic figcaption{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 8px 3px;color:#d8cdea;font:600 12px Inter,sans-serif}
      .study-final-infographic figcaption b{color:#f0c45a}
      .strategy-hero .hero-art.study-final-hidden-art{display:none!important}
      .study-final-modal{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:rgba(2,0,5,.94);backdrop-filter:blur(12px)}
      .study-final-modal[hidden]{display:none}
      .study-final-modal img{max-width:min(1500px,96vw);max-height:90vh;object-fit:contain;border-radius:18px;box-shadow:0 28px 90px rgba(0,0,0,.7)}
      .study-final-modal button{position:fixed;right:22px;top:18px;width:44px;height:44px;border:1px solid rgba(255,255,255,.2);border-radius:14px;background:#1b0d27;color:white;font-size:28px;cursor:pointer}
      [data-theme="light"] .study-final-infographic{background:#fff;border-color:rgba(112,48,166,.22);box-shadow:0 20px 55px rgba(92,39,140,.14)}
      [data-theme="light"] .study-final-infographic figcaption{color:#5b5264}
      @media(max-width:700px){.study-final-infographic{margin:14px -4px 20px;padding:6px;border-radius:18px}.study-final-infographic img{border-radius:13px}.study-final-infographic figcaption{font-size:11px;padding:10px 7px 4px}.study-final-modal{padding:8px}.study-final-modal img{max-width:98vw;max-height:88vh}}
    `;
    document.head.appendChild(style);
  }

  function loadScript(src) {
    return new Promise(resolve => {
      if (!src) return resolve();
      const old = [...document.scripts].find(s => s.src.includes(src.split("?")[0]));
      if (old) return resolve();
      const script = document.createElement("script");
      script.src = src;
      script.onload = script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }

  async function loadBase64(url, mime = "image/webp") {
    try {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) return "";
      const data = (await response.text()).trim();
      return data ? `data:${mime};base64,${data}` : "";
    } catch (_) {
      return "";
    }
  }

  function moduleFromElement(element) {
    const text = normalize(`${element.textContent || ""} ${element.getAttribute?.("href") || ""} ${element.id || ""}`);
    return Object.entries(modules).find(([, item]) => item.names.some(name => text.includes(normalize(name))))?.[0] || "";
  }

  async function resolveAsset(key, kind) {
    const item = modules[key];
    if (!item) return "";
    if (item.dataScript) await loadScript(item.dataScript);
    const fromData = window.TURMA_STUDY_IMAGES?.[key]?.[kind];
    if (fromData) return fromData;
    if (kind === "card" && item.cardBase64) return loadBase64(item.cardBase64);
    return item[kind] || (kind === "internal" ? item.card : "");
  }

  async function applyCards() {
    const candidates = [...document.querySelectorAll(".study-module-card,article,a[href*='estudo-']")];
    const done = new Set();
    for (const candidate of candidates) {
      const key = moduleFromElement(candidate);
      if (!key || done.has(key)) continue;
      const image = candidate.querySelector(".study-module-art img,img");
      if (!image) continue;
      const src = await resolveAsset(key, "card");
      if (!src) continue;
      image.src = src;
      image.removeAttribute("srcset");
      image.loading = "eager";
      image.decoding = "async";
      image.classList.add("study-final-card-image");
      image.alt = `Capa oficial do módulo ${modules[key].names[0]}`;
      const link = candidate.matches("a") ? candidate : candidate.querySelector("a[href]");
      if (link && modules[key].routes[0]) link.href = modules[key].routes[0];
      done.add(key);
    }

    document.querySelectorAll("body *").forEach(node => {
      if (node.children.length) return;
      const value = node.textContent.trim();
      if (value === "7 módulos disponíveis") node.textContent = "8 módulos disponíveis";
      else if (value === "0/7") node.textContent = "0/8";
      else if (/^7\s*módulos?$/i.test(value)) node.textContent = value.replace("7", "8");
    });
  }

  function currentModule() {
    return Object.entries(modules).find(([, item]) => item.routes.includes(path))?.[0] || "";
  }

  function ensureModal() {
    let modal = document.getElementById("studyFinalImageModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "studyFinalImageModal";
    modal.className = "study-final-modal";
    modal.hidden = true;
    modal.innerHTML = '<button type="button" aria-label="Fechar">×</button><img alt="Arte ampliada do módulo">';
    modal.addEventListener("click", event => {
      if (event.target === modal || event.target.closest("button")) modal.hidden = true;
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") modal.hidden = true; });
    document.body.appendChild(modal);
    return modal;
  }

  async function applyInternal() {
    const key = currentModule();
    if (!key) return;
    const src = await resolveAsset(key, "internal") || await resolveAsset(key, "card");
    if (!src) return;

    document.querySelector(".strategy-hero .hero-art")?.classList.add("study-final-hidden-art");
    document.querySelector(".study-final-infographic")?.remove();

    const figure = document.createElement("figure");
    figure.className = "study-final-infographic";
    figure.innerHTML = `<button type="button" aria-label="Ampliar arte do módulo"><img src="${src}" alt="Arte interna oficial do módulo ${modules[key].names[0]}"></button><figcaption><b>Arte oficial do módulo</b><span>Toque para ampliar</span></figcaption>`;
    const anchor = document.querySelector(".strategy-hero") || document.querySelector(".strategy-head");
    anchor?.insertAdjacentElement("afterend", figure);

    const modal = ensureModal();
    figure.querySelector("button").addEventListener("click", () => {
      modal.querySelector("img").src = src;
      modal.hidden = false;
    });
  }

  async function run() {
    injectStyles();
    if (isHome) {
      await applyCards();
      const observer = new MutationObserver(() => applyCards());
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 9000);
    } else {
      await applyInternal();
    }
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", run, { once: true })
    : run();
})();
