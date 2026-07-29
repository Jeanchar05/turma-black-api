"use strict";

const DASH_PORTRAIT_URL = "assets/hero-primo-cutout.svg?v=20260729-dashboard-cutout-1";

function installDashboardPortraitStyles() {
  if (document.getElementById("dashboardPortraitFixStyles")) return;

  const style = document.createElement("style");
  style.id = "dashboardPortraitFixStyles";
  style.textContent = `
    .dash-hero{isolation:isolate!important;min-height:285px!important;overflow:hidden!important}
    .dash-hero-copy{position:relative!important;z-index:6!important;width:55%!important}
    .dash-hero-portrait-wrap{
      position:absolute!important;
      z-index:4!important;
      right:2.5%!important;
      bottom:-4px!important;
      width:39%!important;
      height:100%!important;
      display:flex!important;
      align-items:flex-end!important;
      justify-content:center!important;
      overflow:visible!important;
      pointer-events:none!important;
    }
    .dash-hero-portrait-wrap:before{
      content:"";
      position:absolute;
      z-index:0;
      left:50%;
      bottom:-62%;
      width:390px;
      height:390px;
      transform:translateX(-50%);
      border:3px solid rgba(157,54,255,.82);
      border-radius:50%;
      box-shadow:0 0 20px #8f2be9,0 0 72px rgba(157,54,255,.66),inset 0 0 42px rgba(144,43,238,.24);
    }
    .dash-hero-portrait-wrap:after{
      content:"";
      position:absolute;
      z-index:0;
      left:50%;
      bottom:-45%;
      width:320px;
      height:320px;
      transform:translateX(-50%);
      border:1px dashed rgba(243,181,47,.35);
      border-radius:50%;
    }
    .dash-hero-portrait{
      position:relative!important;
      z-index:3!important;
      display:block!important;
      width:auto!important;
      height:108%!important;
      max-width:100%!important;
      max-height:340px!important;
      margin:0!important;
      object-fit:contain!important;
      object-position:center bottom!important;
      opacity:1!important;
      visibility:visible!important;
      background:transparent!important;
      transform:translateY(3%)!important;
      animation:none!important;
      filter:drop-shadow(0 24px 26px rgba(0,0,0,.58)) drop-shadow(0 0 24px rgba(151,46,255,.34))!important;
      pointer-events:none!important;
    }
    @media(max-width:1100px){
      .dash-hero-copy{width:58%!important}
      .dash-hero-portrait-wrap{right:0!important;width:42%!important}
      .dash-hero-portrait{height:104%!important;max-height:320px!important}
    }
    @media(max-width:760px){
      .dash-hero{min-height:555px!important;padding-bottom:275px!important}
      .dash-hero-copy{width:100%!important;text-align:left!important}
      .dash-hero-portrait-wrap{left:0!important;right:0!important;bottom:-2px!important;width:100%!important;height:280px!important}
      .dash-hero-portrait{height:286px!important;max-height:286px!important;max-width:90vw!important;transform:translateY(4%)!important}
      .dash-hero-portrait-wrap:before{bottom:-63%!important;width:350px!important;height:350px!important}
      .dash-hero-portrait-wrap:after{bottom:-46%!important;width:285px!important;height:285px!important}
    }
    @media(max-width:430px){
      .dash-hero{min-height:545px!important;padding:27px 22px 263px!important}
      .dash-hero-portrait-wrap{height:265px!important}
      .dash-hero-portrait{height:270px!important;max-height:270px!important}
    }
  `;
  document.head.appendChild(style);
}

function applyDashboardPortrait() {
  installDashboardPortraitStyles();

  const hero = document.querySelector(".dash-hero");
  if (!hero) return false;

  let portrait = hero.querySelector(".dash-hero-portrait, .dash-tiger");
  if (!portrait) {
    portrait = document.createElement("img");
    hero.appendChild(portrait);
  }

  let wrap = hero.querySelector(".dash-hero-portrait-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "dash-hero-portrait-wrap";
    hero.appendChild(wrap);
  }

  if (portrait.parentElement !== wrap) wrap.appendChild(portrait);

  portrait.className = "dash-hero-portrait";
  const expected = new URL(DASH_PORTRAIT_URL, location.href).href;
  if (portrait.src !== expected) portrait.src = DASH_PORTRAIT_URL;
  portrait.alt = "Ilustração do Primo";
  portrait.loading = "eager";
  portrait.decoding = "async";
  portrait.removeAttribute("width");
  portrait.removeAttribute("height");
  portrait.onerror = () => {
    portrait.onerror = null;
    portrait.style.display = "none";
  };

  return true;
}

function waitForDashboardPortrait() {
  installDashboardPortraitStyles();
  applyDashboardPortrait();

  const observer = new MutationObserver(() => applyDashboardPortrait());
  const target = document.querySelector("#section-inicio") || document.documentElement;
  observer.observe(target, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 15000);
}

const releaseDashboard = () => window.setTimeout(() => {
  waitForDashboardPortrait();
  document.body?.classList.add("neo-ready");
}, 80);

const preloadPortrait = new Image();
preloadPortrait.src = DASH_PORTRAIT_URL;

Promise.all([
  import("./dashboard-neo/routes.js?v=20260728-clean-2"),
  import("./dashboard-neo/app.js?v=20260729-dashboard-1")
])
  .then(() => document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", releaseDashboard, { once: true })
    : releaseDashboard())
  .catch((error) => {
    console.error("Falha ao iniciar o dashboard:", error);
    waitForDashboardPortrait();
    document.body?.classList.add("neo-ready");
    const loading = document.getElementById("dashLoading");
    if (loading) loading.innerHTML = "<div><strong>Não foi possível abrir o painel</strong><span>Atualize a página e tente novamente.</span></div>";
  });
