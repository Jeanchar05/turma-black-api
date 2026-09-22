"use strict";
(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  function toast(msg){const stack=$("#examToastStack");if(!stack)return;const el=document.createElement("div");el.className="exam-toast";el.textContent=msg;stack.appendChild(el);requestAnimationFrame(()=>el.classList.add("show"));setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),220)},3200)}
  function register(){
    $("#examHistoryBtn")?.addEventListener("click",()=>{const history=document.querySelector("#studentExamHistory,.exam-history-v6,[data-exam-history]");if(history)history.scrollIntoView({behavior:"smooth",block:"start"});else toast("Seu histórico aparecerá aqui depois da primeira prova concluída.")});
    $("#examSearch")?.addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();$$('[data-exam-card]').forEach(card=>{card.hidden=!!q&&!String(card.dataset.examCard||"").toLowerCase().includes(q)})});
    document.addEventListener("turma:theme-change",()=>window.dispatchEvent(new Event("resize")));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",register,{once:true});else register();
})();