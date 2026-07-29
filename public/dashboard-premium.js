"use strict";

const PORTRAIT_URL = "assets/hero-jean-transparent.webp?v=20260728-portrait-4";

function installPortraitStyles() {
  if (document.getElementById("dashPortraitFinalStyles")) return;
  const style = document.createElement("style");
  style.id = "dashPortraitFinalStyles";
  style.textContent = `
    .dash-hero-copy{position:relative!important;z-index:6!important;width:55%!important}
    .dash-hero-portrait-wrap{
      position:absolute!important;right:2.2%!important;bottom:0!important;z-index:4!important;
      width:39%!important;height:100%!important;display:flex!important;align-items:flex-end!important;
      justify-content:center!important;overflow:visible!important;pointer-events:none!important;
    }
    .dash-hero-portrait-wrap:before{
      content:"";position:absolute;left:50%;bottom:-46%;width:390px;height:390px;
      transform:translateX(-50%);border:3px solid rgba(159,56,255,.8);border-radius:50%;
      box-shadow:0 0 18px #8d28e8,0 0 58px rgba(156,45,246,.62),inset 0 0 42px rgba(149,44,242,.24);
    }
    .dash-hero-portrait-wrap:after{
      content:"";position:absolute;left:50%;bottom:-36%;width:320px;height:320px;
      transform:translateX(-50%);border:1px dashed rgba(255,191,53,.32);border-radius:50%;
    }
    .dash-hero-portrait{
      position:relative!important;z-index:3!important;display:block!important;width:auto!important;
      height:108%!important;max-width:100%!important;max-height:318px!important;
      object-fit:contain!important;object-position:center bottom!important;
      filter:drop-shadow(0 22px 24px rgba(0,0,0,.52)) drop-shadow(0 0 22px rgba(151,46,255,.34))!important;
      transform:translateY(4%) scale(1.03)!important;transform-origin:center bottom!important;
    }
    .dash-hero-mark{left:60%!important;opacity:.16!important}
    @media(max-width:1180px){
      .dash-hero-copy{width:57%!important}
      .dash-hero-portrait-wrap{right:-1%!important;width:42%!important}
      .dash-hero-portrait{height:105%!important;max-height:300px!important}
    }
    @media(max-width:900px){
      .dash-hero-copy{width:60%!important}
      .dash-hero-portrait-wrap{right:-4%!important;width:44%!important}
      .dash-hero-portrait{height:100%!important;max-height:285px!important}
    }
    @media(max-width:760px){
      .dash-hero{min-height:570px!important;padding-bottom:260px!important;align-items:flex-start!important}
      .dash-hero-copy{width:100%!important;text-align:left!important}
      .dash-hero-portrait-wrap{left:0!important;right:0!important;bottom:0!important;width:100%!important;height:48%!important}
      .dash-hero-portrait{height:112%!important;max-height:300px!important;transform:translateY(5%) scale(1.02)!important}
      .dash-hero-portrait-wrap:before{width:330px;height:330px;bottom:-49%}
      .dash-hero-portrait-wrap:after{width:270px;height:270px;bottom:-39%}
    }
    @media(max-width:430px){
      .dash-hero{min-height:540px!important;padding:28px 22px 245px!important}
      .dash-hero-portrait{max-height:270px!important}
      .dash-hero-portrait-wrap:before{width:290px;height:290px}
      .dash-hero-portrait-wrap:after{width:235px;height:235px}
    }
  `;
  document.head.appendChild(style);
}

function mountPortrait() {
  installPortraitStyles();
  const hero = document.querySelector(".dash-hero");
  if (!hero) return false;

  let portrait = hero.querySelector(".dash-hero-portrait");
  let wrapper = hero.querySelector(".dash-hero-portrait-wrap");

  if (!portrait) {
    const old = hero.querySelector(".dash-tiger");
    portrait = old || document.createElement("img");
    portrait.className = "dash-hero-portrait";
  }

  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.className = "dash-hero-portrait-wrap";
    hero.appendChild(wrapper);
  }

  if (portrait.parentElement !== wrapper) wrapper.appendChild(portrait);
  portrait.src = PORTRAIT_URL;
  portrait.alt = "Personagem do Primo";
  portrait.loading = "eager";
  portrait.decoding = "async";
  portrait.onerror = () => {
    portrait.src = "assets/hero-jean.webp?v=20260728-fallback";
  };
  return true;
}

function initializePortrait() {
  if (mountPortrait()) return;
  const observer = new MutationObserver(() => {
    if (mountPortrait()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 8000);
}

const releaseDashboard = () => setTimeout(() => {
  initializePortrait();
  document.body?.classList.add("neo-ready");
}, 60);

const preload = new Image();
preload.src = PORTRAIT_URL;

Promise.all([
  import("./dashboard-neo/routes.js?v=20260728-clean-2"),
  import("./dashboard-neo/app.js?v=20260728-neo-5")
])
  .then(() => document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", releaseDashboard, { once: true })
    : releaseDashboard())
  .catch((error) => {
    console.error("Falha ao iniciar o dashboard:", error);
    initializePortrait();
    document.body?.classList.add("neo-ready");
    const loading = document.getElementById("dashLoading");
    if (loading) loading.remove();
  });
