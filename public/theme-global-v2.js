"use strict";
(() => {
  const KEY="turma_global_theme_v2";
  const root=document.documentElement;
  const saved=()=>{try{return localStorage.getItem(KEY)||localStorage.getItem("theme")||localStorage.getItem("turma_theme")||"dark"}catch{return"dark"}};
  const normalize=v=>v==="light"?"light":"dark";
  function apply(value,broadcast=true){const theme=normalize(value);root.dataset.theme=theme;root.style.colorScheme=theme;try{localStorage.setItem(KEY,theme);localStorage.setItem("theme",theme);localStorage.setItem("turma_theme",theme)}catch{}document.querySelectorAll('[data-global-theme],[data-theme-toggle],.dash-theme-toggle,#studyThemeToggle,#themeButton').forEach(btn=>{btn.setAttribute("aria-pressed",String(theme==="light"));btn.setAttribute("title",theme==="light"?"Ativar tema escuro":"Ativar tema claro");const label=btn.querySelector('[data-theme-label]');if(label)label.textContent=theme==="light"?"Escuro":"Claro"});if(broadcast)window.dispatchEvent(new CustomEvent("turma:theme-change",{detail:{theme}}));}
  function bind(){document.addEventListener("click",event=>{const btn=event.target.closest('[data-global-theme],[data-theme-toggle],.dash-theme-toggle,#studyThemeToggle,#themeButton');if(!btn)return;event.preventDefault();apply(root.dataset.theme==="light"?"dark":"light")});window.addEventListener("storage",event=>{if([KEY,"theme","turma_theme"].includes(event.key))apply(event.newValue,false)});}
  if(!document.querySelector('link[data-global-theme-css]')){const link=document.createElement("link");link.rel="stylesheet";link.href="/theme-global-v2.css?v=20260802-global-theme";link.dataset.globalThemeCss="1";document.head.appendChild(link)}
  apply(saved(),false);document.readyState==="loading"?document.addEventListener("DOMContentLoaded",bind,{once:true}):bind();
})();