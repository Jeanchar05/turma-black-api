"use strict";
(() => {
  if (window.__TURMA_PLATFORM_FIXES_V18__) return;
  window.__TURMA_PLATFORM_FIXES_V18__ = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  const theme = () => document.documentElement.dataset.theme === "light" ? "light" : "dark";

  const PLANOS = Object.freeze({
    monthly: { price: "R$ 99,90", detail: "aprox. R$ 3,33 por dia", saving: "Ideal para começar com um período menor." },
    six_months: { price: "R$ 239,99", detail: "equivale a R$ 40,00 por mês", badge: "ECONOMIZE R$ 359,41", saving: "R$ 599,40 no mensal → R$ 239,99" },
    annual: { price: "R$ 396,99", detail: "equivale a R$ 33,08 por mês", saving: "Economia de R$ 801,81 vs. mensal por 12 meses." }
  });
  const PORTRAIT = Object.freeze({
    dark: "/assets/hero-jean-transparent.webp?v=20260923-v18",
    light: "/assets/primo-portrait-light-v5.webp?v=20260923-v18"
  });
  const TOOL_ART = Object.freeze({
    gemeos: { dark: "/assets/modules-v4/gemeos-dark.webp", light: "/assets/modules-v4/gemeos-light.webp" },
    pitagoras: { dark: "/assets/modules-v4/pitagoras-dark.webp", light: "/assets/modules-v4/pitagoras-light.webp" },
    reel: { dark: "/assets/roulette/tools/reel-dark.svg?v=20260923-v18", light: "/assets/roulette/tools/reel-light.svg?v=20260923-v18" }
  });
  const EXAM_ART = Object.freeze({
    daily: { dark: "/assets/exams/daily-final-dark.svg?v=20260923-v18", light: "/assets/exams/daily-final-light.svg?v=20260923-v18" },
    weekly: { dark: "/assets/exams/weekly-final-dark.svg?v=20260923-v18", light: "/assets/exams/weekly-final-light.svg?v=20260923-v18" },
    primo: { dark: "/assets/exams/primo-final-dark.svg?v=20260923-v18", light: "/assets/exams/primo-final-light.svg?v=20260923-v18" }
  });

  function installStyles() {
    if ($("#platformFixesV18Style")) return;
    const style = document.createElement("style");
    style.id = "platformFixesV18Style";
    style.textContent = `
      .login-v18-art{position:relative;margin:28px 0 0;width:min(920px,100%);aspect-ratio:16/9;overflow:hidden;border-radius:28px;border:1px solid rgba(200,126,255,.22);background:radial-gradient(circle at 74% 38%,rgba(168,85,247,.27),transparent 27%),repeating-conic-gradient(from -4deg at 78% 58%,rgba(255,255,255,.035) 0 4deg,transparent 4deg 12deg),linear-gradient(135deg,#13071f,#07040b 63%,#1b0b2b);box-shadow:0 34px 90px rgba(0,0,0,.42);isolation:isolate}
      .login-v18-art:before{content:"";position:absolute;width:310px;aspect-ratio:1;right:7%;top:19%;border-radius:50%;border:18px solid rgba(226,180,255,.13);box-shadow:0 0 0 10px rgba(168,85,247,.08),inset 0 0 48px rgba(168,85,247,.18);z-index:-1}
      .login-v18-art img{position:absolute;right:1%;bottom:0;width:min(55%,510px);height:96%;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 22px 35px rgba(0,0,0,.42))}
      .login-v18-copy{position:absolute;z-index:2;left:7%;top:50%;transform:translateY(-50%);max-width:43%}.login-v18-copy small{font:800 10px/1 Inter,sans-serif;letter-spacing:.18em;color:#c894ed}.login-v18-copy strong{display:block;margin-top:12px;font:900 clamp(24px,3vw,42px)/1.02 Sora,sans-serif;letter-spacing:-.05em;color:#fff}.login-v18-copy span{display:block;margin-top:12px;color:#afa5b8;font:600 11px/1.55 Inter,sans-serif}
      html[data-theme="light"] .login-v18-art{background:radial-gradient(circle at 76% 36%,rgba(147,51,234,.15),transparent 29%),repeating-conic-gradient(from -4deg at 78% 58%,rgba(91,33,182,.025) 0 4deg,transparent 4deg 12deg),linear-gradient(135deg,#fff,#f4edfb 64%,#eee4f7);border-color:rgba(126,34,206,.18);box-shadow:0 26px 70px rgba(65,35,88,.16)}html[data-theme="light"] .login-v18-copy strong{color:#281735}html[data-theme="light"] .login-v18-copy span{color:#6f6179}
      .roulette-card-art.v18-art{position:relative;isolation:isolate;overflow:hidden;background:linear-gradient(145deg,#13071f,#07040b)}.roulette-card-art.v18-art:before{content:"";position:absolute;inset:0;z-index:-2;background:radial-gradient(circle at 75% 38%,var(--v18-glow,rgba(168,85,247,.34)),transparent 34%),repeating-conic-gradient(from 0deg at 76% 54%,rgba(255,255,255,.045) 0 3deg,transparent 3deg 10deg)}.roulette-card-art.v18-art:after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(5,3,8,.96) 0%,rgba(8,4,12,.68) 44%,rgba(8,4,12,.08) 78%)}
      .roulette-casino-card[data-provider="evolution"]{--v18-glow:rgba(139,92,246,.46)}.roulette-casino-card[data-provider="playtech"]{--v18-glow:rgba(59,130,246,.38)}.roulette-casino-card[data-provider="pragmatic"]{--v18-glow:rgba(234,179,8,.34)}.roulette-casino-card[data-provider="tukias"]{--v18-glow:rgba(16,185,129,.32)}
      .roulette-card-art.v18-art img{position:absolute;right:-2%;bottom:-2%;width:54%;height:104%;object-fit:contain!important;object-position:center bottom!important;filter:drop-shadow(0 18px 24px rgba(0,0,0,.38));z-index:0}.roulette-card-art.v18-art>div{position:relative;z-index:2;max-width:56%}
      html[data-theme="light"] .roulette-card-art.v18-art{background:linear-gradient(145deg,#fff,#eee7f5)}html[data-theme="light"] .roulette-card-art.v18-art:after{background:linear-gradient(90deg,rgba(255,255,255,.96),rgba(255,255,255,.68) 48%,rgba(255,255,255,.03) 80%)}
      .real-v18-art{position:relative;margin:26px 0 12px;min-height:300px;border:1px solid rgba(190,105,255,.2);border-radius:28px;overflow:hidden;background:radial-gradient(circle at 75% 45%,rgba(168,85,247,.28),transparent 30%),repeating-conic-gradient(from 0deg at 76% 55%,rgba(255,255,255,.04) 0 4deg,transparent 4deg 11deg),linear-gradient(145deg,#140720,#07040b);box-shadow:0 28px 80px rgba(0,0,0,.34)}.real-v18-art img{position:absolute;right:2%;bottom:0;width:min(50%,470px);height:98%;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 22px 30px rgba(0,0,0,.45))}.real-v18-art div{position:absolute;left:7%;top:50%;transform:translateY(-50%);max-width:45%}.real-v18-art small{font:900 10px Inter;letter-spacing:.16em;color:#c98ff2}.real-v18-art strong{display:block;margin-top:10px;font:900 clamp(28px,4vw,52px)/.98 Sora;color:#fff;letter-spacing:-.055em}.real-v18-art span{display:block;margin-top:12px;color:#a99fb2;font:600 11px/1.55 Inter}
      html[data-theme="light"] .real-v18-art{background:radial-gradient(circle at 75% 45%,rgba(147,51,234,.15),transparent 30%),repeating-conic-gradient(from 0deg at 76% 55%,rgba(91,33,182,.025) 0 4deg,transparent 4deg 11deg),linear-gradient(145deg,#fff,#f0e8f7);border-color:rgba(126,34,206,.16);box-shadow:0 24px 64px rgba(66,35,86,.14)}html[data-theme="light"] .real-v18-art strong{color:#281735}html[data-theme="light"] .real-v18-art span{color:#716578}
      @media(max-width:760px){.login-v18-art{border-radius:20px;min-height:260px;aspect-ratio:auto}.login-v18-art img{width:58%;opacity:.82}.login-v18-copy{left:7%;max-width:52%}.login-v18-copy span{font-size:10px}.roulette-card-art.v18-art img{width:58%;opacity:.9}.real-v18-art{min-height:260px;border-radius:22px}.real-v18-art img{width:58%;right:-7%;opacity:.88}.real-v18-art div{left:7%;max-width:52%}}
    `;
    document.head.appendChild(style);
  }

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

  function currentPortrait() { return PORTRAIT[theme()]; }

  function installLoginArtwork() {
    if (!["/", "/index", "/index.html"].includes(route())) return;
    const current = $(".login-v30-product, .login-v34-art, .login-v18-art");
    if (!current) return;
    if (!current.classList.contains("login-v18-art")) {
      const art = document.createElement("figure");
      art.className = "login-v18-art";
      art.innerHTML = `<div class="login-v18-copy"><small>TURMA DO PRIMO</small><strong>Estratégia, prática e evolução.</strong><span>Uma experiência premium para acessar estudos, ferramentas e sua jornada em um só ambiente.</span></div><img id="loginPrimoArtwork" src="${currentPortrait()}" alt="Primo da Roleta" fetchpriority="high">`;
      current.replaceWith(art);
    } else {
      const img = $("img", current); if (img) img.src = currentPortrait();
    }
  }

  function syncRouletteMedia() {
    if (route() !== "/roleta") return;
    const src = currentPortrait();
    const main = $(".roulette-main-photo img");
    if (main) { main.src = src; main.alt = "Primo da Roleta"; main.style.objectFit = "contain"; }
    $$(".roulette-casino-card").forEach((card) => {
      const art = $(".roulette-card-art", card);
      const img = $(".roulette-card-art img", card);
      if (art) art.classList.add("v18-art");
      if (img) { img.src = src; img.alt = `${$("h3", card)?.textContent || "Mesa de roleta"} — Turma do Primo`; }
    });
    Object.entries(TOOL_ART).forEach(([key, assets]) => {
      const img = $(`.roulette-tool-card-new[data-tool="${key}"] img`);
      if (!img) return;
      img.dataset.dark = assets.dark;
      img.dataset.light = assets.light;
      img.src = assets[theme()];
    });
  }

  function syncExamMedia() {
    if (route() !== "/provas") return;
    const labels = { daily: "PROVA DIÁRIA", weekly: "PROVA SEMANAL", primo: "DESAFIO DO PRIMO" };
    Object.entries(labels).forEach(([type, text]) => {
      const card = $(`[data-exam-type="${type}"]`);
      if (!card) return;
      const badge = $(".exam-art .exam-badge", card);
      if (badge) badge.textContent = text;
      const img = $(".exam-art img", card);
      if (img) {
        img.src = EXAM_ART[type][theme()];
        img.alt = text;
        Object.assign(img.style, { width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" });
      }
    });
  }

  function fixExamWorkspace() {
    if (route() !== "/provas") return;
    const workspace = $("#examWorkspace");
    if (!workspace || workspace.dataset.v18Observed === "1") return;
    workspace.dataset.v18Observed = "1";
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
    new MutationObserver(reveal).observe(workspace, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "aria-hidden", "style"] });
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-exam-locked], [data-evolution-exam-type]")) return;
      [150, 350, 700, 1200].forEach((delay, index) => setTimeout(() => {
        reveal();
        if (index === 1 && !workspace.hidden && workspace.childElementCount) workspace.scrollIntoView({ behavior: "smooth", block: "start" });
      }, delay));
    }, true);
  }

  function installRealArtwork() {
    if (route() !== "/roleta-real") return;
    const welcome = $(".real-welcome");
    if (!welcome) return;
    let art = $(".real-v18-art", welcome);
    if (!art) {
      art = document.createElement("figure");
      art.className = "real-v18-art";
      art.innerHTML = `<div><small>ROLETA REAL · SIMULADOR</small><strong>Treine sua leitura.</strong><span>Prática livre, sem dinheiro real, com roda europeia e comparação de marcações.</span></div><img src="${currentPortrait()}" alt="Roleta Real — Turma do Primo">`;
      const start = $(".real-start", welcome);
      if (start) start.insertAdjacentElement("afterend", art); else welcome.appendChild(art);
    }
    const img = $("img", art); if (img) img.src = currentPortrait();
  }

  function syncAll() {
    installStyles();
    syncPlanPrices();
    installLoginArtwork();
    syncRouletteMedia();
    syncExamMedia();
    installRealArtwork();
  }

  function init() {
    syncAll();
    fixExamWorkspace();
    window.addEventListener("turma:theme-change", syncAll);
    new MutationObserver((records) => {
      if (records.some((record) => record.attributeName === "data-theme")) syncAll();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
