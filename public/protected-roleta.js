"use strict";
(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];

  function forceVisible() {
    if (!document.body) return;
    document.body.style.setProperty("opacity", "1", "important");
    document.body.style.setProperty("visibility", "visible", "important");
  }

  function getToken() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of TOKEN_KEYS) {
        try {
          const value = storage.getItem(key);
          if (value) return value;
        } catch (_) {}
      }
    }
    return "";
  }

  function clearSession() {
    TOKEN_KEYS.forEach((key) => {
      try { sessionStorage.removeItem(key); } catch (_) {}
      try { localStorage.removeItem(key); } catch (_) {}
    });
  }

  function release(user) {
    forceVisible();
    document.body.classList.add("protected-ready");
    document.getElementById("rouletteSidebar")?.style.removeProperty("visibility");
    document.querySelector(".roulette-main")?.style.removeProperty("visibility");
    document.getElementById("rouletteLoading")?.remove();
    document.dispatchEvent(new CustomEvent("turma:roulette-ready", { detail: { user } }));
  }

  async function start() {
    forceVisible();
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
      release(data.usuario);
    } catch (_) {
      clearSession();
      location.replace("/");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();