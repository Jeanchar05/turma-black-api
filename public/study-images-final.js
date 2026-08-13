"use strict";
(() => {
  if (window.__TURMA_STUDY_IMAGES_STABLE_V25__) return;
  window.__TURMA_STUDY_IMAGES_STABLE_V25__ = true;
  const path=location.pathname.replace(/\/$/,"")||"/";
  if(path==="/estudo"||path==="/estudo.html") return;
  const modules={
    gemeos:{routes:["/estudo-gemeos","/estudo-gemeos.html"],name:"Gêmeos",internal:"/assets/study/gemeos-hero-v2.svg"},
    espelhos:{routes:["/estudo-espelhos","/estudo-espelhos.html"],name:"Espelhos",internal:"/assets/study/espelhos-module.webp"},
    fibonacci:{routes:["/estudo-fibonacci","/estudo-fibonacci.html"],name:"Fibonacci",internal:"/assets/study/fibonacci-module.webp"},
    magneto:{routes:["/estudo-magneto","/estudo-magneto.html"],name:"Magneto",script:"/assets/study/final-data/magneto.js"},
    camaleoes:{routes:["/estudo-camaleoes","/estudo-camaleoes.html"],name:"Camaleões",script:"/assets/study/final-data/camaleoes.js"},
    pitagoras:{routes:["/estudo-triangulacao","/estudo-triangulacao.html","/estudo-pitagoras","/estudo-pitagoras.html"],name:"Pitágoras",script:"/assets/study/final-data/pitagoras.js"},
    cavalos:{routes:["/estudo-cavalos","/estudo-cavalos.html"],name:"Cavalo",script:"/assets/study/final-data/cavalos-card.js"},
    eclipse:{routes:["/estudo-eclipse-zero","/estudo-eclipse-zero.html"],name:"Eclipse Zero",internal:"/assets/study/eclipse-zero-module.svg"}
  };
  const current=Object.entries(modules).find(([,m])=>m.routes.includes(path));if(!current)return;const [key,module]=current;
  function loadScript(src){return new Promise(resolve=>{if(!src)return resolve();const old=[...document.scripts].find(s=>s.src.includes(src));if(old)return resolve();const s=document.createElement("script");s.src=src+"?v=20260812-study-v25";s.onload=s.onerror=resolve;document.head.appendChild(s)})}
  function styles(){
    if(document.getElementById("studyStableImageStyles"))return;
    const s=document.createElement("style");s.id="studyStableImageStyles";
    s.textContent='.study-final-infographic{width:min(100%,820px);max-width:820px;margin:20px auto 26px;padding:8px;border:1px solid rgba(196,100,255,.3);border-radius:20px;background:#08030d;overflow:hidden}.study-final-infographic img{display:block;width:100%;max-width:100%;height:auto;max-height:540px;margin:0 auto;border-radius:14px;object-fit:contain;object-position:center}.study-final-infographic figcaption{display:flex;justify-content:space-between;gap:10px;padding:9px 7px 3px;color:#bfb1c8;font:600 10px Inter,sans-serif}.study-final-infographic figcaption b{color:#efc45d}.strategy-hero .hero-art.study-final-hidden-art{display:none!important}html[data-theme="light"] .study-final-infographic{background:#fff;border-color:rgba(112,48,166,.2)}@media(max-width:620px){.study-final-infographic{width:100%;max-width:100%;margin:15px auto 20px;padding:6px;border-radius:16px}.study-final-infographic img{max-height:360px;border-radius:11px}.study-final-infographic figcaption{font-size:9px}}';
    document.head.appendChild(s)
  }
  async function init(){styles();await loadScript(module.script);const src=window.TURMA_STUDY_IMAGES?.[key]?.internal||module.internal||window.TURMA_STUDY_IMAGES?.[key]?.card;if(!src)return;document.querySelector(".strategy-hero .hero-art")?.classList.add("study-final-hidden-art");document.querySelector(".study-final-infographic")?.remove();const fig=document.createElement("figure");fig.className="study-final-infographic";fig.innerHTML=`<img src="${src}" alt="Arte oficial do módulo ${module.name}" decoding="async"><figcaption><b>Arte oficial do módulo</b><span>${module.name}</span></figcaption>`;const anchor=document.querySelector(".strategy-hero")||document.querySelector(".strategy-head");anchor?.insertAdjacentElement("afterend",fig)}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();
