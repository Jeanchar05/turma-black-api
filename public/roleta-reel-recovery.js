"use strict";

(() => {
  if (window.__TURMA_REEL_RECOVERY__) return;
  window.__TURMA_REEL_RECOVERY__ = true;

  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  let released = false;

  function hasToken() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of TOKEN_KEYS) {
        try { if (storage.getItem(key)) return true; } catch (_) {}
      }
    }
    return false;
  }

  function style(src, key) {
    if (document.querySelector(`link[data-${key}]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = src;
    link.dataset[key] = "1";
    document.head.appendChild(link);
  }

  function forceRaceV4() {
    style("/race-tool.css?v=20260812-race-v4", "reelRaceV4Css");
    style("/race-mobile-v23.css?v=20260812-race-v23", "reelRaceMobileV23");
    if (window.TurmaRace?.version === "4.0.0") {
      window.TurmaRace.mountAll?.();
      return;
    }
    if (document.querySelector('script[data-reel-race-v4]')) return;
    const script = document.createElement("script");
    script.src = "/race-tool.js?v=20260812-race-v4";
    script.defer = true;
    script.dataset.reelRaceV4 = "1";
    script.onload = () => window.TurmaRace?.mountAll?.();
    document.head.appendChild(script);
  }

  function releasePage() {
    const body = document.body;
    if (!body) return;
    released = true;
    body.classList.add("protected-ready", "reel-ready");
    body.style.setProperty("opacity", "1", "important");
    body.style.setProperty("visibility", "visible", "important");
    document.getElementById("reelAudio")?.remove();
    const loader = document.getElementById("reelLoading");
    if (loader) {
      loader.style.opacity = "0";
      loader.style.pointerEvents = "none";
      setTimeout(() => loader.remove(), 180);
    }
    forceRaceV4();
  }

  function install() {
    forceRaceV4();
    document.addEventListener("turma:protected-ready", releasePage);
    window.addEventListener("turma:protected-ready", releasePage);
    if (document.body?.classList.contains("protected-ready")) releasePage();
    setTimeout(() => { if (!released && hasToken()) releasePage(); }, 3200);
    setTimeout(forceRaceV4, 3800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
