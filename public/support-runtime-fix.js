"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const token = () => {
    for (const key of TOKEN_KEYS) {
      try {
        const value = sessionStorage.getItem(key);
        if (value) return value;
      } catch (_) {}
    }
    return "";
  };

  function releaseLoading() {
    const loading = $("supportLoading");
    if (!loading) return;
    loading.style.transition = "opacity .22s ease, visibility .22s ease";
    loading.style.opacity = "0";
    loading.style.visibility = "hidden";
    loading.style.pointerEvents = "none";
    setTimeout(() => loading.remove(), 260);
  }

  function showRecoverableError(message) {
    const list = $("ticketList");
    if (!list || !/carregando/i.test(list.textContent || "")) return;
    list.innerHTML = `
      <div class="support-empty support-runtime-error">
        <strong>O atendimento demorou para responder.</strong>
        <span>${String(message || "Você já pode usar a página e tentar novamente.")}</span>
        <button type="button" id="supportRuntimeRetry">Tentar novamente</button>
      </div>`;
    $("supportRuntimeRetry")?.addEventListener("click", () => location.reload());
  }

  function boot() {
    const fastRelease = setTimeout(releaseLoading, 2200);
    const recovery = setTimeout(() => {
      releaseLoading();
      showRecoverableError("Atualize apenas os chamados pelo botão acima ou recarregue a página.");
    }, 10000);

    window.addEventListener("support:ready", () => {
      clearTimeout(fastRelease);
      clearTimeout(recovery);
      releaseLoading();
    }, { once: true });

    window.addEventListener("error", releaseLoading);
    window.addEventListener("unhandledrejection", releaseLoading);

    if (!token()) {
      clearTimeout(fastRelease);
      clearTimeout(recovery);
      releaseLoading();
      setTimeout(() => location.replace("/"), 250);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
