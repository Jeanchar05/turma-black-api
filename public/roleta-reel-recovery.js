"use strict";

(() => {
  if (window.__TURMA_REEL_RECOVERY__) return;
  window.__TURMA_REEL_RECOVERY__ = true;

  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  let released = false;

  function hasToken() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of TOKEN_KEYS) {
        try {
          if (storage.getItem(key)) return true;
        } catch (_) {}
      }
    }
    return false;
  }

  function releasePage() {
    const body = document.body;
    if (!body) return;

    released = true;
    body.classList.add("protected-ready", "reel-ready");
    body.style.setProperty("opacity", "1", "important");
    body.style.setProperty("visibility", "visible", "important");

    const loader = document.getElementById("reelLoading");
    if (loader) {
      loader.style.opacity = "0";
      loader.style.pointerEvents = "none";
      setTimeout(() => loader.remove(), 180);
    }

    try {
      window.TurmaRace?.mountAll?.();
    } catch (error) {
      console.warn("A Race será carregada novamente após a abertura da página:", error);
    }
  }

  function install() {
    document.addEventListener("turma:protected-ready", releasePage);
    window.addEventListener("turma:protected-ready", releasePage);

    if (document.body?.classList.contains("protected-ready")) {
      releasePage();
    }

    // Evita tela preta permanente caso algum script auxiliar falhe antes de remover o loader.
    setTimeout(() => {
      if (!released && hasToken()) releasePage();
    }, 3200);

    setTimeout(() => {
      try {
        window.TurmaRace?.mountAll?.();
      } catch (_) {}
    }, 3800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
