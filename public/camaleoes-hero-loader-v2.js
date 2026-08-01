"use strict";
(() => {
  const PAYLOADS = [
    "/assets/study/camaleoes-interno-exato-v2.base64?v=20260801-hero-fix-4",
    "/assets/study/camaleoes-card-v1.base64?v=20260801-hero-fix-4"
  ];
  const FALLBACK = "/assets/study/camaleoes-card-v1.svg?v=20260801-hero-fix-4";

  function mimeOf(base64) {
    if (base64.startsWith("UklG")) return "image/webp";
    if (base64.startsWith("/9j/")) return "image/jpeg";
    if (base64.startsWith("iVBOR")) return "image/png";
    return "";
  }

  function mountImage(root, src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.className = "cam-official-hero-image";
      image.alt = "Arte oficial do módulo Camaleões";
      image.decoding = "async";
      image.onload = () => {
        root.replaceChildren(image);
        root.classList.add("is-ready");
        resolve();
      };
      image.onerror = reject;
      image.src = src;
    });
  }

  async function loadPayload(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const base64 = (await response.text()).trim();
    const mime = mimeOf(base64);
    if (!mime) throw new Error("Payload inválido");
    return `data:${mime};base64,${base64}`;
  }

  async function mountHero() {
    const root = document.getElementById("camHeroMedia");
    if (!root) return;
    root.innerHTML = '<div class="cam-hero-loading"><span></span><small>Carregando arte…</small></div>';

    for (const payload of PAYLOADS) {
      try {
        const src = await loadPayload(payload);
        await mountImage(root, src);
        return;
      } catch (_) {}
    }

    try {
      await mountImage(root, FALLBACK);
    } catch (_) {
      root.innerHTML = '<div class="cam-hero-error"><strong>Camaleões</strong><small>Arte temporariamente indisponível.</small></div>';
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountHero, { once: true });
  } else {
    mountHero();
  }
})();
