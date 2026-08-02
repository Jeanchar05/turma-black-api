"use strict";
(() => {
  if (window.__TURMA_STUDY_RACE_INJECTOR__) return;
  window.__TURMA_STUDY_RACE_INJECTOR__ = true;
  const path=(location.pathname.replace(/\/$/,"")||"/").toLowerCase();
  if(!path.startsWith("/estudo-")||path==="/estudo.html")return;
  function inject(){
    if(document.querySelector(".tp-study-race-card"))return;
    const card=document.createElement("section");card.className="tp-study-race-card";card.innerHTML=`<div class="tp-study-race-intro"><div><span class="tp-study-race-icon">♞</span><div><h3>Race disponível neste módulo</h3><p>Abra a ferramenta, marque números e leve a mesma leitura para a Roleta Reel.</p></div></div><button class="tp-study-race-open" type="button" aria-expanded="false">Abrir Race</button></div><div class="tp-study-race-panel" hidden><div data-race-tool data-default-view="race"></div></div>`;
    const anchor=document.querySelector(".study-final-infographic")||document.querySelector(".strategy-hero")||document.querySelector(".strategy-head")||document.querySelector("main");
    if(anchor?.parentElement)anchor.insertAdjacentElement("afterend",card);else document.body.appendChild(card);
    const panel=card.querySelector(".tp-study-race-panel"),button=card.querySelector(".tp-study-race-open");
    button.addEventListener("click",()=>{const open=panel.hidden;panel.hidden=!open;button.setAttribute("aria-expanded",String(open));button.textContent=open?"Fechar Race":"Abrir Race";if(open){window.TurmaRace?.mountAll(card);setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"start"}),80)}});
    window.TurmaRace?.mountAll(card);
  }
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",inject,{once:true}):inject();
  window.addEventListener("turma:race-ready",inject,{once:true});
  setTimeout(inject,900);
})();
