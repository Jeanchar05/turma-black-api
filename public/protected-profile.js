"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  let validationStarted = false;

  function installResponsiveLayer() {
    if (document.querySelector('link[data-global-responsive]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/responsive-global.css?v=20260729-profile-session-4";
    link.dataset.globalResponsive = "true";
    document.head.appendChild(link);
  }

  function exposeLoadingState() {
    const body = document.body;
    if (!body) return;
    body.style.opacity = "1";
    body.style.visibility = "visible";
    body.classList.add("protected-booting");
  }

  function startValidation() {
    if (validationStarted) return;
    validationStarted = true;
    exposeLoadingState();
    validatePage();
  }

  installResponsiveLayer();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startValidation, { once: true });
  else startValidation();

  function getToken() {
    for (const key of TOKEN_KEYS) {
      try {
        const sessionToken = sessionStorage.getItem(key);
        if (sessionToken) return sessionToken;
      } catch (_) {}
      try {
        const localToken = localStorage.getItem(key);
        if (localToken) return localToken;
      } catch (_) {}
    }
    return "";
  }

  function clearSession() {
    TOKEN_KEYS.forEach((key) => {
      try { sessionStorage.removeItem(key); } catch (_) {}
      try { localStorage.removeItem(key); } catch (_) {}
    });
  }

  function normalizeRole(user) {
    return String(user?.cargo || user?.tipo || "aluno").trim().toLowerCase().replaceAll("_", "-");
  }

  function hasAccess(user, required) {
    if (!required || required === "dashboard") return true;
    const permissions = user?.permissoes || user?.acessosRapidos || {};
    const role = normalizeRole(user);
    if (required === "painelAdmin") return Boolean(permissions.painelAdmin || ["dev", "dono", "superadmin", "admin", "financeiro", "moderador"].includes(role));
    if (required === "painelVendas") return Boolean(permissions.painelVendas || user?.vendedor || ["dev", "dono", "superadmin", "admin", "financeiro", "vendedor"].includes(role));
    if (required === "financas") return Boolean(permissions.financas || ["dev", "dono", "superadmin", "financeiro"].includes(role));
    return Boolean(permissions[required]);
  }

  async function validatePage() {
    const token = getToken();
    if (!token) {
      window.location.replace("/");
      return;
    }

    try {
      const response = await fetch(`${window.location.origin}/me`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.usuario) throw new Error(data?.erro || "Sessão inválida.");

      const user = data.usuario;
      const required = document.body?.dataset.requiredAccess || "dashboard";
      if (!hasAccess(user, required)) {
        window.location.replace("/dashboard");
        return;
      }

      fillUser(user);
      document.body?.classList.remove("protected-booting");
      document.body?.classList.add("protected-ready");
      if (document.body) {
        document.body.style.removeProperty("opacity");
        document.body.style.removeProperty("visibility");
      }
      document.dispatchEvent(new CustomEvent("turma:protected-ready", { detail: { user } }));
    } catch (_) {
      clearSession();
      window.location.replace("/");
    }
  }

  function roleLabel(role) {
    const labels = { dev:"Dev", dono:"Dono", superadmin:"Dono", admin:"Admin", financeiro:"Financeiro", vendedor:"Vendedor", moderador:"Moderador", suporte:"Suporte", aluno:"Aluno" };
    return labels[role] || "Usuário";
  }

  function fillUser(user) {
    const name = String(user?.nome || "Usuário");
    const firstName = name.trim().split(/\s+/)[0] || "Usuário";
    const role = normalizeRole(user);
    $$('[data-user-name]').forEach((element) => { element.textContent = firstName; });
    $$('[data-user-fullname]').forEach((element) => { element.textContent = name; });
    $$('[data-user-role]').forEach((element) => { element.textContent = roleLabel(role); });
    $$('[data-logout]').forEach((button) => button.addEventListener("click", () => { clearSession(); window.location.replace("/"); }));
  }
})();