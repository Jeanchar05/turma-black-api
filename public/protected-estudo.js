"use strict";
(() => {
  const KEYS=["token","adminToken","authToken","accessToken","jwt"];
  const ICONS="/assets/study/study-icons.svg";
  function forceVisible(){if(!document.body)return;document.body.style.setProperty("opacity","1","important");document.body.style.setProperty("visibility","visible","important");const loader=document.getElementById("studyLoading");if(loader&&!document.body.classList.contains("protected-ready")){loader.style.setProperty("display","flex","important");loader.style.setProperty("opacity","1","important");loader.style.setProperty("visibility","visible","important")}}
  function getToken(){for(const storage of [sessionStorage,localStorage])for(const key of KEYS){try{const value=storage.getItem(key);if(value)return value}catch(_){}}return""}
  function clearSession(){for(const storage of [sessionStorage,localStorage])for(const key of KEYS){try{storage.removeItem(key)}catch(_){}}}
  function icon(root,name){const use=root?.querySelector("svg use");if(use){use.setAttribute("href",`${ICONS}#${name}`);use.closest("svg")?.classList.add("study-custom-icon")}}
  function applyCustomIcons(){
    if(!document.querySelector('link[data-study-icon-polish]')){const l=document.createElement("link");l.rel="stylesheet";l.href=`/study-icons-polish.css?v=20260730-icons-1&t=${Date.now()}`;l.dataset.studyIconPolish="1";document.head.appendChild(l)}
    if(document.body?.classList.contains("study-home-page")){
      icon(document.querySelector(".study-home-icon"),"book");
      const m=[...document.querySelectorAll(".study-metric")];icon(m[0],"book");icon(m[1],"spark");icon(m[2],"timeline");icon(m[3],"trophy");
      icon(document.getElementById("homeFavorite"),"star");
      const meta=[...document.querySelectorAll(".study-module-meta span")];icon(meta[0],"layers");icon(meta[1],"clock");
    }
    if(document.body?.classList.contains("study-gemeos-page")){
      icon(document.querySelector(".study-heading-icon"),"book");icon(document.getElementById("studyFavorite"),"star");
      const tabs=[...document.querySelectorAll(".study-tab")];icon(tabs[0],"book");icon(tabs[1],"activity");icon(tabs[2],"gamepad");
      const next=[...document.querySelectorAll(".study-next")];icon(next[0],"activity");icon(next[1],"gamepad");
    }
  }
  function release(user){forceVisible();applyCustomIcons();document.body.classList.add("protected-ready");document.getElementById("studyLoading")?.remove();document.dispatchEvent(new CustomEvent("turma:study-ready",{detail:{user}}))}
  async function start(){forceVisible();applyCustomIcons();const token=getToken();if(!token){location.replace("/");return}try{const response=await fetch(`${location.origin}/me`,{headers:{Accept:"application/json",Authorization:`Bearer ${token}`},cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok||!data?.usuario)throw new Error("Sessão inválida");release(data.usuario)}catch(_){clearSession();location.replace("/")}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();