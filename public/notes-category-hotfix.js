"use strict";
(() => {
  if (window.__TURMA_NOTES_CATEGORY_V23__) return;
  window.__TURMA_NOTES_CATEGORY_V23__ = true;
  const native = () => document.getElementById("noteCategory");
  let picker = null, button = null, menu = null, observer = null;

  function close(){ if(picker) picker.classList.remove("open"); }
  function sync(){
    const select=native(); if(!select||!menu||!button)return;
    const options=[...select.options].map(o=>({value:o.value,label:o.textContent||o.value}));
    if(!options.length)return;
    if(!select.value||!options.some(o=>o.value===select.value))select.value=options[0].value;
    button.querySelector("span").textContent=options.find(o=>o.value===select.value)?.label||"Geral";
    menu.innerHTML=options.map(o=>`<button type="button" class="notes-category-picker-option ${o.value===select.value?"active":""}" data-note-category-value="${String(o.value).replace(/"/g,"&quot;")}"><span>${String(o.label).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</span></button>`).join("");
  }
  function choose(value){
    const select=native(); if(!select)return;
    select.value=value;
    select.dispatchEvent(new Event("input",{bubbles:true}));
    select.dispatchEvent(new Event("change",{bubbles:true}));
    sync(); close();
  }
  function mount(){
    const select=native(); if(!select)return false;
    if(document.querySelector(".notes-category-picker")){picker=document.querySelector(".notes-category-picker");button=picker.querySelector(".notes-category-picker-button");menu=picker.querySelector(".notes-category-picker-menu");sync();return true}
    picker=document.createElement("div");picker.className="notes-category-picker";
    picker.innerHTML='<button class="notes-category-picker-button" type="button" aria-haspopup="listbox" aria-expanded="false"><span>Geral</span></button><div class="notes-category-picker-menu" role="listbox"></div>';
    select.insertAdjacentElement("afterend",picker);
    button=picker.querySelector(".notes-category-picker-button");menu=picker.querySelector(".notes-category-picker-menu");
    button.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();const open=!picker.classList.contains("open");close();picker.classList.toggle("open",open);button.setAttribute("aria-expanded",String(open));if(open)sync()});
    menu.addEventListener("click",e=>{const option=e.target.closest("[data-note-category-value]");if(option)choose(option.dataset.noteCategoryValue)});
    document.addEventListener("click",e=>{if(!e.target.closest(".notes-category-picker"))close()});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
    select.addEventListener("change",sync);select.addEventListener("input",sync);
    observer=new MutationObserver(sync);observer.observe(select,{childList:true,subtree:true,attributes:true});
    sync();return true;
  }
  function boot(){if(mount())return;let tries=0;const timer=setInterval(()=>{if(mount()||++tries>40)clearInterval(timer)},100)}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
  document.addEventListener("turma:protected-ready",()=>{mount();sync()});
})();
