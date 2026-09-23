"use strict";
(() => {
  if (window.TurmaNavigation) return;
  const original = new URL(location.href);
  const saved = history.state?.turmaPage;
  const kind = performance.getEntriesByType("navigation")[0]?.type;
  if (original.pathname === "/" && saved && saved !== "/" && ["reload", "back_forward"].includes(kind)) {
    try {
      const restored = new URL(saved, location.origin);
      if (restored.origin === location.origin && /^\/[a-z0-9-]+$/i.test(restored.pathname)) {
        location.replace(restored.pathname + restored.search + restored.hash);
        return;
      }
    } catch (_) {}
  }
  let current = original;
  const replace = history.replaceState.bind(history), push = history.pushState.bind(history);
  const route = () => current.pathname + current.search + current.hash;
  window.TurmaNavigation = Object.freeze({ get pathname(){ return current.pathname; }, get search(){ return current.search; }, get hash(){ return current.hash; } });
  function update(method, data, title, url) {
    const next = url == null ? current : new URL(String(url), current.href);
    if (next.origin !== location.origin) throw new DOMException("A navegação deve permanecer no mesmo site.", "SecurityError");
    current = next;
    return method({ ...(data && typeof data === "object" ? data : {}), turmaPage: route() }, title, "/");
  }
  history.replaceState = (data, title, url) => update(replace, data, title, url);
  history.pushState = (data, title, url) => update(push, data, title, url);
  replace({ ...history.state, turmaPage: route() }, "", "/");
  window.addEventListener("hashchange", () => { if (location.hash) current.hash = location.hash; replace({ ...history.state, turmaPage: route() }, "", "/"); });
  window.addEventListener("popstate", (event) => {
    if (!event.state?.turmaPage) return;
    const next = new URL(event.state.turmaPage, location.origin);
    if (next.origin !== location.origin) return;
    if (next.pathname !== current.pathname) { location.replace(next.pathname + next.search + next.hash); return; }
    const previousHash = current.hash; current = next;
    if (previousHash !== current.hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  });

  function loadStyle(href, key) {
    if (typeof document === "undefined") return;
    if (document.querySelector(`link[data-turma-runtime="${key}"]`)) return;
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = href; link.dataset.turmaRuntime = key; document.head.appendChild(link);
  }
  function loadScript(src, key) {
    if (typeof document === "undefined") return;
    if (document.querySelector(`script[data-turma-runtime="${key}"]`)) return;
    const script = document.createElement("script"); script.src = src; script.defer = true; script.dataset.turmaRuntime = key; document.head.appendChild(script);
  }
  function loadRuntime() {
    if (typeof document === "undefined") return;
    const path = current.pathname.toLowerCase();
    loadScript("/platform-fixes-v17.js?v=20260923-v18", "platform-fixes-v17");
    const admin = ["/admin", "/painel-admin"].includes(path);
    const student = ["/dashboard", "/notas", "/estudo", "/modulos", "/gestao", "/suporte", "/perfil", "/roleta", "/roleta-real", "/provas", "/favoritos", "/notificacoes"].includes(path) || path.startsWith("/estudo-");
    if (!admin && !student) return;
    if (admin) {
      loadStyle("/admin-support-v7.css?v=20260922-final", "admin-support-css");
      loadScript("/admin-support-v7.js?v=20260922-final", "admin-support-js");
    }
    if (!student) return;
    loadScript("/dashboard-notifications-live.js?v=20260923-v18", "student-notifications-js");
    loadScript("/student-nav-standard-v9.js?v=20260922-final", "student-nav-js");
    loadStyle("/student-evolution-v6.css?v=20260923-v18", "evolution-css");
    loadScript("/student-evolution-v6.js?v=20260923-v18", "evolution-js");
    if (path === "/gestao") loadScript("/management-stop-entries-v18.js?v=20260923-v18", "management-stop-entries-v18");
    loadStyle("/support-float-v6.css?v=20260922-final", "support-float-css");
    loadScript("/support-float-v6.js?v=20260922-final", "support-float-js");
    loadStyle("/profile-v6.css?v=20260922-final", "profile-css");
    loadScript("/profile-v6.js?v=20260922-final", "profile-js");
    loadScript("/profile-save-guard-v6.js?v=20260922-final", "profile-save-guard-js");
    loadStyle("/favorites-v6.css?v=20260922-final", "favorites-css");
    loadScript("/favorites-v6.js?v=20260922-final", "favorites-js");
    loadScript("/activity-v6.js?v=20260922-final", "activity-js");
    loadStyle("/floating-controls-v7.css?v=20260922-final", "floating-controls-css");
    loadScript("/floating-controls-v7.js?v=20260922-final", "floating-controls-js");
  }
  loadRuntime();
})();