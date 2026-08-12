"use strict";
(() => {
  const TOKEN_KEYS=["token","adminToken","authToken","accessToken","jwt"];
  function addStyle(src,key){if(document.querySelector(`link[data-${key}]`))return;const l=document.createElement("link");l.rel="stylesheet";l.href=src;l.dataset[key]="1";document.head.appendChild(l)}
  function addScript(src,key){if(document.querySelector(`script[data-${key}]`))return;const s=document.createElement("script");s.src=src;s.defer=true;s.dataset[key]="1";document.head.appendChild(s)}
  addStyle("/theme-global-v2.css?v=20260812-shell-v23","rouletteThemeCss");addStyle("/student-shell-v23.css?v=20260812-shell-v23","rouletteShellCss");
  function prepareShell(){
    const side=document.querySelector('.roulette-sidebar');side?.classList.add('dash-sidebar','tp-shell-sidebar');
    const top=document.querySelector('.roulette-topbar');top?.classList.add('dash-topbar','tp-shell-topbar');
    document.querySelector('.roulette-menu')?.classList.add('dash-menu-toggle');document.querySelector('.roulette-search')?.classList.add('dash-search-trigger');
    const actions=document.querySelector('.roulette-top-actions');actions?.classList.add('dash-top-actions','tp-shell-actions');
    const theme=document.querySelector('.roulette-theme-top');if(theme){theme.classList.add('dash-theme-toggle');theme.setAttribute('data-global-theme','')}
    const bell=document.querySelector('.roulette-notification');bell?.classList.add('dash-notification-btn');
    const user=document.querySelector('.roulette-avatar-top');if(user){user.classList.add('dash-user-menu');if(!user.querySelector('strong'))user.insertAdjacentHTML('beforeend','<span><strong data-user-name>Primo</strong><small data-user-role>Aluno</small></span>')}
  }
  function installScripts(){addScript("/theme-global-v2.js?v=20260812-shell-v23","rouletteThemeJs");addScript("/navigation-final.js?v=20260812-shell-v23","rouletteNavV23");addScript("/student-shell-v23.js?v=20260812-shell-v23","rouletteShellV23")}
  function forceVisible(){if(!document.body)return;document.body.style.setProperty("opacity","1","important");document.body.style.setProperty("visibility","visible","important")}
  function getToken(){for(const storage of[sessionStorage,localStorage])for(const key of TOKEN_KEYS){try{const value=storage.getItem(key);if(value)return value}catch{}}return""}
  function clearSession(){TOKEN_KEYS.forEach(key=>{try{sessionStorage.removeItem(key)}catch{}try{localStorage.removeItem(key)}catch{}})}
  function release(user){forceVisible();const name=String(user?.nome||"Primo"),first=name.trim().split(/\s+/)[0]||"Primo",role=String(user?.cargo||user?.tipo||"Aluno");document.querySelectorAll('[data-user-name]').forEach(el=>el.textContent=first);document.querySelectorAll('[data-user-role]').forEach(el=>el.textContent=role);document.body.classList.add("protected-ready");document.getElementById("rouletteSidebar")?.style.removeProperty("visibility");document.querySelector(".roulette-main")?.style.removeProperty("visibility");document.getElementById("rouletteLoading")?.remove();document.dispatchEvent(new CustomEvent("turma:protected-ready",{detail:{user}}));document.dispatchEvent(new CustomEvent("turma:roulette-ready",{detail:{user}}))}
  async function start(){prepareShell();installScripts();forceVisible();const token=getToken();if(!token){location.replace("/");return}try{const response=await fetch(`${location.origin}/me`,{headers:{Accept:"application/json",Authorization:`Bearer ${token}`},cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok||!data?.usuario)throw new Error("Sessão inválida");release(data.usuario)}catch(_){clearSession();location.replace("/")}}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();