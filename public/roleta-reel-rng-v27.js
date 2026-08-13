"use strict";
(() => {
  if (window.__TURMA_REEL_UNBIASED_RNG_V27__) return;
  window.__TURMA_REEL_UNBIASED_RNG_V27__ = true;

  const secureRandom = () => {
    try {
      if (window.crypto?.getRandomValues) {
        const value = new Uint32Array(1);
        window.crypto.getRandomValues(value);
        return value[0] / 4294967296;
      }
    } catch (_) {}
    return Number((Date.now() % 1000000) / 1000000) || 0.5;
  };

  function selectedCount() {
    try {
      const selected = window.TurmaRace?.getSelectedNumbers?.();
      return Array.isArray(selected) ? selected.length : 0;
    } catch (_) {
      return 0;
    }
  }

  function install() {
    const button = document.getElementById("reelSpin");
    if (!button || button.dataset.unbiasedRngV27 === "1") return;
    button.dataset.unbiasedRngV27 = "1";

    button.addEventListener("click", () => {
      const nativeRandom = Math.random;
      const hasRaceSelection = selectedCount() > 0;
      let calls = 0;

      Math.random = () => {
        calls += 1;
        // O motor antigo usa a primeira chamada para decidir se a Race influencia o giro.
        // Forçar o ramo aleatório remove essa influência; as chamadas seguintes são uniformes.
        if (hasRaceSelection && calls === 1) return 0.99;
        return secureRandom();
      };

      queueMicrotask(() => {
        Math.random = nativeRandom;
      });
    }, true);

    window.addEventListener("turma:roulette-result", event => {
      if (event?.detail?.source !== "roleta-reel") return;
      const mode = document.getElementById("reelEngineMode");
      if (mode) mode.textContent = "Aleatório uniforme";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
