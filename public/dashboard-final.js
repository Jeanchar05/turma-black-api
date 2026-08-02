"use strict";
(()=>{
  if(window.__TURMA_DASHBOARD_FINAL__)return;window.__TURMA_DASHBOARD_FINAL__=true;
  const $=(s,r=document)=>r.querySelector(s);
  function stage(){const hero=$('.dash-hero');if(!hero)return null;let visual=$('.dash-hero-stage',hero);if(!visual){visual=document.createElement('div');visual.className='dash-hero-stage';visual.setAttribute('aria-hidden','true');hero.appendChild(visual)}return visual}
  function movePortrait(){const hero=$('.dash-hero'),visual=stage();if(!hero||!visual)return false;const wrappers=[...document.querySelectorAll('.dash-hero-portrait-wrap')];if(!wrappers.length)return false;const chosen=wrappers[wrappers.length-1];wrappers.slice(0,-1).forEach(el=>el.remove());if(chosen.parentElement!==visual)visual.appendChild(chosen);return true}
  function watchPortrait(){if(movePortrait())return;const hero=$('.dash-hero');if(!hero)return;const observer=new MutationObserver(()=>{if(movePortrait())observer.disconnect()});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),5000)}
  function hardenControls(){
    const theme=$('[data-global-theme],.dash-theme-toggle');if(theme)theme.type='button';
    const legacy=$('#notificationPanel');if(legacy)legacy.remove();
    const bell=$('#notificationButton');if(bell){bell.type='button';bell.dataset.notificationToggle='1';bell.removeAttribute('onclick')}
  }
  function init(){stage();watchPortrait();hardenControls();document.body.classList.add('dashboard-final-ready')}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();