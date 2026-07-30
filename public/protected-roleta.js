"use strict";
(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];

  const getToken = () => {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of TOKEN_KEYS) {
        try {
          const value = storage.getItem(key);
          if (value) return value;
        } catch (_) {}
      }
    }
    return "";
  };

  const clearSession = () => TOKEN_KEYS.forEach((key) => {
    try { sessionStorage.removeItem(key); } catch (_) {}
    try { localStorage.removeItem(key); } catch (_) {}
  });

  function showBoot() {
    const body = document.body;
    if (!body) return;
    body.style.setProperty("opacity", "1", "important");
    body.style.setProperty("visibility", "visible", "important");

    const loading = document.getElementById("rouletteLoading");
    if (loading) {
      loading.style.setProperty("display", "flex", "important");
      loading.style.setProperty("opacity", "1", "important");
      loading.style.setProperty("visibility", "visible", "important");

      if (!loading.__rouletteNativeRemove) {
        loading.__rouletteNativeRemove = loading.remove.bind(loading);
        loading.remove = function () {
          this.dataset.pendingRemove = "1";
        };
      }
    }

    document.getElementById("rouletteSidebar")?.style.setProperty("visibility", "hidden");
    document.querySelector(".roulette-page .dash-main")?.style.setProperty("visibility", "hidden");
  }

  function releaseShell(user) {
    const body = document.body;
    if (!body) return;

    body.classList.add("protected-ready");
    body.style.removeProperty("opacity");
    body.style.removeProperty("visibility");
    document.getElementById("rouletteSidebar")?.style.removeProperty("visibility");
    document.querySelector(".roulette-page .dash-main")?.style.removeProperty("visibility");

    const loading = document.getElementById("rouletteLoading");
    if (loading?.__rouletteNativeRemove) {
      const nativeRemove = loading.__rouletteNativeRemove;
      const wasPending = loading.dataset.pendingRemove === "1";
      loading.remove = nativeRemove;
      delete loading.__rouletteNativeRemove;
      if (wasPending) setTimeout(() => nativeRemove(), 120);
    }

    document.dispatchEvent(new CustomEvent("turma:roulette-ready", { detail: { user } }));
  }

  const start = async () => {
    showBoot();
    const token = getToken();
    if (!token) {
      location.replace("/");
      return;
    }

    try {
      const response = await fetch(`${location.origin}/me`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.usuario) throw new Error("Sessão inválida");
      releaseShell(data.usuario);
    } catch (_) {
      clearSession();
      location.replace("/");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();