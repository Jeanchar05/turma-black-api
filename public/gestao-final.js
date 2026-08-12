"use strict";
(() => {
  if(window.__TURMA_GESTAO_V23__)return;window.__TURMA_GESTAO_V23__=true;
  function loadCover(){return new Promise(resolve=>{if(window.TURMA_GESTAO_CAPA)return resolve(window.TURMA_GESTAO_CAPA);const old=[...document.scripts].find(s=>s.src.includes('/assets/gestao/gestao-capa-data.js'));if(old){let tries=0;const timer=setInterval(()=>{if(window.TURMA_GESTAO_CAPA||++tries>20){clearInterval(timer);resolve(window.TURMA_GESTAO_CAPA||'')}},80);return}const s=document.createElement('script');s.src='/assets/gestao/gestao-capa-data.js?v=20260812-gestao-v23';s.onload=()=>resolve(window.TURMA_GESTAO_CAPA||'');s.onerror=()=>resolve('');document.head.appendChild(s)})}
  async function enhance(){
    document.body.classList.add('bankroll-compact-v23');
    const hero=document.querySelector('.bankroll-hero');
    if(hero&&!hero.querySelector('.bankroll-hero-visual')){
      const actions=hero.querySelector('.bankroll-hero-actions');
      if(actions){const copy=hero.querySelector('div:first-child');if(copy&&!copy.contains(actions))copy.appendChild(actions)}
      const visual=document.createElement('div');visual.className='bankroll-hero-visual';visual.innerHTML='<div style="height:100%;display:grid;place-items:center;color:#9f8daa;font:700 11px Inter,sans-serif">Carregando arte…</div>';hero.appendChild(visual);
      const cover=await loadCover();
      if(cover)visual.innerHTML=`<img src="${cover}" alt="Gestão de Banca — controle e disciplina" decoding="async">`;
      else visual.innerHTML='<div style="height:100%;display:grid;place-items:center;padding:20px;text-align:center"><img src="/assets/turma-primo-logo.svg" alt="Turma do Primo" style="width:74px;height:86px;object-fit:contain"><strong style="display:block;margin-top:8px;color:#efc45d;font:800 11px Sora">CONTROLE • DISCIPLINA • CONSISTÊNCIA</strong></div>';
    }
    document.getElementById('exportBankrollButton')?.remove();
    document.querySelector('.history-panel')?.remove();
    document.querySelector('.bankroll-layout')?.classList.add('bankroll-layout-no-history');
    document.querySelector('.chart-panel')?.classList.add('bankroll-chart-featured');
    const chartSmall=document.querySelector('.chart-panel .bankroll-panel-head small');if(chartSmall)chartSmall.textContent='Evolução da sua banca';
    const search=document.querySelector('.bankroll-search-copy em');if(search)search.textContent='Planeje, proteja e acompanhe sua banca';
    const heroText=hero?.querySelector('p');if(heroText)heroText.textContent='Configure banca, unidade, meta e stop-loss em uma tela simples. Acompanhe a sessão sem perder o foco nos seus limites.';
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',enhance,{once:true}):enhance();
  document.addEventListener('turma:protected-ready',enhance);
})();