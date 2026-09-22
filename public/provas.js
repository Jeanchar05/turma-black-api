"use strict";
(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let activeFilter="all";
  function toast(msg){const stack=$("#examToastStack");if(!stack)return;const el=document.createElement("div");el.className="exam-toast";el.textContent=msg;stack.appendChild(el);requestAnimationFrame(()=>el.classList.add("show"));setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),220)},3200)}
  function applyFilters(){const q=String($("#examSearch")?.value||"").trim().toLowerCase();$$('[data-exam-card]').forEach(card=>{const text=String(card.dataset.examCard||"").toLowerCase(),type=String(card.dataset.examType||"");const matchesQuery=!q||text.includes(q),matchesType=activeFilter==="all"||type===activeFilter;card.hidden=!(matchesQuery&&matchesType)});}
  function register(){
    $("#examHistoryBtn")?.addEventListener("click",()=>{const history=document.querySelector("#studentExamHistory,.exam-history-v6,[data-exam-history],.evolution-v6-history");if(history)history.scrollIntoView({behavior:"smooth",block:"start"});else toast("Seu histórico aparecerá aqui depois da primeira prova concluída.")});
    $("#examSearch")?.addEventListener("input",applyFilters);
    $$('[data-exam-filter]').forEach(button=>button.addEventListener("click",()=>{activeFilter=button.dataset.examFilter||"all";$$('[data-exam-filter]').forEach(item=>item.classList.toggle("active",item===button));applyFilters()}));
    document.addEventListener("turma:theme-change",()=>window.dispatchEvent(new Event("resize")));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",register,{once:true});else register();
})();