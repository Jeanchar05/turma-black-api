"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  let validationStarted = false;

  function installResponsiveLayer() {
    const addStyle = (src, marker) => {
      if (document.querySelector(`link[data-${marker}]`)) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = src;
      link.dataset[marker] = "1";
      document.head.appendChild(link);
    };
    const addScript = (src, marker) => {
      if (document.querySelector(`script[data-${marker}]`)) return;
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.dataset[marker] = "1";
      document.head.appendChild(script);
    };

    addStyle("/responsive-global.css?v=20260802-performance-3", "globalResponsive");
    addStyle("/platform-eight-modules-fix.css?v=20260801-eight-modules", "eightModulesFix");
    addScript("/theme-global-v2.js?v=20260802-upgrade-v6", "globalThemeV2");
    addScript("/performance-optimization.js?v=20260802-performance-3", "performanceOptimization");
    addScript("/study-platform-sync.js?v=20260801-sync-2", "studyPlatformSync");
    addScript("/platform-eight-modules-fix.js?v=20260801-eight-modules", "eightModulesFix");

    const route = (location.pathname.replace(/\/$/, "") || "/").toLowerCase();
    if (route === "/roleta-reel" || route === "/roleta-reel.html") {
      addScript("/roleta-reel-recovery.js?v=20260802-reel-recovery-1", "roletaReelRecovery");
    }
  }

  function getToken() {
    for (const key of TOKEN_KEYS) {
      try { const sessionToken = sessionStorage.getItem(key); if (sessionToken) return sessionToken; } catch (_) {}
      try { const localToken = localStorage.getItem(key); if (localToken) return localToken; } catch (_) {}
    }
    return "";
  }

  function clearSession() {
    TOKEN_KEYS.forEach((key) => {
      try { sessionStorage.removeItem(key); } catch (_) {}
      try { localStorage.removeItem(key); } catch (_) {}
    });
  }

  function revealPage(detail = {}) {
    if (!document.body) return;
    document.body.classList.add("protected-ready");
    document.body.style.setProperty("opacity", "1", "important");
    document.body.style.setProperty("visibility", "visible", "important");
    document.querySelectorAll(".dash-loading,.notes-loading,.support-loading").forEach((element) => element.remove());
    const event = new CustomEvent("turma:protected-ready", { detail });
    document.dispatchEvent(event);
    window.dispatchEvent(new CustomEvent("turma:protected-ready", { detail }));
  }

  function normalizeRole(user) {
    return String(user?.cargo || user?.tipo || "aluno").trim().toLowerCase().replaceAll("_", "-");
  }

  function hasAccess(user, required) {
    if (!required || required === "dashboard") return true;
    const permissions = user?.permissoes || user?.acessosRapidos || {};
    const role = normalizeRole(user);
    if (required === "painelAdmin") return Boolean(permissions.painelAdmin || ["dev","dono","superadmin","admin","financeiro","moderador"].includes(role));
    if (required === "painelVendas") return Boolean(permissions.painelVendas || user?.vendedor || ["dev","dono","superadmin","admin","financeiro","vendedor"].includes(role));
    if (required === "financas") return Boolean(permissions.financas || ["dev","dono","superadmin","financeiro"].includes(role));
    return Boolean(permissions[required]);
  }

  async function cleanupLegacyBrowserState() {
    const marker = "legacy-render-cleanup-v2";
    try { if (sessionStorage.getItem(marker) === "ok") return; } catch (_) {}
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(registrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.allSettled(names.map((name) => caches.delete(name)));
      }
      const legacyKeys = ["API_URL","apiUrl","apiURL","apiBase","apiBaseUrl","renderApiUrl","render_url","pushSubscription","notificationEndpoint","vapidPublicKey","serviceWorkerVersion"];
      legacyKeys.forEach((key) => {
        try { localStorage.removeItem(key); } catch (_) {}
        try { sessionStorage.removeItem(key); } catch (_) {}
      });
      try { sessionStorage.setItem(marker, "ok"); } catch (_) {}
    } catch (error) {
      console.warn("Não foi possível concluir toda a limpeza legada:", error);
    }
  }

  async function validatePage() {
    cleanupLegacyBrowserState().catch(() => {});
    const token = getToken();
    if (!token) {
      window.location.replace("/");
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${window.location.origin}/me`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: controller.signal
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
      revealPage({ user });
    } catch (error) {
      if (error?.name === "AbortError") {
        revealPage({ fallback: true });
        return;
      }
      clearSession();
      window.location.replace("/");
    } finally {
      clearTimeout(timeout);
    }
  }

  function startValidation() {
    if (validationStarted) return;
    validationStarted = true;
    validatePage();
  }

  function roleLabel(role) {
    return {dev:"Dev",dono:"Dono",superadmin:"Dono",admin:"Admin",financeiro:"Financeiro",vendedor:"Vendedor",moderador:"Moderador",suporte:"Suporte",aluno:"Aluno"}[role] || "Usuário";
  }

  function fillUser(user) {
    const name = String(user?.nome || "Usuário");
    const firstName = name.trim().split(/\s+/)[0] || "Usuário";
    const role = normalizeRole(user);
    $$('[data-user-name]').forEach((element) => { element.textContent = firstName; });
    $$('[data-user-fullname]').forEach((element) => { element.textContent = name; });
    $$('[data-user-role]').forEach((element) => { element.textContent = roleLabel(role); });
    $$('[data-logout]').forEach((button) => button.addEventListener("click", () => {
      clearSession();
      window.location.replace("/");
    }));
  }

  installResponsiveLayer();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startValidation, { once: true });
  } else {
    startValidation();
  }
})();
