"use strict";
(() => {
  if(window.__TURMA_THEME_GLOBAL_V9__)return;window.__TURMA_THEME_GLOBAL_V9__=true;
  const KEY="turma_global_theme_v2",root=document.documentElement;
  const saved=()=>{try{return localStorage.getItem(KEY)||localStorage.getItem("theme")||localStorage.getItem("turma_theme")||"dark"}catch{return"dark"}};
  const normalize=v=>v==="light"?"light":"dark";
  const selectors='[data-global-theme],[data-theme-toggle],.dash-theme-toggle,#studyThemeToggle,#themeButton,#rouletteThemeTop,#rouletteThemeToggle,#examThemeToggle,#favoritesThemeToggle,#reelThemeToggle';
  function apply(value,broadcast=true){const theme=normalize(value);root.dataset.theme=theme;root.style.colorScheme=theme;try{localStorage.setItem(KEY,theme);localStorage.setItem("theme",theme);localStorage.setItem("turma_theme",theme)}catch{}document.querySelectorAll(selectors).forEach(btn=>{btn.setAttribute("aria-pressed",String(theme==="light"));btn.title=theme==="light"?"Ativar tema escuro":"Ativar tema claro";const use=btn.querySelector("use");if(use&&/i-(moon|sun)/.test(use.getAttribute("href")||""))use.setAttribute("href",`/assets/dashboard-icons.svg#${theme==="light"?"i-sun":"i-moon"}`)});document.querySelector('meta[name="theme-color"]')?.setAttribute("content",theme==="light"?"#f3f1f6":"#07030d");if(broadcast)window.dispatchEvent(new CustomEvent("turma:theme-change",{detail:{theme}}))}
  function bind(){document.addEventListener("click",event=>{const btn=event.target.closest(selectors);if(!btn)return;event.preventDefault();event.stopPropagation();apply(root.dataset.theme==="light"?"dark":"light")},true);window.addEventListener("storage",event=>{if([KEY,"theme","turma_theme"].includes(event.key))apply(event.newValue,false)})}
  function load(src,type,marker){if(document.querySelector(`[data-${marker}]`))return;const el=document.createElement(type==="style"?"link":"script");if(type==="style"){el.rel="stylesheet";el.href=src}else{el.src=src;el.defer=true}el.dataset[marker]="1";document.head.appendChild(el)}
  function install(){
    load("/theme-global-v2.css?v=20260803-v9b","style","globalThemeCss");
    load("/platform-final.css?v=20260803-v9b","style","platformFinalCss");
    load("/platform-upgrade-v6.css?v=20260803-v9b","style","platformUpgradeV6Css");
    load("/turma-overhaul-v8.css?v=20260803-v9b","style","turmaOverhaulV8Css");
    load("/turma-overhaul-v8-addons.css?v=20260803-v9b","style","turmaOverhaulV8AddonsCss");
    load("/site-stabilization-v9.css?v=20260803-v9b","style","siteStabilizationV9Css");
    load("/site-stabilization-v9b.css?v=20260803-v9b","style","siteStabilizationV9bCss");
    load("/platform-final.js?v=20260803-v9b","script","platformFinalJs");
    load("/navigation-final.js?v=20260803-v9b","script","navigationFinalJs");
    load("/platform-upgrade-v6.js?v=20260803-v9b","script","platformUpgradeV6Js");
    load("/notifications-button-v7.js?v=20260803-v9b","script","notificationsButtonV7Js");
    load("/turma-overhaul-v8.js?v=20260803-v9b","script","turmaOverhaulV8Js");
    const route=location.pathname.replace(/\/$/,"")||"/";
    if(route==="/estudo"||route==="/estudo.html"||route.startsWith("/estudo-"))load("/study-images-final.js?v=20260803-v9b","script","studyImagesFinalJs");
    if(document.body?.classList.contains("student-dashboard")&&document.querySelector(".dash-hero")){load("/dashboard-final.css?v=20260803-v9b","style","dashboardFinalCss");load("/dashboard-final.js?v=20260803-v9b","script","dashboardFinalJs")}
    load("/site-stabilization-v9.js?v=20260803-v9b","script","siteStabilizationV9Js");
  }
  apply(saved(),false);const start=()=>{bind();install()};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();
