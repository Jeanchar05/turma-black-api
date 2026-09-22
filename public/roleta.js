"use strict";
(() => {
  const $=id=>document.getElementById(id), $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const AFFILIATE_URL="https://go.aff.esportiva.bet/bhotuu7q";
  function toast(message,type="success"){const stack=$("rouletteToastStack");if(!stack)return;const item=document.createElement("div");item.className=`roulette-toast ${type}`;item.textContent=message;stack.appendChild(item);requestAnimationFrame(()=>item.classList.add("show"));setTimeout(()=>{item.classList.remove("show");setTimeout(()=>item.remove(),220)},3200)}
  function openSearch(){const modal=$("rouletteSearchModal");if(!modal)return;modal.hidden=false;const input=$("rouletteSearchInput");if(input){input.value="";setTimeout(()=>input.focus(),25)}renderSearch("")}
  function closeSearch(){if($("rouletteSearchModal"))$("rouletteSearchModal").hidden=true}
  const searchItems=[
    ["EsportivaBet","Acesso oficial da Turma do Primo","i-roulette",AFFILIATE_URL,true],
    ["Roleta Brasileira — Playtech","Mesa brasileira","i-roulette","https://esportiva.bet.br/games/playtech/roleta-brasileira",true],
    ["Roleta Brasileira — Pragmatic Play","Mesa brasileira","i-roulette","https://esportiva.bet.br/games/pragmaticplay/roleta-brasileira",true],
    ["Roullete immersive — Evolution","Roleta imersiva","i-crown","https://esportiva.bet.br/games/evolution/immersive-roulette",true],
    ["Turistas roullet","Mesa da área operacional","i-activity","https://esportiva.bet.br/games/imaginelive/turkce-rulet",true],
    ["Roleta Reel","Minigame conectado à Race","i-game","/roleta-reel",false],
    ["Gêmeos","Módulo 11, 22 e 33","i-book","/estudo-gemeos",false],
    ["Pitágoras","Triangulação na Race","i-target","/estudo-triangulacao",false],
    ["Cavalo","Famílias de terminais","i-activity","/estudo-cavalos",false]
  ];
  function renderSearch(query){const container=$("rouletteSearchResults");if(!container)return;const q=String(query||"").trim().toLowerCase(),items=searchItems.filter(([title,desc])=>!q||`${title} ${desc}`.toLowerCase().includes(q));container.innerHTML=items.map(([title,desc,icon,href,external])=>`<a class="roulette-search-result" href="${href}" ${external?'target="_blank" rel="noopener noreferrer sponsored"':""}><span><svg><use href="/assets/dashboard-icons.svg#${icon}"></use></svg></span><div><strong>${title}</strong><small>${desc}</small></div></a>`).join("")||'<div style="padding:28px;text-align:center;color:var(--learn-muted);font-size:11px">Nenhum resultado encontrado.</div>'}
  function loadAffiliateStyle(){if(document.querySelector('link[data-esportiva-affiliate]'))return;const link=document.createElement("link");link.rel="stylesheet";link.href="/esportiva-affiliate-v10.css?v=20260922-1";link.dataset.esportivaAffiliate="1";document.head.appendChild(link)}
  function applyAffiliateLinks(){
    const main=$("esportivaAccess");if(main)main.href=AFFILIATE_URL;
    document.querySelectorAll('a[href*="ref=f4ae076a736d"]').forEach(link=>{link.href=AFFILIATE_URL;link.rel="noopener noreferrer sponsored"});
  }
  function normalizeRouletteNames(){
    const cards=$$(".roulette-casino-card");
    const names=["Roleta Brasileira (Playtech)","Roleta Brasileira (Pragmatic)","Roullete immersive (evolution)","Turistas roullet"];
    cards.forEach((card,index)=>{const title=card.querySelector("h3");if(title&&names[index])title.textContent=names[index]});
    if(cards[2]){const img=cards[2].querySelector("img");if(img)img.alt="Roullete immersive (evolution)"}
    if(cards[3]){const img=cards[3].querySelector("img");if(img)img.alt="Turistas roullet";const badge=cards[3].querySelector(".roulette-badge");if(badge)badge.textContent="TURISTAS ROULLET";const desc=cards[3].querySelector(".roulette-card-body small");if(desc)desc.textContent="Acesso direto pela área operacional"}
  }
  function mountAffiliateBanner(){
    if(document.querySelector(".esportiva-affiliate-banner"))return;
    const panels=$$(".roulette-panel-new");const roulettePanel=panels[0];if(!roulettePanel)return;
    const section=document.createElement("section");section.className="esportiva-affiliate-banner";section.innerHTML=`<div class="esportiva-affiliate-copy"><span class="esportiva-affiliate-kicker"><svg><use href="/assets/dashboard-icons.svg#i-crown"></use></svg>ACESSO OFICIAL DA TURMA</span><h2>Vai acessar as mesas? Entre pela <span class="esportiva-affiliate-logo"><strong>Esportiva</strong><b>Bet</b></span>.</h2><p>Use o link oficial da Turma do Primo para entrar ou criar sua conta antes de acessar as roletas. <strong>O acesso continua sendo feito diretamente na plataforma da Esportiva.</strong></p></div><div class="esportiva-affiliate-actions"><a class="esportiva-affiliate-button" href="${AFFILIATE_URL}" target="_blank" rel="noopener noreferrer sponsored"><svg><use href="/assets/dashboard-icons.svg#i-roulette"></use></svg>Acessar Esportiva <b>↗</b></a><small>Link de afiliado da Turma do Primo · 18+ · Jogue com responsabilidade.</small></div>`;
    roulettePanel.insertAdjacentElement("afterend",section);
  }
  function register(){
    loadAffiliateStyle();applyAffiliateLinks();normalizeRouletteNames();mountAffiliateBanner();
    $("rouletteSearchTrigger")?.addEventListener("click",openSearch);
    $("rouletteSearchInput")?.addEventListener("input",event=>renderSearch(event.target.value));
    $("rouletteSearchModal")?.addEventListener("click",event=>{if(event.target===$("rouletteSearchModal"))closeSearch()});
    document.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();openSearch()}if(event.key==="Escape")closeSearch()});
    document.addEventListener("turma:theme-change",()=>window.dispatchEvent(new Event("resize")));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",register,{once:true});else register();
})();