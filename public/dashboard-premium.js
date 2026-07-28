"use strict";

const PORTRAIT_URL = "assets/hero-jean-transparent.webp?v=20260728-portrait-3";

function installPortraitStyles() {
  if (document.getElementById("dashPortraitTransparentStyles")) return;

  const style = document.createElement("style");
  style.id = "dashPortraitTransparentStyles";
  style.textContent = `
    .dash-hero-portrait-wrap{
      right:1.5%!important;
      bottom:0!important;
      width:43%!important;
      height:100%!important;
      display:flex!important;
      align-items:flex-end!important;
      justify-content:center!important;
      overflow:visible!important;
      pointer-events:none!important;
    }

    .dash-hero-portrait.dash-hero-portrait-transparent{
      display:block!important;
      width:auto!important;
      height:112%!important;
      max-width:100%!important;
      max-height:330px!important;
      object-fit:contain!important;
      object-position:center bottom!important;
      filter:drop-shadow(0 22px 24px rgba(0,0,0,.5)) drop-shadow(0 0 24px rgba(151,46,255,.38))!important;
      transform:translateY(3%) scale(1.04)!important;
      transform-origin:center bottom!important;
    }

    @media(max-width:1280px){
      .dash-hero-portrait-wrap{right:-1%!important;width:46%!important}
      .dash-hero-portrait.dash-hero-portrait-transparent{height:108%!important;max-height:315px!important;transform:translateY(4%) scale(1.02)!important}
    }

    @media(max-width:1080px){
      .dash-hero-portrait-wrap{right:-2%!important;width:48%!important}
      .dash-hero-portrait.dash-hero-portrait-transparent{height:105%!important;max-height:310px!important;max-width:96%!important}
    }

    @media(max-width:760px){
      .dash-hero-portrait-wrap{
        right:0!important;
        left:0!important;
        bottom:48px!important;
        width:100%!important;
        height:48%!important;
      }
      .dash-hero-portrait.dash-hero-portrait-transparent{
        width:auto!important;
        height:100%!important;
        max-width:92vw!important;
        max-height:285px!important;
        object-position:center bottom!important;
        transform:translateY(7%) scale(1.05)!important;
      }
    }

    @media(max-width:430px){
      .dash-hero-portrait-wrap{bottom:62px!important;height:43%!important}
      .dash-hero-portrait.dash-hero-portrait-transparent{
        max-width:95vw!important;
        max-height:255px!important;
        transform:translateY(9%) scale(1.04)!important;
      }
    }
  `;

  document.head.appendChild(style);
}

function applyTransparentPortrait() {
  installPortraitStyles();
  const portrait = document.querySelector(".dash-hero-portrait");
  if (!portrait) return false;

  portrait.classList.add("dash-hero-portrait-transparent");
  if (!portrait.src.includes("hero-jean-transparent.webp")) {
    portrait.src = PORTRAIT_URL;
  }
  portrait.alt = "Ilustração do Primo";
  portrait.decoding = "async";
  portrait.loading = "eager";
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
  import("./dashboard-neo/routes.js?v=20260728-clean-2"),
  import("./dashboard-neo/app.js?v=20260728-neo-5")
])
  .then(() => document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", liberarDashboard, { once: true })
    : liberarDashboard())
  .catch((error) => {
    console.error("Falha ao iniciar o dashboard:", error);
    waitForPortrait();
    document.body?.classList.add("neo-ready");
    const loading = document.getElementById("dashLoading");
    if (loading) {
      loading.innerHTML = "<div><strong>Não foi possível abrir o painel</strong><span>Atualize a página e tente novamente.</span></div>";
    }
  });
