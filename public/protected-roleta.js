"use strict";
(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const getToken = () => {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of TOKEN_KEYS) {
        try { const value = storage.getItem(key); if (value) return value; } catch (_) {}
      }
    }
    return "";
  };
  const clearSession = () => TOKEN_KEYS.forEach((key) => {
    try { sessionStorage.removeItem(key); } catch (_) {}
    try { localStorage.removeItem(key); } catch (_) {}
  });
  const start = async () => {
    const token = getToken();
    if (!token) return location.replace("/");
    try {
      const response = await fetch(`${location.origin}/me`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.usuario) throw new Error("Sessão inválida");
      document.body.classList.add("protected-ready");
      document.dispatchEvent(new CustomEvent("turma:roulette-ready", { detail: { user: data.usuario } }));
    } catch (_) {
      clearSession();
      location.replace("/");
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();