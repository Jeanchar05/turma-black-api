"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function installResponsiveLayer() {
    if (!document.querySelector('link[data-global-responsive]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/responsive-global.css?v=20260802-performance-1";
      link.dataset.globalResponsive = "true";
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-eight-modules-fix]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/platform-eight-modules-fix.css?v=20260801-eight-modules";
      link.dataset.eightModulesFix = "1";
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-performance-optimization]')) {
      const script = document.createElement("script");
      script.src = "/performance-optimization.js?v=20260802-performance-1";
      script.defer = true;
      script.dataset.performanceOptimization = "1";
      document.head.appendChild(script);
    }
    if (!document.querySelector('script[data-study-platform-sync]')) {
      const script = document.createElement("script");
      script.src = "/study-platform-sync.js?v=20260801-sync-2";
      script.defer = true;
      script.dataset.studyPlatformSync = "1";
      document.head.appendChild(script);
    }
    if (!document.querySelector('script[data-eight-modules-fix]')) {
      const script = document.createElement("script");
      script.src = "/platform-eight-modules-fix.js?v=20260801-eight-modules";
      script.defer = true;
      script.dataset.eightModulesFix = "1";
      document.head.appendChild(script);
    }
  }

  installResponsiveLayer();
  document.addEventListener("DOMContentLoaded", validatePage, { once: true });

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
      legacyKeys.forEach((key) => { try { localStorage.removeItem(key); } catch (_) {} try { sessionStorage.removeItem(key); } catch (_) {} });
      try { sessionStorage.setItem(marker, "ok"); } catch (_) {}
    } catch (error) { console.warn("Não foi possível concluir toda a limpeza legada:", error); }
  }

  function getToken() {
    for (const key of TOKEN_KEYS) {
      try { const sessionToken = sessionStorage.getItem(key); if (sessionToken) return sessionToken; } catch (_) {}
      try { const localToken = localStorage.getItem(key); if (localToken) return localToken; } catch (_) {}
    }
    return "";
  }
  function clearSession() { TOKEN_KEYS.forEach((key) => { try { sessionStorage.removeItem(key); } catch (_) {} try { localStorage.removeItem(key); } catch (_) {} }); }
  function normalizeRole(user) { return String(user?.cargo || user?.tipo || "aluno").trim().toLowerCase().replaceAll("_", "-"); }
  function hasAccess(user, required) {
    if (!required || required === "dashboard") return true;
    const permissions = user?.permissoes || user?.acessosRapidos || {};
    const role = normalizeRole(user);
    if (required === "painelAdmin") return Boolean(permissions.painelAdmin || ["dev","dono","superadmin","admin","financeiro","moderador"].includes(role));
    if (required === "painelVendas") return Boolean(permissions.painelVendas || user?.vendedor || ["dev","dono","superadmin","admin","financeiro","vendedor"].includes(role));
    if (required === "financas") return Boolean(permissions.financas || ["dev","dono","superadmin","financeiro"].includes(role));
    return Boolean(permissions[required]);
  }
  async function validatePage() {
    cleanupLegacyBrowserState().catch(() => {});
    const token = getToken();
    if (!token) { window.location.replace("/"); return; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${window.location.origin}/me`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.usuario) throw new Error(data?.erro || "Sessão inválida.");
      const user = data.usuario;
      const required = document.body.dataset.requiredAccess || "dashboard";
      if (!hasAccess(user, required)) { window.location.replace("/dashboard"); return; }
      fillUser(user);
      document.body.classList.add("protected-ready");
      document.dispatchEvent(new CustomEvent("turma:protected-ready", { detail: { user } }));
    } catch (error) {
      if (error?.name === "AbortError") {
        document.body.classList.add("protected-ready");
        document.querySelectorAll(".dash-loading,.notes-loading,.support-loading").forEach((element) => element.remove());
        return;
      }
      clearSession();
      window.location.replace("/");
    } finally {
      clearTimeout(timeout);
    }
  }
  function roleLabel(role) { return {dev:"Dev",dono:"Dono",superadmin:"Dono",admin:"Admin",financeiro:"Financeiro",vendedor:"Vendedor",moderador:"Moderador",suporte:"Suporte",aluno:"Aluno"}[role] || "Usuário"; }
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