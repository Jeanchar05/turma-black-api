"use strict";
(() => {
  if (window.__TURMA_ROULETTE_POLISH_V12__) return;
  window.__TURMA_ROULETTE_POLISH_V12__ = true;
  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  if (route() !== "/roleta") return;

  const AFFILIATE = "https://go.aff.esportiva.bet/bhotuu7q";
  const theme = () => document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function applyHero() {
    const image = $(".roulette-hero-image img");
    if (!image) return;
    image.src = `/assets/roulette/v12/hero-${theme()}.webp?v=20260922-v12`;
    image.alt = "Roleta Operacional — Turma do Primo";
    image.removeAttribute("onerror");
    image.onerror = null;
  }

  function applyAffiliate() {
    const main = $("#esportivaAccess");
    if (main) {
      main.href = AFFILIATE;
      main.textContent = "Acessar Esportiva";
      const arrow = document.createElement("b");
      arrow.textContent = " ↗";
      main.appendChild(arrow);
    }
    const platform = $(".roulette-panel-head-new > a");
    if (platform) {
      platform.href = AFFILIATE;
      platform.target = "_blank";
      platform.rel = "noopener sponsored";
    }
  }

  function applyQuickTools() {
    const keys = ["reel", "gemeos", "pitagoras"];
    const tools = $$(".roulette-tools-panel .roulette-tool-card-new");
    tools.slice(3).forEach((tool) => tool.remove());
    tools.slice(0, 3).forEach((tool, index) => {
      const image = $("img", tool);
      const key = keys[index];
      if (!image || !key) return;
      image.src = `/assets/roulette/tools/${key}-${theme()}.svg?v=20260922-v12`;
      image.removeAttribute("onerror");
      image.onerror = null;
    });
  }

  function applyLabels() {
    const title = $(".roulette-tools-panel h2");
    const description = $(".roulette-tools-panel header p");
    if (title) title.textContent = "Ferramentas rápidas";
    if (description) description.textContent = "Três atalhos úteis para complementar sua prática sem poluir a tela.";
  }

  function apply() {
    applyHero();
    applyAffiliate();
    applyQuickTools();
    applyLabels();
  }

  new MutationObserver((records) => {
    if (records.some((record) => record.attributeName === "data-theme")) apply();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener("turma:theme-change", apply);
  document.addEventListener("turma:protected-ready", apply);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
  else apply();
})();
