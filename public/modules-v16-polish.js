"use strict";
(() => {
  if (window.__TURMA_MODULES_V16_POLISH__) return;
  window.__TURMA_MODULES_V16_POLISH__ = true;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const path=(location.pathname.replace(/\/$/,"")||"/").replace(/\.html$/,"").toLowerCase();
  const WHEEL=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const route={"/estudo-gemeos":"gemeos","/estudo-espelhos":"espelhos","/estudo-fibonacci":"fibonacci","/estudo-magneto":"magneto","/estudo-camaleoes":"camaleoes","/estudo-triangulacao":"pitagoras","/estudo-pitagoras":"pitagoras","/estudo-cavalos":"cavalo","/estudo-cavalo":"cavalo","/estudo-eclipse-zero":"eclipse-zero"};
  const key=route[path];
  const detail=key?`/assets/modules-v16/details/${key}.svg`:"";
  const terminal=n=>Math.abs(Number(n))%10;
  const neighbors=(n,count=2)=>{const i=WHEEL.indexOf(Number(n));if(i<0)return[];const out=[];for(let d=-count;d<=count;d++)out.push(WHEEL[(i+d+WHEEL.length)%WHEEL.length]);return out};
  const rand=()=>Math.floor(Math.random()*37);
  let expected=new Set(),score=0,round=0;

  function connectArt(){const img=$(".m16-official img");if(img&&detail){img.src=detail;img.alt=`Explicação visual do módulo ${key}`;img.onerror=()=>{img.src=`/assets/imperial-v14/modules/${key==="eclipse-zero"?"eclipse-zero":key}.svg`}}$$('img').forEach(image=>{image.loading="lazy";image.decoding="async"})}
  function soundButton(){const btn=$("#m16Sound");if(!btn)return;const paint=()=>{const active=localStorage.getItem("tp_sound")!=="0";btn.innerHTML=`<span class="m16-sound-glyph">${active?"🔊":"🔇"}</span>`;btn.title=active?"Desativar sons":"Ativar sons"};paint();btn.addEventListener("click",()=>setTimeout(paint,0))}
  function selected(){return new Set($$('.m16-num.selected').map(b=>Number(b.dataset.num)))}
  function clear(){ $$('.m16-num').forEach(b=>b.classList.remove("selected","protect","hit")); }
  function setPrompt(text){const p=$("#m16Prompt");if(p)p.textContent=text;const s=$("#m16GameStatus");if(s){s.textContent="Marque sua resposta e confirme.";s.className="m16-status"}}
  function customChallenge(){if(!["fibonacci","magneto","camaleoes"].includes(key))return;clear();round++;
    if(key==="fibonacci"){const v=[rand(),rand(),rand(),rand()],targets=[(v[0]+v[1])%37,Math.abs(v[1]-v[2])%37,(v[2]+v[3])%37,Math.abs(v[3]-v[0])%37];expected=new Set([...new Set(targets)].flatMap(n=>neighbors(n,2)));setPrompt(`Resultados ${v.join(" · ")}. Marque as quatro conexões calculadas com dois vizinhos.`)}
    if(key==="magneto"){const v=[rand(),rand(),rand(),rand()],targets=[Math.abs(v[0]-v[2])%37,Math.abs(v[1]-v[3])%37,(v[0]+v[3])%37,(v[1]+v[2])%37];expected=new Set([...new Set(targets)].flatMap(n=>neighbors(n,2)));setPrompt(`Histórico ${v.join(" · ")}. Marque as conexões cruzadas com dois vizinhos.`)}
    if(key==="camaleoes"){const v=[rand(),rand(),rand(),rand()],groups=[[1,4,7],[2,5,8],[3,6,9]],counts=groups.map(g=>v.filter(n=>g.includes(terminal(n))).length),idx=counts.indexOf(Math.min(...counts)),family=groups[idx],representative=WHEEL.find(n=>family.includes(terminal(n)));expected=new Set(neighbors(representative,2));setPrompt(`Resultados ${v.join(" · ")}. A família menos presente é ${family.join("·")}. Marque uma região representativa com dois vizinhos.`)}
  }
  function confirmCustom(){if(!["fibonacci","magneto","camaleoes"].includes(key))return false;const got=selected(),ok=got.size===expected.size&&[...expected].every(n=>got.has(n));if(ok)score++;const status=$("#m16GameStatus");if(status){status.className=`m16-status ${ok?"success":"error"}`;status.textContent=ok?"Resposta correta. A região foi montada conforme o desafio.":`Revise a marcação. A resposta esperada contém ${expected.size} casas.`}const label=$("#m16Score");if(label)label.textContent=`${score}/${round}`;return true}
  function replaceGameButtons(){if(!["fibonacci","magneto","camaleoes"].includes(key))return;const oldNew=$("#m16NewGame"),oldConfirm=$("#m16Confirm");if(oldNew){const fresh=oldNew.cloneNode(true);oldNew.replaceWith(fresh);fresh.addEventListener("click",customChallenge)}if(oldConfirm){const fresh=oldConfirm.cloneNode(true);oldConfirm.replaceWith(fresh);fresh.addEventListener("click",confirmCustom)}const tab=$('[data-tab="game"]');tab?.addEventListener("click",()=>setTimeout(customChallenge,10))}
  function reveal(){const items=$$(".m16-card,.m16-hero,.m16-tabs");if(!("IntersectionObserver" in window)){items.forEach(i=>i.style.opacity="1");return}const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.animate([{opacity:0,transform:"translateY(16px)"},{opacity:1,transform:"none"}],{duration:520,easing:"cubic-bezier(.2,.7,.2,1)",fill:"both"});observer.unobserve(e.target)}}),{threshold:.07});items.forEach(i=>observer.observe(i))}
  function init(){if(!key)return;connectArt();soundButton();replaceGameButtons();reveal();window.addEventListener("error",event=>{if(event.target instanceof HTMLImageElement&&detail)event.target.src=detail},true)}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(init,0),{once:true}):setTimeout(init,0);
})();
