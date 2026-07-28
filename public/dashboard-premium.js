"use strict";

const PORTRAIT_URL = "assets/hero-jean-transparent.webp?v=20260728-portrait-2";

function installPortraitStyles() {
  if (document.getElementById("dashPortraitTransparentStyles")) return;
  const style = document.createElement("style");
  style.id = "dashPortraitTransparentStyles";
  style.textContent = `
    .dash-hero-portrait.dash-hero-portrait-transparent{
      width:auto!important;
      height:105%!important;
      max-width:min(420px,39vw)!important;
      object-fit:contain!important;
      object-position:center bottom!important;
      filter:drop-shadow(0 24px 24px rgba(0,0,0,.52)) drop-shadow(0 0 24px rgba(151,46,255,.38))!important;
      transform-origin:center bottom!important;
    }
    @media(max-width:1080px){
      .dash-hero-portrait.dash-hero-portrait-transparent{height:102%!important;max-width:min(410px,46vw)!important}
    }
    @media(max-width:760px){
      .dash-hero-portrait.dash-hero-portrait-transparent{height:102%!important;max-width:88vw!important;object-position:center bottom!important}
    }
    @media(max-width:430px){
      .dash-hero-portrait.dash-hero-portrait-transparent{height:98%!important;max-width:92vw!important}
    }
  `;
  document.head.appendChild(style);
}

function applyTransparentPortrait() {
  installPortraitStyles();
  const portrait = document.querySelector(".dash-hero-portrait");
  if (!portrait) return false;
  portrait.classList.add("dash-hero-portrait-transparent");
  if (!portrait.src.includes("hero-jean-transparent.webp")) portrait.src = PORTRAIT_URL;
  portrait.alt = "Ilustração do Primo";
  return true;
}

function waitForPortrait() {
  if (applyTransparentPortrait()) return;
  const observer = new MutationObserver(() => {
    if (applyTransparentPortrait()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 8000);
}

const liberarDashboard = () => window.setTimeout(() => {
  waitForPortrait();
  document.body?.classList.add("neo-ready");
}, 80);

const preload = new Image();
preload.src = PORTRAIT_URL;

Promise.all([
  import("./dashboard-neo/routes.js?v=20260728-clean-1"),
  import("./dashboard-neo/app.js?v=20260728-neo-4")
])
  .then(() => document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", liberarDashboard, { once: true })
    : liberarDashboard())
  .catch((error) => {
    console.error("Falha ao iniciar o dashboard:", error);
    waitForPortrait();
    document.body?.classList.add("neo-ready");
    const loading = document.getElementById("dashLoading");
    if (loading) loading.innerHTML = "<div><strong>Não foi possível abrir o painel</strong><span>Atualize a página e tente novamente.</span></div>";
  });
