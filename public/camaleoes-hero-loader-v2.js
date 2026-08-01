"use strict";
(() => {
  const SOURCES = [
    "https://raw.githubusercontent.com/Jeanchar05/turma-black-api/main/public/assets/study/camaleoes-interno-exato-v2.base64",
    "/assets/study/camaleoes-interno-exato-v2.base64?v=20260801-hero-final-4"
  ];

  function decodeBase64(base64) {
    const clean = String(base64 || "").replace(/\s+/g, "");
    if (!clean.startsWith("UklG")) throw new Error("Payload WebP inválido");
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: "image/webp" });
  }

  async function getPayload() {
    let lastError = null;
    for (const source of SOURCES) {
      try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = (await response.text()).trim();
        if (!text.startsWith("UklG")) throw new Error("Conteúdo inválido");
        return text;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Não foi possível carregar a arte");
  }

  async function mountHero() {
    const root = document.getElementById("camHeroMedia");
    if (!root) return;

    root.innerHTML = '<div class="cam-hero-loading"><span></span><small>Carregando arte oficial…</small></div>';

    try {
      const payload = await getPayload();
      const objectUrl = URL.createObjectURL(decodeBase64(payload));
      const image = new Image();
      image.className = "cam-official-hero-image";
      image.alt = "Arte oficial do módulo Camaleões";
      image.decoding = "async";
      image.onload = () => {
        root.replaceChildren(image);
        root.classList.add("is-ready");
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        root.innerHTML = '<div class="cam-hero-error"><strong>Camaleões</strong><small>Não foi possível decodificar a arte.</small></div>';
      };
      image.src = objectUrl;
    } catch (error) {
      console.error("Erro ao carregar a arte oficial de Camaleões:", error);
      root.innerHTML = '<div class="cam-hero-error"><strong>Camaleões</strong><small>Falha ao carregar a imagem oficial.</small></div>';
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountHero, { once: true });
  } else {
    mountHero();
  }
})();
