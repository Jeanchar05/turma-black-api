"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    all = (q, r = document) => [...r.querySelectorAll(q)],
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      ),
    icon = (n) =>
      `<svg aria-hidden="true"><use href="/assets/dashboard-icons.svg#i-${n}"></use></svg>`,
    norm = (v) =>
      String(v)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    id24 = () =>
      [...crypto.getRandomValues(new Uint8Array(12))]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
  const plain = (html) => {
    const d = new DOMParser().parseFromString(html, "text/html");
    d.querySelectorAll("p,div,li,h1,h2,h3,h4,br").forEach((n) => {
      n.before("\n");
      n.after("\n");
    });
    return d.body.textContent.trim();
  };
  DOMPurify.addHook("afterSanitizeAttributes", (n) => {
    if (n.hasAttribute?.("style")) {
      const s = n.style,
        a = {};
      if (["left", "center", "right"].includes(s.textAlign))
        a.textAlign = s.textAlign;
      if (["bold", "700"].includes(s.fontWeight)) a.fontWeight = s.fontWeight;
      if (s.fontStyle === "italic") a.fontStyle = "italic";
      if (["underline", "line-through"].includes(s.textDecoration))
        a.textDecoration = s.textDecoration;
      if (
        [
          "rgb(255, 242, 179)",
          "rgb(217, 199, 255)",
          "rgb(208, 237, 220)",
        ].includes(s.backgroundColor)
      )
        a.backgroundColor = s.backgroundColor;
      n.removeAttribute("style");
      Object.assign(n.style, a);
    }
    if (n.tagName === "A") {
      n.setAttribute("target", "_blank");
      n.setAttribute("rel", "noopener noreferrer");
    }
  });
  const clean = (html) =>
    DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "p",
        "div",
        "br",
        "h1",
        "h2",
        "h3",
        "h4",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "strike",
        "ul",
        "ol",
        "li",
        "blockquote",
        "a",
        "span",
        "mark",
        "hr",
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "style"],
      ALLOW_DATA_ATTR: false,
    });
  let user,
    notes = [],
    activeId,
    scope = "all",
    online = true,
    authorized = true,
    saving,
    saveTimer,
    toastTimer,
    selection,
    opener,
    actionOpener;
  const account = () => String(user?.id || user?._id || ""),
    current = () => notes.find((n) => n.id === activeId),
    key = () => `turma.notes.v2.${account()}`;
  function headers() {
    const h = {
      "Content-Type": "application/json",
      "X-Notes-Account": account(),
      Accept: "application/json",
    };
    for (const s of [sessionStorage, localStorage])
      for (const k of [
        "token",
        "adminToken",
        "authToken",
        "accessToken",
        "jwt",
      ])
        try {
          const t = s.getItem(k);
          if (t) {
            h.Authorization = `Bearer ${t}`;
            return h;
          }
        } catch {}
    return h;
  }
  async function api(url, opt = {}) {
    const r = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        headers: headers(),
        signal: AbortSignal.timeout(20000),
        ...opt,
      }),
      d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) authorized = false;
      throw Object.assign(
        Error(d.erro || "Conexão indisponível. Tente novamente."),
        { status: r.status, data: d },
      );
    }
    return d;
  }
  function toast(s) {
    $("studyToast").textContent = s;
    $("studyToast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("studyToast").hidden = true), 5000);
  }
  function persist() {
    if (!user) return;
    try {
      localStorage.setItem(
        key(),
        JSON.stringify({ account: account(), notes }),
      );
    } catch {
      toast(
        "O armazenamento está cheio. Mantenha a aba aberta até salvar na conta.",
      );
    }
  }
  function cached() {
    try {
      const d = JSON.parse(localStorage.getItem(key()));
      return d?.account === account() && Array.isArray(d.notes)
        ? d.notes
            .filter((n) => /^[a-f0-9]{24}$/.test(n.id))
            .map((n) => ({ ...n, conteudo: clean(n.conteudo || "") }))
        : [];
    } catch {
      return [];
    }
  }
  function queue(n, patch) {
    Object.assign(n, patch, {
      $pending: true,
      $version: (n.$version || 0) + 1,
      $mutation: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    });
    persist();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 2200);
    status();
  }
  function dirty(p) {
    const n = current();
    if (n && !n.excluida) queue(n, p);
  }
  async function flush() {
    if (saving) return saving;
    if (!authorized) {
      status();
      return false;
    }
    saving = (async () => {
      for (const id of notes
        .filter((n) => n.$pending && !n.$conflict)
        .map((n) => n.id)) {
        const n = notes.find((n) => n.id === id);
        if (!n) continue;
        const snap = structuredClone(n);
        try {
          const d = await api(`/dashboard-premium/notas/${id}`, {
              method: "PUT",
              body: JSON.stringify({
                ...snap,
                mutationId: snap.$mutation,
                revision: snap.revision || 0,
              }),
            }),
            live = notes.find((n) => n.id === id);
          if (!live) continue;
          online = true;
          if (live.$version === snap.$version)
            Object.assign(live, d.nota, {
              $pending: false,
              $conflict: null,
              $error: "",
            });
          else {
            live.revision = d.nota.revision;
            live.createdAt = d.nota.createdAt;
          }
          persist();
        } catch (e) {
          online = false;
          const live = notes.find((n) => n.id === id);
          if (live) {
            live.$error = e.message;
            if ([404, 409].includes(e.status))
              live.$conflict = e.data?.nota || "removed";
          }
          persist();
          if (![404, 409].includes(e.status)) break;
        }
      }
      return !notes.some((n) => n.$pending);
    })();
    try {
      return await saving;
    } finally {
      saving = null;
      renderList();
      status();
      if (online && notes.some((n) => n.$pending && !n.$conflict)) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flush, 2200);
      }
    }
  }
  function status() {
    const pending = notes.filter((n) => n.$pending).length;
    if ($("notesSync"))
      $("notesSync").textContent = !authorized
        ? "A conta mudou. Entre novamente."
        : pending
          ? `${pending} nota(s) aguardam sincronização${online ? "." : " · confira sua conexão."}`
          : online
            ? "Tudo salvo na sua conta."
            : "Sem conexão · última versão deste dispositivo.";
    const n = current();
    if (!n || !$("noteSaveStatus")) return;
    $("noteSaveStatus").textContent = n.$conflict
      ? "Edição preservada · escolha como continuar"
      : !authorized
        ? "Conta mudou · edição neste dispositivo"
        : n.$pending
          ? online
            ? "Edição neste dispositivo · aguardando salvar…"
            : "Pendente · ainda não salvo na conta"
          : "Salvo na sua conta";
    $("noteWordCount").textContent =
      `${plain(n.conteudo).split(/\s+/).filter(Boolean).length} palavras`;
    $("noteConflict").hidden = !n.$conflict;
    $("noteLatest").hidden = n.$conflict === "removed";
  }
  async function refresh() {
    try {
      const d = await api("/dashboard-premium/notas");
      online = true;
      const keep = notes.filter(
        (n) => n.$pending || (n.id === activeId && $("noteEditor").open),
      );
      notes = [
        ...d.notas.filter((n) => !keep.some((k) => k.id === n.id)),
        ...keep,
      ];
      persist();
      renderList();
    } catch (e) {
      online = false;
      toast(e.message);
      status();
    }
  }
  function render() {
    $("notesApp").innerHTML =
      `<section class="notes-hero"><div><span class="learn-eyebrow">SEU CADERNO, SUA EVOLUÇÃO</span><h1>Ideias que viram<br><em>aprendizado.</em></h1><p>Organize suas descobertas, destaque o que importa<br>e leve suas anotações com você.</p><button class="learn-button" type="button" data-new-note>+ Criar anotação</button></div><div class="notes-hero-art" aria-hidden="true"><span class="notes-paper-back"></span><div class="notes-paper"><small>MEU CADERNO</small><b>Aprender.<br>Praticar.<br><em>Evoluir.</em></b><span></span><i>✦</i></div></div></section><section class="notes-summary"><span><strong id="notesCount">0</strong> anotações</span><span><strong id="notesFavorites">0</strong> favoritas</span><span><strong id="notesCategoriesCount">0</strong> categorias</span><p id="notesSync" role="status"></p></section><section class="notes-library"><div class="notes-library-top"><div><span class="learn-eyebrow">ORGANIZE O QUE VOCÊ APRENDEU</span><h2 id="notesViewTitle">Meu caderno</h2></div><button type="button" class="notes-trash-button" data-scope="trash" aria-label="Abrir lixeira">${icon("trash")} Lixeira <b id="notesTrashCount">0</b></button></div><div class="notes-filters"><label class="notes-search">${icon("search")}<input id="notesSearch" type="search" aria-label="Buscar nas anotações" placeholder="Buscar nas suas notas…"></label><select id="notesCategoryFilter" aria-label="Categoria"><option value="">Todas as categorias</option></select><select id="notesSort" aria-label="Ordenar"><option value="recent">Mais recentes</option><option value="title">Título A–Z</option><option value="oldest">Mais antigas</option></select></div><div class="notes-scope" role="group" aria-label="Visualização"><button type="button" data-scope="all">Todas as notas</button><button type="button" data-scope="favorite">☆ Favoritas</button><button type="button" data-scope="pinned">◇ Destaques</button><button type="button" data-scope="archived">Arquivadas</button><button type="button" id="notesRefresh">↻ Atualizar</button></div><p id="notesTrashHint" hidden>As notas ficam aqui até você restaurar ou excluir definitivamente.</p><div class="notes-grid" id="notesGrid"></div></section>`;
    $("notesSearch").oninput = renderList;
    $("notesCategoryFilter").onchange = renderList;
    $("notesSort").onchange = renderList;
    $("notesRefresh").onclick = async () => {
      await flush();
      await refresh();
    };
    renderList();
  }
  function renderList() {
    if (!$("notesGrid")) return;
    const active = notes.filter((n) => !n.excluida),
      cats = [...new Set((scope === "trash" ? notes.filter(n => n.excluida) : active).map((n) => n.categoria))].sort(),
      cat = $("notesCategoryFilter").value;
    $("notesCategoryFilter").innerHTML =
      '<option value="">Todas as categorias</option>' +
      cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    $("notesCategoryFilter").value = cats.includes(cat) ? cat : "";
    $("notesCount").textContent = active.length;
    $("notesFavorites").textContent = active.filter((n) => n.favorita).length;
    $("notesCategoriesCount").textContent = new Set(active.map(n => n.categoria)).size;
    $("notesTrashCount").textContent = notes.filter((n) => n.excluida).length;
    const q = norm($("notesSearch").value),
      category = $("notesCategoryFilter").value,
      items = notes.filter(
        (n) =>
          (scope === "trash"
            ? n.excluida
            : !n.excluida &&
              (scope === "archived" ? n.arquivada : !n.arquivada)) &&
          (scope !== "favorite" || n.favorita) &&
          (scope !== "pinned" || n.fixada) &&
          (!category || n.categoria === category) &&
          (!q ||
            norm(
              `${n.titulo} ${plain(n.conteudo)} ${n.tags.join(" ")}`,
            ).includes(q)),
      ),
      sort = $("notesSort").value;
    items.sort((a, b) =>
      sort === "title"
        ? a.titulo.localeCompare(b.titulo, "pt-BR")
        : sort === "oldest"
          ? new Date(a.updatedAt) - new Date(b.updatedAt)
          : Number(b.fixada) - Number(a.fixada) ||
            new Date(b.updatedAt) - new Date(a.updatedAt),
    );
    $("notesViewTitle").textContent = {
      all: "Meu caderno",
      favorite: "Minhas favoritas",
      pinned: "Notas em destaque",
      archived: "Notas arquivadas",
      trash: "Lixeira",
    }[scope];
    all("[data-scope]", $("notesApp")).forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.scope === scope)),
    );
    $("notesTrashHint").hidden = scope !== "trash";
    $("notesGrid").innerHTML = items.length
      ? items
          .map(
            (n) =>
              `<article class="notes-card" data-color="${esc(n.cor)}"><header><span class="notes-category">${esc(n.categoria)}</span><div>${n.fixada ? '<span title="Em destaque">◇</span>' : ""}${!n.excluida ? `<button type="button" class="notes-star" data-favorite="${n.id}" aria-label="Favoritar nota" aria-pressed="${n.favorita}">${n.favorita ? "★" : "☆"}</button>` : ""}</div></header><button type="button" class="notes-card-open" data-open-note="${n.id}"><h3>${esc(n.titulo || "Nota sem título")}</h3><p>${esc(plain(n.conteudo).slice(0, 230) || "Um espaço para suas próximas descobertas.")}</p></button><div class="notes-tags">${n.tags
                .slice(0, 3)
                .map((t) => `<span>#${esc(t)}</span>`)
                .join(
                  "",
                )}</div><footer><span>${n.$pending ? "◷ Pendente" : new Date(n.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>${n.excluida ? `<button type="button" data-restore="${n.id}">Restaurar</button><button type="button" data-remove="${n.id}">Excluir</button>` : `<button type="button" data-open-note="${n.id}">Abrir nota ↗</button>`}</footer></article>`,
          )
          .join("")
      : `<div class="notes-empty">${icon(scope === "trash" ? "trash" : "note")}<h3>${scope === "trash" ? "Sua lixeira está vazia" : q || category ? "Nenhuma nota encontrada" : scope === "all" ? "Seu próximo aprendizado começa aqui" : "Ainda não há notas nesta seleção"}</h3><p>Registre ideias, exemplos e o que você quer revisar depois.</p>${scope === "all" ? '<button type="button" class="learn-button" data-new-note>+ Criar minha primeira nota</button>' : ""}</div>`;
    status();
  }
  function newNote(copy) {
    const n = {
      titulo: "",
      conteudo: "",
      categoria: "Geral",
      cor: "purple",
      favorita: false,
      fixada: false,
      arquivada: false,
      excluida: false,
      tags: [],
      checklist: [],
      anexos: [],
      ...copy,
      id: id24(),
      revision: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      $pending: false,
      $conflict: null,
      $version: 0,
    };
    notes.unshift(n);
    scope = "all";
    $("notesSearch").value = "";
    $("notesCategoryFilter").value = "";
    renderList();
    openEditor(n.id);
    $("noteTitle").focus();
    if (copy) {
      queue(n, { titulo: `${copy.titulo} (cópia)`.slice(0, 160) });
      flush();
    }
  }
  function openEditor(id) {
    const n = notes.find((n) => n.id === id);
    if (!n) return;
    if (n.excluida) {
      toast("Restaure a nota antes de editar.");
      return;
    }
    if (!$("noteEditor").open) opener = document.activeElement;
    activeId = id;
    selection = null;
    $("noteEditor").innerHTML =
      `<header class="notes-editor-head"><div><span class="learn-eyebrow">MEU CADERNO</span><h2 id="noteEditorLabel">${n.revision ? "Editar anotação" : "Nova anotação"}</h2></div><div><button type="button" class="learn-icon-button" id="noteFavorite" aria-label="Favoritar nota" aria-pressed="${n.favorita}">${n.favorita ? "★" : "☆"}</button><button type="button" class="learn-icon-button" id="notePin" aria-label="Destacar nota" aria-pressed="${n.fixada}">◇</button><button type="button" class="learn-icon-button" data-close-editor aria-label="Fechar editor">×</button></div></header><div class="notes-editor-body"><input id="noteTitle" class="notes-title-input" aria-label="Título da anotação" maxlength="160" value="${esc(n.titulo)}" placeholder="Dê um título à sua ideia"><div class="notes-editor-meta"><div class="notes-category-control"><label for="noteCategory">Categoria</label><div class="notes-category-row"><select id="noteCategory" aria-label="Categoria da nota"></select><button type="button" id="noteNewCategory" aria-expanded="false" aria-controls="noteCategoryCreate">+ Nova</button></div><div id="noteCategoryCreate" hidden><label for="noteCategoryName">Nome da nova categoria</label><input id="noteCategoryName" maxlength="80" placeholder="Ex.: Revisão das aulas" autocomplete="off"><div><button type="button" id="noteCategoryAdd">Criar categoria</button><button type="button" id="noteCategoryCancel">Cancelar</button></div></div></div><label>Etiquetas<input id="noteTags" maxlength="611" value="${esc(n.tags.join(", "))}" placeholder="Separe por vírgulas"></label><label>Cor<select id="noteColor"><option value="purple">Lilás</option><option value="gold">Dourado</option><option value="blue">Azul</option><option value="green">Verde</option><option value="pink">Rosa</option></select></label></div><div class="notes-toolbar" role="toolbar" aria-label="Formatação do texto"><select id="noteBlock" aria-label="Estilo do texto"><option value="p">Texto normal</option><option value="h2">Título</option><option value="h3">Subtítulo</option><option value="blockquote">Citação</option></select>${[
        ["bold", "<b>B</b>", "Negrito"],
        ["italic", "<i>I</i>", "Itálico"],
        ["underline", "<u>U</u>", "Sublinhado"],
      ]
        .map(
          ([cmd, t, label]) =>
            `<button type="button" data-command="${cmd}" aria-label="${label}">${t}</button>`,
        )
        .join(
          "",
        )}<select id="noteHighlight" aria-label="Marca-texto"><option value="">Marca-texto</option><option value="#fff2b3">Amarelo</option><option value="#d9c7ff">Lilás</option><option value="#d0eddc">Verde</option></select>${[
        ["insertUnorderedList", "• ≡", "Lista com marcadores"],
        ["insertOrderedList", "1. ≡", "Lista numerada"],
        ["justifyLeft", "≡", "Alinhar à esquerda"],
        ["undo", "↶", "Desfazer"],
        ["redo", "↷", "Refazer"],
        ["removeFormat", "Tx", "Limpar formatação"],
      ]
        .map(
          ([cmd, t, label]) =>
            `<button type="button" data-command="${cmd}" aria-label="${label}">${t}</button>`,
        )
        .join(
          "",
        )}<button type="button" id="noteLink" aria-label="Inserir link">↗</button></div><div class="notes-document" id="noteContent" contenteditable="true" role="textbox" aria-label="Conteúdo da anotação" aria-multiline="true" data-allow-copy spellcheck="true" data-placeholder="Escreva o que aprendeu. Este espaço é seu…">${clean(n.conteudo)}</div><section class="notes-checklist" aria-label="Checklist"><div id="noteChecklist"></div><button type="button" id="noteAddCheck">+ Item de checklist</button></section><div class="notes-references">${n.anexos.map((a) => `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">↗ ${esc(a.nome || a.url)}</a>`).join("")}</div><div id="noteConflict" class="notes-conflict" hidden><strong>Vamos preservar sua edição</strong><p>Esta nota foi alterada ou removida em outro dispositivo. Você pode salvar sua edição como uma cópia.</p><button type="button" class="learn-button" id="noteSaveCopy">Salvar como cópia</button><button type="button" class="learn-button learn-button-secondary" id="noteLatest">Abrir versão da conta</button></div></div><footer class="notes-editor-footer"><div class="notes-editor-status"><span id="noteSaveStatus" role="status"></span><span id="noteWordCount"></span></div><div class="notes-editor-actions"><button class="notes-subtle" id="noteTrash" type="button">${icon("trash")} Lixeira</button><button class="notes-subtle" id="noteArchive" type="button">${n.arquivada ? "Desarquivar" : "Arquivar"}</button><span></span><button class="learn-button learn-button-secondary" id="notePdf" type="button">PDF ↓</button><button class="learn-button learn-button-secondary" id="noteShare" type="button">Compartilhar</button><button class="learn-button" id="noteSave" type="button">Salvar nota</button></div></footer>`;
    $("noteColor").value = n.cor;
    renderChecklist();
    if (!$("noteEditor").open) $("noteEditor").showModal();
    $("noteTitle").oninput = (e) => dirty({ titulo: e.target.value });
    const populateCategories = (selected) => {
      const categories = [...new Set(["Geral", ...window.TurmaStudy.modules.map(m => m.name), ...notes.map(v => v.categoria), selected])].filter(Boolean).sort((a,b) => a.localeCompare(b, "pt-BR"));
      $("noteCategory").replaceChildren(...categories.map(value => new Option(value, value)));
      $("noteCategory").value = selected || "Geral";
    };
    populateCategories(n.categoria);
    $("noteCategory").onchange = e => dirty({ categoria: e.target.value });
    const closeCategory = () => {
      $("noteCategoryCreate").hidden = true;
      $("noteNewCategory").setAttribute("aria-expanded", "false");
      $("noteCategoryName").setCustomValidity("");
      $("noteNewCategory").focus();
    };
    $("noteNewCategory").onclick = () => {
      $("noteCategoryCreate").hidden = false;
      $("noteNewCategory").setAttribute("aria-expanded", "true");
      $("noteCategoryName").value = "";
      $("noteCategoryName").focus();
    };
    const addCategory = () => {
      const input = $("noteCategoryName"), value = input.value.trim().replace(/\s+/g, " ");
      if (!value) { input.setCustomValidity("Digite um nome para a categoria."); input.reportValidity(); return; }
      const match = [...$("noteCategory").options].find(o => norm(o.value) === norm(value));
      const category = match ? match.value : value;
      populateCategories(category);
      dirty({ categoria: category });
      closeCategory();
      $("noteCategory").focus();
    };
    $("noteCategoryName").oninput = () => $("noteCategoryName").setCustomValidity("");
    $("noteCategoryName").onkeydown = e => {
      if (e.key === "Enter") { e.preventDefault(); addCategory(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeCategory(); }
    };
    $("noteCategoryAdd").onclick = addCategory;
    $("noteCategoryCancel").onclick = closeCategory;
    $("noteTags").oninput = (e) =>
      dirty({
        tags: e.target.value
          .split(/[,;]+/)
          .map((v) => v.trim().replace(/^#/, "").slice(0, 50))
          .filter(Boolean)
          .slice(0, 12),
      });
    $("noteColor").onchange = (e) => dirty({ cor: e.target.value });
    $("noteContent").oninput = () =>
      dirty({ conteudo: $("noteContent").innerHTML });
    $("noteContent").onpaste = (e) => {
      e.preventDefault();
      const h = e.clipboardData.getData("text/html");
      document.execCommand(
        "insertHTML",
        false,
        h
          ? clean(h)
          : esc(e.clipboardData.getData("text/plain")).replace(/\n/g, "<br>"),
      );
      dirty({ conteudo: $("noteContent").innerHTML });
    };
    $("noteContent").ondrop = (e) => e.preventDefault();
    $("noteContent").onclick = (e) => {
      if (e.target.closest("a")) e.preventDefault();
    };
    all("[data-command]", $("noteEditor")).forEach((b) => {
      b.onpointerdown = (e) => e.preventDefault();
      b.onclick = () => command(b.dataset.command);
    });
    $("noteBlock").onchange = (e) => command("formatBlock", e.target.value);
    $("noteHighlight").onchange = (e) => {
      if (e.target.value) command("hiliteColor", e.target.value);
      e.target.value = "";
    };
    $("noteFavorite").onclick = () => {
      dirty({ favorita: !current().favorita });
      $("noteFavorite").textContent = current().favorita ? "★" : "☆";
      $("noteFavorite").setAttribute(
        "aria-pressed",
        String(current().favorita),
      );
    };
    $("notePin").onclick = () => {
      dirty({ fixada: !current().fixada });
      $("notePin").setAttribute("aria-pressed", String(current().fixada));
    };
    $("noteSave").onclick = async () => {
      const n = current();
      if (!n.revision && !n.$pending)
        queue(n, { titulo: n.titulo || "Nota sem título" });
      await flush();
      toast(
        n.$pending
          ? n.$error || "Edição preservada neste dispositivo."
          : "Anotação salva na sua conta.",
      );
    };
    $("noteTrash").onclick = () => {
      queue(current(), { excluida: true, arquivada: false });
      closeEditor();
      flush();
      toast("Nota movida para a lixeira. Você pode restaurá-la.");
    };
    $("noteArchive").onclick = () => {
      queue(current(), { arquivada: !current().arquivada });
      closeEditor();
      flush();
    };
    $("notePdf").onclick = async () => {
      try {
        download(await pdfFile(current()));
      } catch (e) {
        toast(e.message);
      }
    };
    $("noteShare").onclick = () => share(current());
    $("noteLink").onclick = insertLink;
    $("noteAddCheck").onclick = () => {
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 500;
      input.placeholder = "O que você quer revisar?";
      input.setAttribute("aria-label", "Novo item da checklist");
      $("noteChecklist").append(input);
      input.focus();
      let added = false;
      const add = () => {
        if (added || !input.isConnected) return;
        added = true;
        if (input.value.trim())
          dirty({
            checklist: [
              ...current().checklist,
              { id: id24(), texto: input.value.trim(), concluido: false },
            ].slice(0, 100),
          });
        renderChecklist();
      };
      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          add();
        }
      };
      input.onblur = add;
    };
    $("noteSaveCopy").onclick = () => {
      const copy = structuredClone(current()),
        remote = copy.$conflict;
      notes = notes.filter((v) => v.id !== copy.id);
      if (remote && remote !== "removed") notes.push(remote);
      persist();
      newNote({ ...copy, excluida: false, arquivada: false });
    };
    $("noteLatest").onclick = () =>
      confirmAction(
        "Abrir a versão da conta?",
        "A edição pendente será substituída. Para manter as duas, cancele e escolha Salvar como cópia.",
        "Abrir versão atual",
        () => {
          const n = current(),
            latest = n?.$conflict;
          if (latest && latest !== "removed") {
            notes = notes.map((v) => (v.id === n.id ? latest : v));
            persist();
            openEditor(latest.id);
            renderList();
          }
        },
      );
    status();
  }
  function renderChecklist() {
    const n = current();
    if (!n) return;
    $("noteChecklist").innerHTML = n.checklist
      .map(
        (c, i) =>
          `<div><label><input type="checkbox" data-check="${i}" ${c.concluido ? "checked" : ""}><span>${esc(c.texto)}</span></label><button type="button" data-delete-check="${i}" aria-label="Remover item da checklist">×</button></div>`,
      )
      .join("");
    all("[data-check]", $("noteChecklist")).forEach(
      (b) =>
        (b.onchange = () => {
          const items = structuredClone(current().checklist);
          items[Number(b.dataset.check)].concluido = b.checked;
          dirty({ checklist: items });
        }),
    );
    all("[data-delete-check]", $("noteChecklist")).forEach(
      (b) =>
        (b.onclick = () => {
          dirty({
            checklist: current().checklist.filter(
              (_, i) => i !== Number(b.dataset.deleteCheck),
            ),
          });
          renderChecklist();
        }),
    );
  }
  function closeEditor() {
    $("noteEditor").close();
  }
  $("noteEditor").onclick = (e) => {
    if (e.target.closest("[data-close-editor]")) closeEditor();
  };
  $("noteEditor").addEventListener("close", () => {
    if ($("noteEditor").open) return;
    const n = current();
    if (n && !n.revision && !n.$pending && !n.titulo && !plain(n.conteudo))
      notes = notes.filter((v) => v !== n);
    activeId = null;
    persist();
    flush();
    renderList();
    opener?.focus();
  });
  document.addEventListener("selectionchange", () => {
    const s = getSelection();
    if (
      s?.rangeCount &&
      $("noteContent")?.contains(s.anchorNode) &&
      $("noteContent")?.contains(s.focusNode)
    )
      selection = s.getRangeAt(0).cloneRange();
  });
  function restoreSelection() {
    $("noteContent").focus();
    if (
      selection &&
      $("noteContent").contains(selection.commonAncestorContainer)
    ) {
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(selection);
    }
  }
  function command(n, v) {
    restoreSelection();
    document.execCommand(n, false, v || null);
    dirty({ conteudo: $("noteContent").innerHTML });
  }
  function showAction(html) {
    actionOpener = document.activeElement;
    $("notesAction").innerHTML = html;
    if (!$("notesAction").open) $("notesAction").showModal();
  }
  function closeAction() {
    $("notesAction").close();
  }
  $("notesAction").onclick = (e) => {
    if (e.target.closest("[data-close-action]")) closeAction();
  };
  $("notesAction").addEventListener("close", () => {
    if (!$("notesAction").open) actionOpener?.focus();
  });
  function confirmAction(title, copy, label, fn) {
    showAction(
      `<header><h2 id="notesActionTitle">${esc(title)}</h2><button type="button" data-close-action aria-label="Fechar">×</button></header><p>${esc(copy)}</p><div class="notes-action-buttons"><button class="learn-button learn-button-secondary" type="button" data-close-action>Cancelar</button><button class="learn-button" type="button" id="notesConfirm">${esc(label)}</button></div>`,
    );
    $("notesConfirm").onclick = async () => {
      $("notesConfirm").disabled = true;
      closeAction();
      await fn();
    };
  }
  function insertLink() {
    showAction(
      '<header><h2 id="notesActionTitle">Inserir link</h2><button type="button" data-close-action aria-label="Fechar">×</button></header><form id="noteLinkForm"><label>Link<input type="url" name="url" placeholder="https://" required maxlength="2000"></label><p role="alert" hidden></p><button class="learn-button" type="submit">Inserir no texto selecionado</button></form>',
    );
    $("noteLinkForm").onsubmit = (e) => {
      e.preventDefault();
      const u = new URL(e.target.elements.url.value);
      if (
        !["http:", "https:"].includes(u.protocol) ||
        u.username ||
        u.password
      ) {
        const err = e.target.querySelector("[role=alert]");
        err.hidden = false;
        err.textContent = "Use um link HTTP ou HTTPS.";
        return;
      }
      closeAction();
      restoreSelection();
      if (getSelection().isCollapsed)
        document.execCommand(
          "insertHTML",
          false,
          `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(u.href)}</a>`,
        );
      else document.execCommand("createLink", false, u.href);
      dirty({ conteudo: $("noteContent").innerHTML });
    };
  }
  async function pdfFile(n) {
    if (!n.revision && !n.$pending)
      queue(n, { titulo: n.titulo || "Nota sem título" });
    await flush();
    const saved = notes.find((v) => v.id === n.id);
    if (!saved || saved.$pending || !authorized)
      throw Error("Salve esta edição na sua conta antes de gerar o PDF.");
    const r = await fetch(`/dashboard-premium/notas/${n.id}.pdf`, {
      credentials: "same-origin",
      cache: "no-store",
      headers: headers(),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw Error("Não foi possível gerar o PDF agora.");
    return new File(
      [await r.blob()],
      `meu-caderno-${
        norm(saved.titulo)
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 60) || "nota"
      }.pdf`,
      { type: "application/pdf" },
    );
  }
  function download(f) {
    const u = URL.createObjectURL(f),
      a = document.createElement("a");
    a.href = u;
    a.download = f.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  }
  async function share(n) {
    const generation = crypto.randomUUID();
    showAction(
      `<header><div><span class="learn-eyebrow">SEU APRENDIZADO VAI ALÉM</span><h2 id="notesActionTitle">Compartilhar anotação</h2></div><button type="button" data-close-action aria-label="Fechar">×</button></header><div class="notes-share-preview"><strong>${esc(n.titulo || "Minha anotação")}</strong><span>PDF personalizado · ${esc(user.nome || "Aluno")}</span></div><p>Compartilhe somente esta nota. O PDF inclui seu nome, sua anotação e a identidade do seu caderno.</p><p id="notesShareStatus" role="status">Preparando o PDF…</p><div class="notes-share-options"><button type="button" id="notesNativeShare" disabled>Compartilhar PDF em outro aplicativo ↗</button><button type="button" id="notesShareDownload" disabled>Salvar PDF no dispositivo ↓</button><button type="button" id="notesShareText">Copiar texto da nota</button></div><p id="notesShareHint"></p>`,
    );
    $("notesAction").dataset.generation = generation;
    $("notesShareText").onclick = async () => {
      const t = `${n.titulo}\n\n${plain(n.conteudo)}\n\nAnotações de ${user.nome || "Aluno"} · Turma do Primo`;
      try {
        await navigator.clipboard.writeText(t);
        $("notesShareStatus").textContent =
          "Texto copiado. Cole no aplicativo que preferir.";
      } catch {
        const a = document.createElement("textarea");
        a.value = t;
        a.readOnly = true;
        a.setAttribute("aria-label", "Texto para copiar");
        $("notesAction").append(a);
        a.select();
      }
    };
    try {
      const f = await pdfFile(n);
      if (
        !$("notesAction").open ||
        $("notesAction").dataset.generation !== generation ||
        !$("notesNativeShare")
      )
        return;
      $("notesShareStatus").textContent = "PDF pronto para compartilhar.";
      $("notesShareDownload").disabled = false;
      $("notesShareDownload").onclick = () => download(f);
      const can = !!navigator.canShare?.({ files: [f] });
      $("notesNativeShare").disabled = !can;
      $("notesShareHint").textContent = can
        ? "Escolha WhatsApp, e-mail ou outro aplicativo disponível no seu dispositivo."
        : "Este navegador não compartilha arquivos diretamente. Salve o PDF e anexe no aplicativo que preferir.";
      $("notesNativeShare").onclick = async () => {
        try {
          await navigator.share({
            files: [f],
            title: n.titulo || "Minha anotação",
          });
        } catch (e) {
          if (e.name !== "AbortError")
            $("notesShareStatus").textContent =
              "Você também pode salvar o PDF para compartilhar.";
        }
      };
    } catch (e) {
      if ($("notesShareStatus")) $("notesShareStatus").textContent = e.message;
    }
  }
  $("notesApp").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-new-note")) newNote();
    if (b.dataset.scope) {
      scope = b.dataset.scope;
      $("notesCategoryFilter").value = "";
      renderList();
    }
    if (b.dataset.openNote) openEditor(b.dataset.openNote);
    if (b.dataset.favorite) {
      const n = notes.find((n) => n.id === b.dataset.favorite);
      queue(n, { favorita: !n.favorita });
      renderList();
      flush();
    }
    if (b.dataset.restore) {
      const n = notes.find((n) => n.id === b.dataset.restore);
      queue(n, { excluida: false, arquivada: false });
      renderList();
      flush();
      toast("Nota restaurada no seu caderno.");
    }
    if (b.dataset.remove) {
      const n = notes.find((n) => n.id === b.dataset.remove);
      confirmAction(
        "Excluir definitivamente?",
        `“${n.titulo}” será apagada da conta. Esta ação não pode ser desfeita.`,
        "Excluir definitivamente",
        async () => {
          await flush();
          try {
            if (n.$pending)
              throw Error(
                "Sincronize a nota antes de excluir definitivamente.",
              );
            await api(
              `/dashboard-premium/notas/${n.id}?revision=${n.revision}`,
              { method: "DELETE" },
            );
            notes = notes.filter((v) => v.id !== n.id);
            persist();
            renderList();
            toast("Nota excluída definitivamente.");
          } catch (e) {
            toast(e.message);
          }
        },
      );
    }
  };
  function theme() {
    const light = document.documentElement.dataset.theme === "light";
    $("studyTheme").innerHTML = icon(light ? "sun" : "moon");
    $("studyTheme").setAttribute(
      "aria-label",
      light ? "Ativar tema escuro" : "Ativar tema claro",
    );
    document.querySelector("meta[name=theme-color]").content = light
      ? "#f3f1f7"
      : "#0b0b11";
  }
  $("studyTheme").onclick = () => {
    document.documentElement.dataset.theme =
      document.documentElement.dataset.theme === "light" ? "dark" : "light";
    try {
      localStorage.setItem(
        "turma.workspace.theme",
        document.documentElement.dataset.theme,
      );
    } catch {}
    theme();
  };
  function menu(open, focus = false) {
    document.body.classList.toggle("menu-open", open);
    $("studySidebar").classList.toggle("is-open", open);
    $("studySidebar").inert = !open && matchMedia("(max-width:900px)").matches;
    $("studyBackdrop").hidden = !open;
    $("studyMenu").setAttribute("aria-expanded", String(open));
    $("studyShell").inert = open;
    $("studyDock").inert = open;
    if (open) $("studyCloseMenu").focus();
    else if (focus) $("studyMenu").focus();
  }
  $("studyMenu").onclick = () => menu(true);
  $("studyCloseMenu").onclick = () => menu(false, true);
  $("studyBackdrop").onclick = () => menu(false, true);
  matchMedia("(min-width:901px)").addEventListener("change", () => menu(false));
  document.addEventListener("keydown", (e) => {
    if (
      $("noteEditor").open &&
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "s"
    ) {
      e.preventDefault();
      $("noteSave").click();
    }
    if (document.body.classList.contains("menu-open")) {
      if (e.key === "Escape") menu(false, true);
      if (e.key === "Tab") {
        const b = all("a,button", $("studySidebar")).filter(
            (el) => el.getClientRects().length,
          ),
          first = b[0],
          last = b.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });
  $("studyLogout").onclick = async () => {
    await flush();
    const leave = async () => {
      try {
        await api("/logout", { method: "POST" });
      } finally {
        for (const s of [sessionStorage, localStorage])
          for (const k of [
            "token",
            "adminToken",
            "authToken",
            "accessToken",
            "jwt",
          ])
            try {
              s.removeItem(k);
            } catch {}
        location.replace("/");
      }
    };
    if (notes.some((n) => n.$pending))
      confirmAction(
        "Sair com notas pendentes?",
        "As edições ainda não chegaram à conta. Elas ficam neste dispositivo para sincronizar quando você entrar nesta mesma conta.",
        "Sair da conta",
        leave,
      );
    else await leave();
  };
  addEventListener("storage", (e) => {
    if (e.key === "turma.workspace.theme") {
      document.documentElement.dataset.theme =
        e.newValue === "light" ? "light" : "dark";
      theme();
    }
  });
  addEventListener("online", async () => {
    await flush();
    await refresh();
  });
  addEventListener("offline", () => {
    online = false;
    status();
  });
  addEventListener("pagehide", persist);
  addEventListener("beforeunload", (e) => {
    if (notes.some((n) => n.$pending)) {
      persist();
      e.preventDefault();
      e.returnValue = "";
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      persist();
      flush();
    }
  });
  async function load() {
    $("studyRetry").hidden = true;
    try {
      const d = await api("/me");
      user = d.usuario;
      if (!user?.acessoPremium) {
        location.replace("/dashboard-free");
        return;
      }
      authorized = true;
      notes = cached();
      await window.TurmaStudySync.init(user);
      await refresh();
      const name = String(user.nome || "Aluno").split(" ")[0];
      $("studyName").textContent = name;
      $("studyAvatar").textContent = name[0].toUpperCase();
      render();
      $("studyLoading").hidden = true;
      $("notesApp").hidden = false;
      const requested = (window.TurmaNavigation?.hash || location.hash).slice(1);
      if (notes.some(n => n.id === requested && !n.excluida)) openEditor(requested);
      flush();
    } catch (e) {
      $("studyLoadTitle").textContent = "Vamos tentar novamente?";
      $("studyLoadMessage").textContent = e.message;
      $("studyRetry").hidden = false;
    }
  }
  $("studyRetry").onclick = load;
  menu(false);
  theme();
  load();
})();
