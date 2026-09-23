"use strict";
(() => {
  const $=id=>document.getElementById(id), $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const AFFILIATE="https://go.aff.esportiva.bet/bhotuu7q";
  function openSearch(){const modal=$("rouletteSearchModal");if(!modal)return;modal.hidden=false;const input=$("rouletteSearchInput");if(input){input.value="";setTimeout(()=>input.focus(),25)}renderSearch("")}
  function closeSearch(){if($("rouletteSearchModal"))$("rouletteSearchModal").hidden=true}
  const searchItems=[
    ["Esportiva","Link oficial da Turma do Primo","i-roulette",AFFILIATE,true],
    ["Roullete immersive (Evolution)","Experiência imersiva Evolution","i-crown","https://esportiva.bet.br/games/evolution/immersive-roulette",true],
    ["Roleta Brasileira (Playtech)","Mesa brasileira Playtech","i-roulette","https://esportiva.bet.br/games/playtech/roleta-brasileira",true],
    ["Roleta Brasileira (Pragmatic)","Mesa brasileira Pragmatic Play","i-roulette","https://esportiva.bet.br/games/pragmaticplay/roleta-brasileira",true],
    ["Tukias roullet","Mesa selecionada Imagine Live","i-activity","https://esportiva.bet.br/games/imaginelive/turkce-rulet",true],
    ["Roleta Reel","Minigame conectado à Race","i-game","/roleta-reel",false],
    ["Gêmeos","Módulo 11, 22 e 33","i-book","/estudo-gemeos",false],
    ["Pitágoras","Triangulação na Race","i-target","/estudo-triangulacao",false]
  ];
  function renderSearch(query){const container=$("rouletteSearchResults");if(!container)return;const q=String(query||"").trim().toLowerCase(),items=searchItems.filter(([title,desc])=>!q||`${title} ${desc}`.toLowerCase().includes(q));container.innerHTML=items.map(([title,desc,icon,href,external])=>`<a class="roulette-search-result" href="${href}" ${external?'target="_blank" rel="noopener noreferrer sponsored"':""}><span><svg><use href="/assets/dashboard-icons.svg#${icon}"></use></svg></span><div><strong>${title}</strong><small>${desc}</small></div></a>`).join("")||'<div style="padding:28px;text-align:center;color:var(--learn-muted);font-size:11px">Nenhum resultado encontrado.</div>'}
  function applyThemeArt(){const theme=document.documentElement.dataset.theme==="light"?"light":"dark";$$('[data-theme-art]').forEach(img=>{const src=img.dataset[theme];if(src&&img.getAttribute("src")!==src)img.src=src;});}
  function secureAffiliate(){const link=$("esportivaAccess");if(link){link.href=AFFILIATE;link.target="_blank";link.rel="noopener noreferrer sponsored";}$$(`a[href="${AFFILIATE}"]`).forEach(a=>{a.target="_blank";a.rel="noopener noreferrer sponsored";});}
  function register(){
    secureAffiliate();applyThemeArt();
    $("rouletteSearchTrigger")?.addEventListener("click",openSearch);
    $("rouletteSearchInput")?.addEventListener("input",event=>renderSearch(event.target.value));
    $("rouletteSearchModal")?.addEventListener("click",event=>{if(event.target===$("rouletteSearchModal"))closeSearch()});
    document.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();openSearch()}if(event.key==="Escape")closeSearch()});
    document.addEventListener("turma:theme-change",()=>{applyThemeArt();window.dispatchEvent(new Event("resize"));});
    new MutationObserver(records=>{if(records.some(record=>record.attributeName==="data-theme"))applyThemeArt();}).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",register,{once:true});else register();
})();