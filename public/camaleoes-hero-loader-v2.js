"use strict";
(() => {
  const PAYLOAD = "/assets/study/camaleoes-interno-exato-v2.base64?v=20260801-hero-final-2";

  function base64ToBlobUrl(base64, mime) {
    const clean = base64.replace(/\s+/g, "");
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }

  async function mountHero() {
    const root = document.getElementById("camHeroMedia");
    if (!root) return;

    root.innerHTML = '<div class="cam-hero-loading"><span></span><small>Carregando arte oficial…</small></div>';

    try {
      const response = await fetch(PAYLOAD, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const base64 = (await response.text()).trim();
      if (!base64.startsWith("UklG")) throw new Error("Payload WebP inválido");

      const objectUrl = base64ToBlobUrl(base64, "image/webp");
      const image = new Image();
      image.className = "cam-official-hero-image";
      image.alt = "Arte oficial do módulo Camaleões";
      image.decoding = "async";
      image.onload = () => {
        root.replaceChildren(image);
        root.classList.add("is-ready");
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        throw new Error("Falha ao decodificar WebP");
      };
      image.src = objectUrl;
    } catch (error) {
      console.error("Erro ao carregar a arte oficial de Camaleões:", error);
      root.innerHTML = '<div class="cam-hero-error"><strong>Camaleões</strong><small>Atualize a página para carregar a arte.</small></div>';
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountHero, { once: true });
  } else {
    mountHero();
  }
})();
