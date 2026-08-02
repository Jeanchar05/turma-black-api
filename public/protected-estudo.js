"use strict";
(() => {
  const KEYS=["token","adminToken","authToken","accessToken","jwt"];
  let released=false;
  function getToken(){for(const storage of[sessionStorage,localStorage])for(const key of KEYS){try{const value=storage.getItem(key);if(value)return value}catch{}}return""}
  function installAssets(){if(!document.querySelector('link[data-study-mobile-polish]')){const link=document.createElement("link");link.rel="stylesheet";link.href="/study-mobile-v2.css?v=20260802-study-mobile";link.dataset.studyMobilePolish="1";document.head.appendChild(link)}if(!document.querySelector('script[data-global-theme-loader]')){const script=document.createElement("script");script.src="/theme-global-v2.js?v=20260802-global-theme";script.defer=true;script.dataset.globalThemeLoader="1";document.head.appendChild(script)}}
  function release(){if(released)return;released=true;document.body?.style.setProperty("opacity","1","important");document.body?.style.setProperty("visibility","visible","important");document.body?.classList.add("protected-ready");const loader=document.getElementById("studyLoading");if(loader){loader.style.opacity="0";loader.style.pointerEvents="none";setTimeout(()=>loader.remove(),180)}document.dispatchEvent(new CustomEvent("turma:study-ready"))}
  function start(){installAssets();if(!getToken()){location.replace("/");return}release()}
  setTimeout(release,2500);document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();