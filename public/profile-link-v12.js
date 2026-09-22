"use strict";
(() => {
  if (window.__TURMA_PROFILE_LINK_V12__) return;
  window.__TURMA_PROFILE_LINK_V12__ = true;
  const CACHE_KEY = "turma.profile.cache.v12";
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const route = () => window.TurmaNavigation?.pathname || location.pathname;

  function token() {
    for (const storage of [sessionStorage, localStorage]) for (const key of TOKEN_KEYS) {
      try { const value = storage.getItem(key); if (value) return value; } catch (_) {}
    }
    return "";
  }

  function apply(user) {
    if (!user) return;
    const full = String(user.nome || "Aluno").trim() || "Aluno";
    const first = full.split(/\s+/)[0] || "Aluno";
    const initial = first.charAt(0).toUpperCase();
    $$('[data-workspace-name],[data-user-name]').forEach((el) => { el.textContent = first; });
    $$('[data-user-fullname],[data-profile-fullname]').forEach((el) => { el.textContent = full; });
    $$('[data-workspace-avatar],[data-profile-avatar]').forEach((el) => {
      if (user.foto) {
        el.textContent = "";
        el.style.backgroundImage = `url("${String(user.foto).replaceAll('"', '%22')}")`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
      } else {
        el.textContent = initial;
        el.style.backgroundImage = "";
      }
    });
  }

  function publish(user) {
    if (!user) return;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ user, at: Date.now() })); } catch (_) {}
    apply(user);
    document.dispatchEvent(new CustomEvent("turma:profile-updated", { detail: { user } }));
  }

  async function refresh() {
    const jwt = token();
    if (!jwt) return;
    try {
      const response = await fetch("/me", { headers: { Accept: "application/json", Authorization: `Bearer ${jwt}` }, cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.usuario) publish(data.usuario);
    } catch (_) {}
  }

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached?.user) apply(cached.user);
  } catch (_) {}

  window.addEventListener("storage", (event) => {
    if (event.key !== CACHE_KEY || !event.newValue) return;
    try { apply(JSON.parse(event.newValue)?.user); } catch (_) {}
  });
  document.addEventListener("turma:profile-updated", (event) => apply(event.detail?.user));
  document.addEventListener("turma:protected-ready", (event) => publish(event.detail?.user));
  document.addEventListener("turma:phone-verified", () => setTimeout(refresh, 150));

  if (route() === "/perfil") {
    document.addEventListener("submit", (event) => {
      if (event.target?.id === "profileForm") setTimeout(refresh, 900);
    }, true);
    document.addEventListener("change", (event) => {
      if (event.target?.closest?.("#profilePhotoUploadV6")) setTimeout(refresh, 1000);
    });
  }
})();
