"use strict";
(() => {
  const KEYS=["token","adminToken","authToken","accessToken","jwt"];
  let released=false;
  function getToken(){for(const storage of[sessionStorage,localStorage])for(const key of KEYS){try{const value=storage.getItem(key);if(value)return value}catch{}}return""}
  function clearSession(){for(const storage of[sessionStorage,localStorage])for(const key of KEYS)try{storage.removeItem(key)}catch{}}
  function load(src,type,marker){if(document.querySelector(`[data-${marker}]`))return;const el=document.createElement(type==="style"?"link":"script");if(type==="style"){el.rel="stylesheet";el.href=src}else{el.src=src;el.defer=true}el.dataset[marker]="1";document.head.appendChild(el)}
  function installAssets(){
    load("/study-mobile-v2.css?v=20260812-shell-v26","style","studyMobilePolish");
    load("/study-icon-fix.css?v=20260812-shell-v26","style","studyIconFix");
    load("/theme-global-v2.css?v=20260812-shell-v26","style","globalThemeCss");
    load("/student-shell-v23.css?v=20260812-shell-v26","style","studentShellCss");
    load("/theme-global-v2.js?v=20260812-shell-v26","script","globalThemeLoader");
    load("/platform-final.css?v=20260812-shell-v26","style","platformFinalCss");
    load("/navigation-final.js?v=20260812-shell-v26","script","navigationFinalJs");
    load("/student-shell-v23.js?v=20260812-shell-v26","script","studentShellJs");
    const route=(window.TurmaNavigation?.pathname ?? location.pathname).replace(/\/$/,"")||"/";
    if(route==="/estudo"||route==="/estudo.html"||route.startsWith("/estudo-"))load("/study-images-final.js?v=20260812-study-v26","script","studyImagesFinalJs");
    if(route.startsWith("/estudo-")&&route!=="/estudo.html"){
      load("/study-module-shell-v25.css?v=20260812-study-v26","style","studyModuleShellV25");
      load("/race-tool.css?v=20260812-race-v26","style","raceToolCss");
      load("/race-mobile-v23.css?v=20260812-race-v26","style","raceMobileV23");
      load("/race-tool.js?v=20260812-race-v26","script","raceToolJs");
      load("/study-race-injector.js?v=20260812-race-v26","script","studyRaceInjectorJs");
    }
    if(route==="/modulos"||route==="/modulos.html"){
      load("/modules-images-v23.css?v=20260812-modules-v26","style","modulesImagesCssV23");
      load("/modules-images-v23.js?v=20260812-modules-v26","script","modulesImagesV23");
    }
    if(route==="/gestao"||route==="/gestao.html"){
      load("/gestao-stability-v25.css?v=20260812-gestao-v26","style","gestaoStabilityV25");
    }
  }
  function bindImageFallback(){document.addEventListener("error",event=>{const img=event.target;if(!(img instanceof HTMLImageElement))return;const host=img.closest(".study-module-art,.study-final-infographic,.strategy-hero,.module-art,.module-video-cover,.modules-player-frame");if(!host||host.dataset.fallbackApplied)return;host.dataset.fallbackApplied="1";host.classList.add("study-broken-image");img.style.display="none"},true)}
  function release(user){if(released)return;released=true;document.body?.style.setProperty("opacity","1","important");document.body?.style.setProperty("visibility","visible","important");document.body?.classList.add("protected-ready");const loader=document.getElementById("studyLoading")||document.getElementById("modulesLoading");if(loader){loader.style.opacity="0";loader.style.pointerEvents="none";setTimeout(()=>loader.remove(),180)}document.dispatchEvent(new CustomEvent("turma:study-ready",{detail:{user}}));document.dispatchEvent(new CustomEvent("turma:protected-ready",{detail:{user}}))}
  function redirectPremium(){location.replace("/dashboard-free?motivo=premium")}
  async function start(){installAssets();bindImageFallback();const token=getToken();if(!token){location.replace("/");return}const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7000);try{const response=await fetch(`${location.origin}/me`,{headers:{Accept:"application/json",Authorization:`Bearer ${token}`},cache:"no-store",signal:controller.signal});const data=await response.json().catch(()=>({}));if(!response.ok||!data?.usuario)throw new Error("Sessão inválida");if(data.usuario.acessoPremium!==true){redirectPremium();return}release(data.usuario)}catch(_){clearSession();location.replace("/")}finally{clearTimeout(timeout)}}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();
