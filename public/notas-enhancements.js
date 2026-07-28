"use strict";
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const cleanFileName = (value) => String(value || "nota").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "nota";

  function prepareUnderline() {
    const button = $('[data-command="underline"]');
    if (!button) return;
    button.title = "Sublinhar texto (Ctrl + U)";
    button.setAttribute("aria-label", "Sublinhar texto");

    document.addEventListener("selectionchange", () => {
      const editor = $("#noteContent");
      const selection = window.getSelection();
      const anchor = selection?.anchorNode;
      const insideEditor = Boolean(editor && anchor && editor.contains(anchor.nodeType === Node.TEXT_NODE ? anchor.parentNode : anchor));
      button.classList.toggle("is-active", insideEditor && document.queryCommandState?.("underline"));
    });

    document.addEventListener("keydown", (event) => {
      const editor = $("#noteContent");
      if (!editor || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "u") return;
      const selection = window.getSelection();
      const anchor = selection?.anchorNode;
      const insideEditor = Boolean(anchor && editor.contains(anchor.nodeType === Node.TEXT_NODE ? anchor.parentNode : anchor));
      if (!insideEditor) return;
      event.preventDefault();
      document.execCommand("underline", false, null);
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatUnderline" }));
    }, true);
  }

  function getChecklist() {
    return $$("#noteChecklist .notes-check-item").map((row) => ({
      checked: Boolean($("input[type='checkbox']", row)?.checked),
      text: $("input[type='text']", row)?.value?.trim() || ""
    })).filter((item) => item.text);
  }

  function getAttachments() {
    return $$("#noteAttachments .notes-attachment-item").map((row) => {
      const anchor = $("a", row);
      return anchor ? { name: anchor.textContent.trim(), url: anchor.href } : null;
    }).filter(Boolean);
  }

  function getNoteData() {
    const title = $("#noteTitle")?.value?.trim() || "Nota sem título";
    const category = $("#noteCategory")?.value || "Geral";
    const tags = String($("#noteTags")?.value || "").split(/[,;]+/).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean);
    const content = $("#noteContent")?.innerHTML?.trim() || "<p>Nota sem conteúdo.</p>";
    const author = $("[data-user-fullname]")?.textContent?.trim() || $("[data-user-name]")?.textContent?.trim() || "Aluno";
    const edited = $("#noteEditedAt")?.textContent?.trim() || "";
    return { title, category, tags, content, author, edited, checklist: getChecklist(), attachments: getAttachments() };
  }

  function buildChecklist(items) {
    if (!items.length) return "";
    const completed = items.filter((item) => item.checked).length;
    return `<section class="pdf-section"><div class="pdf-section-title"><span>CHECKLIST</span><b>${completed}/${items.length} concluídos</b></div><div class="pdf-checklist">${items.map((item) => `<div class="pdf-check-item ${item.checked ? "done" : ""}"><span>${item.checked ? "✓" : ""}</span><p>${esc(item.text)}</p></div>`).join("")}</div></section>`;
  }

  function buildAttachments(items) {
    if (!items.length) return "";
    return `<section class="pdf-section"><div class="pdf-section-title"><span>LINKS E ANEXOS</span><b>${items.length}</b></div><div class="pdf-links">${items.map((item) => `<a href="${esc(item.url)}">${esc(item.name || item.url)}</a>`).join("")}</div></section>`;
  }

  function openPremiumPdf() {
    const data = getNoteData();
    const popup = window.open("", "_blank", "width=1000,height=760");
    if (!popup) return;
    const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date());
    const tags = data.tags.length ? data.tags.map((tag) => `<span>#${esc(tag)}</span>`).join("") : "<span>#anotação</span>";
    const logoUrl = `${location.origin}/assets/turma-primo-logo.svg`;

    popup.document.write(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${cleanFileName(data.title)}-turma-do-primo</title>
<style>
@page{size:A4;margin:18mm 16mm 20mm}*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;color:#1c1722;font:12px/1.65 Arial,Helvetica,sans-serif;background:#fff}.pdf-page{position:relative;min-height:260mm}.pdf-watermark{position:fixed;right:18mm;bottom:34mm;width:150px;opacity:.035}.pdf-header{position:relative;overflow:hidden;padding:22px 24px 20px;border:1px solid #e8dcf1;border-radius:16px;background:linear-gradient(135deg,#100718 0%,#241035 62%,#12091c 100%);color:#fff}.pdf-header:after{content:"";position:absolute;right:-60px;top:-90px;width:230px;height:230px;border:2px solid rgba(177,76,255,.28);border-radius:50%;box-shadow:0 0 0 28px rgba(177,76,255,.05),0 0 0 60px rgba(242,183,45,.035)}.pdf-brand{position:relative;z-index:2;display:flex;align-items:center;gap:12px}.pdf-brand img{width:54px;height:54px;filter:drop-shadow(0 0 15px rgba(242,183,45,.22))}.pdf-brand-name{display:grid}.pdf-brand-name small{color:#d9cfe0;font-size:8px;letter-spacing:.22em}.pdf-brand-name strong{font-size:20px;letter-spacing:.02em}.pdf-badge{margin-left:auto;padding:7px 10px;border:1px solid rgba(242,183,45,.45);border-radius:999px;color:#ffd86f;background:rgba(242,183,45,.08);font-size:8px;font-weight:700;letter-spacing:.12em}.pdf-accent{height:4px;margin:14px 0 18px;border-radius:999px;background:linear-gradient(90deg,#f2b72d,#9d3cff 55%,#3d8dff)}.pdf-title-block h1{margin:0 0 8px;font-size:28px;line-height:1.18;color:#fff}.pdf-meta{display:flex;flex-wrap:wrap;gap:8px;color:#d9cfe0;font-size:9px}.pdf-meta span{padding:4px 8px;border:1px solid rgba(255,255,255,.11);border-radius:999px;background:rgba(255,255,255,.05)}.pdf-summary{margin:18px 0 20px;padding:12px 14px;border-left:4px solid #9d3cff;border-radius:0 10px 10px 0;background:#f7f2fb;color:#5d5264;font-size:10px}.pdf-content{font-size:12px;line-height:1.75}.pdf-content h2,.pdf-content h3,.pdf-content h4{margin:22px 0 8px;color:#3d254c}.pdf-content h2{font-size:20px}.pdf-content h3{font-size:16px}.pdf-content p{margin:0 0 11px}.pdf-content ul,.pdf-content ol{padding-left:22px}.pdf-content blockquote{margin:15px 0;padding:10px 14px;border-left:4px solid #f2b72d;background:#fff8e6;color:#62563b}.pdf-content a{color:#7c2cc8;text-decoration-thickness:1.5px;text-underline-offset:2px}.pdf-content u{text-decoration-color:#9d3cff;text-decoration-thickness:2px;text-underline-offset:3px}.pdf-section{margin-top:22px;break-inside:avoid}.pdf-section-title{display:flex;align-items:center;justify-content:space-between;padding-bottom:7px;border-bottom:1px solid #eadff1;color:#6f3d91;font-size:9px;letter-spacing:.12em}.pdf-section-title b{color:#8b8290;letter-spacing:0}.pdf-checklist{display:grid;gap:7px;margin-top:10px}.pdf-check-item{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border:1px solid #ece4f2;border-radius:8px;background:#fcfaff}.pdf-check-item>span{width:17px;height:17px;flex:0 0 17px;border:1.5px solid #bbaac7;border-radius:5px;display:grid;place-items:center;color:#fff;background:#fff;font-size:11px}.pdf-check-item.done>span{border-color:#48bd79;background:#48bd79}.pdf-check-item p{margin:0}.pdf-check-item.done p{text-decoration:line-through;color:#8d8591}.pdf-links{display:grid;gap:7px;margin-top:10px}.pdf-links a{padding:8px 10px;border:1px solid #e9dff0;border-radius:8px;color:#7732ad;text-decoration:none;background:#fcf9ff}.pdf-footer{position:fixed;left:16mm;right:16mm;bottom:8mm;padding-top:8px;border-top:1px solid #e8dfee;display:flex;align-items:center;justify-content:space-between;color:#8f8794;font-size:8px}.pdf-footer strong{color:#6a347f}.pdf-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:12px}.pdf-tags span{padding:4px 7px;border-radius:6px;color:#7630aa;background:#f2e8f9;font-size:8px}
@media print{body{background:#fff}.pdf-page{min-height:auto}.pdf-header{break-inside:avoid}.pdf-section{break-inside:avoid}}
</style></head><body>
<div class="pdf-page"><img class="pdf-watermark" src="${logoUrl}" alt=""><header class="pdf-header"><div class="pdf-brand"><img src="${logoUrl}" alt="Turma do Primo"><div class="pdf-brand-name"><small>TURMA DO</small><strong>PRIMO</strong></div><span class="pdf-badge">NOTAS INTELIGENTES</span></div><div class="pdf-accent"></div><div class="pdf-title-block"><h1>${esc(data.title)}</h1><div class="pdf-meta"><span>Categoria: ${esc(data.category)}</span><span>Autor: ${esc(data.author)}</span><span>Gerado em ${esc(generatedAt)}</span></div><div class="pdf-tags">${tags}</div></div></header><div class="pdf-summary">Documento pessoal gerado pela plataforma Turma do Primo. ${esc(data.edited)}</div><main class="pdf-content">${data.content}</main>${buildChecklist(data.checklist)}${buildAttachments(data.attachments)}<footer class="pdf-footer"><span><strong>Turma do Primo</strong> • Notas Inteligentes</span><span>Material pessoal • 2026</span></footer></div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500));<\/script></body></html>`);
    popup.document.close();
  }

  function preparePdfButton() {
    const button = $('[data-editor-action="print"]');
    if (!button) return;
    button.classList.add("notes-pdf-button-ready");
    button.textContent = "Gerar PDF oficial";
    button.title = "Gerar PDF com a identidade da Turma do Primo";

    document.addEventListener("click", (event) => {
      const target = event.target.closest('[data-editor-action="print"]');
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openPremiumPdf();
    }, true);
  }

  function init() {
    prepareUnderline();
    preparePdfButton();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
