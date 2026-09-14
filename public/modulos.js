"use strict";
(() => {
  const C=window.TurmaStudy, S=window.TurmaStudySync, Media=window.TurmaMedia;
  const $=id=>document.getElementById(id), all=(q,r=document)=>[...r.querySelectorAll(q)];
  const escape=value=>String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const icon=name=>`<svg aria-hidden="true"><use href="/assets/dashboard-icons.svg#i-${name}"></use></svg>`;
  const normalize=value=>String(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  let catalog, user, selected="gemeos", tab="modulos", player, playingContent, youtubeReady, playbackTimer, editor, toastTimer, opener;
  const current=()=>catalog.modules.find(m=>m.id===selected)||catalog.modules[0];
  const videoProgress=m=>{const v=S.state.videos?.[m.id];return v?.source===m.url?v:null;};
  const art=m=>`/assets/modules-v4/${m.art}-${document.documentElement.dataset.theme==="light"?"light":"dark"}.webp`;
  const cover=(m,extra="")=>`<img src="${art(m)}" data-art="${m.art}" alt="${escape(m.title)}" loading="lazy" width="480" height="320" ${extra}>`;
  function headers(){const h={"Content-Type":"application/json",Accept:"application/json"};if(user)h["X-Study-Account"]=String(user.id||user._id);for(const storage of [sessionStorage,localStorage])for(const key of ["token","adminToken","authToken","accessToken","jwt"])try{const t=storage.getItem(key);if(t){h.Authorization=`Bearer ${t}`;return h;}}catch{}return h;}
  async function api(url,options={}){
    const response=await fetch(url,{headers:headers(),credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(20000),...options});
    if(response.status===401){location.replace("/");throw Error("Entre novamente para continuar.");}
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.erro||"Não foi possível carregar agora. Tente novamente.");
    return data;
  }
  function toast(message){$("studyToast").textContent=message;$("studyToast").hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("studyToast").hidden=true,5000);}
  function applyTheme(){
    const light=document.documentElement.dataset.theme==="light";
    $("studyTheme").innerHTML=icon(light?"sun":"moon");$("studyTheme").setAttribute("aria-label",light?"Ativar tema escuro":"Ativar tema claro");
    document.querySelector('meta[name="theme-color"]').content=light?"#f3f1f7":"#0b0b11";
    all("[data-art]").forEach(img=>img.src=`/assets/modules-v4/${img.dataset.art}-${light?"light":"dark"}.webp`);
  }
  $("studyTheme").addEventListener("click",()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==="light"?"dark":"light";try{localStorage.setItem("turma.workspace.theme",document.documentElement.dataset.theme);}catch{}applyTheme();});
  addEventListener("storage",event=>{if(event.key==="turma.workspace.theme"){document.documentElement.dataset.theme=event.newValue==="light"?"light":"dark";applyTheme();}});
  function menu(open,focus=false){document.body.classList.toggle("menu-open",open);$("studySidebar").classList.toggle("is-open",open);$("studySidebar").inert=!open&&matchMedia("(max-width:900px)").matches;$("studyBackdrop").hidden=!open;$("studyMenu").setAttribute("aria-expanded",String(open));$("studyShell").inert=open;$("studyDock").inert=open;if(open)$("studyCloseMenu").focus();else if(focus)$("studyMenu").focus();}
  $("studyMenu").onclick=()=>menu(true);$("studyCloseMenu").onclick=()=>menu(false,true);$("studyBackdrop").onclick=()=>menu(false,true);
  matchMedia("(min-width:901px)").addEventListener("change",()=>menu(false));
  document.addEventListener("keydown",e=>{
    if(document.body.classList.contains("menu-open")){
      if(e.key==="Escape")menu(false,true);
      if(e.key==="Tab"){const buttons=all('a,button',$("studySidebar")).filter(el=>el.getClientRects().length),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    }
  });
  $("studyLogout").onclick=async()=>{checkpoint();await S.flush();try{await api("/logout",{method:"POST"});}finally{for(const storage of[sessionStorage,localStorage])for(const key of["token","adminToken","authToken","accessToken","jwt"])try{storage.removeItem(key);}catch{}location.replace("/");}};
  function readHash(){const parts=location.hash.slice(1).split("/");if(["modulos","instagram","pdf"].includes(parts[0]))tab=parts[0];if(C.modules.some(m=>m.id===parts[1]))selected=parts[1];}
  function navigate(next,id=selected,scroll=false){stopPlayer();tab=next;selected=id;const route=window.TurmaNavigation?.pathname||"/modulos";history.replaceState(history.state,"",`${route}#${tab}/${selected}`);$("librarySearch").value="";$("libraryFilter").value="all";renderTab();if(scroll)$("libraryTabs").scrollIntoView({behavior:"smooth",block:"start"});}
  function render(){
    $("modulesApp").innerHTML=`<section class="lib-hero"><div><span class="learn-eyebrow">SUA CENTRAL DE CONHECIMENTO</span><h1>O próximo passo<br>começa com um <em>play.</em></h1><p>Assista à explicação. Revise os pontos importantes.<br>Leve o aprendizado para a prática.</p><div class="lib-hero-stats"><span><strong>8</strong> módulos de estudo</span><span><strong>${catalog.modules.filter(m=>m.published).length}</strong> videoaulas disponíveis</span><span><strong>8</strong> materiais de apoio</span></div></div><div class="lib-hero-art">${cover(current())}<span>APRENDA · REVISE · PRATIQUE</span></div></section>
    <div class="lib-tabs-row"><div class="lib-tabs" id="libraryTabs" role="tablist" aria-label="Tipo de conteúdo">${[["modulos","Módulos","layers"],["instagram","Instagram","activity"],["pdf","PDF","note"]].map(([id,label,symbol])=>`<button type="button" id="libraryTab-${id}" data-tab="${id}" role="tab" aria-controls="libraryPanel" aria-selected="false" tabindex="-1">${icon(symbol)}${label}<span>${id==="instagram"?catalog.instagram.length:8}</span></button>`).join("")}</div>${catalog.canManage?'<button class="learn-button learn-button-secondary lib-manage" data-manage type="button">Gerenciar conteúdos +</button>':""}</div>
    <div class="lib-toolbar"><label class="lib-search">${icon("search")}<input type="search" id="librarySearch" placeholder="Buscar módulo ou assunto" aria-label="Buscar conteúdo"></label><select id="libraryFilter" aria-label="Filtrar conteúdo"><option value="all">Todos os conteúdos</option><option value="available">Disponíveis</option><option value="completed">Aulas concluídas</option></select></div><section id="libraryPanel" role="tabpanel" tabindex="0"></section><p class="lib-sync" id="librarySync" role="status"></p>`;
    $("librarySearch").addEventListener("input",renderContent);$("libraryFilter").addEventListener("change",renderContent);
    $("libraryTabs").addEventListener("keydown",e=>{const tabs=["modulos","instagram","pdf"],index=tabs.indexOf(tab);let next;if(e.key==="ArrowRight")next=(index+1)%3;if(e.key==="ArrowLeft")next=(index+2)%3;if(e.key==="Home")next=0;if(e.key==="End")next=2;if(next!==undefined){e.preventDefault();navigate(tabs[next]);$("libraryTab-"+tabs[next]).focus();}});
    renderTab();
  }
  function renderTab(){all("[data-tab]").forEach(b=>{const active=b.dataset.tab===tab;b.setAttribute("aria-selected",String(active));b.tabIndex=active?0:-1;});$("libraryPanel").setAttribute("aria-labelledby","libraryTab-"+tab);$("libraryFilter").hidden=tab!=="modulos";$("librarySearch").placeholder=tab==="instagram"?"Buscar vídeo ou assunto":"Buscar módulo ou assunto";renderContent();}
  function filtered(items){const q=normalize($("librarySearch").value),f=$("libraryFilter").value;return items.filter(m=>(!q||normalize(m.title+" "+m.description).includes(q))&&(tab!=="modulos"||f==="all"||f==="available"&&m.published||f==="completed"&&videoProgress(m)?.completed));}
  const empty=(title,text)=>`<div class="lib-empty">${icon("layers")}<h2>${title}</h2><p>${text}</p></div>`;
  function renderContent(){
    stopPlayer();
    if(tab==="modulos"){
      const items=filtered(catalog.modules);
      $("libraryPanel").innerHTML=`<div class="lib-video-layout"><div><div class="lib-section-heading"><h2>Sua trilha em vídeo</h2><span>${items.length} aulas</span></div><div class="lib-module-grid">${items.map(m=>`<article class="lib-module-card ${selected===m.id?"is-selected":""}"><button class="lib-cover-button" data-select="${m.id}" type="button" aria-label="Abrir aula ${escape(m.title)}">${cover(m)}<span class="lib-cover-tag">MÓDULO ${String(C.modules.findIndex(v=>v.id===m.id)+1).padStart(2,"0")}</span><span class="lib-cover-play" aria-hidden="true">▷</span></button><div class="lib-card-body"><span class="lib-availability ${m.published?"is-ready":""}">${m.published?"● Videoaula disponível":"Em preparação"}</span><h3>${escape(m.title)}</h3><p>${escape(m.description)}</p><div class="lib-card-progress" data-video-progress="${m.id}"></div><div class="lib-card-actions"><button type="button" data-select="${m.id}">${m.published?"Abrir aula":"Ver módulo"} ↗</button><button type="button" data-pdf="${m.id}">${icon("note")} PDF</button></div></div></article>`).join("")}</div>${items.length?"":empty("Nenhum módulo encontrado","Tente outra busca ou altere o filtro.")}</div><aside class="lib-player" id="libraryPlayer" aria-label="Aula selecionada"></aside></div>`;
      renderPlayer();
    }else if(tab==="instagram"){
      const items=filtered(catalog.instagram);
      $("libraryPanel").innerHTML=`<div class="lib-section-heading"><div><h2>Da nossa comunidade para seus estudos</h2><p>Explicações rápidas, revisões e vídeos que a equipe compartilha no Instagram.</p></div></div><div class="lib-instagram-grid">${items.map(m=>{const related=catalog.modules.find(v=>v.id===m.moduleId);return `<article class="lib-instagram-card"><button type="button" data-instagram="${m.id}" class="lib-instagram-cover" aria-label="Ver ${escape(m.title)}">${related?cover(related):`<div class="lib-instagram-brand"><span>TURMA DO</span><strong>PRIMO<span>·</span></strong><small>CONHECIMENTO EM MOVIMENTO</small></div>`}<span class="lib-cover-tag">${m.published?"INSTAGRAM":"RASCUNHO"}</span><span class="lib-cover-play" aria-hidden="true">▷</span></button><div class="lib-card-body"><h3>${escape(m.title)}</h3><p>${escape(m.description)}</p><button class="learn-button learn-button-secondary" data-instagram="${m.id}" type="button">Assistir ao vídeo ↗</button></div></article>`;}).join("")}</div>${items.length?"":empty(catalog.instagram.length?"Nenhum vídeo encontrado":"Os próximos vídeos chegam por aqui",catalog.instagram.length?"Busque outro assunto.":"Quando a equipe compartilhar um vídeo do Instagram, você poderá assistir e revisar nesta área.")}`;
    }else{
      const items=filtered(catalog.modules),m=current();
      $("libraryPanel").innerHTML=`<div class="lib-section-heading"><div><h2>O essencial, sempre à mão</h2><p>Abra um resumo para revisar ou baixe o PDF para ler depois.</p></div></div><div class="lib-pdf-grid">${items.map(m=>`<article class="lib-pdf-card ${selected===m.id?"is-selected":""}"><div class="lib-pdf-cover">${cover(m)}<span>PDF</span></div><div><small>${m.summary?"RESUMO DA VIDEOAULA":"GUIA DE ESTUDO"}</small><h3>${escape(m.title)}</h3><p>${escape(window.TurmaStudyGuides.guides[m.id].goal)}</p><button type="button" class="learn-button learn-button-secondary" data-read="${m.id}">Ler resumo ${icon("note")}</button><button type="button" class="lib-download" data-download="${m.id}">Baixar PDF ↓</button></div></article>`).join("")}</div>${items.length?"":empty("Nenhum material encontrado","Tente buscar pelo nome do módulo.")}<article class="lib-reader" id="libraryReader" tabindex="-1"><div class="lib-reader-heading"><div><span class="learn-eyebrow">${m.summary?"RESUMO DA VIDEOAULA":"GUIA DE ESTUDO"}</span><h2>${escape(m.title)}</h2></div><button type="button" class="learn-button" data-download="${m.id}">Baixar PDF ↓</button></div>${summaryMarkup(m)}<div class="lib-reader-actions"><button type="button" class="learn-button learn-button-secondary" data-lesson="${m.id}">Voltar à videoaula</button><a class="learn-button" href="/estudo-${m.route}">Praticar no estudo →</a></div></article>`;
    }
    updateProgress();
  }
  function summaryMarkup(m){const g=window.TurmaStudyGuides.guides[m.id];return `${m.summary?`<div class="lib-summary-text">${m.summary.split(/\n\s*\n/).map(p=>`<p>${escape(p).replace(/\n/g,"<br>")}</p>`).join("")}</div>`:`<p class="lib-reader-intro">${escape(g.goal)}</p><p class="lib-reader-note">Material baseado no módulo de estudo. O resumo específico da videoaula será disponibilizado pela equipe.</p>`}<h3>Um exemplo resolvido</h3><ol class="lib-summary-steps">${g.steps.map(([title,text])=>`<li><h4>${escape(title)}</h4><p>${escape(text)}</p></li>`).join("")}</ol><div class="learn-mistake"><strong>Uma confusão comum</strong><p>${escape(g.mistake)}</p></div>`;}
  function renderPlayer(){
    const m=current(),v=videoProgress(m),media=Media.parse(m.url);
    $("libraryPlayer").innerHTML=`<div class="lib-player-media" id="libraryMedia">${cover(m)}<button type="button" class="lib-start-video" data-play ${!m.published||!media?"disabled":""}>${m.published&&media?`<span>▷</span>${v?.position&&!v.completed?"Continuar videoaula":"Assistir à videoaula"}`:"<span>◷</span>Videoaula em preparação"}</button></div><div class="lib-player-copy"><span class="learn-eyebrow">${m.published?"SUA AULA SELECIONADA":"ENQUANTO A AULA NÃO CHEGA"}</span><h2>${escape(m.title)}</h2><p>${escape(m.description)}</p><div class="lib-player-meta"><span>${icon("clock")}${escape(m.duration||"No seu ritmo")}</span><span>${icon("book")}Material de apoio</span></div><div id="selectedVideoProgress"></div><div class="lib-player-actions"><button type="button" class="learn-button" data-complete ${!m.published?"disabled":""}>${v?.completed?"✓ Aula concluída":"Marcar aula como concluída"}</button><button class="learn-button learn-button-secondary" type="button" data-pdf="${m.id}">${icon("note")} Abrir PDF desta aula</button><a class="lib-study-link" href="/estudo-${m.route}">Praticar no estudo →</a></div>${m.published?`<a class="lib-external" href="${escape(media?.url||m.url)}" target="_blank" rel="noopener noreferrer">Abrir vídeo em outra aba ↗</a><p class="lib-player-note">Se o player não abrir, use o link acima.</p>`:`<p class="lib-player-note">Você já pode aprender pelo exemplo interativo e revisar o guia deste módulo.</p>`}<p id="videoError" role="status" hidden></p></div>`;
    updateProgress();
  }
  function updateProgress(){
    if(!catalog)return;
    all("[data-video-progress]").forEach(el=>{const m=catalog.modules.find(v=>v.id===el.dataset.videoProgress),v=videoProgress(m);el.innerHTML=v?`<span>${v.completed?"✓ Concluída":`Retomar em ${Math.floor(v.position/60)}:${String(Math.floor(v.position%60)).padStart(2,"0")}`}</span><progress max="100" value="${v.completed?100:Math.round(v.position/v.duration*100)}" aria-label="Progresso da videoaula ${escape(m.title)}"></progress>`:"";});
    if($("selectedVideoProgress")){const v=videoProgress(current());$("selectedVideoProgress").textContent=v?.completed?"✓ Você concluiu esta aula.":v?.position?`Retome em ${Math.floor(v.position/60)}:${String(Math.floor(v.position%60)).padStart(2,"0")}`:"";const complete=document.querySelector("[data-complete]");if(complete&&v?.completed)complete.textContent="✓ Aula concluída";}
    if($("librarySync"))$("librarySync").textContent=S.status.pending?"Salvando seu progresso…" : S.status.online ? "Seu progresso nas aulas fica salvo na sua conta." : "Sem conexão. Seu progresso aguarda sincronização.";
  }
  function loadYoutube(){
    if(window.YT?.Player)return Promise.resolve(window.YT);
    if(youtubeReady)return youtubeReady;
    youtubeReady=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{youtubeReady=null;reject(Error("Não foi possível abrir o player. Use o link abaixo para assistir."));},15000);window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);resolve(window.YT);};const script=document.createElement("script");script.src="https://www.youtube.com/iframe_api";script.onerror=()=>{clearTimeout(timeout);youtubeReady=null;reject(Error("O player está indisponível. Abra o vídeo pelo link abaixo."));};document.head.append(script);});return youtubeReady;
  }
  async function startVideo(){
    const m=current(),media=Media.parse(m.url);if(!media||!m.published)return;
    stopPlayer();playingContent=m;const mount=$("libraryMedia");
    const position=videoProgress(m)?.completed?0:videoProgress(m)?.position||0;
    mount.innerHTML='<div class="lib-player-wait" role="status">Carregando videoaula…</div>';
    try{
      if(media.provider==="file"){
        mount.innerHTML='<video controls playsinline preload="metadata" aria-label="Videoaula"></video>';
        const video=mount.querySelector("video");video.src=media.url;
        player={kind:"file",element:video};
        video.addEventListener("loadedmetadata",()=>{if(Number.isFinite(video.duration))video.currentTime=Math.min(position,Math.max(0,video.duration-1));video.play().catch(()=>{});});
        video.addEventListener("pause",()=>checkpoint());video.addEventListener("ended",()=>checkpoint(true));
        video.addEventListener("error",()=>{if($("videoError")){ $("videoError").hidden=false;$("videoError").textContent="Não foi possível reproduzir este arquivo. Tente abrir pelo link do vídeo.";}});
      }else{
        const YT=await loadYoutube();if(playingContent!==m||!mount.isConnected)return;
        mount.innerHTML='<div id="youtubeLesson"></div>';
        const yt=new YT.Player("youtubeLesson",{host:"https://www.youtube-nocookie.com",videoId:media.id,playerVars:{playsinline:1,rel:0,origin:location.origin,start:Math.floor(position)},events:{onReady:e=>{if(playingContent===m)e.target.playVideo();},onStateChange:e=>{if(playingContent===m&&[0,2].includes(e.data))checkpoint(e.data===0);},onError:()=>{if($("videoError")){$("videoError").hidden=false;$("videoError").textContent="Este vídeo não pôde ser reproduzido aqui. Tente abrir em outra aba.";}}}});
        player={kind:"youtube",element:yt};
      }
      playbackTimer=setInterval(()=>checkpoint(),10000);
    }catch(e){if(playingContent===m&&mount.isConnected){mount.innerHTML=`<div class="lib-player-wait">${escape(e.message)}</div>`;}}
  }
  function checkpoint(completed=false){
    const m=playingContent||current();if(!m?.published||!m.url)return;
    const before=videoProgress(m);let position=before?.position||0,duration=before?.duration||0;
    if(player&&playingContent){if(player.kind==="file"){position=player.element.currentTime;duration=player.element.duration;}else{position=player.element.getCurrentTime?.()||position;duration=player.element.getDuration?.()||duration;}}
    if(!Number.isFinite(duration)||duration<=0){if(!completed)return;duration=before?.duration||1;position=before?.position||0;}
    if(duration>43200||!Number.isFinite(position))return;
    position=Math.min(duration,Math.max(0,position));
    if(!completed&&Math.abs((before?.position||0)-position)<1)return;
    S.enqueue({kind:"video",module:m.id,source:m.url,position,duration,completed,observedAt:S.now});
  }
  function stopPlayer(){if(!catalog)return;checkpoint();clearInterval(playbackTimer);const previous=player;player=null;playingContent=null;if(previous){if(previous.kind==="youtube")previous.element.destroy?.();else previous.element.pause();}}
  async function download(id,button){
    if(button)button.disabled=true;
    try{const response=await fetch(`/learning/materials/${id}.pdf`,{headers:headers(),credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error("Não foi possível baixar o PDF agora.");const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`turma-do-primo-${id}.pdf`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){toast(e.message);}finally{if(button)button.disabled=false;}
  }
  function openDialog(html){opener=document.activeElement;$("libraryDialog").innerHTML=html;$("libraryDialog").showModal();}
  function closeDialog(){ $("libraryDialog").close();$("libraryDialog").replaceChildren();opener?.focus(); }
  $("libraryDialog").addEventListener("close",()=>{ if(!$("libraryDialog").open){$("libraryDialog").replaceChildren();opener?.focus();}});
  $("libraryDialog").addEventListener("click",e=>{if(e.target.closest("[data-close-dialog]"))closeDialog();});
  function instagram(id){const m=catalog.instagram.find(v=>v.id===id),media=Media.parse(m?.url,"instagram");if(!media){toast("Este vídeo ainda não tem um link disponível.");return;}openDialog(`<header><div><span class="learn-eyebrow">INSTAGRAM</span><h2 id="libraryDialogTitle">${escape(m.title)}</h2></div><button class="learn-icon-button" type="button" data-close-dialog aria-label="Fechar vídeo">×</button></header><iframe class="lib-instagram-embed" title="${escape(m.title)}" src="${escape(media.embed)}" allow="encrypted-media; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe><p>${escape(m.description)}</p><a class="learn-button" href="${media.url}" target="_blank" rel="noopener noreferrer">Ver no Instagram ↗</a><p class="lib-player-note">A disponibilidade do vídeo depende da publicação no Instagram.</p>`);}
  function manage(id=selected){
    if(!catalog.canManage)return;
    const options=[...catalog.modules,...catalog.instagram];
    editor=options.find(m=>m.id===id)||{id:`ig-${crypto.randomUUID()}`,type:"instagram",title:"",description:"",url:"",summary:"",duration:"",moduleId:"",published:false,revision:0};
    openDialog(`<header><div><span class="learn-eyebrow">GESTÃO DE CONTEÚDO</span><h2 id="libraryDialogTitle">Publicar e organizar</h2></div><button class="learn-icon-button" type="button" data-close-dialog aria-label="Fechar editor">×</button></header><form id="contentForm"><label>Conteúdo<select id="contentChoice">${options.map(m=>`<option value="${m.id}" ${m.id===editor.id?"selected":""}>${m.type==="instagram"?"Instagram · ":"Módulo · "}${escape(m.title)}</option>`).join("")}<option value="new" ${editor.id.startsWith("ig-")&&!options.some(m=>m.id===editor.id)?"selected":""}>+ Novo vídeo do Instagram</option></select></label><div class="lib-editor-fields"><label>Título<input name="title" maxlength="120" required value="${escape(editor.title)}"></label><label>Descrição curta<textarea name="description" rows="2" maxlength="600">${escape(editor.description)}</textarea></label><label>Link ${editor.type==="instagram"?"da publicação ou Reel":"do vídeo (YouTube, MP4 ou WebM)"}<input name="url" type="url" maxlength="2000" placeholder="https://" value="${escape(editor.url)}"></label><div class="lib-editor-row"><label>Duração exibida<input name="duration" maxlength="30" placeholder="Ex.: 12 min" value="${escape(editor.duration)}"></label>${editor.type==="instagram"?`<label>Módulo relacionado<select name="moduleId"><option value="">Conteúdo geral</option>${catalog.modules.map(m=>`<option value="${m.id}" ${editor.moduleId===m.id?"selected":""}>${escape(m.title)}</option>`).join("")}</select></label>`:""}</div>${editor.type==="module"?`<label>Resumo escrito da videoaula<textarea name="summary" rows="8" maxlength="16000" placeholder="Descreva os conceitos, as etapas e os exemplos explicados no vídeo. Separe os parágrafos com uma linha em branco.">${escape(editor.summary)}</textarea><small>Este texto aparece na aba PDF e no arquivo para baixar.</small></label>`:'<input type="hidden" name="summary" value="">'}<label class="lib-publish"><input type="checkbox" name="published" ${editor.published?"checked":""}> Publicar para os alunos</label></div><p id="contentError" class="lib-form-error" role="alert" hidden></p><div class="lib-dialog-actions"><button type="button" class="learn-button learn-button-secondary" data-close-dialog>Cancelar</button><button class="learn-button" type="submit" id="contentSave">Salvar conteúdo</button></div></form>`);
    $("contentChoice").onchange=e=>{const next=e.target.value;$("libraryDialog").close();manage(next);};
    $("contentForm").onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));data.published=e.currentTarget.elements.published.checked;data.revision=editor.revision;$("contentSave").disabled=true;$("contentError").hidden=true;try{await api(`/learning/content/${editor.id}`,{method:"PUT",body:JSON.stringify(data)});catalog=await api("/learning/catalog");closeDialog();render();toast(data.published?"Conteúdo publicado para os alunos.":"Rascunho salvo. O conteúdo está oculto para os alunos.");}catch(error){if($("contentError")){$("contentError").hidden=false;$("contentError").textContent=error.message;$("contentSave").disabled=false;}}};
  }
  $("modulesApp").addEventListener("click",e=>{const b=e.target.closest("button");if(!b||b.disabled)return;if(b.dataset.tab)navigate(b.dataset.tab);if(b.dataset.select){stopPlayer();selected=b.dataset.select;const route=window.TurmaNavigation?.pathname||"/modulos";history.replaceState(history.state,"",`${route}#modulos/${selected}`);all(".lib-module-card").forEach(el=>el.classList.toggle("is-selected",el.querySelector("[data-select]").dataset.select===selected));renderPlayer();if(matchMedia("(max-width:1100px)").matches)$("libraryPlayer").scrollIntoView({behavior:"smooth",block:"start"});}if(b.dataset.pdf)navigate("pdf",b.dataset.pdf,true);if(b.dataset.lesson)navigate("modulos",b.dataset.lesson,true);if(b.dataset.read){navigate("pdf",b.dataset.read);$("libraryReader").scrollIntoView({behavior:"smooth",block:"start"});$("libraryReader").focus({preventScroll:true});}if(b.dataset.download)download(b.dataset.download,b);if(b.hasAttribute("data-play"))startVideo();if(b.hasAttribute("data-complete")){checkpoint(true);toast("Conclusão registrada na sua conta.");}if(b.dataset.instagram)instagram(b.dataset.instagram);if(b.hasAttribute("data-manage"))manage();});
  addEventListener("hashchange",()=>{if(catalog){stopPlayer();readHash();renderTab();}});
  addEventListener("turma:study-change",updateProgress);
  addEventListener("pagehide",()=>{checkpoint();S.flush();});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){checkpoint();S.flush();}});
  async function load(){
    $("studyRetry").hidden=true;
    try{const response=await api("/me");user=response.usuario;if(!user?.acessoPremium){location.replace("/dashboard-free");return;}await S.init(user);catalog=await api("/learning/catalog");const name=String(user.nome||"Aluno").split(" ")[0];$("studyName").textContent=name;$("studyAvatar").textContent=name[0].toUpperCase();readHash();render();$("studyLoading").hidden=true;$("modulesApp").hidden=false;}
    catch(e){$("studyLoadTitle").textContent="Vamos tentar novamente?";$("studyLoadMessage").textContent=e.message;$("studyRetry").hidden=false;}
  }
  $("studyRetry").onclick=load;menu(false);applyTheme();load();
})();
