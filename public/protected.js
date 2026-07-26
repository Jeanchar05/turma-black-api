"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  document.addEventListener("DOMContentLoaded", validatePage, { once: true });

  function getToken() {
    for (const key of TOKEN_KEYS) {
      try {
        const token = sessionStorage.getItem(key);
        if (token) return token;
      } catch (_) {}
    }
    return "";
  }

  function clearSession() {
    TOKEN_KEYS.forEach((key) => {
      try { sessionStorage.removeItem(key); } catch (_) {}
    });
  }

  function normalizeRole(user) {
    return String(user?.cargo || user?.tipo || "aluno")
      .trim()
      .toLowerCase()
      .replaceAll("_", "-");
  }

  function hasAccess(user, required) {
    if (!required || required === "dashboard") return true;

    const permissions = user?.permissoes || user?.acessosRapidos || {};
    const role = normalizeRole(user);

    if (required === "painelAdmin") {
      return Boolean(
        permissions.painelAdmin ||
        ["dev", "dono", "superadmin", "admin", "financeiro", "moderador"].includes(role)
      );
    }

    if (required === "painelVendas") {
      return Boolean(
        permissions.painelVendas ||
        user?.vendedor ||
        ["dev", "dono", "superadmin", "admin", "financeiro", "vendedor"].includes(role)
      );
    }

    if (required === "financas") {
      return Boolean(
        permissions.financas ||
        ["dev", "dono", "superadmin", "financeiro"].includes(role)
      );
    }

    return Boolean(permissions[required]);
  }

  async function validatePage() {
    const token = getToken();

    if (!token) {
      window.location.replace("index.html");
      return;
    }

    try {
      const response = await fetch(`${window.location.origin}/me`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.usuario) {
        throw new Error(data?.erro || "Sessão inválida.");
      }

      const user = data.usuario;
      const required = document.body.dataset.requiredAccess || "dashboard";

      if (!hasAccess(user, required)) {
        window.location.replace("dashboard.html");
        return;
      }

      fillUser(user);
      document.body.classList.add("protected-ready");
    } catch (_) {
      clearSession();
      window.location.replace("index.html");
    }
  }

  function roleLabel(role) {
    const labels = {
      dev: "Dev",
      dono: "Dono",
      superadmin: "Dono",
      admin: "Admin",
      financeiro: "Financeiro",
      vendedor: "Vendedor",
      moderador: "Moderador",
      suporte: "Suporte",
      aluno: "Aluno"
    };
    return labels[role] || "Usuário";
  }

  function fillUser(user) {
    const name = String(user?.nome || "Usuário");
    const firstName = name.trim().split(/\s+/)[0] || "Usuário";
    const role = normalizeRole(user);

    $$('[data-user-name]').forEach((element) => { element.textContent = firstName; });
    $$('[data-user-fullname]').forEach((element) => { element.textContent = name; });
    $$('[data-user-role]').forEach((element) => { element.textContent = roleLabel(role); });

    $$('[data-logout]').forEach((button) => {
      button.addEventListener("click", () => {
        clearSession();
        window.location.replace("index.html");
      });
    });
  }
})();
