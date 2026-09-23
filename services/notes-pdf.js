"use strict";
const PDFDocument = require("pdfkit"),
  { parseDocument } = require("htmlparser2"),
  registerFonts = require("./pdf-fonts"),
  { html } = require("./note-content");

function blocks(markup) {
  const result = [];
  let runs = [];
  const flush = () => { if (runs.some((r) => r.text.trim())) result.push({ kind: "p", runs }); runs = []; };
  const text = (n, s = {}) => {
    if (n.type === "text") { runs.push({ text: n.data.replace(/\s+/g, " "), ...s }); return; }
    if (n.name === "br") { runs.push({ text: "\n", ...s }); return; }
    const next = {
      ...s,
      bold: s.bold || ["b", "strong"].includes(n.name) || /font-weight:\s*(bold|700)/.test(n.attribs?.style || ""),
      italic: s.italic || ["em", "i"].includes(n.name) || /font-style:\s*italic/.test(n.attribs?.style || ""),
      underline: s.underline || n.name === "u",
      link: n.name === "a" ? n.attribs?.href : s.link,
    };
    (n.children || []).forEach((c) => text(c, next));
  };
  const walk = (nodes, depth = 0) => nodes.forEach((n) => {
    const tag = n.name || "";
    if (["ul", "ol"].includes(tag)) {
      flush(); let i = 0;
      for (const li of n.children || []) if (li.name === "li") {
        runs = [{ text: tag === "ol" ? `${++i}. ` : "• " }];
        (li.children || []).filter((c) => !["ul", "ol"].includes(c.name)).forEach((c) => text(c));
        result.push({ kind: "li", depth, runs }); runs = [];
        walk((li.children || []).filter((c) => ["ul", "ol"].includes(c.name)), depth + 1);
      }
    } else if (/^h[1-4]$/.test(tag) || ["p", "div", "blockquote"].includes(tag)) {
      flush();
      if ((n.children || []).some((c) => ["p", "div", "ul", "ol"].includes(c.name))) walk(n.children, depth);
      else { text(n); if (runs.some((r) => r.text.trim())) result.push({ kind: tag, runs }); runs = []; }
    } else if (tag === "hr") { flush(); result.push({ kind: "hr", runs: [] }); }
    else text(n);
  });
  walk(parseDocument(html(markup)).children); flush(); return result;
}

function create(note, student) {
  const doc = registerFonts(new PDFDocument({
    size: "A4",
    margins: { top: 58, bottom: 70, left: 54, right: 54 },
    bufferPages: true,
    info: { Title: note.titulo, Author: student, Subject: "Caderno pessoal - Turma do Primo" },
  }));
  const left = 54, right = 541, width = right - left;
  const purple = "#6f35a1", deep = "#24152f", gold = "#c79535", muted = "#7c6d84", line = "#e8e0ed", paper = "#faf8fc";
  const date = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" });

  doc.roundedRect(left, 48, width, 118, 16).fill(paper);
  doc.rect(left, 48, 7, 118).fill(purple);
  doc.font("PrimoBold").fontSize(9).fillColor(purple).text("TURMA DO PRIMO  •  CADERNO DO ALUNO", left + 24, 66, { characterSpacing: 1.2 });
  doc.font("PrimoBold").fontSize(26).fillColor(deep).text(note.titulo || "Minha anotação", left + 24, 88, { width: width - 48, lineGap: 1 });
  doc.font("Primo").fontSize(9.5).fillColor(muted).text(`${note.categoria || "Geral"}  •  ${date}  •  ${student}`, left + 24, 142, { width: width - 48 });
  doc.y = 187;

  if (note.tags?.length) {
    doc.font("PrimoBold").fontSize(8).fillColor(gold).text(note.tags.slice(0, 8).map((t) => `#${t}`).join("   "), left, doc.y, { width });
    doc.moveDown(.9);
  }

  doc.font("PrimoBold").fontSize(10).fillColor(purple).text("ANOTAÇÃO", left, doc.y, { characterSpacing: 1.1 }).moveDown(.7);

  for (const b of blocks(note.conteudo)) {
    if (doc.y > 704) doc.addPage();
    if (b.kind === "hr") {
      doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(line).lineWidth(1).stroke();
      doc.moveDown(.8); continue;
    }
    const heading = /^h/.test(b.kind);
    const quote = b.kind === "blockquote";
    const indent = b.kind === "li" ? Math.min(b.depth || 0, 6) * 14 : quote ? 18 : 0;
    const size = heading ? (b.kind === "h1" ? 19 : b.kind === "h2" ? 16 : 13) : 10.5;
    if (heading && doc.y > 660) doc.addPage();
    if (quote) {
      const quoteY = doc.y - 2;
      doc.roundedRect(left, quoteY, width, 42, 8).fill("#f4eef8");
      doc.rect(left, quoteY, 4, 42).fill(purple);
      doc.y = quoteY + 11;
    }
    b.runs.forEach((r, i) => {
      doc.font(r.bold || heading ? "PrimoBold" : "Primo").fontSize(size).fillColor(r.link ? purple : heading ? deep : "#3b3340");
      const opts = { width: width - indent, lineGap: 4, continued: i < b.runs.length - 1, underline: !!r.underline || !!r.link, oblique: !!r.italic, link: r.link || null };
      if (i === 0) doc.text(r.text, left + indent, doc.y, opts); else doc.text(r.text, opts);
    });
    doc.x = left; doc.moveDown(heading ? .8 : .65);
  }

  const sections = [
    ["CHECKLIST", (note.checklist || []).map((i) => `${i.concluido ? "✓" : "○"}  ${i.texto}`)],
    ["REFERÊNCIAS", (note.anexos || []).map((a) => `${a.nome || "Referência"}: ${a.url}`)],
  ];
  for (const [title, items] of sections) if (items.length) {
    if (doc.y > 655) doc.addPage();
    doc.moveDown(.5).font("PrimoBold").fontSize(10).fillColor(purple).text(title, left, doc.y, { characterSpacing: 1.1 }).moveDown(.65);
    for (const item of items) {
      doc.roundedRect(left, doc.y - 4, width, 26, 7).fill("#faf8fc");
      doc.font("Primo").fontSize(10).fillColor("#3b3340").text(item, left + 12, doc.y + 2, { width: width - 24, lineGap: 3 }).moveDown(.55);
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.moveTo(left, 777).lineTo(right, 777).strokeColor(line).lineWidth(1).stroke();
    doc.font("PrimoBold").fontSize(7.5).fillColor(purple).text("TURMA DO PRIMO", left, 790, { lineBreak: false, characterSpacing: .9 });
    doc.font("Primo").fontSize(7.5).fillColor(muted).text(`Caderno pessoal • ${note.id.slice(0, 8).toUpperCase()}`, left + 88, 790, { lineBreak: false });
    doc.font("PrimoBold").fontSize(7.5).fillColor(deep).text(`${i + 1} / ${range.count}`, 500, 790, { lineBreak: false });
  }
  return doc;
}
module.exports = { create, blocks };
