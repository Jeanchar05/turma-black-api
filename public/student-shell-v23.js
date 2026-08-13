"use strict";
(() => {
  if (window.__TURMA_STUDENT_SHELL_V23__) return;
  window.__TURMA_STUDENT_SHELL_V23__ = true;
  const path=(location.pathname.replace(/\/$/,"")||"/").toLowerCase();
  if (/^\/(admin|painel-vendas)(?:\/|$)/.test(path)) return;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const icon=id=>`<svg aria-hidden="true"><use href="/assets/dashboard-icons.svg#${id}"></use></svg>`;
  function injectStyle(src,key){if(document.querySelector(`link[data-${key}]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=src;l.dataset[key]='1';document.head.appendChild(l)}
  function injectScript(src,key){if(document.querySelector(`script[data-${key}]`))return;const s=document.createElement('script');s.src=src;s.defer=true;s.dataset[key]='1';document.head.appendChild(s)}

  function cleanLinks(){
    const routes={"dashboard.html":"/dashboard","notas.html":"/notas","minigames.html":"/minigames","estudo.html":"/estudo","modulos.html":"/modulos","gestao.html":"/gestao","suporte.html":"/suporte","perfil.html":"/perfil","roleta.html":"/roleta","provas.html":"/provas","favoritos.html":"/favoritos"};
    $$('a[href]').forEach(a=>{const raw=a.getAttribute('href')||'';const key=raw.replace(/^\//,'');if(routes[key])a.href=routes[key]});
  }

  function removeSound(){
    $$('[data-sound-toggle],[data-audio-toggle],.sound-toggle,.audio-toggle,.volume-toggle,#soundButton,#audioButton,#volumeButton,#reelAudio').forEach(el=>el.remove());
    $$('button,a').forEach(el=>{const t=`${el.getAttribute('aria-label')||''} ${el.title||''} ${el.textContent||''}`.toLowerCase();if(/\b(som|áudio|audio|volume|mute|mutar|desmutar)\b/.test(t)&&!/notifica/.test(t))el.remove()});
  }

  function sidebar(){
    const el=$('.dash-sidebar,.notes-sidebar,.support-sidebar'); if(!el)return;
    el.classList.add('dash-sidebar','tp-shell-sidebar');
    $('.dash-brand,.notes-brand,.support-brand',el)?.classList.add('dash-brand');
    const nav=$('.dash-nav,.notes-main-nav,.support-nav',el); if(!nav)return;
    nav.classList.add('dash-nav'); $$('a[href]',nav).forEach(a=>a.classList.add('dash-nav-item'));
  }

  function notificationPanel(){
    let p=$('#notificationPanel'); if(p){p.classList.add('tp-shell-notification-panel');return p}
    p=document.createElement('aside');p.id='notificationPanel';p.className='dash-notification-panel tp-shell-notification-panel';p.hidden=true;
    p.innerHTML='<div class="dash-notification-head"><h3>Notificações</h3><button id="markNotificationsRead" type="button">Marcar como lidas</button></div><div class="dash-notification-list" id="notificationList"><div class="dash-notification-empty">Carregando…</div></div>';
    ($('main')||document.body).appendChild(p);return p;
  }

  function topbar(){
    const el=$('.dash-topbar,.notes-topbar,.support-topbar'); if(!el)return;
    el.classList.add('dash-topbar','tp-shell-topbar');
    $('.dash-menu-toggle,.notes-menu-button,.support-menu-button,[aria-label*="Abrir menu"]',el)?.classList.add('dash-menu-toggle');
    let actions=$('.dash-top-actions,.notes-top-actions,.support-top-actions',el);
    if(!actions){actions=document.createElement('div');actions.className='dash-top-actions tp-shell-actions';el.appendChild(actions)}else actions.classList.add('dash-top-actions','tp-shell-actions');
    let theme=$('[data-global-theme],.dash-theme-toggle,#studyThemeToggle,#themeButton,#profileThemeToggle,#rouletteThemeTop,#examThemeToggle,#favoritesThemeToggle',actions);
    if(!theme){theme=document.createElement('button');theme.type='button';theme.className='dash-theme-toggle';theme.setAttribute('data-global-theme','');theme.setAttribute('aria-label','Alternar tema');theme.innerHTML=icon('i-moon');actions.prepend(theme)}else{theme.classList.add('dash-theme-toggle');theme.setAttribute('data-global-theme','')}
    let bell=$('#notificationButton',actions)||$('.dash-notification-btn',actions);
    if(bell?.tagName==='A'){const b=document.createElement('button');b.type='button';b.className=bell.className;b.innerHTML=bell.innerHTML||icon('i-bell');bell.replaceWith(b);bell=b}
    if(!bell){bell=document.createElement('button');bell.type='button';bell.className='dash-notification-btn';bell.innerHTML=icon('i-bell');const user=$('.dash-user-menu,.notes-top-user,.support-top-user',actions);user?actions.insertBefore(bell,user):actions.appendChild(bell)}
    bell.id='notificationButton';bell.setAttribute('aria-label','Abrir notificações');if(!$('#notificationBadge',bell)){const badge=document.createElement('b');badge.id='notificationBadge';badge.hidden=true;badge.textContent='0';bell.appendChild(badge)}
    $('.dash-user-menu,.notes-top-user,.support-top-user',actions)?.classList.add('dash-user-menu');
    notificationPanel();
  }

  function notes(){
    if(path!='/notas'&&path!='/notas.html')return;
    ['categoryFilter','sortFilter','noteCategory'].forEach(id=>{const s=document.getElementById(id);if(s){s.disabled=false;s.removeAttribute('aria-disabled');s.style.pointerEvents='auto'}});
    $$('.notes-category-list button,[data-category]').forEach(b=>{b.disabled=false;b.style.pointerEvents='auto'});
    injectStyle('/notes-category-hotfix.css?v=20260812-notes-v25','notesCategoryHotfixCss');
    injectScript('/notes-category-hotfix.js?v=20260812-notes-v25','notesCategoryHotfixJs');
  }

  function bindBell(){
    if(path==='/dashboard'||path==='/dashboard.html')return;
    const b=$('#notificationButton'),p=$('#notificationPanel');if(!b||!p||b.dataset.shellBound)return;b.dataset.shellBound='1';
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();p.hidden=!p.hidden;if(!p.hidden)document.dispatchEvent(new CustomEvent('turma:notifications-refresh'))});
    document.addEventListener('click',e=>{if(!p.hidden&&!e.target.closest('#notificationPanel')&&!e.target.closest('#notificationButton'))p.hidden=true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')p.hidden=true});
  }

  function liveNotifications(){
    if($('script[src*="dashboard-notifications-live.js"]'))return;
    const s=document.createElement('script');s.src='/dashboard-notifications-live.js?v=20260812-shell-v25';s.defer=true;document.head.appendChild(s);
  }

  function init(){cleanLinks();removeSound();sidebar();topbar();notes();bindBell();liveNotifications();document.documentElement.dataset.studentShell='v25'}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
  document.addEventListener('turma:protected-ready',init);
})();
