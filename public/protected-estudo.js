"use strict";
(() => {
  const KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  let released = false;

  function getToken() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of KEYS) {
        try {
          const value = storage.getItem(key);
          if (value) return value;
        } catch (_) {}
      }
    }
    return "";
  }

  function showPage() {
    if (!document.body) return;
    document.body.style.setProperty("opacity", "1", "important");
    document.body.style.setProperty("visibility", "visible", "important");
  }

  function release() {
    if (released) return;
    released = true;
    showPage();
    document.body?.classList.add("protected-ready");
    const loader = document.getElementById("studyLoading");
    if (loader) {
      loader.style.opacity = "0";
      loader.style.pointerEvents = "none";
      setTimeout(() => loader.remove(), 180);
    }
    document.dispatchEvent(new CustomEvent("turma:study-ready"));
  }

  function installMobileCss() {
    if (document.querySelector('link[data-study-mobile-polish]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/study-mobile-v2.css?v=20260801-study-loader-fix";
    link.dataset.studyMobilePolish = "1";
    document.head.appendChild(link);
  }

  function start() {
    showPage();
    installMobileCss();

    const token = getToken();
    if (!token) {
      window.location.replace("/");
      return;
    }

    // A página é liberada imediatamente. A validação do usuário continua sendo
    // feita pelas próprias rotas protegidas, evitando travamento e loops 405/429.
    release();
  }

  // Proteção extra: nunca deixar o usuário preso na tela de carregamento.
  setTimeout(release, 2500);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();