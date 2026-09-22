"use strict";
(() => {
  const $=id=>document.getElementById(id), $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  function toast(message,type="success"){const stack=$("rouletteToastStack");if(!stack)return;const item=document.createElement("div");item.className=`roulette-toast ${type}`;item.textContent=message;stack.appendChild(item);requestAnimationFrame(()=>item.classList.add("show"));setTimeout(()=>{item.classList.remove("show");setTimeout(()=>item.remove(),220)},3200)}
  function openSearch(){const modal=$("rouletteSearchModal");if(!modal)return;modal.hidden=false;const input=$("rouletteSearchInput");if(input){input.value="";setTimeout(()=>input.focus(),25)}renderSearch("")}
  function closeSearch(){if($("rouletteSearchModal"))$("rouletteSearchModal").hidden=true}
  const searchItems=[
    ["EsportivaBet","Link oficial da Turma do Primo","i-roulette","https://esportiva.bet.br?ref=f4ae076a736d",true],
    ["Roleta Brasileira — Playtech","Mesa brasileira ao vivo","i-roulette","https://esportiva.bet.br/games/playtech/roleta-brasileira",true],
    ["Roleta Brasileira — Pragmatic Play","Mesa localizada para o Brasil","i-roulette","https://esportiva.bet.br/games/pragmaticplay/roleta-brasileira",true],
    ["Immersive Roulette — Evolution","Roleta ao vivo imersiva","i-crown","https://esportiva.bet.br/games/evolution/immersive-roulette",true],
    ["Turkish Roulette — Imagine Live","Mesa Türkçe Rulet","i-activity","https://esportiva.bet.br/games/imaginelive/turkce-rulet",true],
    ["Roleta Reel","Minigame conectado à Race","i-game","/roleta-reel",false],
    ["Gêmeos","Módulo 11, 22 e 33","i-book","/estudo-gemeos",false],
    ["Pitágoras","Triangulação na Race","i-target","/estudo-triangulacao",false],
    ["Cavalo","Famílias de terminais","i-activity","/estudo-cavalos",false]
  ];
  function renderSearch(query){const container=$("rouletteSearchResults");if(!container)return;const q=String(query||"").trim().toLowerCase(),items=searchItems.filter(([title,desc])=>!q||`${title} ${desc}`.toLowerCase().includes(q));container.innerHTML=items.map(([title,desc,icon,href,external])=>`<a class="roulette-search-result" href="${href}" ${external?'target="_blank" rel="noopener sponsored"':""}><span><svg><use href="/assets/dashboard-icons.svg#${icon}"></use></svg></span><div><strong>${title}</strong><small>${desc}</small></div></a>`).join("")||'<div style="padding:28px;text-align:center;color:var(--learn-muted);font-size:11px">Nenhum resultado encontrado.</div>'}
  function register(){
    $("rouletteSearchTrigger")?.addEventListener("click",openSearch);
    $("rouletteSearchInput")?.addEventListener("input",event=>renderSearch(event.target.value));
    $("rouletteSearchModal")?.addEventListener("click",event=>{if(event.target===$("rouletteSearchModal"))closeSearch()});
    document.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();openSearch()}if(event.key==="Escape")closeSearch()});
    document.addEventListener("turma:theme-change",()=>window.dispatchEvent(new Event("resize")));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",register,{once:true});else register();
})();