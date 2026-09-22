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
    } catch {}
  }
  let current = original;
  const replace = history.replaceState.bind(history);
  const push = history.pushState.bind(history);
  const route = () => current.pathname + current.search + current.hash;
  window.TurmaNavigation = Object.freeze({
    get pathname() { return current.pathname; },
    get search() { return current.search; },
    get hash() { return current.hash; }
  });
  function update(method, data, title, url) {
    const next = url == null ? current : new URL(String(url), current.href);
    if (next.origin !== location.origin) throw new DOMException("A navegação deve permanecer no mesmo site.", "SecurityError");
    current = next;
    return method({ ...(data && typeof data === "object" ? data : {}), turmaPage: route() }, title, "/");
  }
  history.replaceState = (data, title, url) => update(replace, data, title, url);
  history.pushState = (data, title, url) => update(push, data, title, url);
  replace({ ...history.state, turmaPage: route() }, "", "/");
  window.addEventListener("hashchange", () => {
    if (location.hash) current.hash = location.hash;
    replace({ ...history.state, turmaPage: route() }, "", "/");
  });
  window.addEventListener("popstate", event => {
    if (!event.state?.turmaPage) return;
    const next = new URL(event.state.turmaPage, location.origin);
    if (next.origin !== location.origin) return;
    if (next.pathname !== current.pathname) { location.replace(next.pathname + next.search + next.hash); return; }
    const previousHash = current.hash;
    current = next;
    if (previousHash !== current.hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  });

  function loadStyle(href, key) {
    if (document.querySelector(`link[data-turma-v6="${key}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.turmaV6 = key;
    document.head.appendChild(link);
  }
  function loadScript(src, key) {
    if (document.querySelector(`script[data-turma-v6="${key}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.dataset.turmaV6 = key;
    document.head.appendChild(script);
  }
  function loadEvolutionV6() {
    const path = current.pathname.toLowerCase();
    const admin = ["/admin", "/painel-admin"].includes(path);
    const student = ["/dashboard", "/notas", "/estudo", "/modulos", "/gestao", "/suporte", "/perfil", "/roleta", "/provas", "/favoritos"].includes(path) || path.startsWith("/estudo-");
    const unified = ["/notas", "/perfil", "/provas", "/gestao", "/roleta", "/suporte"].includes(path);
    if (!admin && !student) return;

    if (admin) {
      loadStyle("/admin-support-v7.css?v=20260921-1", "admin-support-v7-css");
      loadScript("/admin-support-v7.js?v=20260921-1", "admin-support-v7-js");
    }

    if (!student) return;
    loadStyle("/student-evolution-v6.css?v=20260921-6", "evolution-css");
    loadScript("/student-evolution-v6.js?v=20260921-6", "evolution-js");
    loadStyle("/support-float-v6.css?v=20260921-6", "support-float-css");
    loadStyle("/profile-v6.css?v=20260921-6", "profile-css");
    loadStyle("/favorites-v6.css?v=20260921-6", "favorites-css");
    loadStyle("/floating-controls-v7.css?v=20260921-1", "floating-controls-v7-css");
    loadScript("/support-float-v6.js?v=20260921-6", "support-float-js");
    loadScript("/profile-v6.js?v=20260921-6", "profile-js");
    loadScript("/profile-save-guard-v6.js?v=20260921-6", "profile-save-guard-js");
    loadScript("/favorites-v6.js?v=20260921-6", "favorites-js");
    loadScript("/activity-v6.js?v=20260921-6", "activity-js");
    loadScript("/floating-controls-v7.js?v=20260921-1", "floating-controls-v7-js");

    if (unified) {
      loadStyle("/study-workspace.css?v=20260921-shell-v7", "study-workspace-v7");
      loadStyle("/student-shell-v7.css?v=20260921-1", "student-shell-v7-css");
      loadScript("/student-shell-v7.js?v=20260921-1", "student-shell-v7-js");
    }
    if (path === "/gestao") {
      loadStyle("/management-v6.css?v=20260921-6", "management-css");
      loadScript("/management-v6.js?v=20260921-6", "management-js");
    }
  }
  loadEvolutionV6();
})();
