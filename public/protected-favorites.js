"use strict";
(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  let started = false;
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const getToken = () => {
    for (const key of TOKEN_KEYS) {
      try { const value = sessionStorage.getItem(key); if (value) return value; } catch (_) {}
      try { const value = localStorage.getItem(key); if (value) return value; } catch (_) {}
    }
    return "";
  };
  const clearSession = () => TOKEN_KEYS.forEach((key) => {
    try { sessionStorage.removeItem(key); } catch (_) {}
    try { localStorage.removeItem(key); } catch (_) {}
  });
  const normalizeRole = (user) => String(user?.cargo || user?.tipo || "aluno").trim().toLowerCase().replaceAll("_", "-");
  const roleLabel = (role) => ({ dev:"Dev", dono:"Dono", superadmin:"Dono", admin:"Admin", financeiro:"Financeiro", vendedor:"Vendedor", moderador:"Moderador", suporte:"Suporte", aluno:"Aluno" }[role] || "Usuário");
  const fillUser = (user) => {
    const name = String(user?.nome || "Usuário");
    const firstName = name.trim().split(/\s+/)[0] || "Usuário";
    const role = normalizeRole(user);
    $$('[data-user-name]').forEach((element) => { element.textContent = firstName; });
    $$('[data-user-fullname]').forEach((element) => { element.textContent = name; });
    $$('[data-user-role]').forEach((element) => { element.textContent = roleLabel(role); });
  };
  async function validate() {
    if (started) return;
    started = true;
    if (document.body) {
      document.body.style.opacity = "1";
      document.body.style.visibility = "visible";
      document.body.classList.add("protected-booting");
    }
    const token = getToken();
    if (!token) return location.replace("/");
    try {
      const response = await fetch(`${location.origin}/me`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.usuario) throw new Error("Sessão inválida.");
      fillUser(data.usuario);
      document.body?.classList.remove("protected-booting");
      document.body?.classList.add("protected-ready");
      if (document.body) {
        document.body.style.removeProperty("opacity");
        document.body.style.removeProperty("visibility");
      }
      document.dispatchEvent(new CustomEvent("turma:protected-ready", { detail: { user: data.usuario } }));
    } catch (_) {
      clearSession();
      location.replace("/");
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", validate, { once: true });
  else validate();
})();