"use strict";
(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const DEFAULT_CATEGORIES = ["Geral", "Estratégias", "Reflexivos", "Gatilhos", "Camaleões", "Magnetismo", "Fibonacci", "Pitágoras"];
  const COLORS = { purple: "#9d3cff", gold: "#f2b72d", blue: "#368dff", green: "#45d884", pink: "#ff4d93" };
  const state = { user: null, notes: [], activeId: "", filter: "all", category: "all", sort: "updated-desc", view: "grid", theme: "dark", color: "purple", checklist: [], attachments: [], dirty: false, saving: false, saveTimer: null, dialogMode: "", selectedTag: "" };

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const firstName = (name) => String(name || "Usuário").trim().split(/\s+/)[0] || "Usuário";
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function getToken() {
    for (const key of TOKEN_KEYS) {
      try { const value = sessionStorage.getItem(key); if (value) return value; } catch (_) {}
    }
    return "";
  }

  async function api(endpoint, options = {}) {
    const token = getToken();
    if (!token) throw new Error("Sessão expirada.");
    const response = await fetch(`${location.origin}${endpoint}`, {
      method: options.method || "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}.`);
    return data;
  }

  function toast(message, type = "success") {
    const item = document.createElement("div");
    item.className = `notes-toast ${type}`;
    item.textContent = message;
    $("notesToastStack")?.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 3400);
  }

  function formatDate(value, withTime = false) {
    if (!value) return "Agora";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Agora";
    return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(date);
  }

  function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = String(html || "");
    return (div.textContent || "").replace(/\s+/g, " ").trim();
  }

  function sanitizeHtml(html) {
    const allowed = new Set(["B", "STRONG", "I", "EM", "U", "P", "DIV", "BR", "UL", "OL", "LI", "H2", "H3", "H4", "BLOCKQUOTE", "A", "SPAN"]);
    const doc = new DOMParser().parseFromString(`<div>${String(html || "")}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    const walk = (node) => {
      Array.from(node.children).forEach((child) => {
        if (!allowed.has(child.tagName)) { child.replaceWith(...child.childNodes); return; }
        Array.from(child.attributes).forEach((attr) => {
          if (child.tagName === "A" && attr.name === "href") {
            if (!/^(https?:\/\/|mailto:)/i.test(attr.value)) child.removeAttribute(attr.name);
          } else if (!(child.tagName === "A" && ["target", "rel"].includes(attr.name))) child.removeAttribute(attr.name);
        });
        if (child.tagName === "A") { child.setAttribute("target", "_blank"); child.setAttribute("rel", "noopener noreferrer"); }
        walk(child);
      });
    };
    walk(root);
    return root.innerHTML;
  }

  function normalizeTags(value) {
    if (Array.isArray(value)) return [...new Set(value.map((tag) => String(tag).trim().replace(/^#/, "")).filter(Boolean))].slice(0, 12);
    return [...new Set(String(value || "").split(/[,;]+/).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean))].slice(0, 12);
  }

  function categories() {
    const found = state.notes.map((note) => note.categoria).filter(Boolean);
    return [...new Set([...DEFAULT_CATEGORIES, ...found])];
  }

  function activeNote() { return state.notes.find((note) => note.id === state.activeId) || null; }

  function setAvatar(user) {
    const photo = String(user?.foto || "").trim();
    $$('[data-user-avatar]').forEach((element) => {
      element.textContent = photo ? "" : firstName(user?.nome).charAt(0).toUpperCase();
      element.style.backgroundImage = photo ? `url("${photo.replaceAll('"', "%22")}")` : "";
    });
  }

  function fillUser(user) {
    state.user = user || {};
    $$('[data-user-name]').forEach((element) => { element.textContent = firstName(user?.nome); });
    $$('[data-user-fullname]').forEach((element) => { element.textContent = user?.nome || "Usuário"; });
    $$('[data-user-role]').forEach((element) => { element.textContent = user?.cargo || user?.tipo || "Aluno"; });
    setAvatar(user);
  }

  function resolveTheme(theme) {
    if (theme === "system") return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    return theme === "light" ? "light" : "dark";
  }

  function applyTheme(theme) {
    state.theme = theme;
    const resolved = resolveTheme(theme);
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#07030d" : "#eef0f5");
    const use = $("themeButton")?.querySelector("use");
    if (use) use.setAttribute("href", `assets/dashboard-icons.svg#${resolved === "dark" ? "i-moon" : "i-sun"}`);
  }

  async function toggleTheme() {
    const next = (document.documentElement.dataset.theme || "dark") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { await api("/dashboard-premium/preferencias", { method: "PUT", body: { tema: next } }); }
    catch (error) { toast(`Tema aplicado nesta sessão. ${error.message}`, "error"); }
  }

  function registerEvents() {
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeydown);
    $("notesSearch")?.addEventListener("input", renderAll);
    $("categoryFilter")?.addEventListener("change", (event) => { state.category = event.target.value; renderAll(); });
    $("sortFilter")?.addEventListener("change", (event) => { state.sort = event.target.value; renderCards(); });
    $("noteTitle")?.addEventListener("input", markDirty);
    $("noteTags")?.addEventListener("input", markDirty);
    $("noteCategory")?.addEventListener("change", markDirty);
    $("noteContent")?.addEventListener("input", () => { updateCounts(); markDirty(); });
    $("noteEditorForm")?.addEventListener("submit", (event) => { event.preventDefault(); saveActiveNote(true); });
    window.addEventListener("beforeunload", (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ""; } });
  }

  function handleClick(event) {
    const filter = event.target.closest("[data-filter]");
    if (filter) { state.filter = filter.dataset.filter; state.selectedTag = ""; syncFilterButtons(); renderAll(); return; }
    if (event.target.closest("#newNoteButton,[data-create-note]")) { createDraft(); return; }
    if (event.target.closest("#themeButton")) { toggleTheme(); return; }
    if (event.target.closest("#viewToggleButton")) { state.view = state.view === "grid" ? "list" : "grid"; $("notesGrid")?.classList.toggle("list-view", state.view === "list"); return; }
    if (event.target.closest("#notesMenuButton")) { openSidebar(); return; }
    if (event.target.closest("#notesMobileOverlay")) { closeSidebar(); closeEditorOnMobile(); return; }
    const card = event.target.closest("[data-note-id]");
    if (card) { openNote(card.dataset.noteId); return; }
    const category = event.target.closest("[data-category]");
    if (category) { state.category = category.dataset.category; $("categoryFilter").value = state.category; renderAll(); return; }
    const tag = event.target.closest("[data-tag]");
    if (tag) { state.selectedTag = tag.dataset.tag; $("notesSearch").value = `#${state.selectedTag}`; renderAll(); return; }
    const color = event.target.closest("[data-color]");
    if (color) { state.color = color.dataset.color; syncColorButtons(); markDirty(); return; }
    const command = event.target.closest("[data-command]");
    if (command) { runEditorCommand(command.dataset.command, command.dataset.value); return; }
    const editorAction = event.target.closest("[data-editor-action]");
    if (editorAction) { executeEditorAction(editorAction.dataset.editorAction); return; }
    if (event.target.closest("#addChecklistButton")) { state.checklist.push({ id: crypto.randomUUID?.() || String(Date.now()), texto: "", concluido: false }); renderChecklist(); markDirty(); return; }
    const removeCheck = event.target.closest("[data-remove-check]");
    if (removeCheck) { state.checklist = state.checklist.filter((item) => item.id !== removeCheck.dataset.removeCheck); renderChecklist(); markDirty(); return; }
    if (event.target.matches("[data-check-toggle]")) { const item = state.checklist.find((check) => check.id === event.target.dataset.checkToggle); if (item) item.concluido = event.target.checked; renderChecklist(); markDirty(); return; }
    if (event.target.matches("[data-check-text]")) { const item = state.checklist.find((check) => check.id === event.target.dataset.checkText); if (item) item.texto = event.target.value; markDirty(); return; }
    if (event.target.closest("#addAttachmentButton")) { openSimpleDialog("attachment"); return; }
    const removeAttachment = event.target.closest("[data-remove-attachment]");
    if (removeAttachment) { state.attachments = state.attachments.filter((item) => item.id !== removeAttachment.dataset.removeAttachment); renderAttachments(); markDirty(); return; }
    if (event.target.closest("#newCategoryButton")) { openSimpleDialog("category"); return; }
  }

  function handleKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("notesSearch")?.focus(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveActiveNote(true); }
    if (event.key === "Escape") { closeSidebar(); closeEditorOnMobile(); }
  }

  function openSidebar() { $("notesSidebar")?.classList.add("open"); if ($("notesMobileOverlay")) $("notesMobileOverlay").hidden = false; }
  function closeSidebar() { $("notesSidebar")?.classList.remove("open"); if ($("notesMobileOverlay")) $("notesMobileOverlay").hidden = true; }
  function openEditorOnMobile() { $("notesEditor")?.classList.add("open"); if (innerWidth <= 1180 && $("notesMobileOverlay")) $("notesMobileOverlay").hidden = false; }
  function closeEditorOnMobile() { if (innerWidth <= 1180) $("notesEditor")?.classList.remove("open"); if (!$("notesSidebar")?.classList.contains("open") && $("notesMobileOverlay")) $("notesMobileOverlay").hidden = true; }

  function syncFilterButtons() { $$('[data-filter]').forEach((button) => button.classList.toggle("active", button.dataset.filter === state.filter)); }
  function syncColorButtons() { $$('[data-color]').forEach((button) => button.classList.toggle("active", button.dataset.color === state.color)); }

  function filteredNotes() {
    const queryRaw = String($("notesSearch")?.value || "").trim().toLowerCase();
    const query = queryRaw.replace(/^#/, "");
    let notes = [...state.notes];
    if (state.filter === "favorite") notes = notes.filter((note) => note.favorita && !note.excluida);
    else if (state.filter === "pinned") notes = notes.filter((note) => note.fixada && !note.excluida);
    else if (state.filter === "recent") notes = notes.filter((note) => !note.excluida && (Date.now() - new Date(note.updatedAt).getTime()) <= 7 * 86400000);
    else if (state.filter === "archived") notes = notes.filter((note) => note.arquivada && !note.excluida);
    else if (state.filter === "trash") notes = notes.filter((note) => note.excluida);
    else notes = notes.filter((note) => !note.excluida && !note.arquivada);
    if (state.category !== "all") notes = notes.filter((note) => note.categoria === state.category);
    if (query) notes = notes.filter((note) => `${note.titulo} ${stripHtml(note.conteudo)} ${(note.tags || []).join(" ")} ${note.categoria}`.toLowerCase().includes(query));
    if (state.selectedTag) notes = notes.filter((note) => (note.tags || []).includes(state.selectedTag));
    const sorters = {
      "updated-desc": (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
      "updated-asc": (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
      "title-asc": (a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"),
      "title-desc": (a, b) => b.titulo.localeCompare(a.titulo, "pt-BR")
    };
    return notes.sort((a, b) => Number(b.fixada) - Number(a.fixada) || sorters[state.sort](a, b));
  }

  function renderAll() { renderCounts(); renderCategories(); renderTags(); renderCards(); }

  function renderCounts() {
    const active = state.notes.filter((note) => !note.excluida && !note.arquivada);
    $("countAll").textContent = String(active.length);
    $("countFavorite").textContent = String(active.filter((note) => note.favorita).length);
    $("countPinned").textContent = String(active.filter((note) => note.fixada).length);
    $("countRecent").textContent = String(active.filter((note) => (Date.now() - new Date(note.updatedAt).getTime()) <= 7 * 86400000).length);
    $("countArchived").textContent = String(state.notes.filter((note) => note.arquivada && !note.excluida).length);
    $("countTrash").textContent = String(state.notes.filter((note) => note.excluida).length);
  }

  function renderCategories() {
    const counts = new Map();
    state.notes.filter((note) => !note.excluida).forEach((note) => counts.set(note.categoria || "Geral", (counts.get(note.categoria || "Geral") || 0) + 1));
    const list = categories();
    $("categoryList").innerHTML = list.map((category, index) => {
      const color = Object.values(COLORS)[index % Object.values(COLORS).length];
      return `<button class="notes-category-button" type="button" data-category="${esc(category)}"><i class="notes-category-dot" style="color:${color};background:${color}"></i><span>${esc(category)}</span><b>${counts.get(category) || 0}</b></button>`;
    }).join("");
    const current = state.category;
    $("categoryFilter").innerHTML = `<option value="all">Todas as categorias</option>${list.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join("")}`;
    $("categoryFilter").value = list.includes(current) ? current : "all";
    $("noteCategory").innerHTML = list.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join("");
  }

  function renderTags() {
    const counts = new Map();
    state.notes.filter((note) => !note.excluida).forEach((note) => (note.tags || []).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
    const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    $("popularTags").innerHTML = tags.length ? tags.map(([tag, count]) => `<button class="notes-tag-chip" type="button" data-tag="${esc(tag)}">#${esc(tag)} <b>${count}</b></button>`).join("") : `<span class="notes-tag-chip">Sem tags ainda</span>`;
  }

  function renderCards() {
    const notes = filteredNotes();
    $("resultCount").textContent = `${notes.length} ${notes.length === 1 ? "nota" : "notas"}`;
    $("notesGrid").classList.toggle("list-view", state.view === "list");
    if (!notes.length) {
      $("notesGrid").innerHTML = `<div class="notes-empty"><span><svg><use href="assets/dashboard-icons.svg#i-note"></use></svg></span><strong>Nenhuma nota encontrada</strong><p>Crie uma nova anotação ou altere os filtros.</p><button class="notes-new-button" type="button" data-create-note>＋ Nova nota</button></div>`;
      return;
    }
    $("notesGrid").innerHTML = notes.map((note) => {
      const plain = stripHtml(note.conteudo);
      const color = COLORS[note.cor] || COLORS.purple;
      return `<article class="note-card ${note.id === state.activeId ? "active" : ""}" data-note-id="${note.id}" style="--card-color:${color}"><div class="note-card-head"><span class="note-card-icon"><svg><use href="assets/dashboard-icons.svg#${noteIcon(note.categoria)}"></use></svg></span><div class="note-card-flags">${note.fixada ? "<span>♛</span>" : ""}${note.favorita ? "<span>★</span>" : ""}</div></div><span class="note-card-category">● ${esc(note.categoria || "Geral")}</span><h2>${esc(note.titulo || "Sem título")}</h2><p>${esc(plain || "Nota sem conteúdo.")}</p><div class="note-card-tags">${(note.tags || []).slice(0, 4).map((tag) => `<span>#${esc(tag)}</span>`).join("")}</div><footer><span>${formatDate(note.updatedAt, true)}</span><span>${(note.checklist || []).filter((item) => item.concluido).length}/${(note.checklist || []).length} tarefas</span></footer></article>`;
    }).join("");
  }

  function noteIcon(category) {
    const value = String(category || "").toLowerCase();
    if (value.includes("estratég")) return "i-target";
    if (value.includes("fibonacci") || value.includes("pitág")) return "i-chart";
    if (value.includes("gatilho")) return "i-activity";
    if (value.includes("camale")) return "i-star";
    return "i-book";
  }

  function createDraft() {
    const draft = { id: "draft", titulo: "", conteudo: "", categoria: categories()[0] || "Geral", tags: [], favorita: false, fixada: false, arquivada: false, excluida: false, cor: "purple", checklist: [], anexos: [], createdAt: "", updatedAt: "" };
    state.notes = state.notes.filter((note) => note.id !== "draft");
    state.notes.unshift(draft);
    state.activeId = "draft";
    fillEditor(draft);
    renderAll();
    openEditorOnMobile();
    setTimeout(() => $("noteTitle")?.focus(), 30);
  }

  function openNote(id) {
    if (state.dirty && state.activeId && state.activeId !== id) saveActiveNote(false);
    const note = state.notes.find((item) => item.id === id);
    if (!note) return;
    state.activeId = id;
    fillEditor(note);
    renderCards();
    openEditorOnMobile();
  }

  function fillEditor(note) {
    $("notesEditor").classList.remove("is-empty");
    $("editorEmptyState").hidden = true;
    $("noteEditorForm").hidden = false;
    $("noteId").value = note.id || "";
    $("noteTitle").value = note.titulo || "";
    $("noteCategory").value = note.categoria || "Geral";
    $("noteTags").value = (note.tags || []).map((tag) => `#${tag}`).join(", ");
    $("noteContent").innerHTML = sanitizeHtml(note.conteudo || "");
    state.color = note.cor || "purple";
    state.checklist = Array.isArray(note.checklist) ? structuredClone(note.checklist) : [];
    state.attachments = Array.isArray(note.anexos) ? structuredClone(note.anexos) : [];
    state.dirty = false;
    syncColorButtons();
    renderChecklist();
    renderAttachments();
    updateEditorActions(note);
    updateCounts();
    setSaveStatus(note.id === "draft" ? "Rascunho novo" : "Salva", "saved");
    $("noteEditedAt").textContent = note.updatedAt ? `Última edição: ${formatDate(note.updatedAt, true)}` : "Ainda não salva";
  }

  function updateEditorActions(note = activeNote()) {
    const map = { pin: Boolean(note?.fixada), favorite: Boolean(note?.favorita) };
    Object.entries(map).forEach(([action, active]) => document.querySelector(`[data-editor-action="${action}"]`)?.classList.toggle("active", active));
  }

  function currentPayload(overrides = {}) {
    const note = activeNote() || {};
    return { titulo: $("noteTitle").value.trim() || "Nota sem título", conteudo: sanitizeHtml($("noteContent").innerHTML), categoria: $("noteCategory").value || "Geral", tags: normalizeTags($("noteTags").value), favorita: Boolean(note.favorita), fixada: Boolean(note.fixada), arquivada: Boolean(note.arquivada), excluida: Boolean(note.excluida), cor: state.color, checklist: state.checklist, anexos: state.attachments, ...overrides };
  }

  function markDirty() {
    if (!state.activeId) return;
    state.dirty = true;
    setSaveStatus("Alterações não salvas", "saving");
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => saveActiveNote(false), 900);
  }

  function setSaveStatus(text, type = "saved") {
    const status = $("saveStatus"); if (!status) return;
    status.classList.toggle("saving", type === "saving");
    status.classList.toggle("error", type === "error");
    status.innerHTML = `<i></i> ${esc(text)}`;
  }

  async function saveActiveNote(showToast = false) {
    if (!state.activeId || state.saving) return;
    const note = activeNote(); if (!note) return;
    const payload = currentPayload();
    state.saving = true; setSaveStatus("Salvando…", "saving");
    try {
      const isDraft = note.id === "draft";
      const response = await api(isDraft ? "/dashboard-premium/notas" : `/dashboard-premium/notas/${encodeURIComponent(note.id)}`, { method: isDraft ? "POST" : "PUT", body: payload });
      const saved = response.nota;
      state.notes = state.notes.map((item) => item.id === note.id ? saved : item);
      state.activeId = saved.id;
      state.dirty = false;
      $("noteId").value = saved.id;
      $("noteEditedAt").textContent = `Última edição: ${formatDate(saved.updatedAt, true)}`;
      setSaveStatus("Rascunho salvo", "saved");
      renderAll(); updateEditorActions(saved);
      if (showToast) toast(isDraft ? "Nota criada." : "Nota atualizada.");
    } catch (error) { setSaveStatus("Erro ao salvar", "error"); toast(error.message, "error"); }
    finally { state.saving = false; }
  }

  async function executeEditorAction(action) {
    const note = activeNote();
    if (!note && action !== "close") return;
    if (action === "close") { if (state.dirty) await saveActiveNote(false); closeEditor(); return; }
    if (action === "pin") { note.fixada = !note.fixada; updateEditorActions(note); markDirty(); return; }
    if (action === "favorite") { note.favorita = !note.favorita; updateEditorActions(note); markDirty(); return; }
    if (action === "duplicate") { await duplicateNote(note); return; }
    if (action === "print") { printNote(note); return; }
    if (action === "share") { shareNote(note); return; }
    if (action === "trash") {
      if (note.id === "draft") { state.notes = state.notes.filter((item) => item.id !== "draft"); closeEditor(); renderAll(); return; }
      if (note.excluida) { if (confirm("Apagar esta nota permanentemente?")) await deletePermanent(note); }
      else { note.excluida = true; note.arquivada = false; await saveActiveNote(false); closeEditor(); toast("Nota movida para a lixeira."); }
    }
  }

  async function duplicateNote(note) {
    const payload = currentPayload({ titulo: `${$("noteTitle").value.trim() || note.titulo} (cópia)`, favorita: false, fixada: false, excluida: false });
    try { const response = await api("/dashboard-premium/notas", { method: "POST", body: payload }); state.notes.unshift(response.nota); openNote(response.nota.id); renderAll(); toast("Nota duplicada."); }
    catch (error) { toast(error.message, "error"); }
  }

  async function deletePermanent(note) {
    try { await api(`/dashboard-premium/notas/${encodeURIComponent(note.id)}?permanente=1`, { method: "DELETE" }); state.notes = state.notes.filter((item) => item.id !== note.id); closeEditor(); renderAll(); toast("Nota apagada permanentemente."); }
    catch (error) { toast(error.message, "error"); }
  }

  function closeEditor() {
    state.activeId = ""; state.dirty = false; clearTimeout(state.saveTimer);
    $("notesEditor").classList.add("is-empty"); $("editorEmptyState").hidden = false; $("noteEditorForm").hidden = true;
    closeEditorOnMobile(); renderCards();
  }

  function runEditorCommand(command, value) {
    $("noteContent")?.focus();
    if (command === "createLink") { const url = prompt("Cole o endereço do link:", "https://"); if (!url) return; document.execCommand(command, false, url); }
    else document.execCommand(command, false, value || null);
    markDirty();
  }

  function renderChecklist() {
    $("noteChecklist").innerHTML = state.checklist.length ? state.checklist.map((item) => `<div class="notes-check-item ${item.concluido ? "done" : ""}"><input type="checkbox" data-check-toggle="${esc(item.id)}" ${item.concluido ? "checked" : ""}/><input type="text" data-check-text="${esc(item.id)}" value="${esc(item.texto)}" placeholder="Item da checklist"/><button type="button" data-remove-check="${esc(item.id)}">×</button></div>`).join("") : `<div class="notes-empty" style="min-height:70px"><p>Nenhum item na checklist.</p></div>`;
  }

  function renderAttachments() {
    $("noteAttachments").innerHTML = state.attachments.length ? state.attachments.map((item) => `<div class="notes-attachment-item"><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.nome || item.url)}</a><button type="button" data-remove-attachment="${esc(item.id)}">×</button></div>`).join("") : `<div class="notes-empty" style="min-height:70px"><p>Nenhum link ou anexo.</p></div>`;
  }

  function updateCounts() {
    const text = stripHtml($("noteContent")?.innerHTML || "");
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    $("wordCount").textContent = String(words);
    $("characterCount").textContent = String(text.length);
  }

  function printNote() {
    const payload = currentPayload();
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return toast("O navegador bloqueou a janela de impressão.", "error");
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(payload.titulo)}</title><style>body{font-family:Arial;max-width:800px;margin:40px auto;line-height:1.6;color:#222}h1{border-bottom:2px solid #8b35d7;padding-bottom:12px}.meta{color:#666;font-size:12px}.check{margin-top:25px}</style></head><body><h1>${esc(payload.titulo)}</h1><p class="meta">${esc(payload.categoria)} • ${payload.tags.map((tag) => `#${esc(tag)}`).join(" ")}</p>${payload.conteudo}<div class="check">${payload.checklist.map((item) => `<p>${item.concluido ? "☑" : "☐"} ${esc(item.texto)}</p>`).join("")}</div><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  }

  async function shareNote() {
    const payload = currentPayload();
    const text = `${payload.titulo}\n\n${stripHtml(payload.conteudo)}`;
    try {
      if (navigator.share) await navigator.share({ title: payload.titulo, text });
      else { await navigator.clipboard.writeText(text); toast("Nota copiada para compartilhar."); }
    } catch (error) { if (error.name !== "AbortError") toast("Não foi possível compartilhar.", "error"); }
  }

  function openSimpleDialog(mode) {
    state.dialogMode = mode;
    $("dialogTitle").textContent = mode === "category" ? "Nova categoria" : "Adicionar link ou anexo";
    $("dialogInputLabel").textContent = mode === "category" ? "Nome da categoria" : "URL do arquivo ou página";
    $("dialogInput").placeholder = mode === "category" ? "Ex.: Estratégias avançadas" : "https://…";
    $("dialogInput").value = "";
    $("simpleDialog").showModal();
    setTimeout(() => $("dialogInput").focus(), 20);
  }

  function registerDialog() {
    $("simpleDialogForm")?.addEventListener("submit", (event) => {
      const submitter = event.submitter;
      if (submitter?.value === "cancel") return;
      event.preventDefault();
      const value = $("dialogInput").value.trim(); if (!value) return;
      if (state.dialogMode === "category") {
        const select = $("noteCategory");
        if (![...select.options].some((option) => option.value === value)) select.add(new Option(value, value));
        select.value = value; markDirty(); renderCategories(); toast("Categoria adicionada.");
      } else {
        try { const url = new URL(value); state.attachments.push({ id: crypto.randomUUID?.() || String(Date.now()), nome: url.pathname.split("/").pop() || url.hostname, url: url.href, tipo: "link" }); renderAttachments(); markDirty(); }
        catch (_) { return toast("Digite um endereço válido.", "error"); }
      }
      $("simpleDialog").close();
    });
  }

  async function init() {
    if (location.pathname.endsWith(".html")) history.replaceState(null, "", "/notas");
    registerEvents(); registerDialog();
    try {
      const [homeResponse, notesResponse] = await Promise.all([api("/dashboard-premium/home"), api("/dashboard-premium/notas")]);
      fillUser(homeResponse.usuario || {});
      applyTheme(homeResponse.preferencias?.tema || "dark");
      state.notes = Array.isArray(notesResponse.notas) ? notesResponse.notas : [];
      renderAll();
      if (state.notes.length) openNote(state.notes.find((note) => !note.excluida)?.id || state.notes[0].id);
    } catch (error) { toast(error.message, "error"); }
    finally { setTimeout(() => $("notesLoading")?.remove(), 180); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
