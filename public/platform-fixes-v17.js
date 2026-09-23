"use strict";
(() => {
  if (window.__TURMA_PLATFORM_FIXES_V17__) return;
  window.__TURMA_PLATFORM_FIXES_V17__ = true;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  const theme = () => document.documentElement.dataset.theme === "light" ? "light" : "dark";

  const PLANOS = Object.freeze({
    monthly: { price: "R$ 99,90", detail: "aprox. R$ 3,33 por dia", saving: "Ideal para começar com um período menor." },
    six_months: { price: "R$ 239,99", detail: "equivale a R$ 40,00 por mês", badge: "ECONOMIZE R$ 359,41", saving: "R$ 599,40 no mensal → R$ 239,99" },
    annual: { price: "R$ 396,99", detail: "equivale a R$ 33,08 por mês", saving: "Economia de R$ 801,81 vs. mensal por 12 meses." }
  });

  function syncPlanPrices() {
    if (route() !== "/dashboard-free") return;
    Object.entries(PLANOS).forEach(([key, data]) => {
      const button = $(`[data-plan="${key}"]`);
      const card = button?.closest(".free-v10-plan");
      if (!card) return;
      const price = $(".free-v10-price strong", card);
      const detail = $(".free-v10-price small", card);
      const saving = $(".free-v10-saving", card);
      const badge = $(".free-v10-plan-badge", card);
      if (price) price.textContent = data.price;
      if (detail) detail.textContent = data.detail;
      if (saving) saving.textContent = data.saving;
      if (badge && data.badge) badge.textContent = data.badge;
    });
  }

  const ROLETA_ART = Object.freeze({
    dark: "/assets/login/primo-login-dark-v34.webp?v=20260923-v17",
    light: "/assets/login/primo-login-light-v34.webp?v=20260923-v17"
  });
  const TOOL_ART = Object.freeze({
    gemeos: { dark: "/assets/modules-v4/gemeos-dark.webp", light: "/assets/modules-v4/gemeos-light.webp" },
    pitagoras: { dark: "/assets/modules-v4/pitagoras-dark.webp", light: "/assets/modules-v4/pitagoras-light.webp" },
    reel: { dark: "/assets/roulette/tools/reel-dark.svg?v=20260923-v17", light: "/assets/roulette/tools/reel-light.svg?v=20260923-v17" }
  });

  function syncRouletteMedia() {
    if (route() !== "/roleta") return;
    const current = theme();
    const main = $(".roulette-main-photo img");
    if (main) { main.src = ROLETA_ART[current]; main.alt = "Turma do Primo — Roleta Operacional"; }
    $$(".roulette-casino-card .roulette-card-art img").forEach((img) => {
      img.src = ROLETA_ART[current];
      img.alt = "Turma do Primo — mesa de roleta";
      img.style.objectFit = "cover";
      img.style.objectPosition = "35% center";
    });
    Object.entries(TOOL_ART).forEach(([key, art]) => {
      const img = $(`.roulette-tool-card-new[data-tool="${key}"] img`);
      if (!img) return;
      img.dataset.dark = art.dark;
      img.dataset.light = art.light;
      img.src = art[current];
      img.style.objectFit = "cover";
      img.style.objectPosition = "center";
    });
  }

  function fixExamCards() {
    if (route() !== "/provas") return;
    const labels = { daily: "PROVA DIÁRIA", weekly: "PROVA SEMANAL", primo: "DESAFIO DO PRIMO" };
    Object.entries(labels).forEach(([type, text]) => {
      const card = $(`[data-exam-type="${type}"]`);
      const badge = $(".exam-art .exam-badge", card);
      if (badge) badge.textContent = text;
    });
    const workspace = $("#examWorkspace");
    if (!workspace) return;
    const reveal = () => {
      if (!workspace.hidden && workspace.childElementCount) {
        workspace.style.display = "block";
        workspace.style.visibility = "visible";
        workspace.style.opacity = "1";
        workspace.style.minHeight = "240px";
        $(".exam-grid")?.setAttribute("hidden", "");
        $(".exam-note")?.setAttribute("hidden", "");
        workspace.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    new MutationObserver(reveal).observe(workspace, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "aria-hidden"] });
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-exam-locked], [data-evolution-exam-type]")) setTimeout(reveal, 250);
    }, true);
  }

  function syncTheme() {
    syncRouletteMedia();
  }

  function init() {
    syncPlanPrices();
    syncRouletteMedia();
    fixExamCards();
    window.addEventListener("turma:theme-change", syncTheme);
    new MutationObserver((records) => {
      if (records.some((record) => record.attributeName === "data-theme")) syncTheme();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
