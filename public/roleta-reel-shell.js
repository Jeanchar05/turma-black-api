"use strict";
(() => {
  const root = document.documentElement;
  try { root.dataset.theme = localStorage.getItem('turma.workspace.theme') || 'dark'; root.classList.toggle('sidebar-compact', localStorage.getItem('turma.workspace.compact') === 'true'); } catch {}
  document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    $('mainNav').innerHTML = window.TurmaWorkspaceNav.map(([label,route,symbol]) => `<a href="/${route}" title="${label}" ${route === 'roleta-real' ? 'class="active" aria-current="page"' : ''}><svg aria-hidden="true"><use href="/assets/dashboard-icons.svg#${symbol}"></use></svg><span>${label}</span></a>`).join('');
    const close = () => { $('sidebar').classList.remove('open'); $('menuToggle').setAttribute('aria-expanded','false'); $('menuBackdrop').hidden = true; document.body.classList.remove('menu-open'); };
    $('menuToggle').addEventListener('click', () => { const open = !$('sidebar').classList.contains('open'); close(); if(open){$('sidebar').classList.add('open');$('menuToggle').setAttribute('aria-expanded','true');$('menuBackdrop').hidden=false;document.body.classList.add('menu-open');$('sidebar').querySelector('a').focus();} });
    $('menuBackdrop').addEventListener('click',()=>{close();$('menuToggle').focus();});
    matchMedia('(min-width:721px)').addEventListener('change', close);
    document.addEventListener('keydown',event=>{
      if(!$('sidebar').classList.contains('open'))return;
      if(event.key==='Escape'){close();$('menuToggle').focus();}
      if(event.key==='Tab'){
        const items=[$('menuToggle'),...$('sidebar').querySelectorAll('a,button')].filter(el=>el.getClientRects().length), first=items[0], last=items.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
    function collapse(){const compact=root.classList.contains('sidebar-compact');$('sidebarCollapse').textContent=compact?'»':'«';$('sidebarCollapse').setAttribute('aria-expanded',String(!compact));$('sidebarCollapse').setAttribute('aria-label',compact?'Expandir menu lateral':'Recolher menu lateral');}
    $('sidebarCollapse').addEventListener('click',()=>{root.classList.toggle('sidebar-compact');try{localStorage.setItem('turma.workspace.compact',String(root.classList.contains('sidebar-compact')));}catch{}collapse();});collapse();
    function paint(){const light=root.dataset.theme==='light';$('reelThemeToggle').setAttribute('aria-label',light?'Ativar tema escuro':'Ativar tema claro');$('reelThemeToggle').setAttribute('aria-pressed',String(light));$('reelThemeToggle').textContent=light?'☾':'☀';document.querySelector('meta[name="theme-color"]').content=light?'#f1eff5':'#09090e';}
    if(document.body.classList.contains('real-intro'))$('reelThemeToggle').addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='light'?'dark':'light';try{localStorage.setItem('turma.workspace.theme',root.dataset.theme);}catch{}paint();});
    window.addEventListener('turma:theme-change',paint);paint();
    document.addEventListener('turma:protected-ready',event=>{const user=event.detail?.user;if(user)document.querySelectorAll('[data-user-name]').forEach(el=>el.textContent=String(user.nome||'Primo').split(' ')[0]);});
  });
})();
