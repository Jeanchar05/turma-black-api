"use strict";
(() => {
  if (window.__TURMA_WORKSPACE_V8__) return;
  window.__TURMA_WORKSPACE_V8__ = true;
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const getToken = () => {
    for (const storage of [sessionStorage, localStorage]) for (const key of TOKEN_KEYS) {
      try { const value = storage.getItem(key); if (value) return value; } catch (_) {}
    }
    return "";
  };
  const systemTheme = () => matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  const resolvedTheme = () => document.documentElement.dataset.theme === "light" ? "light" : "dark";
  function applyTheme(theme, persist = true) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#f3f1f7" : "#0b0b11");
    const use = $("studyTheme")?.querySelector("use");
    if (use) use.setAttribute("href", `/assets/dashboard-icons.svg#${next === "dark" ? "i-moon" : "i-sun"}`);
    $("studyTheme")?.setAttribute("aria-label", next === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
    if (persist) {
      try { localStorage.setItem("turma.workspace.theme", next); } catch (_) {}
      const token = getToken();
      if (token) fetch("/dashboard-premium/preferencias", { method:"PUT", headers:{Accept:"application/json",Authorization:`Bearer ${token}`,"Content-Type":"application/json"}, body:JSON.stringify({tema:next}), cache:"no-store" }).catch(()=>{});
    }
    window.dispatchEvent(new CustomEvent("turma:theme-change", { detail:{ theme: next } }));
  }
  function syncProfileTheme(value) {
    const preference = String(value || "dark");
    const next = preference === "system" ? systemTheme() : (preference === "light" ? "light" : "dark");
    try {
      if (preference === "system") localStorage.removeItem("turma.workspace.theme");
      else localStorage.setItem("turma.workspace.theme", next);
    } catch (_) {}
    applyTheme(next, false);
  }
  function closeMenu(restore = false) {
    const sidebar = $("studySidebar"), menu = $("studyMenu"), backdrop = $("studyBackdrop"), shell = $("studyShell"), dock = $("studyDock");
    sidebar?.classList.remove("is-open");
    menu?.setAttribute("aria-expanded", "false");
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove("menu-open");
    if (shell) shell.inert = false;
    if (dock) dock.inert = false;
    if (sidebar) sidebar.inert = matchMedia("(max-width:900px)").matches;
    if (restore) menu?.focus();
  }
  function openMenu() {
    const sidebar = $("studySidebar"), menu = $("studyMenu"), backdrop = $("studyBackdrop"), shell = $("studyShell"), dock = $("studyDock");
    if (!sidebar) return;
    sidebar.inert = false;
    sidebar.classList.add("is-open");
    menu?.setAttribute("aria-expanded", "true");
    if (backdrop) backdrop.hidden = false;
    document.body.classList.add("menu-open");
    if (shell) shell.inert = true;
    if (dock) dock.inert = true;
    sidebar.querySelector("a,button")?.focus();
  }
  async function loadAccount() {
    const token = getToken(); if (!token) return;
    try {
      const response = await fetch("/dashboard-premium/home", { headers:{Accept:"application/json",Authorization:`Bearer ${token}`}, cache:"no-store" });
      const data = await response.json(); if (!response.ok) return;
      const user = data.usuario || {}, name = String(user.nome || "Aluno").trim(), first = name.split(/\s+/)[0] || "Aluno", initial = first.charAt(0).toUpperCase();
      $$('[data-workspace-name]').forEach(el => el.textContent = first);
      $$('[data-workspace-avatar]').forEach(el => { el.textContent = user.foto ? "" : initial; el.style.backgroundImage = user.foto ? `url("${String(user.foto).replaceAll('"','%22')}")` : ""; });
      $$('[data-workspace-plan]').forEach(el => el.textContent = data.plano?.rotulo || "Meu perfil");
      const preferred = data.preferencias?.tema;
      let localTheme = "";
      try { localTheme = localStorage.getItem("turma.workspace.theme") || ""; } catch (_) {}
      if (!localTheme && ["dark","light","system"].includes(preferred)) syncProfileTheme(preferred);
    } catch (_) {}
  }
  function logout() {
    const token = getToken();
    if (token) fetch("/logout", { method:"POST", headers:{Authorization:`Bearer ${token}`}, keepalive:true }).catch(()=>{});
    TOKEN_KEYS.forEach(key => { try { sessionStorage.removeItem(key); localStorage.removeItem(key); } catch (_) {} });
    location.replace("/");
  }
  function init() {
    let theme = "dark";
    try { theme = localStorage.getItem("turma.workspace.theme") || document.documentElement.dataset.theme || "dark"; } catch (_) {}
    applyTheme(theme, false);
    const pageOwnsShell = document.body?.dataset.workspaceController === "page";
    if (!pageOwnsShell) {
      $("studyMenu")?.addEventListener("click", openMenu);
      $("studyCloseMenu")?.addEventListener("click", () => closeMenu(true));
      $("studyBackdrop")?.addEventListener("click", () => closeMenu(true));
      $("studyTheme")?.addEventListener("click", () => applyTheme(resolvedTheme() === "dark" ? "light" : "dark"));
      $("studyLogout")?.addEventListener("click", logout);
      matchMedia("(max-width:900px)").addEventListener?.("change", () => closeMenu());
      document.addEventListener("keydown", event => { if (event.key === "Escape" && $("studySidebar")?.classList.contains("is-open")) closeMenu(true); });
      closeMenu();
    }
    document.addEventListener("click", event => {
      const choice = event.target.closest?.("[data-set-theme]");
      if (choice) syncProfileTheme(choice.dataset.setTheme);
    });
    addEventListener("storage", event => {
      if (event.key === "turma.workspace.theme" && event.newValue) applyTheme(event.newValue, false);
    });
    matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => {
      if (document.querySelector('[data-set-theme="system"].active')) syncProfileTheme("system");
    });
    loadAccount();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true }); else init();
})();