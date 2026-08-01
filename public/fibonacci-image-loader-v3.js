"use strict";
(() => {
  async function loadFibonacciArtwork() {
    const img = document.getElementById("fibonacciHero");
    if (!img) return;
    try {
      const response = await fetch(`/assets/study/fibonacci-module-cover-v3.base64?v=20260801-fib-cover-3&t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (!response.ok) throw new Error("Imagem indisponível");
      const base64 = (await response.text()).trim();
      if (!base64.startsWith("UklG")) throw new Error("Formato inválido");
      img.src = `data:image/webp;base64,${base64}`;
    } catch (_) {
      img.src = "/assets/study/fibonacci-module.webp?v=20260731-1";
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadFibonacciArtwork, { once: true });
  } else {
    loadFibonacciArtwork();
  }
})();
