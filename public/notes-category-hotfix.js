"use strict";
(() => {
  if (window.__TURMA_NOTES_CATEGORY_V25__) return;
  window.__TURMA_NOTES_CATEGORY_V25__ = true;
  const native=()=>document.getElementById("noteCategory");
  let picker,button,menu,observer;

  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  function options(){const select=native();return select?[...select.options].map(o=>({value:o.value,label:o.textContent||o.value})):[]}
  function currentLabel(){const select=native(),list=options();return list.find(o=>o.value===select?.value)?.label||list[0]?.label||"Geral"}
  function close(){if(!menu||!button)return;menu.hidden=true;button.setAttribute("aria-expanded","false");picker?.classList.remove("open")}
  function position(){if(!menu||menu.hidden||!button)return;const r=button.getBoundingClientRect(),gap=7,spaceBelow=innerHeight-r.bottom,preferred=Math.min(320,Math.max(190,innerHeight*.42));const openUp=spaceBelow<preferred+gap&&r.top>spaceBelow;menu.style.left=`${Math.max(10,Math.min(r.left,innerWidth-r.width-10))}px`;menu.style.width=`${Math.min(r.width,innerWidth-20)}px`;menu.style.maxHeight=`${preferred}px`;if(openUp){menu.style.top="auto";menu.style.bottom=`${Math.max(10,innerHeight-r.top+gap)}px`}else{menu.style.bottom="auto";menu.style.top=`${Math.min(innerHeight-80,r.bottom+gap)}px`}}
  function render(){if(!button||!menu)return;const list=options();button.querySelector("span").textContent=currentLabel();menu.innerHTML=list.map(o=>`<button type="button" class="notes-category-picker-option ${o.value===native()?.value?"active":""}" data-note-category-value="${esc(o.value)}" role="option" aria-selected="${o.value===native()?.value}"><span>${esc(o.label)}</span></button>`).join("");if(!menu.hidden)position()}
  function choose(value){const select=native();if(!select)return;select.value=value;select.dispatchEvent(new Event("input",{bubbles:true}));select.dispatchEvent(new Event("change",{bubbles:true}));render();close()}
  function open(){if(!menu||!button)return;render();menu.hidden=false;picker?.classList.add("open");button.setAttribute("aria-expanded","true");position()}
  function mount(){
    const select=native();if(!select)return false;
    if(document.querySelector(".notes-category-picker")){picker=document.querySelector(".notes-category-picker");button=picker.querySelector(".notes-category-picker-button");menu=document.querySelector("#notesCategoryFloatingMenu");render();return true}
    picker=document.createElement("div");picker.className="notes-category-picker";picker.innerHTML='<button class="notes-category-picker-button" type="button" aria-haspopup="listbox" aria-expanded="false"><span>Geral</span><i aria-hidden="true">⌄</i></button>';select.insertAdjacentElement("afterend",picker);button=picker.querySelector(".notes-category-picker-button");
    menu=document.createElement("div");menu.id="notesCategoryFloatingMenu";menu.className="notes-category-floating-menu";menu.setAttribute("role","listbox");menu.hidden=true;document.body.appendChild(menu);
    button.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();menu.hidden?open():close()});
    menu.addEventListener("click",e=>{const option=e.target.closest("[data-note-category-value]");if(option)choose(option.dataset.noteCategoryValue)});
    document.addEventListener("click",e=>{if(!e.target.closest(".notes-category-picker")&&!e.target.closest("#notesCategoryFloatingMenu"))close()});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
    window.addEventListener("resize",()=>{if(!menu.hidden)position()},{passive:true});
    document.addEventListener("scroll",()=>{if(!menu.hidden)position()},{passive:true,capture:true});
    select.addEventListener("change",render);select.addEventListener("input",render);
    observer=new MutationObserver(render);observer.observe(select,{childList:true,subtree:true,attributes:true});render();return true
  }
  function boot(){if(mount())return;let tries=0;const timer=setInterval(()=>{if(mount()||++tries>50)clearInterval(timer)},100)}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
  document.addEventListener("turma:protected-ready",()=>{mount();render()});
})();
