"use strict";
(() => {
  if (window.__MODULES_PAGE_V16_FIX__) return;
  window.__MODULES_PAGE_V16_FIX__ = true;
  const path=(location.pathname.replace(/\/$/,"")||"/").replace(/\.html$/,"").toLowerCase();
  if(path!=="/modulos")return;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const covers={gemeos:"gemeos.svg",espelhos:"espelhos.svg",fibonacci:"fibonacci.svg",magneto:"magneto.svg",camaleoes:"camaleoes.svg",pitagoras:"pitagoras.svg",cavalos:"cavalo.svg",cavalo:"cavalo.svg","eclipse-zero":"eclipse-zero.svg"};
  function apply(){
    $$('[data-module-id]').forEach(card=>{const id=card.dataset.moduleId,file=covers[id],img=$(".module-video-cover img",card);if(file){if(img){img.hidden=false;img.src=`/assets/imperial-v14/modules/${file}`;img.onerror=()=>{img.src=`/assets/imperial-v14/modules/${file}`}}else{$(".module-video-cover",card)?.insertAdjacentHTML("beforeend",`<img src="/assets/imperial-v14/modules/${file}" alt="Capa do módulo" loading="lazy" decoding="async">`)}}if(id==="cavalos"){const title=$(".module-video-copy strong",card);if(title)title.textContent="Cavalo"}}
    );
    const active=$('[data-module-id].active')?.dataset.moduleId||"gemeos",file=covers[active];
    const frame=$("#modulesPlayerFrame");if(frame&&file&&!$("iframe",frame)){frame.style.background=`linear-gradient(180deg,rgba(4,6,11,.12),rgba(4,6,11,.8)),url('/assets/imperial-v14/modules/${file}') center/cover no-repeat`;const title=$("#selectedModuleTitle");if(title&&active==="cavalos")title.textContent="Cavalo"}
  }
  const start=()=>{apply();const observer=new MutationObserver(()=>requestAnimationFrame(apply));observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),12000)};
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();
