"use strict";
(() => {
  const C = window.TurmaStudy,
    $ = (id) => document.getElementById(id),
    all = (s, r = document) => [...r.querySelectorAll(s)];
  const icon = (n) =>
    `<svg aria-hidden="true"><use href="/assets/dashboard-icons.svg#i-${n}"></use></svg>`;
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const steps = ["explicacao", "exemplo", "minigame"],
    stepNames = ["Explicação", "Exemplo interativo", "Minigame"];
  const module = C.modules.find(
    (m) => m.route === document.body.dataset.studyRoute,
  );
  const normalize = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  let memberId = "",
    state = { modules: {} },
    activeStep = "explicacao",
    selectedFilter = "all",
    toastTimer,
    noteTimer,
    session = null,
    demoStage = 0,
    demoValues = [],
    demoDirty = false;
  const boardModes = {
    demo: matchMedia("(max-width:650px)").matches ? "grid" : "race",
    game: matchMedia("(max-width:650px)").matches ? "grid" : "race",
  };
  const S = window.TurmaStudySync,
    G = window.TurmaStudyGames;
  const emptyEntry = window.TurmaStudyState.emptyEntry;
  function persist(change) {
    const latest = JSON.parse(JSON.stringify(state));
    change(latest);
    for (const m of C.modules) {
      const before = state.modules[m.id] || emptyEntry(),
        after = latest.modules[m.id] || emptyEntry(),
        fields = {};
      for (const key of [
        "steps",
        "note",
        "favorite",
        "lastStep",
        "visitedAt",
        "demo",
      ]) {
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
          fields[key] =
            key === "steps"
              ? after.steps.filter((s) => s !== "minigame")
              : after[key];
      }
      if (Object.keys(fields).length)
        S.enqueue({ kind: "patch", module: m.id, fields });
    }
    state = S.state;
    storageStatus();
    return S.status.online;
  }
  function entry(id = module?.id) {
    return state.modules[id] || emptyEntry();
  }
  function mutateModule(id, change) {
    return persist((data) => {
      data.modules[id] ??= emptyEntry();
      change(data.modules[id]);
    });
  }
  function storageStatus() {
    const status = S.status;
    const message = status.pending
      ? status.online
        ? "Sincronizando alterações…"
        : status.lastError
      : status.online
        ? "Progresso salvo na sua conta. Continue em qualquer dispositivo."
        : status.lastError;
    $("studyStorageStatus").hidden = status.online || !status.lastError;
    $("studyStorageStatus").textContent =
      message +
      (!status.storageOK && status.pending
        ? " Mantenha esta página aberta até concluir a sincronização."
        : "");
    all("[data-save-hint]").forEach((el) => (el.textContent = message));
    if ($("studyNoteStatus") && document.activeElement !== $("studyNote"))
      $("studyNoteStatus").textContent = status.pending
        ? "Sincronizando com sua conta…"
        : status.online
          ? "Anotação salva na sua conta."
          : "Conexão pendente.";
  }
  function progress(id) {
    return Math.round((entry(id).steps.length / 3) * 100);
  }
  function cover(m) {
    return `/assets/modules-v4/${m.art}-${document.documentElement.dataset.theme === "light" ? "light" : "dark"}.webp`;
  }
  function art(m, extra = "") {
    return `<img src="${cover(m)}" alt="" data-study-art="${m.id}" ${extra}>`;
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $("studyToast").textContent = message;
    $("studyToast").hidden = false;
    toastTimer = setTimeout(() => ($("studyToast").hidden = true), 3000);
  }
  function setTheme() {
    const light = document.documentElement.dataset.theme === "light";
    $("studyTheme").setAttribute(
      "aria-label",
      light ? "Ativar tema escuro" : "Ativar tema claro",
    );
    $("studyTheme").setAttribute("aria-pressed", String(light));
    document.querySelector('meta[name="theme-color"]').content = light
      ? "#f3f1f7"
      : "#0b0b11";
    all("[data-study-art]").forEach((img) => {
      const m = C.modules.find((m) => m.id === img.dataset.studyArt);
      if (m) img.src = cover(m);
    });
  }
  $("studyTheme").addEventListener("click", () => {
    document.documentElement.dataset.theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(
        "turma.workspace.theme",
        document.documentElement.dataset.theme,
      );
    } catch {}
    setTheme();
  });
  setTheme();
  function closeMenu(restoreFocus = false) {
    $("studySidebar").classList.remove("is-open");
    $("studyMenu").setAttribute("aria-expanded", "false");
    $("studyBackdrop").hidden = true;
    document.body.classList.remove("menu-open");
    $("studyShell").inert = false;
    $("studyDock").inert = false;
    $("studySidebar").inert = matchMedia("(max-width:900px)").matches;
    if (restoreFocus) $("studyMenu").focus();
  }
  $("studyMenu").addEventListener("click", () => {
    $("studySidebar").inert = false;
    $("studySidebar").classList.add("is-open");
    $("studyMenu").setAttribute("aria-expanded", "true");
    $("studyBackdrop").hidden = false;
    document.body.classList.add("menu-open");
    $("studyShell").inert = true;
    $("studyDock").inert = true;
    $("studySidebar").querySelector("a").focus();
  });
  $("studyBackdrop").addEventListener("click", () => closeMenu(true));
  $("studyCloseMenu").addEventListener("click", () => closeMenu(true));
  matchMedia("(max-width:900px)").addEventListener("change", () => closeMenu());
  closeMenu();
  document.addEventListener("keydown", (event) => {
    if ($("studySidebar").classList.contains("is-open")) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
      if (event.key === "Tab") {
        const items = all("a,button", $("studySidebar")).filter(
            (el) => !el.disabled,
          ),
          first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    if (
      !module &&
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "k" &&
      $("studySearch")
    ) {
      event.preventDefault();
      $("studySearch").focus();
    }
  });
  function headers() {
    const result = { Accept: "application/json" };
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of [
        "token",
        "adminToken",
        "authToken",
        "accessToken",
        "jwt",
      ]) {
        try {
          const token = storage.getItem(key);
          if (token) {
            result.Authorization = `Bearer ${token}`;
            return result;
          }
        } catch {}
      }
    }
    return result;
  }
  async function api(url, method = "GET") {
    const response = await fetch(url, {
      method,
      headers: headers(),
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) {
      location.replace("/");
      throw new Error("Entre novamente para continuar.");
    }
    if (response.status === 403) {
      location.replace("/dashboard-free");
      throw new Error("Confira o acesso da sua conta.");
    }
    if (!response.ok)
      throw new Error(
        "Não foi possível carregar seus estudos. Tente novamente.",
      );
    return response.json();
  }
  async function load() {
    $("studyRetry").hidden = true;
    $("studyLoadTitle").textContent = "Preparando seus estudos";
    $("studyLoadMessage").textContent =
      "Só um instante. Estamos carregando seu espaço.";
    try {
      const { usuario } = await api("/me");
      if (!usuario || usuario.acessoPremium !== true) {
        location.replace("/dashboard-free");
        return;
      }
      memberId = String(usuario.id || usuario._id || "");
      state = await S.init(usuario);
      const name = String(usuario.nome || "Primo")
        .trim()
        .split(/\s+/)[0];
      $("studyName").textContent = name;
      $("studyAvatar").textContent = name.charAt(0).toUpperCase();
      if (module) renderLesson();
      else renderHome();
      $("studyApp").hidden = false;
      $("studyLoading").hidden = true;
      storageStatus();
    } catch (error) {
      $("studyLoadTitle").textContent = "Vamos tentar de novo?";
      $("studyLoadMessage").textContent =
        error.name === "TimeoutError"
          ? "A conexão demorou mais que o esperado. Tente novamente."
          : "Não foi possível carregar seus estudos agora. Seu progresso salvo permanece vinculado à sua conta.";
      $("studyRetry").hidden = false;
    }
  }
  $("studyRetry").addEventListener("click", load);
  $("studyLogout").addEventListener("click", async () => {
    flushNote();
    $("studyLogout").disabled = true;
    try {
      await api("/logout", "POST");
      for (const storage of [sessionStorage, localStorage])
        for (const key of [
          "token",
          "adminToken",
          "authToken",
          "accessToken",
          "jwt",
        ])
          try {
            storage.removeItem(key);
          } catch {}
      location.replace("/");
    } catch {
      $("studyLogout").disabled = false;
      toast("Não foi possível sair agora. Tente novamente.");
    }
  });
  function resumeModule() {
    return (
      C.modules.find(
        (m) => m.id === state.lastModule && progress(m.id) < 100,
      ) ||
      C.modules.find((m) => progress(m.id) > 0 && progress(m.id) < 100) ||
      C.modules.find((m) => progress(m.id) < 100) ||
      C.modules[0]
    );
  }
  function renderHome() {
    const resume = resumeModule(),
      completed = C.modules.filter((m) => progress(m.id) === 100).length,
      totalSteps = C.modules.reduce((n, m) => n + entry(m.id).steps.length, 0),
      pct = Math.round((totalSteps / 24) * 100),
      started = C.modules.filter(
        (m) => entry(m.id).visitedAt > 0 && progress(m.id) < 100,
      ).length;
    const nextStep = entry(resume.id).lastStep,
      hasVisited = !!entry(resume.id).visitedAt;
    $("studyApp").innerHTML =
      `<div class="learn-heading"><div><span class="learn-eyebrow">CENTRAL DE ESTUDOS</span><h1>Seu próximo passo começa aqui.</h1><p>Um conceito por vez. Uma prática para cada descoberta.</p></div><span class="learn-label">${icon("book")}8 módulos para explorar</span></div>
      <div class="learn-feature-grid"><section class="learn-hero">${art(resume, 'class="learn-hero-art" fetchpriority="high"')}<div class="learn-hero-copy"><span class="learn-eyebrow">${hasVisited ? "CONTINUE SUA JORNADA" : "APRENDA NO SEU RITMO"}</span><h2>Entenda a lógica.<br><em>Coloque em prática.</em></h2><p>${hasVisited ? `Retome ${resume.name} e continue pela etapa ${stepNames[steps.indexOf(nextStep)].toLowerCase()}.` : "Explore as explicações, descubra os exemplos e teste o que aprendeu com os minigames."}</p><a class="learn-button" href="/estudo-${resume.route}#${nextStep}">${icon("play")}${hasVisited ? `Continuar ${resume.name}` : `Começar por ${resume.name}`}<span>→</span></a><div class="learn-hero-foot"><span>${icon("book")}Explicação</span><span>${icon("activity")}Exemplo interativo</span><span>${icon("game")}Minigame</span></div></div></section>
      <aside class="learn-progress-card"><small>SUA TRILHA DE APRENDIZADO</small><div class="learn-progress-ring" style="--pct:${pct * 3.6}deg"><div><strong>${pct}%</strong><small>da trilha concluída</small></div></div><p>Em andamento <b>${started}</b></p><p>Módulos concluídos <b>${completed} de 8</b></p><div class="learn-save-hint" data-save-hint></div></aside></div>
      <section class="learn-stat-strip" aria-label="Seu progresso"><article>${icon("book")}<div><strong>8</strong><small>Módulos disponíveis</small></div></article><article>${icon("activity")}<div><strong>${totalSteps}<span> / 24</span></strong><small>Etapas concluídas</small></div></article><article>${icon("exam")}<div><strong>${completed}<span> / 8</span></strong><small>Módulos concluídos</small></div></article></section>
      <section aria-labelledby="libraryTitle"><div class="learn-library-head"><div><span class="learn-eyebrow">EXPLORE O CONHECIMENTO</span><h2 id="libraryTitle">Sua biblioteca de módulos</h2></div><label class="learn-search">${icon("search")}<input id="studySearch" type="search" aria-label="Buscar módulos" placeholder="Buscar um módulo…" autocomplete="off"></label></div>
      <div class="learn-toolbar"><div class="learn-filters" aria-label="Filtrar módulos">${[
        ["all", "Todos"],
        ["progress", "Em andamento"],
        ["done", "Concluídos"],
        ["saved", "Salvos"],
      ]
        .map(
          ([id, name]) =>
            `<button type="button" data-filter="${id}" aria-pressed="${selectedFilter === id}">${name}</button>`,
        )
        .join(
          "",
        )}</div><select class="learn-sort" id="studySort" aria-label="Ordenar módulos"><option value="order">Ordem da trilha</option><option value="progress">Maior progresso</option><option value="recent">Acessados recentemente</option></select></div>
      <p id="studyResultCount" class="learn-results" role="status"></p><div class="learn-cards" id="studyCards"></div><div class="learn-empty" id="studyEmpty" hidden><p>Nenhum módulo nesta seleção.</p><button type="button" class="learn-button learn-button-secondary" data-action="clear-filters">Ver todos os módulos</button></div></section>
      <p class="learn-home-note">${icon("shield")}Atividades para aprender as regras dos módulos. A roleta é aleatória: o desempenho no treino não prevê resultados de apostas.</p>`;
    $("studySearch").addEventListener("input", renderCards);
    $("studySort").addEventListener("change", renderCards);
    renderCards();
    storageStatus();
  }
  function renderCards() {
    const query = normalize($("studySearch").value.trim()),
      sort = $("studySort").value;
    let items = C.modules
      .filter((m) =>
        normalize(m.name + " " + m.category + " " + m.summary).includes(query),
      )
      .filter(
        (m) =>
          selectedFilter === "all" ||
          (selectedFilter === "saved" && entry(m.id).favorite) ||
          (selectedFilter === "done" && progress(m.id) === 100) ||
          (selectedFilter === "progress" &&
            entry(m.id).visitedAt > 0 &&
            progress(m.id) < 100),
      );
    if (sort === "progress")
      items.sort((a, b) => progress(b.id) - progress(a.id));
    if (sort === "recent")
      items.sort((a, b) => entry(b.id).visitedAt - entry(a.id).visitedAt);
    $("studyCards").innerHTML = items
      .map((m) => {
        const p = progress(m.id),
          e = entry(m.id);
        return `<article class="learn-card" data-module="${m.id}" style="--accent:${m.color}"><a class="learn-card-cover" href="/estudo-${m.route}" aria-label="Estudar ${m.name}">${art(m, 'loading="lazy" width="480" height="320"')}<span class="learn-card-category">${m.category}</span></a><button class="learn-favorite" type="button" data-favorite="${m.id}" aria-label="${e.favorite ? "Remover" : "Salvar"} ${m.name}${e.favorite ? " dos salvos" : " na trilha"}" aria-pressed="${e.favorite}">${icon("star")}</button><div class="learn-card-copy"><a class="learn-card-title" href="/estudo-${m.route}"><h3>${m.name}</h3>${icon(m.icon.slice(2))}</a><p>${m.summary}</p><div class="learn-card-meta"><span>3 etapas · 5 desafios</span><b>${p === 100 ? "Concluído ✓" : e.steps.length ? `${e.steps.length}/3 concluídas` : "Para começar"}</b></div><progress max="100" value="${p}" aria-label="Progresso de ${m.name}"></progress><a class="learn-card-bottom" href="/estudo-${m.route}"><span>${p === 100 ? "Revisar módulo" : e.visitedAt ? "Continuar estudo" : "Explorar módulo"}</span><span>↗</span></a></div></article>`;
      })
      .join("");
    $("studyEmpty").hidden = items.length > 0;
    $("studyResultCount").textContent =
      `${items.length} ${items.length === 1 ? "módulo encontrado" : "módulos encontrados"}`;
  }
  function reference() {
    let rows = [],
      heads = ["Origem", "Relação do módulo"];
    if (module.id === "espelhos")
      rows = Object.entries(C.mirrors).map(([n, t]) => [n, t]);
    if (module.id === "magneto")
      rows = Object.entries(C.magnets).map(([n, t]) => [n, t.join(" · ")]);
    if (module.id === "pitagoras") {
      heads = ["Família", "Pontos"];
      rows = C.triangles.map((t) => [t.name, t.points.join(" · ")]);
    }
    if (module.id === "cavalo") {
      heads = ["Família", "Terminais"];
      rows = C.families.map((f, i) => [`Cavalo ${i + 1}`, f.join(" · ")]);
    }
    if (!rows.length) return "";
    return `<details class="learn-reference"><summary>Consultar a tabela do módulo</summary><table class="learn-reference-table"><thead><tr>${heads.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v, i) => (i ? `<td>${escape(v)}</td>` : `<th scope="row">${escape(v)}</th>`)).join("")}</tr>`).join("")}</tbody></table></details>`;
  }
  function requestedStep() {
    const raw = (window.TurmaNavigation?.hash ?? location.hash).slice(1);
    return (
      {
        example: "explicacao",
        interactive: "exemplo",
        game: "minigame",
        treino: "minigame",
      }[raw] || raw
    );
  }
  function renderLesson() {
    const requested = requestedStep();
    activeStep = steps.includes(requested) ? requested : entry().lastStep;
    persist((data) => {
      data.lastModule = module.id;
      data.modules[module.id] ??= emptyEntry();
      data.modules[module.id].visitedAt = Date.now();
    });
    const next = C.modules[(C.modules.indexOf(module) + 1) % 8];
    $("studyApp").innerHTML =
      `<div class="learn-module-heading"><a class="learn-back" href="/estudo">← Voltar para a biblioteca</a><button id="studyModuleFavorite" class="learn-icon-button" type="button" data-favorite="${module.id}" aria-label="Salvar módulo na trilha" aria-pressed="false">${icon("star")}</button></div>
      <section class="learn-module-hero"><div class="learn-module-intro"><span class="learn-eyebrow">${module.category} · ${module.focus}</span><h1>${module.name}</h1><p>${module.summary}</p><div class="learn-module-tags"><span>${icon("book")}3 etapas de aprendizado</span><span>${icon("game")}5 desafios de fixação</span></div></div>${art(module, 'fetchpriority="high" width="480" height="320"')}</section>
      <div class="learn-lesson-grid"><div class="learn-lesson"><div class="learn-tabs" id="studyTabs" role="tablist" aria-label="Etapas do módulo">${steps.map((s, i) => `<button type="button" id="tab-${s}" role="tab" data-step="${s}" aria-controls="panel-${s}" aria-selected="false" tabindex="-1"><span>${i + 1}</span><span>${stepNames[i]}</span></button>`).join("")}</div>
      <section class="learn-panel" id="panel-explicacao" role="tabpanel" aria-labelledby="tab-explicacao" tabindex="0" hidden><span class="learn-eyebrow">ENTENDA O CONCEITO</span><h2>Como funciona ${module.name}</h2><p class="learn-panel-lead">${module.intro}</p><div class="learn-rules">${module.rules.map(([title, copy], i) => `<article class="learn-rule"><span>${i + 1}</span><div><h3>${title}</h3><p>${copy}</p></div></article>`).join("")}</div><div class="learn-example-callout"><strong>UM EXEMPLO PARA COMEÇAR</strong><p>${module.example}</p></div>${reference()}<div class="learn-remember">${icon("shield")}<p>${module.remember}</p></div><div class="learn-panel-actions"><span>Entendeu a ideia? Vamos visualizar.</span><button class="learn-button" type="button" data-action="complete-explanation">Concluir e ver exemplo →</button></div></section>
      <section class="learn-panel" id="panel-exemplo" role="tabpanel" aria-labelledby="tab-exemplo" tabindex="0" hidden></section>
      <section class="learn-panel" id="panel-minigame" role="tabpanel" aria-labelledby="tab-minigame" tabindex="0" hidden></section>
      <p class="learn-education-note">Exercícios educacionais, sem apostas ou dinheiro real. Os exemplos demonstram as regras do material; não preveem o próximo giro.</p></div>
      <aside class="learn-aside"><section class="learn-aside-card"><h2>Sua jornada neste módulo</h2><div class="learn-percent-row"><strong id="studyPercent">0%</strong><small id="studyStepsCount">0 de 3 etapas</small></div><progress id="studyProgress" max="3" value="0" aria-label="Progresso deste módulo"></progress><ol class="learn-step-list">${steps.map((s, i) => `<li><button type="button" data-step="${s}" data-progress-step="${s}"><span>${i + 1}</span>${stepNames[i]}</button></li>`).join("")}</ol><p class="learn-save-hint" data-save-hint></p><a class="learn-next-module" href="/estudo-${next.route}">${art(next, 'loading="lazy" width="50" height="42"')}<span><small>PRÓXIMO NA TRILHA</small>${next.name} ↗</span></a></section><section class="learn-aside-card"><label class="learn-note-label" for="studyNote">${icon("note")}Meu caderno</label><textarea class="learn-note" id="studyNote" maxlength="1000" placeholder="O que você quer lembrar deste módulo?"></textarea><div class="learn-note-foot"><span id="studyNoteStatus">Anotações sincronizadas com sua conta.</span><span id="studyNoteCount">0/1000</span></div></section></aside></div>`;
    $("studyNote").value = entry().note;
    $("studyNoteCount").textContent = `${entry().note.length}/1000`;
    $("studyNote").addEventListener("input", () => {
      clearTimeout(noteTimer);
      $("studyNoteStatus").textContent = "Salvando…";
      $("studyNoteCount").textContent = `${$("studyNote").value.length}/1000`;
      noteTimer = setTimeout(flushNote, 400);
    });
    $("studyNote").addEventListener("blur", flushNote);
    $("studyTabs").addEventListener("keydown", (event) => {
      const tab = event.target.closest("[data-step]");
      if (!tab) return;
      const index = steps.indexOf(tab.dataset.step);
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % 3;
      if (event.key === "ArrowLeft") next = (index + 2) % 3;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = 2;
      if (next !== undefined) {
        event.preventDefault();
        setStep(steps[next], true);
      }
    });
    renderDemo();
    renderGameIntro();
    setStep(activeStep, false);
    updateProgress();
  }
  function flushNote() {
    if (!module || !$("studyNote")) return;
    clearTimeout(noteTimer);
    const text = $("studyNote").value.slice(0, 1000);
    if (text === entry().note) return;
    const saved = mutateModule(module.id, (e) => (e.note = text));
    $("studyNoteStatus").textContent = saved
      ? "Sincronizando anotação…"
      : "Anotação aguardando conexão.";
  }
  window.addEventListener("pagehide", () => {
    flushNote();
    S.flush();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushNote();
      S.flush();
    }
  });
  function setStep(step, focus = false, save = true) {
    if (!steps.includes(step)) return;
    activeStep = step;
    for (const s of steps) {
      const active = s === step;
      $("panel-" + s).hidden = !active;
      $("tab-" + s).setAttribute("aria-selected", String(active));
      $("tab-" + s).tabIndex = active ? 0 : -1;
    }
    if (save) {
      mutateModule(module.id, (e) => (e.lastStep = step));
      const route = window.TurmaNavigation?.pathname ?? location.pathname;
      history.replaceState(history.state, "", `${route}#${step}`);
    }
    updateProgress();
    if (focus) {
      $("tab-" + step).focus();
      $("studyTabs").scrollIntoView({ block: "start", behavior: "instant" });
    }
  }
  window.addEventListener("hashchange", () => {
    if (module && $("studyTabs")) setStep(requestedStep(), false, false);
  });
  function completeStep(step) {
    mutateModule(module.id, (e) => {
      if (!e.steps.includes(step)) e.steps.push(step);
    });
    updateProgress();
  }
  function updateProgress() {
    if (!module || !$("studyPercent")) return;
    const e = entry();
    $("studyPercent").textContent = progress(module.id) + "%";
    $("studyProgress").value = e.steps.length;
    $("studyStepsCount").textContent = `${e.steps.length} de 3 etapas`;
    steps.forEach((s, i) => {
      const done = e.steps.includes(s),
        tab = $("tab-" + s),
        side = document.querySelector(`[data-progress-step="${s}"]`);
      [tab, side].forEach((el) => {
        el.classList.toggle("is-done", done);
        el.firstElementChild.textContent = done ? "✓" : String(i + 1);
      });
      if (s === activeStep) side.setAttribute("aria-current", "step");
      else side.removeAttribute("aria-current");
    });
    $("studyModuleFavorite").setAttribute("aria-pressed", String(e.favorite));
    $("studyModuleFavorite").setAttribute(
      "aria-label",
      e.favorite ? "Remover módulo dos salvos" : "Salvar módulo na trilha",
    );
    storageStatus();
  }
  // Pontos igualmente espaçados pelo comprimento da elipse, na ordem europeia.
  const wheelPoints = (() => {
    const samples = [],
      count = 1600;
    let distance = 0,
      previous = null;
    for (let i = 0; i <= count; i++) {
      const angle = (i / count) * Math.PI * 2,
        x = 50 + 43 * Math.sin(angle),
        y = 50 - 38 * Math.cos(angle);
      if (previous)
        distance += Math.hypot((x - previous.x) * 6.4, (y - previous.y) * 3.6);
      samples.push({ x, y, distance });
      previous = { x, y };
    }
    return C.wheel.map((n, i) => {
      const point = samples.find((p) => p.distance >= (distance * i) / 37);
      return { n, x: point.x, y: point.y };
    });
  })();
  const red = new Set([
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
  ]);
  function mountBoard(name) {
    const mode = boardModes[name],
      numbers = mode === "grid" ? [...C.wheel].sort((a, b) => a - b) : C.wheel;
    $(name + "BoardMount").innerHTML =
      `<div class="learn-board-wrap"><div class="learn-board-head"><h3>${name === "demo" ? "Visualize a leitura" : "Faça sua marcação"}</h3><div class="learn-board-modes" aria-label="Visualização dos números"><button type="button" data-board-mode="race" data-board-name="${name}" aria-pressed="${mode === "race"}">Race</button><button type="button" data-board-mode="grid" data-board-name="${name}" aria-pressed="${mode === "grid"}">Números</button></div></div><div class="learn-board-scroll"><div id="${name}Board" class="learn-board is-${mode}" role="group" aria-label="${name === "demo" ? "Números do exemplo" : "Selecione sua resposta"}"><svg class="learn-triangle" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none"></svg><div class="learn-board-center"><strong>RACE</strong>RODA EUROPEIA · 37 NÚMEROS</div>${numbers
        .map((n) => {
          const p = wheelPoints.find((p) => p.n === n);
          return `<button type="button" class="learn-number ${red.has(n) ? "is-red" : n === 0 ? "is-zero" : ""}" data-number="${n}" data-board="${name}" style="left:${p.x}%;top:${p.y}%" aria-label="Número ${n}" aria-pressed="false">${n}</button>`;
        })
        .join(
          "",
        )}</div></div><div class="learn-board-legend" id="${name}Legend"></div><p class="learn-board-hint">${mode === "race" ? "Ordem real da roda europeia. Deslize para os lados se necessário." : "Números de 0 a 36. Alterne para Race para ver as posições na roda."}</p></div>`;
    if (name === "demo") {
      $(name + "BoardMount").insertAdjacentHTML(
        "beforeend",
        `<div class="learn-board-options"><label><input id="demoCoverage" type="checkbox" ${demoCoverage ? "checked" : ""}> Mostrar vizinhos e complemento</label><span class="learn-board-hint">Toque em um número para inspecionar.</span></div><p class="learn-board-inspect" id="demoInspect" role="status">Explore as posições e compare os vizinhos na roda.</p>`,
      );
      $("demoCoverage").addEventListener("change", (event) => {
        demoCoverage = event.target.checked;
        updateDemoBoard();
      });
      updateDemoBoard();
    } else updateGameBoard();
  }
  function paintBoard(
    name,
    {
      origin = [],
      targets = [],
      coverage = [],
      triangle = [],
      selected = [],
      expected = [],
      checked = false,
    } = {},
  ) {
    const root = $(name + "Board");
    if (!root) return;
    all("[data-number]", root).forEach((button) => {
      const n = Number(button.dataset.number);
      [
        "origin",
        "target",
        "coverage",
        "selected",
        "correct",
        "wrong",
        "missed",
      ].forEach((c) => button.classList.remove("is-" + c));
      let label = `Número ${n}`;
      if (coverage.includes(n)) {
        button.classList.add("is-coverage");
        label += ", grupo complementar";
      }
      if (origin.includes(n)) {
        button.classList.add("is-origin");
        label += ", origem ou ponto conhecido";
      }
      if (targets.includes(n)) {
        button.classList.remove("is-coverage", "is-origin");
        button.classList.add("is-target");
        label += ", alvo do exemplo";
      }
      if (selected.includes(n)) {
        button.classList.add("is-selected");
        label += ", marcado";
      }
      if (checked) {
        if (expected.includes(n) && selected.includes(n)) {
          button.classList.add("is-correct");
          label += ", correto";
        } else if (selected.includes(n)) {
          button.classList.add("is-wrong");
          label += ", incorreto";
        } else if (expected.includes(n)) {
          button.classList.add("is-missed");
          label += ", faltou marcar";
        }
      }
      button.setAttribute("aria-label", label);
      if (name === "game") {
        button.setAttribute("aria-pressed", String(selected.includes(n)));
        button.disabled = checked;
      }
    });
    const svg = root.querySelector("svg"),
      points = triangle
        .map((n) => wheelPoints.find((p) => p.n === n))
        .filter(Boolean)
        .map((p) => `${p.x},${p.y}`)
        .join(" ");
    svg.innerHTML =
      triangle.length > 1
        ? `<${triangle.length > 2 ? "polygon" : "polyline"} points="${points}"/>`
        : "";
  }
  function updateDemoBoard() {
    const reading = C.reading(module.id, demoValues, demoStage);
    if (!demoCoverage) reading.coverage = [];
    paintBoard("demo", reading);
    $("demoLegend").innerHTML =
      '<span><i></i>Origem / conhecidos</span><span class="gold"><i></i>Alvos do exemplo</span><span class="soft"><i></i>Vizinhos / complemento</span>';
  }
  function updateGameBoard() {
    if (!session) return;
    paintBoard("game", {
      origin: session.question.shown,
      selected: [...session.selected],
      expected: session.question.expected.map(Number),
      checked: session.checked,
      triangle:
        module.id === "pitagoras"
          ? [
              ...session.question.shown,
              ...(session.checked
                ? session.question.expected.map(Number)
                : [...session.selected]),
            ]
          : [],
    });
    $("gameLegend").innerHTML = session.checked
      ? '<span class="good"><i></i>Correto</span><span class="bad"><i></i>Incorreto</span><span class="missed"><i></i>Faltou marcar</span>'
      : '<span><i></i>Números apresentados</span><span class="gold"><i></i>Sua seleção</span>';
  }
  const numberField = (id, label, value) =>
    `<label>${label}<input id="${id}" type="number" min="0" max="36" step="1" inputmode="numeric" value="${value}" required></label>`;
  const selectField = (id, label, options) =>
    `<label>${label}<select id="${id}">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select></label>`;
  let demoCoverage = true,
    scenarioIndex = 0;
  let resetCount = 0,
    resetEnded = false;
  function renderDemo(override = null) {
    const savedDemo = override || entry().demo;
    let fields = "";
    if (module.id === "gemeos") {
      demoValues = [11];
      fields = selectField(
        "demoOrigin",
        "Gêmeo de origem",
        [11, 22, 33].map((n) => [n, n]),
      );
    }
    if (module.id === "espelhos") {
      demoValues = [12];
      fields = selectField(
        "demoOrigin",
        "Número de origem",
        Object.keys(C.mirrors)
          .map(Number)
          .sort((a, b) => a - b)
          .map((n) => [n, n]),
      );
    }
    if (module.id === "fibonacci") {
      demoValues = [15, 14, 25, 4];
      fields = [
        "Primeiro número",
        "Segundo número",
        "Penúltimo número",
        "Último número",
      ]
        .map((label, i) => numberField("demoNumber" + i, label, demoValues[i]))
        .join("");
    }
    if (module.id === "magneto") {
      demoValues = [14, 1];
      fields =
        numberField("demoOrigin", "Número de origem", 14) +
        selectField("demoNeighbors", "Vizinhos por lado", [
          [1, "1 vizinho"],
          [2, "2 vizinhos"],
        ]);
    }
    if (module.id === "camaleoes") {
      demoValues = [16, 18, 25];
      fields =
        '<label class="is-wide">Histórico (1 a 12 números)<input id="demoHistory" type="text" inputmode="numeric" value="16 18 25" placeholder="Ex.: 16 18 25" maxlength="60" autocomplete="off" required></label>';
    }
    if (module.id === "pitagoras") {
      demoValues = [0];
      fields = selectField(
        "demoTriangle",
        "Família do exemplo",
        C.triangles.map((t, i) => [i, t.name]),
      );
    }
    if (module.id === "cavalo") {
      demoValues = [14, 27, 31];
      fields =
        '<label class="is-wide">Três resultados para classificar<input id="demoHistory" type="text" inputmode="numeric" value="14 27 31" placeholder="Ex.: 14 27 31" maxlength="8" autocomplete="off" required></label>';
    }
    if (module.id === "eclipse") {
      demoValues = [0];
      fields =
        '<p class="learn-panel-lead" style="margin:0">Avance as etapas abaixo para revelar os dois terminais. Os números são um exemplo didático.</p>';
    }
    $("panel-exemplo").innerHTML =
      `<span class="learn-eyebrow">VEJA O CONCEITO EM AÇÃO</span><h2>Explore. Altere. Entenda.</h2><p class="learn-panel-lead">${module.id === "eclipse" ? "Acompanhe a construção da órbita, uma etapa por vez." : "Altere o exemplo e avance pelas três etapas para acompanhar cada marcação."}</p><div class="learn-demo-controls"><div class="learn-fields" id="studyDemoFields">${fields}</div>${module.id !== "eclipse" ? '<div class="learn-demo-actions"><small>Use apenas números inteiros entre 0 e 36.</small><button class="learn-button learn-button-secondary" type="button" data-action="demo-apply">Atualizar exemplo</button></div>' : ""}<p class="learn-field-error" id="demoFieldError" role="status" hidden></p></div><div class="learn-demo-walk"><small id="demoStageLabel"></small><p id="demoStageText" aria-live="polite"></p><div class="learn-demo-buttons"><button id="demoPrev" class="learn-button learn-button-quiet" type="button" data-action="demo-prev">← Anterior</button><div class="learn-demo-dots" aria-hidden="true"><i></i><i></i><i></i></div><button id="demoNext" class="learn-button learn-button-secondary" type="button" data-action="demo-next">Próximo →</button></div></div><div id="demoBoardMount"></div><ul class="learn-demo-results" id="demoResults"></ul>${module.id === "gemeos" ? '<details class="learn-reference"><summary>Experimente o reset da leitura</summary><p class="learn-panel-lead">Cenário didático após as duas entradas iniciais. Avance rodadas sem gêmeos ou simule um gêmeo para encerrar a leitura.</p><p id="demoResetStatus" class="learn-panel-lead" role="status"></p><div class="learn-game-controls"><button class="learn-button learn-button-secondary" data-action="reset-neutral" type="button">+ Rodada sem gêmeo</button><button class="learn-button learn-button-quiet" data-action="reset-twin" type="button">Simular gêmeo</button><button class="learn-button learn-button-quiet" data-action="reset-restart" type="button">Reiniciar</button></div></details>' : ""}<div class="learn-panel-actions"><span id="demoCompletionHint">Veja as três etapas para concluir o exemplo.</span><button id="demoComplete" class="learn-button" type="button" data-action="complete-demo" disabled>Concluir e praticar →</button></div>`;
    if (G.validDemo(module.id, savedDemo)) {
      demoValues = [...savedDemo.values];
      demoStage = savedDemo.stage;
    }
    if ($("demoOrigin")) $("demoOrigin").value = String(demoValues[0]);
    if ($("demoNeighbors")) $("demoNeighbors").value = String(demoValues[1]);
    if ($("demoHistory")) $("demoHistory").value = demoValues.join(" ");
    if ($("demoTriangle")) $("demoTriangle").value = String(demoValues[0]);
    for (let i = 0; i < 4; i++)
      if ($("demoNumber" + i))
        $("demoNumber" + i).value = String(demoValues[i]);
    if (module.id !== "eclipse")
      $("studyDemoFields").insertAdjacentHTML(
        "beforebegin",
        '<div class="learn-scenarios"><span>Compare situações diferentes da mesma regra.</span><button class="learn-button learn-button-quiet" data-action="demo-scenario" type="button">Explorar outro cenário ↻</button></div>',
      );
    all("input,select", $("studyDemoFields")).forEach((field) =>
      field.addEventListener("input", () => {
        demoDirty = true;
        $("demoFieldError").hidden = false;
        $("demoFieldError").textContent =
          "Clique em Atualizar exemplo para aplicar as alterações.";
        $("demoNext").disabled = true;
        $("demoPrev").disabled = true;
        $("demoComplete").disabled = true;
      }),
    );
    $("studyDemoFields").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyDemo();
      }
    });
    mountBoard("demo");
    updateDemo();
    if (module.id === "gemeos") updateReset();
  }
  function applyDemo() {
    let values = null;
    if (["gemeos", "espelhos"].includes(module.id)) {
      const n = Number($("demoOrigin").value);
      if (
        module.id === "gemeos"
          ? [11, 22, 33].includes(n)
          : Object.hasOwn(C.mirrors, n)
      )
        values = [n];
    }
    if (module.id === "fibonacci") {
      const parts = Array.from({ length: 4 }, (_, i) =>
        C.parseNumbers($("demoNumber" + i).value, 1),
      );
      if (parts.every(Boolean)) values = parts.flat();
    }
    if (module.id === "magneto") {
      const n = C.parseNumbers($("demoOrigin").value, 1),
        k = Number($("demoNeighbors").value);
      if (n && [1, 2].includes(k)) values = [n[0], k];
    }
    if (module.id === "camaleoes")
      values = C.parseNumbers($("demoHistory").value, 1, 12);
    if (module.id === "cavalo")
      values = C.parseNumbers($("demoHistory").value, 3);
    if (module.id === "pitagoras") {
      const i = Number($("demoTriangle").value);
      if (Number.isInteger(i) && C.triangles[i]) values = [i];
    }
    if (!values) {
      demoDirty = true;
      $("demoFieldError").hidden = false;
      $("demoFieldError").textContent =
        module.id === "cavalo"
          ? "Informe exatamente três números inteiros de 0 a 36, separados por espaços."
          : module.id === "camaleoes"
            ? "Informe de 1 a 12 números inteiros de 0 a 36, separados por espaços."
            : "Preencha todos os campos com números inteiros entre 0 e 36.";
      $("demoComplete").disabled = true;
      $("demoNext").disabled = true;
      return;
    }
    demoValues = values;
    demoStage = 0;
    demoDirty = false;
    resetCount = 0;
    resetEnded = false;
    $("demoFieldError").hidden = true;
    updateDemo();
    if (module.id === "gemeos") updateReset();
  }
  function updateDemo() {
    const r = C.reading(module.id, demoValues, demoStage);
    $("demoStageLabel").textContent = `ETAPA ${demoStage + 1} DE 3`;
    $("demoStageText").textContent = r.lines[demoStage];
    $("demoPrev").disabled = demoStage === 0 || demoDirty;
    $("demoNext").disabled = demoStage === 2 || demoDirty;
    $("demoComplete").disabled = demoStage !== 2 || demoDirty;
    all(".learn-demo-dots i").forEach((el, i) =>
      el.classList.toggle("is-active", i <= demoStage),
    );
    $("demoResults").innerHTML = r.lines
      .slice(0, demoStage + 1)
      .map((line) => `<li>${escape(line)}</li>`)
      .join("");
    $("demoCompletionHint").textContent =
      demoStage === 2
        ? "Exemplo explorado. Teste o que aprendeu."
        : "Veja as três etapas para concluir o exemplo.";
    updateDemoBoard();
    mutateModule(
      module.id,
      (e) => (e.demo = { values: [...demoValues], stage: demoStage }),
    );
  }
  function updateReset() {
    if (!$("demoResetStatus")) return;
    $("demoResetStatus").textContent = resetEnded
      ? "Um gêmeo apareceu: esta leitura foi encerrada. Reinicie para explorar outro cenário."
      : resetCount === 12
        ? "12 rodadas sem gêmeos: o método considera o ciclo resetado e prevê mais duas entradas. Isso não altera a aleatoriedade dos giros."
        : `${resetCount} de 12 rodadas sem gêmeos. A leitura continua pendente.`;
    all('[data-action="reset-neutral"],[data-action="reset-twin"]').forEach(
      (b) => (b.disabled = resetEnded || resetCount === 12),
    );
  }
  function renderGameIntro() {
    const e = entry(),
      meta = G.catalog[module.id],
      resume = e.game && e.game.answers.length < 5;
    $("panel-minigame").innerHTML =
      `<span class="learn-eyebrow">${meta.mechanic} · NÍVEL ${meta.level} / 8</span><div class="learn-game-intro"><div class="learn-game-emblem">${icon("game")}</div><h2>${meta.name}</h2><p>${meta.description}</p><div class="learn-difficulty" aria-label="Dificuldade ${meta.difficulty}">${Array.from({ length: 8 }, (_, i) => `<i class="${i < meta.level ? "is-active" : ""}"></i>`).join("")}<span>${meta.difficulty}</span></div><div class="learn-game-facts"><span><strong>5</strong>desafios por sessão</span><span><strong>3</strong>acertos para concluir</span><span><strong>∞</strong>tempo para pensar</span></div><button class="learn-button" type="button" data-action="game-start">${icon("play")}${resume ? `Continuar desafio ${e.game.answers.length + 1} de 5` : "Começar minigame"}</button>${resume ? '<button class="learn-button learn-button-quiet" type="button" data-action="game-new">Iniciar outra sessão</button>' : e.game ? '<button class="learn-button learn-button-quiet" type="button" data-action="game-review">Ver última sessão</button>' : ""}<p>${e.sessions ? `Melhor sessão: ${e.bestScore}/5 acertos · ${e.sessions} sessão(ões) finalizada(s).` : "Suas respostas e a próxima rodada ficam salvas na sua conta."}</p></div>`;
  }
  function startGame(resume = true, review = false) {
    const stored = entry().game;
    const saved =
      resume && stored && (review || stored.answers.length < 5)
        ? stored
        : {
            id: crypto.randomUUID(),
            seed: crypto.getRandomValues(new Uint32Array(1))[0],
            answers: [],
            draft: [],
          };
    session = {
      id: saved.id,
      seed: saved.seed,
      round: Math.min(4, saved.answers.length),
      score: 0,
      answers: [],
      selected: new Set(),
      draft: [...saved.draft],
      checked: false,
      finished: false,
    };
    session.answers = saved.answers.map((selected, i) => {
      const question = G.task(module.id, session.seed, i);
      const ok = G.grade(question, selected);
      session.score += Number(ok);
      return { question, selected, ok };
    });
    if (saved.answers.length === 5) {
      finishGame();
      return;
    }
    session.question = G.task(module.id, session.seed, session.round);
    session.selected = new Set(session.draft.map(Number));
    saveGame();
    renderRound();
  }
  function saveGame() {
    if (!session) return;
    const game = {
      id: session.id,
      seed: session.seed,
      answers: session.answers.map((a) => a.selected.map(String)),
      draft: session.draft.map(String),
    };
    S.enqueue({
      kind: "game",
      module: module.id,
      game,
      ...(game.answers.length === 5 ? { id: `game:${game.id}:finish` } : {}),
    });
    state = S.state;
    updateProgress();
  }
  function renderRound() {
    const q = session.question,
      meta = G.catalog[module.id];
    $("panel-minigame").innerHTML =
      `<span class="learn-eyebrow">${meta.mechanic} · ${meta.difficulty}</span><h2>${meta.name}</h2><div class="learn-game-top"><span>Desafio ${session.round + 1} de 5</span><b>${session.score} ${session.score === 1 ? "acerto" : "acertos"} até aqui</b></div><progress value="${session.round}" max="5" aria-label="Desafios respondidos"></progress><div class="learn-game-question">${["gemeos", "camaleoes"].includes(module.id) ? `<div class="learn-prompts">${q.shown.map((n) => `<span>${n}</span>`).join("")}</div>` : ""}<h3 id="gameQuestion" tabindex="-1">${escape(q.prompt)}</h3></div><div id="gameBoardMount"></div><p class="learn-game-selection" id="gameSelection" aria-live="polite"></p><div class="learn-game-controls"><button class="learn-button learn-button-quiet" data-action="game-clear" type="button" id="gameClear">Limpar resposta</button><button class="learn-button" data-action="game-check" type="button" id="gameCheck">Conferir resposta</button><button class="learn-button" data-action="game-next" type="button" id="gameNext" hidden>${session.round === 4 ? "Ver resultado" : "Próximo desafio"} →</button></div><div class="learn-game-feedback" id="gameFeedback" role="status" hidden></div>`;
    renderPuzzle();
    if (activeStep === "minigame")
      $("gameQuestion").focus({ preventScroll: true });
  }
  function renderPuzzle() {
    if (module.id === "pitagoras") mountBoard("game");
    else
      window.TurmaStudyGameUI.render(
        $("gameBoardMount"),
        session.question,
        session.draft,
        session.checked,
        (answer) => {
          session.draft = answer;
          saveGame();
        },
      );
  }
  function checkGame() {
    if (!session || session.checked || session.finished) return;
    const selected =
      module.id === "pitagoras"
        ? [...session.selected].map(String)
        : session.draft;
    if (!selected.length || selected.some((v) => v === "")) {
      $("gameFeedback").hidden = false;
      $("gameFeedback").textContent =
        "Preencha sua resposta antes de conferir.";
      return;
    }
    const ok = G.grade(session.question, selected);
    session.checked = true;
    session.score += Number(ok);
    session.answers.push({
      question: session.question,
      selected: [...selected],
      ok,
    });
    session.draft = [];
    saveGame();
    session.draft = [...selected];
    $("gameFeedback").hidden = false;
    $("gameFeedback").classList.toggle("is-error", !ok);
    $("gameFeedback").innerHTML =
      `<strong>${ok ? "Boa! Você identificou a relação." : "Vamos revisar essa relação."}</strong>${escape(session.question.explanation)}`;
    $("gameCheck").disabled = true;
    $("gameClear").disabled = true;
    $("gameNext").hidden = false;
    renderPuzzle();
  }
  function nextGame() {
    if (!session || !session.checked || session.finished) return;
    if (session.round === 4) {
      finishGame();
      return;
    }
    session.round++;
    session.question = G.task(module.id, session.seed, session.round);
    session.draft = [];
    session.selected = new Set();
    session.checked = false;
    renderRound();
  }
  function finishGame() {
    if (session.finished) return;
    session.finished = true;
    const passed = session.score >= 3;
    updateProgress();
    $("panel-minigame").innerHTML =
      `<span class="learn-eyebrow">SESSÃO FINALIZADA · ${G.catalog[module.id].name}</span><div class="learn-game-intro"><div class="learn-result-score">${session.score}<small> / 5</small></div><h2 id="gameResultTitle" tabindex="-1">${passed ? "Mais um passo no seu aprendizado." : "Cada revisão ajuda a fixar."}</h2><p>${passed ? "Você concluiu a etapa Minigame. Revise suas respostas ou continue os estudos." : "A etapa Minigame é concluída com pelo menos três acertos. Revise as relações e tente novamente."}</p></div><div class="learn-game-review">${session.answers.map((a, i) => `<details><summary><span class="${a.ok ? "good" : "bad"}">${a.ok ? "✓" : "○"} Desafio ${i + 1}</span> · ${escape(a.question.prompt)}</summary><p>${escape(a.question.explanation)}</p><small>Sua resposta: ${escape(G.answerText(a.question, a.selected))}. Resposta esperada: ${escape(G.answerText(a.question, a.question.expected))}.</small></details>`).join("")}</div><div class="learn-game-controls"><button class="learn-button learn-button-secondary" data-action="game-new" type="button">Praticar novamente</button><a class="learn-button" href="/estudo">Voltar à trilha →</a></div>`;
    $("gameResultTitle").focus({ preventScroll: true });
  }
  $("studyApp").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.dataset.favorite) {
      const id = button.dataset.favorite;
      if (!C.modules.some((m) => m.id === id)) return;
      mutateModule(id, (e) => (e.favorite = !e.favorite));
      if (module) updateProgress();
      else {
        renderCards();
        document
          .querySelector(`[data-favorite="${id}"]`)
          ?.focus({ preventScroll: true });
      }
      toast(
        entry(id).favorite
          ? "Módulo salvo na sua trilha."
          : "Módulo removido dos salvos.",
      );
      return;
    }
    if (button.dataset.filter) {
      selectedFilter = button.dataset.filter;
      all("[data-filter]").forEach((b) =>
        b.setAttribute("aria-pressed", String(b === button)),
      );
      renderCards();
      return;
    }
    if (button.dataset.step) {
      setStep(button.dataset.step, true);
      return;
    }
    if (button.dataset.boardMode) {
      const name = button.dataset.boardName;
      boardModes[name] = button.dataset.boardMode;
      mountBoard(name);
      document
        .querySelector(
          `[data-board-name="${name}"][data-board-mode="${boardModes[name]}"]`,
        )
        .focus({ preventScroll: true });
      return;
    }
    if (
      button.dataset.board === "game" &&
      session &&
      !session.checked &&
      !session.finished
    ) {
      const n = Number(button.dataset.number);
      if (session.selected.has(n)) session.selected.delete(n);
      else session.selected.add(n);
      session.draft = [...session.selected].map(String);
      saveGame();
      updateGameBoard();
      $("gameSelection").textContent = session.selected.size
        ? `${session.selected.size} marcado(s): ${[...session.selected].sort((a, b) => a - b).join(", ")}.`
        : "Nenhum número marcado.";
      return;
    }
    const action = button.dataset.action;
    if (action === "clear-filters") {
      $("studySearch").value = "";
      selectedFilter = "all";
      all("[data-filter]").forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.filter === "all")),
      );
      renderCards();
      $("studySearch").focus();
    }
    if (action === "complete-explanation") {
      completeStep("explicacao");
      setStep("exemplo", true);
    }
    if (action === "demo-scenario") {
      const scenarios = {
        gemeos: [[11], [22], [33]],
        espelhos: [[12], [6], [1]],
        fibonacci: [
          [15, 14, 25, 4],
          [25, 19, 7, 30],
          [0, 0, 18, 18],
        ],
        magneto: [
          [14, 1],
          [24, 2],
          [0, 1],
        ],
        camaleoes: [
          [16, 18, 25],
          [12, 14, 21],
          [15, 24, 33],
        ],
        pitagoras: [[0], [3], [5]],
        cavalo: [
          [14, 27, 31],
          [10, 14, 27],
          [12, 18, 22],
        ],
      };
      const values = scenarios[module.id];
      scenarioIndex = (scenarioIndex + 1) % values.length;
      demoDirty = false;
      renderDemo({ values: values[scenarioIndex], stage: 0 });
    }
    if (button.dataset.board === "demo") {
      const n = Number(button.dataset.number),
        reading = C.reading(module.id, demoValues, demoStage);
      const role = reading.targets.includes(n)
        ? "Alvo desta etapa"
        : reading.origin.includes(n)
          ? "Origem ou ponto conhecido"
          : reading.coverage.includes(n)
            ? "Vizinho ou complemento"
            : "Fora da marcação desta etapa";
      $("demoInspect").textContent =
        `Número ${n} · ${role}. Um vizinho de cada lado: ${C.neighbors(n, 1)
          .filter((x) => x !== n)
          .join(" e ")}.`;
    }
    if (action === "demo-apply") applyDemo();
    if (action === "demo-prev" && !demoDirty && demoStage > 0) {
      demoStage--;
      updateDemo();
    }
    if (action === "demo-next" && !demoDirty && demoStage < 2) {
      demoStage++;
      updateDemo();
    }
    if (action === "complete-demo" && demoStage === 2 && !demoDirty) {
      completeStep("exemplo");
      setStep("minigame", true);
    }
    if (action === "reset-neutral" && !resetEnded && resetCount < 12) {
      resetCount++;
      updateReset();
    }
    if (action === "reset-twin") {
      resetEnded = true;
      updateReset();
    }
    if (action === "reset-restart") {
      resetCount = 0;
      resetEnded = false;
      updateReset();
    }
    if (action === "game-start") startGame();
    if (action === "game-new") startGame(false);
    if (action === "game-review") startGame(true, true);
    if (action === "game-clear" && session && !session.checked) {
      session.selected.clear();
      session.draft = [];
      saveGame();
      renderRound();
    }
    if (action === "game-check") checkGame();
    if (action === "game-next") nextGame();
  });
  $("studyApp").addEventListener("keydown", (event) => {
    const b = event.target.closest("[data-board]");
    if (!b || (b.dataset.board === "game" && session?.checked)) return;
    const buttons = all("[data-board]", $(b.dataset.board + "Board")),
      i = buttons.indexOf(b);
    let next;
    if (event.key === "ArrowRight") next = (i + 1) % buttons.length;
    if (event.key === "ArrowLeft")
      next = (i + buttons.length - 1) % buttons.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = buttons.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      buttons[next].focus();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "turma.workspace.theme") {
      document.documentElement.dataset.theme =
        event.newValue === "light" ? "light" : "dark";
      setTheme();
    }
  });
  window.addEventListener("turma:study-change", () => {
    if (!memberId) return;
    const previous = state;
    state = S.state;
    storageStatus();
    if (
      !module &&
      $("studyCards") &&
      JSON.stringify(previous.modules) !== JSON.stringify(state.modules)
    ) {
      const query = $("studySearch").value,
        sort = $("studySort").value;
      if (document.activeElement === $("studySearch")) renderCards();
      else {
        renderHome();
        $("studySearch").value = query;
        $("studySort").value = sort;
        renderCards();
      }
    }
    if (module) {
      updateProgress();
      if ($("studyNote") && document.activeElement !== $("studyNote")) {
        $("studyNote").value = entry().note;
        $("studyNoteCount").textContent = `${entry().note.length}/1000`;
      }
    }
  });
  document.addEventListener(
    "error",
    (event) => {
      const img = event.target;
      if (
        !(img instanceof HTMLImageElement) ||
        !img.dataset.studyArt ||
        img.dataset.fallback
      )
        return;
      img.dataset.fallback = "true";
      const m = C.modules.find((m) => m.id === img.dataset.studyArt);
      if (m) img.src = `/assets/imperial-v14/modules/${m.art}.svg`;
    },
    true,
  );
  load();
})();
