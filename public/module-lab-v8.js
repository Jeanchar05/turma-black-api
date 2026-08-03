"use strict";
(() => {
  if (window.__TURMA_MODULE_LAB_V8__) return;
  window.__TURMA_MODULE_LAB_V8__ = true;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const route=(location.pathname.replace(/\/$/,"")||"/").toLowerCase();
  const wheel=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const configs={
    "/estudo-gemeos":{id:"gemeos",title:"Gêmeos",subtitle:"Gatilho variável, dois vizinhos e proteção"},
    "/estudo-espelhos":{id:"espelhos",title:"Espelhos",subtitle:"Identifique a inversão e marque na Race"},
    "/estudo-fibonacci":{id:"fibonacci",title:"Fibonacci",subtitle:"Preencha quatro pontos e visualize terminais"},
    "/estudo-magneto":{id:"magneto",title:"Magneto",subtitle:"Conecte os números que se puxam"},
    "/estudo-camaleoes":{id:"camaleoes",title:"Camaleões",subtitle:"Descubra o grupo ausente e suas proteções"},
    "/estudo-triangulacao":{id:"pitagoras",title:"Pitágoras",subtitle:"Feche a triangulação com linhas reais"},
    "/estudo-pitagoras":{id:"pitagoras",title:"Pitágoras",subtitle:"Feche a triangulação com linhas reais"},
    "/estudo-cavalos":{id:"cavalos",title:"Cavalo",subtitle:"Visualize as três famílias de terminais"},
    "/estudo-eclipse-zero":{id:"eclipse",title:"Eclipse Zero",subtitle:"Ative os terminais 0 e 9 com vizinhos"}
  };
  const config=Object.entries(configs).find(([p])=>route===p||route===`${p}.html`)?.[1];
  if(!config)return;
  let state={};
  const rand=a=>a[Math.floor(Math.random()*a.length)];
  const unique=a=>[...new Set(a.map(Number).filter(n=>wheel.includes(n)))];
  const terminal=n=>Math.abs(Number(n))%10;
  const setResult=(text,type="")=>{const el=$("#tpLabResult");if(!el)return;el.className=`tp-lab-result ${type}`;el.innerHTML=text};
  const race=()=>$("#tpLabRace")?.__turmaRaceInstance||window.TurmaRace?.mount?.($("#tpLabRace"));
  function setRace(centers=[],neighbors=0,highlights={}){window.TurmaRace?.setState?.({centers:unique(centers),neighbors,bets:[],view:"race"});window.TurmaRace?.highlight?.(highlights);setTimeout(drawTriangle,40)}
  function centers(){return window.TurmaRace?.getState?.().centers||[]}
  function inputNumbers(){return $$('[data-lab-number]').map(i=>Number(i.value)).filter(n=>Number.isInteger(n)&&n>=0&&n<=36)}
  function fields(){return `<div class="tp-lab-fields"><label>Primeiro número<input data-lab-number type="number" min="0" max="36" inputmode="numeric"></label><label>Segundo número<input data-lab-number type="number" min="0" max="36" inputmode="numeric"></label><label>Penúltimo número<input data-lab-number type="number" min="0" max="36" inputmode="numeric"></label><label>Último número<input data-lab-number type="number" min="0" max="36" inputmode="numeric"></label></div>`}
  function baseMarkup(){return `<section class="tp-module-lab" id="tpModuleLab"><header class="tp-module-lab-head"><div><span>EXPLICAÇÃO INTERATIVA ATUALIZADA</span><h2>${config.title}</h2><p>${config.subtitle}. Use a mesma Race conectada à Roleta Reel.</p></div><span class="tp-lab-chip">RACE COM 0–9 VIZINHOS</span></header><div class="tp-lab-grid"><article class="tp-lab-card" id="tpLabControls"></article><article class="tp-lab-card tp-triangle-stage"><h3 class="tp-lab-title">Race interativa</h3><p class="tp-lab-copy">As marcações ficam sincronizadas entre o módulo e a Roleta Reel.</p><div id="tpLabRace" data-race-tool data-default-view="race"></div><svg class="tp-triangle-svg" id="tpTriangleSvg" aria-hidden="true"></svg></article></div><div class="tp-lab-result" id="tpLabResult">Comece o desafio para visualizar a leitura.</div><p class="tp-lab-disclaimer">Ferramenta educacional: a roleta permanece aleatória e nenhuma leitura garante resultado.</p></section>`}
  function cleanupLegacy(){
    $$('[data-race-tool]').forEach(el=>{if(el.id!=="tpLabRace")el.closest("section,article,div.study-race-section")?.remove()});
    $$('h2,h3').forEach(h=>{const t=(h.textContent||"").toLowerCase();if(/explica[cç][aã]o interativa|minigame r[aá]pido|feche o tri[aâ]ngulo|ativar eclipse/.test(t)){const box=h.closest("section,article");if(box&&!box.closest("#tpModuleLab"))box.hidden=true}});
  }
  function mount(){
    cleanupLegacy();const html=baseMarkup();const anchor=$(".study-final-infographic")||$(".strategy-hero")||$("main>section")||$("main");anchor?.insertAdjacentHTML("afterend",html);window.TurmaRace?.mountAll?.();renderControls();window.addEventListener("resize",()=>setTimeout(drawTriangle,80));window.addEventListener("turma:race-selection",()=>{if(config.id==="pitagoras")drawTriangle()});
  }
  function renderControls(){
    const host=$("#tpLabControls");if(!host)return;
    if(config.id==="gemeos")host.innerHTML=`<h3 class="tp-lab-title">Desafio dos Gêmeos</h3><p class="tp-lab-copy">O gatilho muda a cada rodada. Marque os outros dois gêmeos com dois vizinhos cada.</p><div class="tp-lab-number-row" id="tpPromptNumbers"></div><div class="tp-lab-controls"><button class="tp-lab-btn" data-action="new">Novo gatilho</button><button class="tp-lab-btn gold" data-action="check">Conferir marcações</button></div>`;
    else if(config.id==="espelhos")host.innerHTML=`<h3 class="tp-lab-title">Encontre o Espelho</h3><p class="tp-lab-copy">Um número será apresentado. Marque seu espelho e use dois vizinhos para completar a região.</p><div class="tp-lab-number-row" id="tpPromptNumbers"></div><div class="tp-lab-controls"><button class="tp-lab-btn" data-action="new">Sortear número</button><button class="tp-lab-btn gold" data-action="check">Responder</button></div>`;
    else if(["fibonacci","magneto","camaleoes"].includes(config.id))host.innerHTML=`<h3 class="tp-lab-title">Monte a leitura</h3><p class="tp-lab-copy">Preencha somente os dois primeiros e os dois últimos números. O sistema destaca alvos e terminais de proteção com cores diferentes.</p>${fields()}<div class="tp-lab-controls" style="margin-top:13px"><button class="tp-lab-btn" data-action="calculate">Calcular leitura</button><button class="tp-lab-btn secondary" data-action="random">Exemplo aleatório</button></div>`;
    else if(config.id==="pitagoras")host.innerHTML=`<h3 class="tp-lab-title">Feche o Triângulo</h3><p class="tp-lab-copy">Dois vértices serão marcados. Escolha o terceiro ponto que fecha uma triangulação coerente na Race.</p><div class="tp-lab-number-row" id="tpPromptNumbers"></div><div class="tp-lab-controls"><button class="tp-lab-btn" data-action="new">Novo triângulo</button><button class="tp-lab-btn gold" data-action="check">Fechar triângulo</button></div>`;
    else if(config.id==="cavalos")host.innerHTML=`<h3 class="tp-lab-title">Famílias do Cavalo</h3><p class="tp-lab-copy">Azul: 1–4–7. Verde: 2–5–8. Laranja: 3–6–9. Depois analise três giros e responda se existe conexão.</p><div class="tp-horse-board" id="tpHorseBoard"></div><div class="tp-lab-number-row" id="tpPromptNumbers"></div><div class="tp-lab-controls"><button class="tp-lab-btn" data-action="new">Fazer 3 giros</button><button class="tp-lab-btn secondary" data-action="horse-yes">Existe conexão</button><button class="tp-lab-btn secondary" data-action="horse-no">Não existe</button></div>`;
    else host.innerHTML=`<h3 class="tp-lab-title">Ativar o Eclipse</h3><p class="tp-lab-copy">Faça uma demonstração com giros aleatórios e depois marque a região do terminal 0 ou 9 usando vizinhos.</p><div class="tp-lab-number-row" id="tpPromptNumbers"></div><div class="tp-lab-controls"><button class="tp-lab-btn" data-action="new">Ativar Eclipse</button><button class="tp-lab-btn gold" data-action="check">Conferir região</button></div>`;
    host.addEventListener("click",handleAction);
    if(config.id==="cavalos")renderHorseBoard();
    newRound();
  }
  function renderHorseBoard(){const host=$("#tpHorseBoard");if(!host)return;host.innerHTML=Array.from({length:37},(_,n)=>{const t=terminal(n);const f=n===0?"zero":[1,4,7].includes(t)?"family-1":[2,5,8].includes(t)?"family-2":[3,6,9].includes(t)?"family-3":"";return`<button class="tp-horse-cell ${f}" type="button" data-horse-number="${n}">${n}</button>`}).join("")}
  function prompt(nums,classes=[]){const host=$("#tpPromptNumbers");if(host)host.innerHTML=nums.map((n,i)=>`<span class="tp-lab-number ${classes[i]||""}">${n}</span>`).join("")}
  function newRound(){window.TurmaRace?.clear?.();window.TurmaRace?.clearHighlights?.();$("#tpTriangleSvg")?.replaceChildren();
    if(config.id==="gemeos"){const all=[11,22,33],trigger=rand(all);state={trigger,expected:all.filter(n=>n!==trigger)};prompt([trigger],["gold"]);setRace([],2,{[trigger]:"gold"});setResult(`Gatilho sorteado: <strong>${trigger}</strong>. Marque ${state.expected.join(" e ")} com dois vizinhos.`)}
    else if(config.id==="espelhos"){const pairs=[[6,9],[12,21],[13,31],[23,32],[1,10],[2,20],[3,30]],pair=rand(pairs),shown=rand(pair);state={shown,expected:pair.find(n=>n!==shown)};prompt([shown],["gold"]);setRace([],2,{[shown]:"gold"});setResult(`Número apresentado: <strong>${shown}</strong>. Marque o espelho correspondente.`)}
    else if(["fibonacci","magneto","camaleoes"].includes(config.id)){state={};setRace([],2,{});setResult("Digite quatro números ou carregue um exemplo aleatório.")}
    else if(config.id==="pitagoras"){const start=Math.floor(Math.random()*wheel.length),vertices=[wheel[start],wheel[(start+12)%37],wheel[(start+24)%37]];const missing=rand(vertices);state={vertices,shown:vertices.filter(n=>n!==missing),expected:missing};prompt(state.shown,["blue","blue"]);setRace(state.shown,0,Object.fromEntries(state.shown.map(n=>[n,"blue"])));setResult(`Os dois primeiros vértices são <strong>${state.shown.join(" e ")}</strong>. Marque o terceiro ponto.`);setTimeout(drawTriangle,120)}
    else if(config.id==="cavalos"){const spins=Array.from({length:3},()=>rand(wheel));const fam=spins.map(n=>horseFamily(n));const counts=fam.reduce((a,f)=>{if(f)a[f]=(a[f]||0)+1;return a},{});const dominant=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];state={spins,connection:Boolean(dominant&&dominant[1]>=2),family:dominant?.[0]||0};prompt(spins,spins.map(n=>`family-${horseFamily(n)}`));setRace(spins,0,Object.fromEntries(spins.map(n=>[n,["blue","green","orange"][horseFamily(n)-1]||"gold"])));setResult("Analise os três giros e decida se há uma família predominante.")}
    else{const key=Math.random()<.5?0:9;const baseIndex=wheel.indexOf(key),sequence=[wheel[(baseIndex-2+37)%37],wheel[(baseIndex-1+37)%37],key,wheel[(baseIndex+1)%37],wheel[(baseIndex+2)%37]];state={key,sequence};prompt(sequence,sequence.map(n=>n===key?"gold":""));setRace([],2,{[key]:"gold"});setResult(`O terminal <strong>${key}</strong> ativou o exemplo. Marque sua região com dois vizinhos.`)}
  }
  function horseFamily(n){const t=terminal(n);if([1,4,7].includes(t))return 1;if([2,5,8].includes(t))return 2;if([3,6,9].includes(t))return 3;return 0}
  function calculate(){const nums=inputNumbers();if(nums.length!==4){setResult("Preencha os quatro campos com números de 0 a 36.","error");return}const [a,b,c,d]=nums;let core=unique(nums),protect=[],text="";
    if(config.id==="fibonacci"){protect=unique([terminal(a+b),terminal(c+d),terminal(Math.abs((a+b)-(c+d)))]);text=`Somas-base: ${a+b} e ${c+d}. Terminais de proteção: ${protect.join(", ")}.`}
    if(config.id==="magneto"){protect=unique([terminal(Math.abs(a-c)),terminal(Math.abs(b-d)),terminal(a+d),terminal(b+c)]);text=`Conexões cruzadas calculadas entre início e final. Proteções: ${protect.join(", ")}.`}
    if(config.id==="camaleoes"){const present=new Set(nums.map(horseFamily).filter(Boolean)),missing=[1,2,3].filter(x=>!present.has(x));const familyNumbers={1:[1,4,7],2:[2,5,8],3:[3,6,9]};protect=unique(missing.flatMap(x=>familyNumbers[x]));text=missing.length?`Grupo ausente: Cavalo ${missing.join(" e ")}. Terminais destacados: ${protect.join(", ")}.`:"As três famílias aparecem na amostra; observe repetição e transição."}
    const highlights={};core.forEach(n=>highlights[n]="blue");protect.forEach(n=>highlights[n]=config.id==="camaleoes"?"orange":"green");setRace(core,2,highlights);setResult(`<strong>Leitura montada.</strong> ${text}`,"success")
  }
  function randomInputs(){$$('[data-lab-number]').forEach(i=>i.value=String(rand(wheel)));calculate()}
  function check(){const selected=centers();
    if(config.id==="gemeos"){const ok=state.expected.every(n=>selected.includes(n))&&window.TurmaRace.getState().neighbors===2;setResult(ok?`Correto: ${state.expected.join(" e ")} foram marcados com dois vizinhos.`:`Marque exatamente os outros gêmeos (${state.expected.join(" e ")}) e deixe os vizinhos em 2.`,ok?"success":"error")}
    else if(config.id==="espelhos"){const ok=selected.includes(state.expected)&&window.TurmaRace.getState().neighbors===2;setResult(ok?`Acerto: o espelho de ${state.shown} é ${state.expected}.`:`Procure o espelho de ${state.shown} e use dois vizinhos.`,ok?"success":"error")}
    else if(config.id==="pitagoras"){const ok=selected.includes(state.expected);if(ok){window.TurmaRace.highlight(Object.fromEntries(state.vertices.map(n=>[n,"gold"])));setResult(`Triângulo fechado em ${state.expected}. As linhas mostram os três vértices.`,"success")}else setResult(`O ponto marcado não fecha a triangulação proposta. O fechamento coerente é ${state.expected}.`,"error");drawTriangle(ok?state.vertices:[...state.shown,...selected.slice(0,1)])}
    else{const ok=selected.includes(state.key)&&window.TurmaRace.getState().neighbors===2;setResult(ok?`Região do terminal ${state.key} marcada com dois vizinhos.`:`Marque o terminal ${state.key} e ajuste a Race para dois vizinhos.`,ok?"success":"error")}
  }
  function drawTriangle(custom){if(config.id!=="pitagoras")return;const svg=$("#tpTriangleSvg"),inst=race();if(!svg||!inst)return;const nums=custom||[...state.shown,...centers().slice(0,1)];const pts=nums.map(n=>inst.getPoint(n)).filter(Boolean);const panel=inst.root.querySelector('[data-view-panel="race"]');if(!panel||pts.length<2){svg.replaceChildren();return}const rect=panel.getBoundingClientRect(),host=svg.parentElement.getBoundingClientRect();svg.setAttribute("viewBox",`0 0 ${host.width} ${host.height}`);const offsetX=rect.left-host.left,offsetY=rect.top-host.top;const p=pts.map(x=>`${x.x+offsetX},${x.y+offsetY}`).join(" ");svg.innerHTML=pts.length>=3?`<polygon points="${p}"/>`:`<line x1="${pts[0].x+offsetX}" y1="${pts[0].y+offsetY}" x2="${pts[1].x+offsetX}" y2="${pts[1].y+offsetY}"/>`}
  function handleAction(e){const a=e.target.closest("[data-action]")?.dataset.action;if(!a)return;if(a==="new")newRound();if(a==="check")check();if(a==="calculate")calculate();if(a==="random")randomInputs();if(a==="horse-yes"||a==="horse-no"){const answer=a==="horse-yes",ok=answer===state.connection;setResult(ok?`Correto. ${state.connection?`A família ${state.family} apareceu com maior presença.`:"Não houve família predominante nos três giros."}`:`Resposta incorreta. ${state.connection?`A família ${state.family} apareceu pelo menos duas vezes.`:"Os giros ficaram distribuídos entre famílias diferentes."}`,ok?"success":"error")}}
  function boot(){if(!window.TurmaRace){setTimeout(boot,100);return}mount()}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
})();
