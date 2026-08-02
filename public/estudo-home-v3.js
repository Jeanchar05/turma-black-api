"use strict";
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const svgData = (title, subtitle, symbol) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><defs><radialGradient id="b" cx="50%" cy="45%"><stop stop-color="#32105f"/><stop offset="1" stop-color="#05020a"/></radialGradient><linearGradient id="g"><stop stop-color="#ffcf62"/><stop offset="1" stop-color="#a83cff"/></linearGradient></defs><rect width="1200" height="675" rx="36" fill="url(#b)"/><circle cx="245" cy="335" r="175" fill="none" stroke="#9b36ff" stroke-width="14" opacity=".45"/><text x="245" y="395" text-anchor="middle" fill="url(#g)" font-size="190">${symbol}</text><text x="515" y="285" fill="#fff" font-family="serif" font-size="88" font-weight="700">${title}</text><text x="520" y="365" fill="#d99bff" font-family="sans-serif" font-size="30" letter-spacing="5">${subtitle}</text><text x="520" y="445" fill="#f3cf75" font-family="sans-serif" font-size="25">TURMA DO PRIMO • MÓDULO PREMIUM</text></svg>`);

  function installFixCss(){
    if(document.querySelector('link[data-eight-modules-fix]'))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href='/platform-eight-modules-fix.css?v=20260801-eight-modules';link.dataset.eightModulesFix='1';document.head.appendChild(link);
  }

  const modules = [
    { id: "gemeos", name: "Gêmeos", desc: "Aprenda como 11, 22 e 33 ativam a família dos gêmeos.", image: "/assets/study/gemeos-card-v3.webp", fallback: svgData("GÊMEOS","11 • 22 • 33","♊"), href: "/estudo-gemeos", time: "12 rodadas" },
    { id: "espelhos", name: "Espelhos", desc: "Identifique números invertidos e monte regiões com vizinhos.", image: "/assets/study/espelhos-module.webp", fallback: svgData("ESPELHOS","INVERSÃO • CONEXÃO","69"), href: "/estudo-espelhos", time: "12 rodadas" },
    { id: "fibonacci", name: "Fibonacci", desc: "Calcule soma, subtração, terminais e congruências na Race.", image: "/assets/study/fibonacci-card-v3.webp", fallback: svgData("FIBONACCI","SOMA • SEQUÊNCIA • RACE","Φ"), href: "/estudo-fibonacci", time: "12 rodadas" },
    { id: "magneto", name: "Magneto", desc: "Encontre conexões que atraem outros números pelo histórico.", image: "/assets/study/magneto-card-v1.svg", fallback: svgData("MAGNETO","ATRAÇÃO • CONEXÃO","∪"), href: "/estudo-magneto", time: "12 rodadas" },
    { id: "camaleoes", name: "Camaleões", desc: "Revele grupos escondidos pela soma e subtração dos dígitos.", image: "/assets/study/camaleoes-card-v1.svg", fallback: svgData("CAMALEÕES","ADAPTE • OBSERVE • DOMINE","◉"), href: "/estudo-camaleoes", time: "12 rodadas" },
    { id: "pitagoras", name: "Pitágoras", desc: "Conecte pontos e encontre o terceiro vértice na Race.", image: "/assets/study/triangulacao-card-v1.svg", fallback: svgData("PITÁGORAS","GEOMETRIA • CONEXÃO","△"), href: "/estudo-triangulacao", time: "Race interativa" },
    { id: "cavalos", name: "Cavalos", desc: "Treine a leitura dos movimentos de cavalo e suas conexões na Race.", image: svgData("CAVALOS","MOVIMENTO • SALTO • LEITURA","♞"), fallback: svgData("CAVALOS","MOVIMENTO • SALTO • LEITURA","♞"), href: "/estudo", time: "12 rodadas" },
    { id: "eclipse", name: "Eclipse Zero", desc: "Ative o Terminal 0 e use o Terminal 9 como proteção da leitura.", image: "/assets/study/eclipse-zero-card.svg", fallback: svgData("ECLIPSE ZERO","TERMINAL 0 • PROTEÇÃO 9","◐"), href: "/estudo-eclipse-zero", time: "Desafio de 12s", tag: "Novo" }
  ];

  const stores = {
    gemeos: "study_espelhos_gemeos_v1", espelhos: "study_espelhos_v1", fibonacci: "study_fibonacci_v1",
    magneto: "study_magneto_v1", camaleoes: "study_camaleoes_v2", pitagoras: "study_triangulacao_v1",
    cavalos: "study_cavalos_v1", eclipse: "study_eclipse_zero_v1"
  };

  function progress(id) {
    try {
      const state = JSON.parse(localStorage.getItem(stores[id]) || "{}");
      const values = Object.values(state.progress || {});
      return values.length ? Math.round(values.filter(Boolean).length / Math.max(3, values.length) * 100) : 0;
    } catch (_) { return 0; }
  }
  function isFavorite(id) { try { return localStorage.getItem(`study_favorite_${id}`) === "1"; } catch (_) { return false; } }

  function card(module, index) {
    const pct = progress(module.id);
    return `<article class="study-module-card ${module.tag ? "is-new" : ""}" data-module-card data-module="${module.id}" data-progress="${pct}">
      <div class="study-module-art">
        <img src="${module.image}${String(module.image).startsWith('data:')?'':'?v=20260801-eight-modules'}" data-fallback="${module.fallback}" alt="Capa do módulo ${module.name}" loading="lazy">
        ${module.tag ? `<span class="study-module-badge">${module.tag}</span>` : ""}
        <button class="study-fav" type="button" data-fav="${module.id}" aria-label="Favoritar módulo"><svg><use href="assets/dashboard-icons.svg#i-star"></use></svg></button>
      </div>
      <div class="study-module-body">
        <h2>${index + 1}. ${module.name}</h2><p>${module.desc}</p>
        <div class="study-module-progress-row"><span>Seu progresso</span><strong>${pct}%</strong></div>
        <div class="study-module-progress"><i style="width:${pct}%"></i></div>
        <div class="study-module-meta"><span><svg><use href="assets/dashboard-icons.svg#i-layers"></use></svg>3 experiências</span><span><svg><use href="assets/dashboard-icons.svg#i-clock"></use></svg>${module.time}</span></div>
        <a class="study-open-module" href="${module.href}">Acessar módulo <b>→</b></a>
      </div></article>`;
  }

  function bind() {
    $$('[data-fav]').forEach(button => { const id=button.dataset.fav; button.setAttribute('aria-pressed',String(isFavorite(id))); button.onclick=e=>{e.preventDefault();e.stopPropagation();const on=!isFavorite(id);try{localStorage.setItem(`study_favorite_${id}`,on?'1':'0')}catch{}button.setAttribute('aria-pressed',String(on));}; });
    $$('[data-study-filter]').forEach(button => button.onclick=()=>{ const filter=button.dataset.studyFilter; $$('[data-study-filter]').forEach(item=>item.classList.toggle('active',item===button)); $$('[data-module-card]').forEach(card=>{const pct=Number(card.dataset.progress||0),id=card.dataset.module;card.hidden=(filter==='progress'&&(pct===0||pct===100))||(filter==='done'&&pct<100)||(filter==='favorites'&&!isFavorite(id));}); });
    $$('img[data-fallback]').forEach(img=>{img.onerror=()=>{img.onerror=null;img.src=img.dataset.fallback;};});
    $('#studyMenuToggle')?.addEventListener('click',()=>$('#studySidebar')?.classList.add('open'));
    $('#studyMobileOverlay')?.addEventListener('click',()=>$('#studySidebar')?.classList.remove('open'));
  }

  function render() {
    const grid=$('.study-module-grid'); if(!grid)return; grid.innerHTML=modules.map(card).join(''); bind();
    const done=modules.filter(m=>progress(m.id)===100).length;
    const average=Math.round(modules.reduce((sum,m)=>sum+progress(m.id),0)/modules.length);
    $('.study-home-state')&&($('.study-home-state').textContent='8 módulos disponíveis');
    const metrics=$$('.study-metric strong'); if(metrics[0])metrics[0].textContent='8'; if(metrics[3])metrics[3].textContent=`${done}/8`;
    $('#homeScore')&&($('#homeScore').textContent=`${average}%`); $('#homeScoreRing')?.style.setProperty('--score',`${average}%`);
    $('#homeCompletedSide')&&($('#homeCompletedSide').textContent=`${done}/8`);
  }

  function init(){installFixCss();try{render();}finally{document.body?.classList.add('protected-ready');document.getElementById('studyLoading')?.remove();}}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();