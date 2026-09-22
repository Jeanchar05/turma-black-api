"use strict";
(() => {
  if (window.__TURMA_STUDENT_NAV_V9__) return;
  window.__TURMA_STUDENT_NAV_V9__ = true;

  const route = () => (window.TurmaNavigation?.pathname || location.pathname || "/").replace(/\/$/, "") || "/";
  const icon = (name) => `<svg aria-hidden="true"><use href="/assets/dashboard-icons.svg#${name}"></use></svg>`;

  function currentKey() {
    const path = route().toLowerCase();
    if (path.startsWith("/estudo-")) return "estudo";
    return path.replace(/^\//, "") || "dashboard";
  }

  function ensureData() {
    if (Array.isArray(window.TurmaWorkspaceNav)) return Promise.resolve(window.TurmaWorkspaceNav);
    return new Promise((resolve) => {
      const existing = document.querySelector('script[data-workspace-nav-data]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.TurmaWorkspaceNav || []), { once: true });
        setTimeout(() => resolve(window.TurmaWorkspaceNav || []), 1200);
        return;
      }
      const script = document.createElement("script");
      script.src = "/roleta-reel-nav-data.js?v=20260922-nav-v9";
      script.dataset.workspaceNavData = "1";
      script.onload = () => resolve(window.TurmaWorkspaceNav || []);
      script.onerror = () => resolve([]);
      document.head.appendChild(script);
    });
  }

  function learnMarkup(items, active) {
    return items.map(([label, target, symbol]) => {
      const selected = target === active;
      return `<a href="/${target}"${selected ? ' class="is-active" aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span></a>`;
    }).join("");
  }

  function dashMarkup(items, active) {
    return items.map(([label, target, symbol]) => {
      const selected = target === active;
      return `<a class="dash-nav-item${selected ? " active" : ""}" href="/${target}"${selected ? ' aria-current="page"' : ""}>${icon(symbol)}<b>${label}</b></a>`;
    }).join("");
  }

  function genericMarkup(items, active) {
    return items.map(([label, target, symbol]) => {
      const selected = target === active;
      return `<a href="/${target}"${selected ? ' class="active" aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span></a>`;
    }).join("");
  }

  function syncDock(active) {
    if (route() === "/dashboard") return;
    const dock = document.querySelector(".learn-dock, .mobile-dock");
    if (!dock) return;
    const items = [
      ["Início", "dashboard", "i-home"],
      ["Estudar", "estudo", "i-book"],
      ["Notas", "notas", "i-note"],
      ["Perfil", "perfil", "i-user"],
    ];
    const html = items.map(([label, target, symbol]) => `<a href="/${target}"${target === active ? ' aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span></a>`).join("");
    if (dock.innerHTML !== html) dock.innerHTML = html;
  }

  async function render() {
    if (route() === "/dashboard") return;
    const items = await ensureData();
    if (!items.length) return;
    const active = currentKey();
    document.querySelectorAll(".learn-nav").forEach((nav) => {
      const html = learnMarkup(items, active);
      if (nav.innerHTML !== html) nav.innerHTML = html;
    });
    document.querySelectorAll(".dash-nav").forEach((nav) => {
      const html = dashMarkup(items, active);
      if (nav.innerHTML !== html) nav.innerHTML = html;
    });
    document.querySelectorAll(".support-nav,.roulette-nav").forEach((nav) => {
      const html = genericMarkup(items, active);
      if (nav.innerHTML !== html) nav.innerHTML = html;
    });
    syncDock(active);
    document.documentElement.dataset.studentNavVersion = "v9";
  }

  const boot = () => {
    render();
    setTimeout(render, 450);
    window.addEventListener("turma:protected-ready", render);
    window.addEventListener("turma:study-ready", render);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
