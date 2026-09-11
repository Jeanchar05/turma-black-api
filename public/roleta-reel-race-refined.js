"use strict";
(() => {
  function init() {
    const host=document.querySelector('#reelRace [data-race-tool]');if(!host||host.dataset.refined)return;const tool=host.querySelector('.tp-race-tool');if(!tool)return;host.dataset.refined='true';
    const legend=document.createElement('div');legend.className='real-race-legend';legend.innerHTML='<span><i></i>Centro escolhido</span><span><i></i>Vizinhos incluídos</span><span><i></i>Último resultado</span>';tool.querySelector('.tp-race-body').before(legend);
    const selection=document.createElement('section');selection.className='real-race-selection';selection.innerHTML='<h3 id="realSelectionTitle">Sua seleção</h3><div class="real-selection-chips" aria-labelledby="realSelectionTitle"></div>';tool.querySelector('.tp-race-foot').before(selection);
    tool.querySelector('[data-neighbor-step="-1"]').setAttribute('aria-label','Diminuir vizinhos');tool.querySelector('[data-neighbor-step="1"]').setAttribute('aria-label','Aumentar vizinhos');tool.querySelector('[data-race-summary]').setAttribute('role','status');
    const grid=tool.querySelector('[data-racetrack-grid]');[...grid.children].sort((a,b)=>Number(a.dataset.number)-Number(b.dataset.number)).forEach((el,index)=>el.style.setProperty('--mobile-order',index));
    function sync(){
      const state=window.TurmaRace.getState(), numbers=window.TurmaRace.getSelectedNumbers();
      selection.querySelector('h3').textContent=`Sua seleção · ${numbers.length} de 37 números`;
      const chips=selection.querySelector('.real-selection-chips');chips.replaceChildren();
      if(!numbers.length){const p=document.createElement('p');p.textContent='Escolha um número para começar sua leitura.';chips.append(p);}else [...numbers].sort((a,b)=>a-b).forEach(n=>{const chip=document.createElement('span');chip.textContent=n;chips.append(chip);});
      tool.querySelectorAll('[data-number]').forEach(button=>{const n=Number(button.dataset.number);button.setAttribute('aria-pressed',String(numbers.includes(n)));button.setAttribute('aria-label',`Número ${n}${state.centers.includes(n)?', centro escolhido':numbers.includes(n)?', incluído na seleção':''}`);});
      tool.querySelectorAll('[data-rt-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.rtView===state.view)));
      tool.querySelectorAll('[data-bet]').forEach(button=>{button.setAttribute('aria-pressed',String(state.bets.includes(button.dataset.bet)));const labels={red:'Vermelhos',black:'Pretos',first12:'1ª dúzia',second12:'2ª dúzia',third12:'3ª dúzia'};if(labels[button.dataset.bet])button.setAttribute('aria-label',labels[button.dataset.bet]);});
      tool.querySelector('[data-neighbor-step="-1"]').disabled=state.neighbors===0;tool.querySelector('[data-neighbor-step="1"]').disabled=state.neighbors===9;
    }
    window.addEventListener('turma:race-selection',sync);sync();
  }
  window.addEventListener('turma:race-ready',init);document.addEventListener('DOMContentLoaded',init);
})();
