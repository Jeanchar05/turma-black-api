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
})();
