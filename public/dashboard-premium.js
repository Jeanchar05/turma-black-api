"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const state = { user:null, home:null, notes:[], favorites:[], tickets:[], activities:[], notifications:[], themePreference:"dark", searchResults:[], searchIndex:-1, noteTimer:null };

  const modules = [
    { key:"reflexivos", title:"Reflexivos", icon:"◈", description:"Leitura e interpretação estratégica.", progress:72 },
    { key:"gatilhos", title:"Gatilhos", icon:"⚡", description:"Reconheça padrões e momentos decisivos.", progress:58 },
    { key:"camaleoes", title:"Camaleões", icon:"✦", description:"Adaptação e análise de cenários.", progress:43 },
    { key:"magnetismo", title:"Magnetismo", icon:"◎", description:"Comportamento, força e atração de sequências.", progress:30 },
    { key:"fibonacci", title:"Fibonacci", icon:"∞", description:"Sequências, ciclos e proporções.", progress:18 },
    { key:"pitagoras", title:"Pitágoras", icon:"△", description:"Estrutura lógica e relações numéricas.", progress:0 }
  ];

  const library = [
    { icon:"▣", title:"Aulas em vídeo", description:"Conteúdos organizados por módulo e nível.", target:"modulos" },
    { icon:"PDF", title:"Materiais de apoio", description:"Resumos, guias e conteúdos complementares.", target:"modulos" },
    { icon:"✎", title:"Anotações", description:"Crie notas online durante seus estudos.", target:"notas" },
    { icon:"▤", title:"Avaliações", description:"Teste seu aprendizado e acompanhe resultados.", target:"provas" },
    { icon:"🎮", title:"Treino interativo", description:"Aprenda com desafios e minigames.", target:"minigames" },
    { icon:"★", title:"Favoritos", description:"Salve conteúdos importantes para revisar.", target:"favoritos" }
  ];

  const shortcuts = [
    { title:"Início", description:"Voltar ao dashboard", icon:"⌂", target:"inicio", keywords:"dashboard home principal" },
    { title:"Notas", description:"Criar e consultar anotações", icon:"★", target:"notas", keywords:"anotacoes caderno texto" },
    { title:"Minigames", description:"Aprender jogando", icon:"🎮", target:"minigames", keywords:"jogos zero one eclipse desafio" },
    { title:"Estudo", description:"Biblioteca de conteúdos", icon:"▣", target:"estudo", keywords:"materiais pdf aulas" },
    { title:"Módulos", description:"Trilha de aprendizado", icon:"◆", target:"modulos", keywords:"reflexivos gatilhos camaleoes magnetismo fibonacci pitagoras" },
    { title:"Suporte", description:"Abrir ou acompanhar chamado", icon:"◉", target:"suporte", keywords:"ajuda atendimento problema" },
    { title:"Perfil", description:"Conta, foto e aparência", icon:"♙", target:"perfil", keywords:"usuario telefone tema claro escuro" },
    { title:"Roleta", description:"Race, Racetrack e ferramentas", icon:"✺", target:"roleta", keywords:"race racetrack operacional" },
    { title:"Provas", description:"Avaliações e resultados", icon:"▤", target:"provas", keywords:"teste avaliacao resultado nota" },
    { title:"Favoritos", description:"Conteúdos salvos", icon:"☆", target:"favoritos", keywords:"salvos estrela" }
  ];

  document.addEventListener("DOMContentLoaded", init, { once:true });

  function getToken(){ for(const key of TOKEN_KEYS){ try{ const value=sessionStorage.getItem(key); if(value) return value; }catch(_){} } return ""; }
  async function api(endpoint, options={}){
    const token=getToken(); if(!token) throw new Error("Sessão expirada.");
    const response=await fetch(`${window.location.origin}${endpoint}`,{method:options.method||"GET",headers:{Accept:options.accept||"application/json",Authorization:`Bearer ${token}`,...(options.body!==undefined?{"Content-Type":"application/json"}:{})},body:options.body!==undefined?JSON.stringify(options.body):undefined,cache:"no-store"});
    if(options.raw) return response;
    const data=await response.json().catch(()=>({})); if(!response.ok||data.erro) throw new Error(data.erro||data.mensagem||`Erro ${response.status}.`); return data;
  }
  function escapeHTML(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
  function toast(message,type="success"){const stack=$("dashToastStack");if(!stack)return;const item=document.createElement("div");item.className=`dash-toast ${type}`;item.textContent=message;stack.appendChild(item);requestAnimationFrame(()=>item.classList.add("show"));setTimeout(()=>{item.classList.remove("show");setTimeout(()=>item.remove(),250);},3800);}
  function formatDate(value,withTime=false){if(!value)return"—";const date=new Date(value);if(Number.isNaN(date.getTime()))return"—";return new Intl.DateTimeFormat("pt-BR",withTime?{dateStyle:"short",timeStyle:"short"}:{dateStyle:"short"}).format(date);}
  function firstName(name){return String(name||"Usuário").trim().split(/\s+/)[0]||"Usuário";}

  async function init(){
    registerEvents();renderStaticContent();
    try{
      const [homeResponse,notesResponse,supportResponse]=await Promise.all([api("/dashboard-premium/home"),api("/dashboard-premium/notas"),api("/dashboard-premium/suporte")]);
      state.home=homeResponse;state.user=homeResponse.usuario||null;state.notes=Array.isArray(notesResponse.notas)?notesResponse.notas:[];state.tickets=Array.isArray(supportResponse.chamados)?supportResponse.chamados:[];state.favorites=Array.isArray(homeResponse.favoritos)?homeResponse.favoritos:[];state.activities=Array.isArray(homeResponse.atividades)?homeResponse.atividades:[];state.notifications=Array.isArray(homeResponse.notificacoes)?homeResponse.notificacoes:[];state.themePreference=homeResponse.preferencias?.tema||"dark";
      applyTheme(state.themePreference,false);renderHome();renderNotes();renderSupport();renderFavorites();renderActivities();renderNotifications();fillProfile();
    }catch(error){toast(error.message,"error");renderFallbackHome();}
    finally{setTimeout(()=>$("dashLoading")?.remove(),220);navigateFromHash();}
  }

  function registerEvents(){
    document.addEventListener("click",handleClick);document.addEventListener("keydown",handleKeydown);
    $("noteForm")?.addEventListener("submit",saveNote);$("supportForm")?.addEventListener("submit",createSupportTicket);$("profileForm")?.addEventListener("submit",saveProfile);
    $("noteSearch")?.addEventListener("input",()=>{clearTimeout(state.noteTimer);state.noteTimer=setTimeout(renderNotes,180);});$("noteFilter")?.addEventListener("change",renderNotes);$("globalSearchInput")?.addEventListener("input",renderGlobalSearch);window.addEventListener("hashchange",navigateFromHash);
    const media=window.matchMedia?.("(prefers-color-scheme: light)");media?.addEventListener?.("change",()=>{if(state.themePreference==="system")applyTheme("system",false);});
  }

  function handleClick(event){
    const nav=event.target.closest("[data-nav]");if(nav){event.preventDefault();navigate(nav.dataset.nav);return;}
    if(event.target.closest("#dashMenuToggle")){openSidebar();return;}if(event.target.closest("#dashMobileOverlay")){closeSidebar();return;}if(event.target.closest("#dashSearchTrigger")){openSearch();return;}if(event.target.closest("[data-close-search]")){closeSearch();return;}
    if(event.target.closest("#dashThemeToggle")){const current=document.documentElement.dataset.theme||"dark";saveTheme(current==="dark"?"light":"dark");return;}
    const themeButton=event.target.closest("[data-set-theme]");if(themeButton){saveTheme(themeButton.dataset.setTheme);return;}
    if(event.target.closest("#newNoteButton")){openNoteForm();return;}if(event.target.closest("#closeNoteForm, #cancelNote")){closeNoteForm();return;}
    const editNoteButton=event.target.closest("[data-edit-note]");if(editNoteButton){const note=state.notes.find(item=>item.id===editNoteButton.dataset.editNote);if(note)openNoteForm(note);return;}
    const deleteNoteButton=event.target.closest("[data-delete-note]");if(deleteNoteButton){deleteNote(deleteNoteButton.dataset.deleteNote);return;}
    const favoriteNoteButton=event.target.closest("[data-favorite-note]");if(favoriteNoteButton){toggleNoteFavorite(favoriteNoteButton.dataset.favoriteNote);return;}
    if(event.target.closest("#refreshSupport")){loadSupport();return;}
    const result=event.target.closest("[data-search-target]");if(result){navigate(result.dataset.searchTarget);closeSearch();return;}
    const moduleButton=event.target.closest("[data-open-module]");if(moduleButton){markActivity("modulo",`Módulo ${moduleButton.dataset.openModule}`,"Conteúdo aberto pelo dashboard.");toast(`Abrindo ${moduleButton.dataset.openModule}.`);return;}
    const gameButton=event.target.closest("[data-action='launch-game']");if(gameButton){markActivity("minigame",gameButton.dataset.game,"Minigame iniciado.");toast(`${gameButton.dataset.game} iniciado. O módulo será conectado à tela do jogo.`);return;}
    const toolButton=event.target.closest("[data-action='launch-tool']");if(toolButton){markActivity("roleta",toolButton.dataset.tool,"Ferramenta da roleta aberta.");toast(`${toolButton.dataset.tool} selecionado.`);}
  }

  function handleKeydown(event){
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();openSearch();return;}
    if(event.key==="Escape"){closeSearch();closeSidebar();return;}
    if(!$("dashSearchModal")?.hidden&&["ArrowDown","ArrowUp","Enter"].includes(event.key)){const items=$$("[data-search-target]",$("globalSearchResults"));if(!items.length)return;event.preventDefault();if(event.key==="ArrowDown")state.searchIndex=(state.searchIndex+1)%items.length;if(event.key==="ArrowUp")state.searchIndex=(state.searchIndex-1+items.length)%items.length;if(event.key==="Enter"){items[Math.max(0,state.searchIndex)]?.click();return;}items.forEach((item,index)=>item.classList.toggle("active",index===state.searchIndex));items[state.searchIndex]?.scrollIntoView({block:"nearest"});}
  }

  function navigateFromHash(){navigate(window.location.hash.replace("#","")||"inicio",false);}
  function navigate(target,updateHash=true){const section=$(`section-${target}`)||$("section-inicio");$$(".dash-section").forEach(item=>item.classList.toggle("active",item===section));$$("[data-nav]").forEach(item=>item.classList.toggle("active",item.dataset.nav===section.id.replace("section-","")));document.title=`${section.dataset.title||"Dashboard"} | Turma do Primo`;if(updateHash)history.replaceState(null,"",`#${section.id.replace("section-","")}`);closeSidebar();window.scrollTo({top:0,behavior:"smooth"});}
  function openSidebar(){$("dashSidebar")?.classList.add("open");if($("dashMobileOverlay"))$("dashMobileOverlay").hidden=false;}
  function closeSidebar(){$("dashSidebar")?.classList.remove("open");if($("dashMobileOverlay"))$("dashMobileOverlay").hidden=true;}
  function openSearch(){const modal=$("dashSearchModal");if(!modal)return;modal.hidden=false;state.searchIndex=-1;const input=$("globalSearchInput");if(input){input.value="";setTimeout(()=>input.focus(),20);}renderGlobalSearch();}
  function closeSearch(){if($("dashSearchModal"))$("dashSearchModal").hidden=true;}

  function renderGlobalSearch(){
    const query=String($("globalSearchInput")?.value||"").trim().toLowerCase();
    const noteResults=state.notes.map(note=>({title:note.titulo,description:`Nota • ${String(note.conteudo||"").slice(0,70)}`,icon:note.favorita?"★":"✎",target:"notas",keywords:`${note.titulo} ${note.conteudo}`.toLowerCase()}));
    const moduleResults=modules.map(module=>({title:module.title,description:`Módulo • ${module.description}`,icon:module.icon,target:"modulos",keywords:`${module.title} ${module.description}`.toLowerCase()}));
    const all=[...shortcuts,...moduleResults,...noteResults];state.searchResults=all.filter(item=>!query||`${item.title} ${item.description} ${item.keywords||""}`.toLowerCase().includes(query)).slice(0,14);state.searchIndex=-1;
    const container=$("globalSearchResults");if(!container)return;if(!state.searchResults.length){container.innerHTML='<div class="dash-empty-state"><strong>Nenhum resultado encontrado</strong><p>Tente outro termo.</p></div>';return;}
    container.innerHTML=state.searchResults.map(item=>`<button class="dash-search-result" type="button" data-search-target="${escapeHTML(item.target)}"><span>${escapeHTML(item.icon)}</span><div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.description)}</small></div></button>`).join("");
  }

  function resolveTheme(preference){if(preference==="system")return window.matchMedia?.("(prefers-color-scheme: light)").matches?"light":"dark";return preference==="light"?"light":"dark";}
  function applyTheme(preference,updateButtons=true){state.themePreference=preference;const resolved=resolveTheme(preference);document.documentElement.dataset.theme=resolved;document.querySelector('meta[name="theme-color"]')?.setAttribute("content",resolved==="dark"?"#07030d":"#edf0f5");const icon=$("dashThemeToggle")?.querySelector("span");if(icon)icon.textContent=resolved==="dark"?"☾":"☀";if(updateButtons)$$('[data-set-theme]').forEach(button=>button.classList.toggle("active",button.dataset.setTheme===preference));}
  async function saveTheme(preference){applyTheme(preference);try{await api("/dashboard-premium/preferencias",{method:"PUT",body:{tema:preference}});toast("Tema atualizado.");}catch(error){try{sessionStorage.setItem("dashboardTheme",preference);}catch(_){}toast(`Tema aplicado nesta sessão. ${error.message}`,"error");}}

  function renderStaticContent(){
    if($("homeModuleList"))$("homeModuleList").innerHTML=modules.slice(0,4).map(moduleRow).join("");
    if($("moduleGrid"))$("moduleGrid").innerHTML=modules.map(module=>`<article class="dash-module-card"><span>${module.icon}</span><h2>${escapeHTML(module.title)}</h2><p>${escapeHTML(module.description)}</p><div class="progress"><i style="width:${module.progress}%"></i></div><small>${module.progress}% concluído</small><button type="button" data-open-module="${escapeHTML(module.title)}">${module.progress?"Continuar módulo":"Começar módulo"} →</button></article>`).join("");
    if($("studyLibrary"))$("studyLibrary").innerHTML=library.map(item=>`<article class="dash-library-card"><span>${item.icon}</span><h2>${escapeHTML(item.title)}</h2><p>${escapeHTML(item.description)}</p><button type="button" data-nav="${item.target}">Acessar →</button></article>`).join("");
    renderProgressChart([22,34,31,48,55,64,72]);
  }
  function moduleRow(module){return `<div class="dash-module-row"><span class="icon">${module.icon}</span><div><strong>${escapeHTML(module.title)}</strong><small>${escapeHTML(module.description)}</small><div class="progress"><i style="width:${module.progress}%"></i></div></div><small>${module.progress}%</small></div>`;}
  function renderProgressChart(values){const chart=$("progressChart");if(chart)chart.innerHTML=values.map(value=>`<span style="height:${Math.max(8,value)}%" data-value="${value}"></span>`).join("");}

  function renderHome(){
    const home=state.home||{},stats=home.estatisticas||{},user=home.usuario||{},plan=home.plano||{};
    $$('[data-user-initial]').forEach(element=>{element.textContent=firstName(user.nome).charAt(0).toUpperCase();});
    $("statAverage").textContent=Number(stats.mediaGeral||0).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1});$("statModules").textContent=`${stats.modulosConcluidos||0} / ${stats.totalModulos||modules.length}`;$("statModulesDetail").textContent=`${stats.progressoGeral||0}% concluído`;$("statProgress").textContent=`${stats.progressoGeral||0}%`;$("statFocus").textContent=String(stats.diasFoco||0);
    $("notificationBadge").hidden=!(home.notificacoesNaoLidas>0);$("notificationBadge").textContent=String(home.notificacoesNaoLidas||0);$$('[data-plan-name]').forEach(element=>{element.textContent=plan.nome||"Plano Premium";});$$('[data-plan-label]').forEach(element=>{element.textContent=plan.rotulo||"Premium";});$("planExpiryText").textContent=plan.validadeTexto||"Acesso ativo";$("planProgressBar").style.width=`${Math.max(5,Math.min(100,Number(plan.percentualValidade||100)))}%`;
    if($("profileName"))$("profileName").value=user.nome||"";if($("profileEmail"))$("profileEmail").value=user.email||"";if($("profilePhone"))$("profilePhone").value=user.telefone||"";if($("profilePhoto"))$("profilePhoto").value=user.foto||"";if(Array.isArray(stats.grafico)&&stats.grafico.length)renderProgressChart(stats.grafico);
  }
  function renderFallbackHome(){renderActivities();renderFavorites();renderNotes();renderSupport();}
  function renderActivities(){const activities=state.activities.length?state.activities:[{tipo:"boas-vindas",titulo:"Sua jornada está pronta",descricao:"Escolha um módulo para começar.",createdAt:new Date().toISOString()}];const markup=activities.map(item=>`<div class="dash-activity-row"><span class="icon">${activityIcon(item.tipo)}</span><div><strong>${escapeHTML(item.titulo||"Atividade")}</strong><small>${escapeHTML(item.descricao||"")}</small></div><small>${formatDate(item.createdAt,true)}</small></div>`).join("");if($("recentActivityList"))$("recentActivityList").innerHTML=markup.slice(0,2500);if($("allActivityList"))$("allActivityList").innerHTML=markup;}
  function activityIcon(type){return{nota:"✎",suporte:"◉",modulo:"◆",minigame:"🎮",roleta:"✺",perfil:"♙"}[type]||"✓";}
  function renderNotifications(){const list=$("notificationList");if(!list)return;if(!state.notifications.length){list.innerHTML='<div class="dash-empty-state"><span>♧</span><strong>Nenhuma notificação</strong><p>Novos avisos aparecerão aqui.</p></div>';return;}list.innerHTML=state.notifications.map(item=>`<div class="dash-activity-row"><span class="icon">♧</span><div><strong>${escapeHTML(item.titulo||"Aviso")}</strong><small>${escapeHTML(item.mensagem||"")}</small></div><small>${formatDate(item.createdAt,true)}</small></div>`).join("");}
  function fillProfile(){const user=state.user||{};if($("profileName"))$("profileName").value=user.nome||"";if($("profileEmail"))$("profileEmail").value=user.email||"";if($("profilePhone"))$("profilePhone").value=user.telefone||"";if($("profilePhoto"))$("profilePhoto").value=user.foto||"";$$('[data-set-theme]').forEach(button=>button.classList.toggle("active",button.dataset.setTheme===state.themePreference));}

  function openNoteForm(note=null){const form=$("noteForm");if(!form)return;form.hidden=false;$("noteId").value=note?.id||"";$("noteTitle").value=note?.titulo||"";$("noteContent").value=note?.conteudo||"";$("noteFavorite").checked=Boolean(note?.favorita);$("noteFormTitle").textContent=note?"Editar nota":"Nova nota";setTimeout(()=>$("noteTitle")?.focus(),30);}
  function closeNoteForm(){$("noteForm")?.reset();if($("noteId"))$("noteId").value="";if($("noteForm"))$("noteForm").hidden=true;}
  async function saveNote(event){event.preventDefault();const id=$("noteId").value,payload={titulo:$("noteTitle").value.trim(),conteudo:$("noteContent").value.trim(),favorita:$("noteFavorite").checked};if(!payload.titulo||!payload.conteudo)return toast("Preencha título e conteúdo.","error");try{const response=await api(id?`/dashboard-premium/notas/${encodeURIComponent(id)}`:"/dashboard-premium/notas",{method:id?"PUT":"POST",body:payload});const note=response.nota;if(id)state.notes=state.notes.map(item=>item.id===id?note:item);else state.notes.unshift(note);renderNotes();closeNoteForm();toast(id?"Nota atualizada.":"Nota criada.");}catch(error){toast(error.message,"error");}}
  async function deleteNote(id){if(!window.confirm("Apagar esta nota?"))return;try{await api(`/dashboard-premium/notas/${encodeURIComponent(id)}`,{method:"DELETE"});state.notes=state.notes.filter(item=>item.id!==id);renderNotes();toast("Nota apagada.");}catch(error){toast(error.message,"error");}}
  async function toggleNoteFavorite(id){const note=state.notes.find(item=>item.id===id);if(!note)return;try{const response=await api(`/dashboard-premium/notas/${encodeURIComponent(id)}`,{method:"PUT",body:{titulo:note.titulo,conteudo:note.conteudo,favorita:!note.favorita}});state.notes=state.notes.map(item=>item.id===id?response.nota:item);renderNotes();renderFavorites();toast(response.nota.favorita?"Nota adicionada aos favoritos.":"Nota removida dos favoritos.");}catch(error){toast(error.message,"error");}}
  function renderNotes(){const grid=$("noteGrid");if(!grid)return;const query=String($("noteSearch")?.value||"").trim().toLowerCase(),filter=$("noteFilter")?.value||"all",notes=state.notes.filter(note=>(!query||`${note.titulo} ${note.conteudo}`.toLowerCase().includes(query))&&(filter!=="favorite"||note.favorita));if(!notes.length){grid.innerHTML='<div class="dash-empty-state"><span>✎</span><strong>Nenhuma nota encontrada</strong><p>Crie sua primeira anotação online.</p></div>';return;}grid.innerHTML=notes.map(note=>`<article class="dash-note-card"><header><h3>${escapeHTML(note.titulo)}</h3><button type="button" data-favorite-note="${escapeHTML(note.id)}">${note.favorita?"★":"☆"}</button></header><p>${escapeHTML(String(note.conteudo||"").slice(0,260))}</p><footer><span>${formatDate(note.updatedAt||note.createdAt,true)}</span><div><button type="button" data-edit-note="${escapeHTML(note.id)}">Editar</button><button type="button" data-delete-note="${escapeHTML(note.id)}">Apagar</button></div></footer></article>`).join("");}

  async function createSupportTicket(event){event.preventDefault();const payload={assunto:$("supportSubject").value.trim(),prioridade:$("supportPriority").value,mensagem:$("supportMessage").value.trim()};if(!payload.assunto||!payload.mensagem)return toast("Preencha assunto e mensagem.","error");try{const response=await api("/dashboard-premium/suporte",{method:"POST",body:payload});state.tickets.unshift(response.chamado);event.currentTarget.reset();renderSupport();toast("Chamado enviado para a equipe.");}catch(error){toast(error.message,"error");}}
  async function loadSupport(){try{const response=await api("/dashboard-premium/suporte");state.tickets=response.chamados||[];renderSupport();toast("Chamados atualizados.");}catch(error){toast(error.message,"error");}}
  function renderSupport(){const list=$("supportList");if(!list)return;if(!state.tickets.length){list.innerHTML='<div class="dash-empty-state"><span>◉</span><strong>Nenhum chamado aberto</strong><p>Use o formulário para falar com a equipe.</p></div>';return;}list.innerHTML=state.tickets.map(ticket=>`<div class="dash-ticket-row"><div><strong>${escapeHTML(ticket.assunto)}</strong><small>${escapeHTML(ticket.mensagem)}</small><small>${formatDate(ticket.createdAt,true)} • Prioridade ${escapeHTML(ticket.prioridade)}</small></div><span class="dash-status">${escapeHTML(ticket.status)}</span></div>`).join("");}

  async function saveProfile(event){event.preventDefault();const payload={nome:$("profileName").value.trim(),telefone:$("profilePhone").value.trim(),foto:$("profilePhoto").value.trim()};if(!payload.nome)return toast("Informe seu nome.","error");try{const response=await api("/dashboard-premium/perfil",{method:"PUT",body:payload});state.user=response.usuario;$$('[data-user-name]').forEach(element=>{element.textContent=firstName(state.user.nome);});$$('[data-user-fullname]').forEach(element=>{element.textContent=state.user.nome;});$$('[data-user-initial]').forEach(element=>{element.textContent=firstName(state.user.nome).charAt(0).toUpperCase();});toast("Perfil atualizado.");}catch(error){toast(error.message,"error");}}
  function renderFavorites(){const grid=$("favoriteGrid");if(!grid)return;const noteFavorites=state.notes.filter(note=>note.favorita).map(note=>({title:note.titulo,description:String(note.conteudo||"").slice(0,130),target:"notas",icon:"✎"})),favorites=[...state.favorites,...noteFavorites];if(!favorites.length){grid.innerHTML='<div class="dash-empty-state"><span>☆</span><strong>Nenhum favorito ainda</strong><p>Marque notas e conteúdos para encontrá-los aqui.</p></div>';return;}grid.innerHTML=favorites.map(item=>`<article class="dash-favorite-card"><span>${escapeHTML(item.icon||"★")}</span><h2>${escapeHTML(item.title||item.titulo||"Favorito")}</h2><p>${escapeHTML(item.description||item.descricao||"")}</p><button class="dash-secondary-btn" type="button" data-nav="${escapeHTML(item.target||"estudo")}">Abrir →</button></article>`).join("");}
  async function markActivity(type,title,description){try{await api("/dashboard-premium/atividades",{method:"POST",body:{tipo:type,titulo:title,descricao:description}});}catch(_){}}
})();
