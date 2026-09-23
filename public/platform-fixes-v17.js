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
  const HERO_ART = Object.freeze({
    dark: "/assets/login/primo-login-dark-v34.webp?v=20260923-v17",
    light: "/assets/login/primo-login-light-v34.webp?v=20260923-v17"
  });
  const TOOL_ART = Object.freeze({
    gemeos: { dark: "/assets/modules-v4/gemeos-dark.webp", light: "/assets/modules-v4/gemeos-light.webp" },
    pitagoras: { dark: "/assets/modules-v4/pitagoras-dark.webp", light: "/assets/modules-v4/pitagoras-light.webp" },
    reel: { dark: "/assets/roulette/tools/reel-dark.svg?v=20260923-v17", light: "/assets/roulette/tools/reel-light.svg?v=20260923-v17" }
  });
  const EXAM_ART = Object.freeze({
    daily: { dark: "/assets/exams/daily-final-dark.svg?v=20260923-v17", light: "/assets/exams/daily-final-light.svg?v=20260923-v17" },
    weekly: { dark: "/assets/exams/weekly-final-dark.svg?v=20260923-v17", light: "/assets/exams/weekly-final-light.svg?v=20260923-v17" },
    primo: { dark: "/assets/exams/primo-final-dark.svg?v=20260923-v17", light: "/assets/exams/primo-final-light.svg?v=20260923-v17" }
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

  function installLoginArtwork() {
    if (!["/", "/index", "/index.html"].includes(route())) return;
    const product = $(".login-v30-product");
    if (!product || $("#loginPrimoArtwork")) return;
    const art = document.createElement("figure");
    art.className = "login-v34-art";
    art.innerHTML = `<picture><source media="(prefers-color-scheme: light)" srcset="${HERO_ART.light}"><img id="loginPrimoArtwork" src="${HERO_ART.dark}" alt="Turma do Primo — ambiente de roleta" fetchpriority="high"></picture>`;
    product.replaceWith(art);
    if (!$("#loginV34ArtStyle")) {
      const style = document.createElement("style");
      style.id = "loginV34ArtStyle";
      style.textContent = `.login-v34-art{position:relative;margin:30px 0 0;width:min(920px,100%);aspect-ratio:16/9;border-radius:28px;overflow:hidden;border:1px solid rgba(216,121,255,.18);box-shadow:0 34px 90px rgba(0,0,0,.42)}.login-v34-art img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}.login-v34-art:after{content:"";position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}@media(max-width:900px){.login-v34-art{margin-top:20px;border-radius:20px}}`;
      document.head.appendChild(style);
    }
  }

  function syncRouletteMedia() {
    if (route() !== "/roleta") return;
    const current = theme();
    const main = $(".roulette-main-photo img");
    if (main) { main.src = HERO_ART[current]; main.alt = "Turma do Primo — Roleta Operacional"; main.style.objectFit = "cover"; }
    $$(".roulette-casino-card .roulette-card-art img").forEach((img, index) => {
      img.src = HERO_ART[current];
      img.alt = "Turma do Primo — mesa de roleta";
      img.style.objectFit = "cover";
      img.style.objectPosition = index % 2 ? "42% center" : "32% center";
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

  function syncExamMedia() {
    if (route() !== "/provas") return;
    const current = theme();
    const labels = { daily: "PROVA DIÁRIA", weekly: "PROVA SEMANAL", primo: "DESAFIO DO PRIMO" };
    Object.entries(labels).forEach(([type, text]) => {
      const card = $(`[data-exam-type="${type}"]`);
      if (!card) return;
      const badge = $(".exam-art .exam-badge", card);
      if (badge) badge.textContent = text;
      const img = $(".exam-art img", card);
      if (img) {
        img.src = EXAM_ART[type][current];
        img.alt = text;
        img.style.width = "100%";
        img.style.aspectRatio = "16/9";
        img.style.objectFit = "cover";
        img.style.display = "block";
      }
    });
  }

  function fixExamWorkspace() {
    if (route() !== "/provas") return;
    const workspace = $("#examWorkspace");
    if (!workspace) return;
    const reveal = () => {
      if (workspace.childElementCount > 0 || workspace.textContent.trim()) {
        workspace.hidden = false;
        workspace.removeAttribute("hidden");
        workspace.setAttribute("aria-hidden", "false");
        Object.assign(workspace.style, { display: "block", visibility: "visible", opacity: "1", minHeight: "240px", position: "relative", zIndex: "2" });
        const grid = $(".exam-grid"); if (grid) grid.hidden = true;
        const note = $(".exam-note"); if (note) note.hidden = true;
      }
    };
    new MutationObserver(() => { reveal(); }).observe(workspace, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "aria-hidden", "style"] });
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-exam-locked], [data-evolution-exam-type]")) return;
      [150, 350, 700, 1200].forEach((delay, index) => setTimeout(() => {
        reveal();
        if (index === 1 && !workspace.hidden && workspace.childElementCount) workspace.scrollIntoView({ behavior: "smooth", block: "start" });
      }, delay));
    }, true);
  }

  function syncTheme() {
    syncRouletteMedia();
    syncExamMedia();
  }

  function init() {
    syncPlanPrices();
    installLoginArtwork();
    syncRouletteMedia();
    syncExamMedia();
    fixExamWorkspace();
    window.addEventListener("turma:theme-change", syncTheme);
    new MutationObserver((records) => {
      if (records.some((record) => record.attributeName === "data-theme")) syncTheme();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
