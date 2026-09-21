"use strict";
const PDFDocument = require("pdfkit"),
  { parseDocument } = require("htmlparser2"),
  registerFonts = require("./pdf-fonts"),
  { html } = require("./note-content");
function blocks(markup) {
  const result = [];
  let runs = [];
  const flush = () => {
    if (runs.some((r) => r.text.trim())) result.push({ kind: "p", runs });
    runs = [];
  };
  const text = (n, s = {}) => {
    if (n.type === "text") {
      runs.push({ text: n.data.replace(/\s+/g, " "), ...s });
      return;
    }
    if (n.name === "br") {
      runs.push({ text: "\n", ...s });
      return;
    }
    const next = {
      ...s,
      bold:
        s.bold ||
        ["b", "strong"].includes(n.name) ||
        /font-weight:\s*(bold|700)/.test(n.attribs?.style || ""),
      italic:
        s.italic ||
        ["em", "i"].includes(n.name) ||
        /font-style:\s*italic/.test(n.attribs?.style || ""),
      underline: s.underline || n.name === "u",
      link: n.name === "a" ? n.attribs?.href : s.link,
    };
    (n.children || []).forEach((c) => text(c, next));
  };
  const walk = (nodes, depth = 0) =>
    nodes.forEach((n) => {
      const tag = n.name || "";
      if (["ul", "ol"].includes(tag)) {
        flush();
        let i = 0;
        for (const li of n.children || [])
          if (li.name === "li") {
            runs = [{ text: tag === "ol" ? `${++i}. ` : "• " }];
            (li.children || [])
              .filter((c) => !["ul", "ol"].includes(c.name))
              .forEach((c) => text(c));
            result.push({ kind: "li", depth, runs });
            runs = [];
            walk(
              (li.children || []).filter((c) => ["ul", "ol"].includes(c.name)),
              depth + 1,
            );
          }
      } else if (
        /^h[1-4]$/.test(tag) ||
        ["p", "div", "blockquote"].includes(tag)
      ) {
        flush();
        if (
          (n.children || []).some((c) =>
            ["p", "div", "ul", "ol"].includes(c.name),
          )
        )
          walk(n.children, depth);
        else {
          text(n);
          if (runs.some((r) => r.text.trim())) result.push({ kind: tag, runs });
          runs = [];
        }
      } else if (tag === "hr") {
        flush();
        result.push({ kind: "hr", runs: [] });
      } else text(n);
    });
  walk(parseDocument(html(markup)).children);
  flush();
  return result;
}
function create(note, student) {
  const brand = require("./pdf-brand"), doc = brand.create(note.titulo, true), width = 461;
  doc.info.Author = student;
  doc.info.Subject = "Caderno pessoal - Turma do Primo";
  doc.save().roundedRect(82, 87, 461, 145, 14).fill("#f2ecf6").restore();
  doc.x = 100; doc.y = 106;
  doc
    .font("PrimoBold")
    .fontSize(9)
    .fillColor("#79539a")
    .text("TURMA DO PRIMO  /  MEU CADERNO");
  doc
    .moveDown(1)
    .fontSize(24)
    .fillColor("#2d203b")
    .text(note.titulo, { width: 425, lineGap: 2 });
  doc
    .moveDown(0.7)
    .font("Primo")
    .fontSize(10)
    .fillColor("#796582")
    .text(`Anotações de ${student}`, { width });
  doc
    .moveDown(0.4)
    .fontSize(9)
    .text(
      `${note.categoria}  •  ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      { width },
    );
  if (note.tags?.length)
    doc.moveDown(0.4).text(note.tags.map((t) => `#${t}`).join("  "), { width });
  doc.y = Math.max(doc.y + 28, 254); doc.x = 82;
  for (const b of blocks(note.conteudo)) {
    if (doc.y > 705) doc.addPage();
    if (b.kind === "hr") {
      doc.moveTo(82, doc.y).lineTo(541, doc.y).strokeColor("#ddd5e4").stroke();
      doc.moveDown(0.8);
      continue;
    }
    const h = /^h/.test(b.kind),
      indent =
        b.kind === "li"
          ? Math.min(b.depth || 0, 6) * 14
          : b.kind === "blockquote"
            ? 14
            : 0,
      size = h ? (b.kind === "h1" ? 19 : b.kind === "h2" ? 16 : 13) : 10.5;
    if (h && doc.y > 665) doc.addPage();
    b.runs.forEach((r, i) => {
      doc
        .font(r.bold || h ? "PrimoBold" : "Primo")
        .fontSize(size)
        .fillColor(r.link ? "#68439a" : h ? "#634280" : "#38313e");
      const o = {
        width: width - indent,
        lineGap: 4,
        continued: i < b.runs.length - 1,
        underline: !!r.underline || !!r.link,
        oblique: !!r.italic,
        link: r.link || null,
      };
      if (i === 0) doc.text(r.text, 82 + indent, doc.y, o);
      else doc.text(r.text, o);
    });
    doc.x = 82;
    doc.moveDown(0.7);
  }
  for (const [title, items] of [
    [
      "Minha checklist",
      (note.checklist || []).map(
        (i) => `${i.concluido ? "[x]" : "[ ]"} ${i.texto}`,
      ),
    ],
    [
      "Links de referência",
      (note.anexos || []).map((a) => `${a.nome || "Referência"}: ${a.url}`),
    ],
  ])
    if (items.length) {
      if (doc.y > 680) doc.addPage();
      doc
        .font("PrimoBold")
        .fontSize(13)
        .fillColor("#634280")
        .text(title, 82, doc.y, { width })
        .moveDown(0.5);
      for (const item of items)
        doc
          .font("Primo")
          .fontSize(10.5)
          .fillColor("#38313e")
          .text(item, { width, lineGap: 4 })
          .moveDown(0.4);
    }
  brand.footer(doc, "MEU CADERNO · " + String(note.id || "").slice(0,8).toUpperCase(), "Anotações de " + student);
  return doc;
}
module.exports = { create, blocks };
