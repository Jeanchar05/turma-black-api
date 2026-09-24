"use strict";
(() => {
  if (window.__TURMA_ROULETTE_PRODUCTION_V20__) return;
  window.__TURMA_ROULETTE_PRODUCTION_V20__ = true;
  const path = () => window.TurmaNavigation?.pathname || location.pathname;
  const theme = () => document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const portraits = { dark:"/assets/hero-jean-transparent.webp?v=20260924-v20", light:"/assets/primo-portrait-light-v5.webp?v=20260924-v20" };
  const tools = {
    reel:{ dark:"/assets/roulette/tools/reel-premium-dark.svg?v=20260924-v20", light:"/assets/roulette/tools/reel-premium-light.svg?v=20260924-v20" },
    gemeos:{ dark:"/assets/modules-v4/gemeos-dark.webp", light:"/assets/modules-v4/gemeos-light.webp" },
    pitagoras:{ dark:"/assets/modules-v4/pitagoras-dark.webp", light:"/assets/modules-v4/pitagoras-light.webp" }
  };
  function sync(){
    if (path() !== "/roleta") return;
    const t = theme();
    const main = document.querySelector(".roulette-main-photo img");
    if (main) { main.src = portraits[t]; main.alt = "Roleta Operacional — Turma do Primo"; }
    document.querySelectorAll(".roulette-casino-card .roulette-card-art img").forEach((img)=>{ img.src = portraits[t]; });
    Object.entries(tools).forEach(([key, asset])=>{
      const img = document.querySelector(`.roulette-tool-card-new[data-tool="${key}"] img`);
      if (!img) return;
      img.dataset.dark = asset.dark; img.dataset.light = asset.light; img.src = asset[t];
    });
  }
  function init(){
    sync();
    window.addEventListener("turma:theme-change", sync);
    new MutationObserver((records)=>{ if(records.some(r=>r.attributeName === "data-theme")) sync(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
    setTimeout(sync,250); setTimeout(sync,900);
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded",init,{once:true}) : init();
})();