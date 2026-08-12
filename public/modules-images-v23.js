"use strict";
(() => {
  if(window.__TURMA_MODULES_IMAGES_V23__)return;window.__TURMA_MODULES_IMAGES_V23__=true;
  const covers={
    "gêmeos":"/assets/imperial-v14/modules/gemeos.svg","gemeos":"/assets/imperial-v14/modules/gemeos.svg",
    "espelhos":"/assets/imperial-v14/modules/espelhos.svg","fibonacci":"/assets/imperial-v14/modules/fibonacci.svg",
    "magneto":"/assets/imperial-v14/modules/magneto.svg","camaleões":"/assets/imperial-v14/modules/camaleoes.svg","camaleoes":"/assets/imperial-v14/modules/camaleoes.svg",
    "pitágoras":"/assets/imperial-v14/modules/pitagoras.svg","pitagoras":"/assets/imperial-v14/modules/pitagoras.svg",
    "cavalos":"/assets/imperial-v14/modules/cavalo.svg","cavalo":"/assets/imperial-v14/modules/cavalo.svg",
    "eclipse zero":"/assets/imperial-v14/modules/eclipse-zero.svg"
  };
  const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  function source(text){const n=norm(text);for(const [name,src]of Object.entries(covers))if(n.includes(norm(name)))return src;return""}
  function apply(){let count=0;document.querySelectorAll(".module-video-item").forEach(card=>{const src=source(card.textContent);if(!src)return;const cover=card.querySelector(".module-video-cover");if(!cover)return;let img=cover.querySelector("img");if(!img){img=document.createElement("img");cover.appendChild(img)}img.src=src;img.hidden=false;img.loading="eager";img.decoding="async";img.alt=`Capa oficial de ${card.querySelector("strong")?.textContent||"módulo"}`;count++});return count>=8}
  if(apply())return;const observer=new MutationObserver(()=>{if(apply())observer.disconnect()});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),2500);
})();