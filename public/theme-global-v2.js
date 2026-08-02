"use strict";
(() => {
  const KEY="turma_global_theme_v2";
  const root=document.documentElement;
  const saved=()=>{try{return localStorage.getItem(KEY)||localStorage.getItem("theme")||localStorage.getItem("turma_theme")||"dark"}catch{return"dark"}};
  const normalize=v=>v==="light"?"light":"dark";
  const themeSelectors='[data-global-theme],[data-theme-toggle],.dash-theme-toggle,#studyThemeToggle,#themeButton,#rouletteThemeTop,#rouletteThemeToggle,#examThemeToggle,#favoritesThemeToggle';
  function apply(value,broadcast=true){const theme=normalize(value);root.dataset.theme=theme;root.style.colorScheme=theme;try{localStorage.setItem(KEY,theme);localStorage.setItem("theme",theme);localStorage.setItem("turma_theme",theme)}catch{}document.querySelectorAll(themeSelectors).forEach(btn=>{btn.setAttribute("aria-pressed",String(theme==="light"));btn.setAttribute("title",theme==="light"?"Ativar tema escuro":"Ativar tema claro");const label=btn.querySelector('[data-theme-label]');if(label)label.textContent=theme==="light"?"Escuro":"Claro"});if(broadcast)window.dispatchEvent(new CustomEvent("turma:theme-change",{detail:{theme}}));}
  function bind(){document.addEventListener("click",event=>{const btn=event.target.closest(themeSelectors);if(!btn)return;event.preventDefault();event.stopPropagation();apply(root.dataset.theme==="light"?"dark":"light")},true);window.addEventListener("storage",event=>{if([KEY,"theme","turma_theme"].includes(event.key))apply(event.newValue,false)});}
  function load(src,type,marker){if(document.querySelector(`[data-${marker}]`))return;const el=document.createElement(type==="style"?"link":"script");if(type==="style"){el.rel="stylesheet";el.href=src}else{el.src=src;el.defer=true}el.dataset[marker]="1";document.head.appendChild(el)}
  function install(){
    load("/theme-global-v2.css?v=20260802-global-theme-2","style","globalThemeCss");
    load("/platform-final.css?v=20260802-final-1","style","platformFinalCss");
    load("/platform-upgrade-v6.css?v=20260802-upgrade-v6","style","platformUpgradeV6Css");
    load("/platform-final.js?v=20260802-final-2","script","platformFinalJs");
    load("/navigation-final.js?v=20260802-navigation-final-3","script","navigationFinalJs");
    load("/platform-upgrade-v6.js?v=20260802-upgrade-v6","script","platformUpgradeV6Js");
    load("/notifications-button-v7.js?v=20260802-notifications-v7","script","notificationsButtonV7Js");
    const route=location.pathname.replace(/\/$/,"")||"/";
    if(route==="/estudo"||route==="/estudo.html"||route.startsWith("/estudo-")){
      load("/study-images-final.js?v=20260802-study-images-final-4","script","studyImagesFinalJs");
    }
    if(document.body?.classList.contains("student-dashboard")&&document.querySelector(".dash-hero")){
      load("/dashboard-final.css?v=20260802-final-2","style","dashboardFinalCss");
      load("/dashboard-final.js?v=20260802-final-4","script","dashboardFinalJs");
    }
  }
  apply(saved(),false);
  const start=()=>{bind();install();};
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();