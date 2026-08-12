"use strict";
(() => {
  const KEYS=["token","adminToken","authToken","accessToken","jwt"];
  let released=false;
  function getToken(){for(const storage of[sessionStorage,localStorage])for(const key of KEYS){try{const value=storage.getItem(key);if(value)return value}catch{}}return""}
  function load(src,type,marker){if(document.querySelector(`[data-${marker}]`))return;const el=document.createElement(type==="style"?"link":"script");if(type==="style"){el.rel="stylesheet";el.href=src}else{el.src=src;el.defer=true}el.dataset[marker]="1";document.head.appendChild(el)}
  function installAssets(){
    load("/study-mobile-v2.css?v=20260812-shell-v23","style","studyMobilePolish");
    load("/study-icon-fix.css?v=20260812-shell-v23","style","studyIconFix");
    load("/theme-global-v2.css?v=20260812-shell-v23","style","globalThemeCss");
    load("/student-shell-v23.css?v=20260812-shell-v23","style","studentShellCss");
    load("/theme-global-v2.js?v=20260812-shell-v23","script","globalThemeLoader");
    load("/platform-final.css?v=20260812-shell-v23","style","platformFinalCss");
    load("/navigation-final.js?v=20260812-shell-v23","script","navigationFinalJs");
    load("/student-shell-v23.js?v=20260812-shell-v23","script","studentShellJs");
    const route=location.pathname.replace(/\/$/,"")||"/";
    if(route==="/estudo"||route==="/estudo.html"||route.startsWith("/estudo-"))load("/study-images-final.js?v=20260812-study-stable-1","script","studyImagesFinalJs");
    if(route.startsWith("/estudo-")&&route!=="/estudo.html"){
      load("/race-tool.css?v=20260812-race-v4","style","raceToolCss");
      load("/race-tool.js?v=20260812-race-v4","script","raceToolJs");
      load("/study-race-injector.js?v=20260812-race-v4","script","studyRaceInjectorJs");
    }
    if(route==="/modulos"||route==="/modulos.html")load("/modules-images-v23.js?v=20260812-modules-v23","script","modulesImagesV23");
    if(route==="/gestao"||route==="/gestao.html"){
      load("/gestao-final.css?v=20260812-gestao-v23","style","gestaoFinalCss");
      load("/gestao-final.js?v=20260812-gestao-v23","script","gestaoFinalJs");
    }
  }
  function bindImageFallback(){document.addEventListener("error",event=>{const img=event.target;if(!(img instanceof HTMLImageElement))return;const host=img.closest(".study-module-art,.study-final-infographic,.strategy-hero,.module-art,.module-video-cover,.modules-player-frame");if(!host||host.dataset.fallbackApplied)return;host.dataset.fallbackApplied="1";host.classList.add("study-broken-image");img.style.display="none"},true)}
  function release(){if(released)return;released=true;document.body?.style.setProperty("opacity","1","important");document.body?.style.setProperty("visibility","visible","important");document.body?.classList.add("protected-ready");const loader=document.getElementById("studyLoading")||document.getElementById("modulesLoading");if(loader){loader.style.opacity="0";loader.style.pointerEvents="none";setTimeout(()=>loader.remove(),180)}document.dispatchEvent(new CustomEvent("turma:study-ready"));document.dispatchEvent(new CustomEvent("turma:protected-ready"))}
  function start(){installAssets();bindImageFallback();if(!getToken()){location.replace("/");return}release()}
  setTimeout(release,2500);document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();
