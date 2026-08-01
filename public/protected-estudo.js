"use strict";
(() => {
  const KEYS=["token","adminToken","authToken","accessToken","jwt"];
  const ICONS="/assets/study/study-icons.svg";
  function forceVisible(){if(!document.body)return;document.body.style.setProperty("opacity","1","important");document.body.style.setProperty("visibility","visible","important");const loader=document.getElementById("studyLoading");if(loader&&!document.body.classList.contains("protected-ready")){loader.style.setProperty("display","flex","important");loader.style.setProperty("opacity","1","important");loader.style.setProperty("visibility","visible","important")}}
  function getToken(){for(const storage of [sessionStorage,localStorage])for(const key of KEYS){try{const value=storage.getItem(key);if(value)return value}catch(_){}}return""}
  function clearSession(){for(const storage of [sessionStorage,localStorage])for(const key of KEYS){try{storage.removeItem(key)}catch(_){}}}
  function icon(root,name){const use=root?.querySelector("svg use");if(use){use.setAttribute("href",`${ICONS}#${name}`);use.closest("svg")?.classList.add("study-custom-icon")}}
  async function readArtwork(path){const r=await fetch(`${path}?v=20260801-pitagoras-final&t=${Date.now()}`,{cache:"no-store",headers:{"Cache-Control":"no-cache"}});if(!r.ok)throw new Error("Imagem indisponível");const b=(await r.text()).trim();if(!b.startsWith("UklG"))throw new Error("Imagem inválida");return `data:image/webp;base64,${b}`}
  async function loadMagnetoArtwork(){const img=document.getElementById("magnetoHero");if(!img)return;try{img.src=await readArtwork("/assets/study/magneto-module-exact.base64")}catch(_){img.src="/assets/study/magneto-card-v1.svg?v=20260801-fallback-2"}}
  async function loadPitagorasModuleArtwork(){const img=document.getElementById("triHero");if(!img)return;try{img.src=await readArtwork("/assets/study/triangulacao-module-exact.base64");img.removeAttribute("srcset");img.style.objectFit="contain";img.style.objectPosition="center"}catch(_){}}
  async function loadPitagorasCardArtwork(){const img=document.querySelector('[data-module="pitagoras"] .study-module-art img');if(!img)return false;try{const source=await readArtwork("/assets/study/triangulacao-card-exact.base64");img.src=source;img.dataset.cardFallback=source;img.removeAttribute("data-card-payload");img.removeAttribute("srcset");img.style.objectFit="cover";img.style.objectPosition="center";return true}catch(_){return false}}
  function watchPitagorasCard(){if(!document.body?.classList.contains("study-home-page"))return;let tries=0;const apply=async()=>{tries+=1;const done=await loadPitagorasCardArtwork();if(done||tries>30){clearInterval(timer);observer.disconnect()}};const observer=new MutationObserver(apply);observer.observe(document.documentElement,{childList:true,subtree:true});const timer=setInterval(apply,150);apply()}
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
  function loadArtwork(){loadMagnetoArtwork();loadPitagorasModuleArtwork();watchPitagorasCard()}
  function release(user){forceVisible();applyCustomIcons();loadArtwork();document.body.classList.add("protected-ready");document.getElementById("studyLoading")?.remove();document.dispatchEvent(new CustomEvent("turma:study-ready",{detail:{user}}))}
  async function start(){forceVisible();applyCustomIcons();loadArtwork();const token=getToken();if(!token){location.replace("/");return}try{const response=await fetch(`${location.origin}/me`,{headers:{Accept:"application/json",Authorization:`Bearer ${token}`},cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok||!data?.usuario)throw new Error("Sessão inválida");release(data.usuario)}catch(_){clearSession();location.replace("/")}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();