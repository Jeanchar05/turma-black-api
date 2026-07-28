"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function installResponsiveLayer() {
    if (document.querySelector('link[data-global-responsive]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/responsive-global.css?v=20260728-responsive-1";
    link.dataset.globalResponsive = "true";
    document.head.appendChild(link);
  }

  installResponsiveLayer();
  document.addEventListener("DOMContentLoaded", validatePage, { once: true });

  async function cleanupLegacyBrowserState() {
    const marker = "legacy-render-cleanup-v1";

    try {
      if (sessionStorage.getItem(marker) === "ok") return;
    } catch (_) {}

    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(registrations.map((registration) => registration.unregister()));
      }

      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.allSettled(names.map((name) => caches.delete(name)));
      }

      const legacyKeys = [
        "API_URL", "apiUrl", "apiURL", "apiBase", "apiBaseUrl",
        "renderApiUrl", "render_url", "pushSubscription",
        "notificationEndpoint", "vapidPublicKey", "serviceWorkerVersion"
      ];

      legacyKeys.forEach((key) => {
        try { localStorage.removeItem(key); } catch (_) {}
        try { sessionStorage.removeItem(key); } catch (_) {}
      });

      try { sessionStorage.setItem(marker, "ok"); } catch (_) {}
    } catch (error) {
      console.warn("Não foi possível concluir toda a limpeza legada:", error);
    }
  }

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
    cleanupLegacyBrowserState().catch(() => {});

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
        },
        cache: "no-store"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.usuario) {
        throw new Error(data?.erro || "Sessão inválida.");
      }

      const user = data.usuario;
      const required = document.body.dataset.requiredAccess || "dashboard";

      if (!hasAccess(user, required)) {
        window.location.replace("/dashboard");
        return;
      }

      fillUser(user);
      document.body.classList.add("protected-ready");
    } catch (_) {
      clearSession();
      window.location.replace("/");
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
        window.location.replace("/");
      });
    });
  }
})();
