"use strict";
(() => {
  const KEY="turma_global_theme_v2";
  const root=document.documentElement;
  const saved=()=>{try{return localStorage.getItem(KEY)||localStorage.getItem("theme")||localStorage.getItem("turma_theme")||"dark"}catch{return"dark"}};
  const normalize=v=>v==="light"?"light":"dark";
  function apply(value,broadcast=true){const theme=normalize(value);root.dataset.theme=theme;root.style.colorScheme=theme;try{localStorage.setItem(KEY,theme);localStorage.setItem("theme",theme);localStorage.setItem("turma_theme",theme)}catch{}document.querySelectorAll('[data-global-theme],[data-theme-toggle],.dash-theme-toggle,#studyThemeToggle,#themeButton').forEach(btn=>{btn.setAttribute("aria-pressed",String(theme==="light"));btn.setAttribute("title",theme==="light"?"Ativar tema escuro":"Ativar tema claro");const label=btn.querySelector('[data-theme-label]');if(label)label.textContent=theme==="light"?"Escuro":"Claro"});if(broadcast)window.dispatchEvent(new CustomEvent("turma:theme-change",{detail:{theme}}));}
  function bind(){document.addEventListener("click",event=>{const btn=event.target.closest('[data-global-theme],[data-theme-toggle],.dash-theme-toggle,#studyThemeToggle,#themeButton');if(!btn)return;event.preventDefault();apply(root.dataset.theme==="light"?"dark":"light")});window.addEventListener("storage",event=>{if([KEY,"theme","turma_theme"].includes(event.key))apply(event.newValue,false)});}
  function load(src,type){if(type==="style"){if(document.querySelector(`link[href^="${src}"]`))return;const el=document.createElement("link");el.rel="stylesheet";el.href=`${src}?v=20260801-live`;document.head.appendChild(el);return;}if(document.querySelector(`script[src^="${src}"]`))return;const el=document.createElement("script");el.src=`${src}?v=20260801-live`;el.defer=true;document.head.appendChild(el);}
  function dashboardExtras(){if(!document.body?.classList.contains("student-dashboard")||!document.querySelector(".dash-hero"))return;load("/dashboard-live-v5.css","style");load("/dashboard-portrait-final.js","script");load("/dashboard-notifications-live.js","script");}
  if(!document.querySelector('link[data-global-theme-css]')){const link=document.createElement("link");link.rel="stylesheet";link.href="/theme-global-v2.css?v=20260802-global-theme";link.dataset.globalThemeCss="1";document.head.appendChild(link)}
  apply(saved(),false);
  const start=()=>{bind();dashboardExtras();};
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();