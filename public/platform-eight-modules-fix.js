"use strict";
(() => {
  const MODULE_STORES = [
    "study_espelhos_gemeos_v1","study_espelhos_v1","study_fibonacci_v1","study_magneto_v1",
    "study_camaleoes_v2","study_triangulacao_v1","study_cavalos_v1","study_eclipse_zero_v1"
  ];
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)];

  function completedModules(){
    return MODULE_STORES.reduce((total,key)=>{
      try{
        const data=JSON.parse(localStorage.getItem(key)||"{}");
        const values=Object.values(data.progress||{});
        return total+(values.length&&values.every(Boolean)?1:0);
      }catch{return total;}
    },0);
  }

  function focusDays(){
    const key="turma_focus_streak_v2";
    const today=new Date().toISOString().slice(0,10);
    try{
      const current=JSON.parse(localStorage.getItem(key)||"{}");
      if(current.last===today)return Number(current.days||1);
      const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
      const days=current.last===yesterday?Number(current.days||0)+1:1;
      localStorage.setItem(key,JSON.stringify({last:today,days}));
      return days;
    }catch{return 1;}
  }

  function replaceModuleTotals(){
    const done=completedModules();
    const stat=$("#statModules"); if(stat) stat.textContent=`${done} / 8`;
    const focus=$("#statFocus"); if(focus) focus.textContent=String(focusDays());
    const patterns=[
      [/\b\d+\s*\/\s*7\b/g,`${done}/8`],
      [/\b\d+\s*\/\s*6\b/g,`${done}/8`],
      [/\b7\s+m[oó]dulos?\s+dispon[ií]veis\b/gi,"8 módulos disponíveis"],
      [/\b6\s+m[oó]dulos?\s+dispon[ií]veis\b/gi,"8 módulos disponíveis"]
    ];
    $$('body *').forEach(el=>{
      if(el.children.length||!el.textContent)return;
      let text=el.textContent;
      let next=text;
      patterns.forEach(([re,val])=>{next=next.replace(re,val)});
      if(next!==text)el.textContent=next;
    });
  }

  function removeSoonBadges(){
    $$('body *').forEach(el=>{
      if(el.children.length>3)return;
      const text=(el.textContent||'').trim();
      if(!/em breve/i.test(text))return;
      const scope=el.closest('article,li,div');
      const scopeText=(scope?.textContent||'');
      if(/cavalos?|eclipse\s*(zero|0)/i.test(scopeText)){
        if(/^em breve$/i.test(text))el.remove();
        else el.textContent=text.replace(/\s*[-–—|·]?\s*em breve\s*/ig,' ').trim();
      }
    });
  }

  function apply(){
    replaceModuleTotals();
    removeSoonBadges();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  setTimeout(apply,700);setTimeout(apply,1800);
  new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
})();