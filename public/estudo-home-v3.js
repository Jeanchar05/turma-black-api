"use strict";
(() => {
  if (window.__TURMA_STUDY_HOME_STABLE__) return;
  window.__TURMA_STUDY_HOME_STABLE__ = true;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const modules=[
    {id:"gemeos",name:"Gêmeos",desc:"Aprenda como 11, 22 e 33 ativam a família dos gêmeos.",image:"/assets/imperial-v14/modules/gemeos.svg",href:"/estudo-gemeos",time:"12 rodadas"},
    {id:"espelhos",name:"Espelhos",desc:"Identifique números invertidos e monte regiões com vizinhos.",image:"/assets/imperial-v14/modules/espelhos.svg",href:"/estudo-espelhos",time:"12 rodadas"},
    {id:"fibonacci",name:"Fibonacci",desc:"Calcule soma, subtração, terminais e congruências na Race.",image:"/assets/imperial-v14/modules/fibonacci.svg",href:"/estudo-fibonacci",time:"12 rodadas"},
    {id:"magneto",name:"Magneto",desc:"Encontre conexões que atraem outros números pelo histórico.",image:"/assets/imperial-v14/modules/magneto.svg",href:"/estudo-magneto",time:"12 rodadas"},
    {id:"camaleoes",name:"Camaleões",desc:"Revele grupos escondidos pela soma e subtração dos dígitos.",image:"/assets/imperial-v14/modules/camaleoes.svg",href:"/estudo-camaleoes",time:"12 rodadas"},
    {id:"pitagoras",name:"Pitágoras",desc:"Conecte pontos e encontre o terceiro vértice na Race.",image:"/assets/imperial-v14/modules/pitagoras.svg",href:"/estudo-triangulacao",time:"Race interativa"},
    {id:"cavalo",name:"Cavalo",desc:"Treine as famílias 1·4·7, 2·5·8 e 3·6·9 e suas conexões.",image:"/assets/imperial-v14/modules/cavalo.svg",href:"/estudo-cavalos",time:"3 giros"},
    {id:"eclipse",name:"Eclipse Zero",desc:"Ative o Terminal 0 e use o Terminal 9 como proteção da leitura.",image:"/assets/imperial-v14/modules/eclipse-zero.svg",href:"/estudo-eclipse-zero",time:"Desafio de 12s",tag:"Novo"}
  ];
  const stores={gemeos:"study_espelhos_gemeos_v1",espelhos:"study_espelhos_v1",fibonacci:"study_fibonacci_v1",magneto:"study_magneto_v1",camaleoes:"study_camaleoes_v2",pitagoras:"study_triangulacao_v1",cavalo:"study_cavalos_v1",eclipse:"study_eclipse_zero_v1"};
  function progress(id){try{const state=JSON.parse(localStorage.getItem(stores[id])||"{}"),values=Object.values(state.progress||{});return values.length?Math.round(values.filter(Boolean).length/Math.max(3,values.length)*100):0}catch{return 0}}
  function favorite(id){try{return localStorage.getItem(`study_favorite_${id}`)==="1"}catch{return false}}
  function card(m,i){const pct=progress(m.id);return `<article class="study-module-card ${m.tag?"is-new":""}" data-module-card data-module="${m.id}" data-progress="${pct}"><div class="study-module-art"><img src="${m.image}" alt="Capa oficial do módulo ${m.name}" loading="eager" decoding="async">${m.tag?`<span class="study-module-badge">${m.tag}</span>`:""}<button class="study-fav" type="button" data-fav="${m.id}" aria-label="Favoritar módulo ${m.name}"><svg><use href="/assets/dashboard-icons.svg#i-star"></use></svg></button></div><div class="study-module-body"><h2>${i+1}. ${m.name}</h2><p>${m.desc}</p><div class="study-module-progress-row"><span>Seu progresso</span><strong>${pct}%</strong></div><div class="study-module-progress"><i style="width:${pct}%"></i></div><div class="study-module-meta"><span><svg><use href="/assets/dashboard-icons.svg#i-layers"></use></svg>3 experiências</span><span><svg><use href="/assets/dashboard-icons.svg#i-clock"></use></svg>${m.time}</span></div><a class="study-open-module" href="${m.href}">Acessar módulo <b>→</b></a></div></article>`}
  function summary(){const done=modules.filter(m=>progress(m.id)===100).length,started=modules.filter(m=>progress(m.id)>0&&progress(m.id)<100).length,avg=Math.round(modules.reduce((s,m)=>s+progress(m.id),0)/modules.length);if($(".study-home-state"))$(".study-home-state").textContent="8 módulos disponíveis";const metrics=$$(".study-metric strong");if(metrics[0])metrics[0].textContent="8";if(metrics[3])metrics[3].textContent=`${done}/8`;if($("#homeScore"))$("#homeScore").textContent=`${avg}%`;$("#homeScoreRing")?.style.setProperty("--score",`${avg}%`);if($("#homeStarted"))$("#homeStarted").textContent=String(started);if($("#homeCompletedSide"))$("#homeCompletedSide").textContent=`${done}/8`}
  function bind(){
    $$('[data-fav]').forEach(b=>{const id=b.dataset.fav;b.setAttribute("aria-pressed",String(favorite(id)));b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();const active=!favorite(id);try{localStorage.setItem(`study_favorite_${id}`,active?"1":"0")}catch{}b.setAttribute("aria-pressed",String(active))})});
    $$('[data-study-filter]').forEach(b=>b.addEventListener("click",()=>{const f=b.dataset.studyFilter;$$('[data-study-filter]').forEach(x=>x.classList.toggle("active",x===b));$$('[data-module-card]').forEach(item=>{const pct=Number(item.dataset.progress||0),id=item.dataset.module;item.hidden=(f==="progress"&&(pct===0||pct===100))||(f==="done"&&pct<100)||(f==="favorites"&&!favorite(id))})}));
    $("#studyMenuToggle")?.addEventListener("click",()=>{$("#studySidebar")?.classList.add("open");const o=$("#studyMobileOverlay");if(o)o.hidden=false});
    $("#studyMobileOverlay")?.addEventListener("click",()=>{$("#studySidebar")?.classList.remove("open");$("#studyMobileOverlay").hidden=true});
  }
  function init(){const grid=$(".study-module-grid");if(grid)grid.innerHTML=modules.map(card).join("");summary();bind();document.body.classList.add("protected-ready");$("#studyLoading")?.remove()}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();
