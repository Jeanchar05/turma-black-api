"use strict";
const PDFDocument = require("pdfkit");
const { parseDocument } = require("htmlparser2");
const registerFonts = require("./pdf-fonts");
const { html } = require("./note-content");

const PURPLE = "#6f2dbd";
const PURPLE_DARK = "#241433";
const GOLD = "#d7a52c";
const INK = "#27212d";
const MUTED = "#776d7e";
const BORDER = "#e8e0ec";
const PAPER = "#fbf9fc";
const LEFT = 54;
const RIGHT = 541;
const WIDTH = RIGHT - LEFT;

function blocks(markup) {
  const result = [];
  let runs = [];
  const flush = () => { if (runs.some((r) => r.text.trim())) result.push({ kind: "p", runs }); runs = []; };
  const text = (node, style = {}) => {
    if (node.type === "text") { runs.push({ text: node.data.replace(/\s+/g, " "), ...style }); return; }
    if (node.name === "br") { runs.push({ text: "\n", ...style }); return; }
    const next = {
      ...style,
      bold: style.bold || ["b", "strong"].includes(node.name) || /font-weight:\s*(bold|700)/.test(node.attribs?.style || ""),
      italic: style.italic || ["em", "i"].includes(node.name) || /font-style:\s*italic/.test(node.attribs?.style || ""),
      underline: style.underline || node.name === "u",
      link: node.name === "a" ? node.attribs?.href : style.link,
    };
    (node.children || []).forEach((child) => text(child, next));
  };
  const walk = (nodes, depth = 0) => nodes.forEach((node) => {
    const tag = node.name || "";
    if (["ul", "ol"].includes(tag)) {
      flush();
      let index = 0;
      for (const li of node.children || []) if (li.name === "li") {
        runs = [{ text: tag === "ol" ? `${++index}. ` : "• " }];
        (li.children || []).filter((child) => !["ul", "ol"].includes(child.name)).forEach((child) => text(child));
        result.push({ kind: "li", depth, runs }); runs = [];
        walk((li.children || []).filter((child) => ["ul", "ol"].includes(child.name)), depth + 1);
      }
    } else if (/^h[1-4]$/.test(tag) || ["p", "div", "blockquote"].includes(tag)) {
      flush();
      if ((node.children || []).some((child) => ["p", "div", "ul", "ol"].includes(child.name))) walk(node.children, depth);
      else { text(node); if (runs.some((run) => run.text.trim())) result.push({ kind: tag, runs }); runs = []; }
    } else if (tag === "hr") { flush(); result.push({ kind: "hr", runs: [] }); }
    else text(node);
  });
  walk(parseDocument(html(markup)).children);
  flush();
  return result;
}

function roundedCard(doc, x, y, width, height, fill = PAPER, stroke = BORDER) {
  doc.roundedRect(x, y, width, height, 10).fillAndStroke(fill, stroke);
}

function ensureSpace(doc, required = 70) {
  if (doc.y + required > 746) doc.addPage();
}

function header(doc, note, student) {
  doc.save();
  doc.rect(0, 0, 595, 122).fill(PURPLE_DARK);
  doc.rect(0, 118, 595, 4).fill(GOLD);
  doc.font("PrimoBold").fontSize(10).fillColor("#dcbcff").text("TURMA DO PRIMO", LEFT, 32, { characterSpacing: 1.4 });
  doc.fontSize(8).fillColor("#b8a8c2").text("CADERNO PESSOAL", LEFT, 51, { characterSpacing: 1.6 });
  doc.font("PrimoBold").fontSize(11).fillColor(GOLD).text("ANOTAÇÕES", 431, 34, { width: 110, align: "right" });
  doc.font("Primo").fontSize(8).fillColor("#d9cede").text(`Aluno: ${student}`, 350, 53, { width: 191, align: "right" });
  doc.restore();

  doc.y = 150;
  doc.font("PrimoBold").fontSize(27).fillColor(PURPLE_DARK).text(note.titulo || "Anotação", LEFT, doc.y, { width: WIDTH, lineGap: 2 });
  doc.moveDown(.45);
  const metaY = doc.y;
  roundedCard(doc, LEFT, metaY, WIDTH, 58, "#ffffff", BORDER);
  doc.font("PrimoBold").fontSize(8).fillColor(PURPLE).text("CATEGORIA", LEFT + 16, metaY + 13);
  doc.font("Primo").fontSize(10).fillColor(INK).text(note.categoria || "Geral", LEFT + 16, metaY + 29, { width: 150 });
  doc.font("PrimoBold").fontSize(8).fillColor(PURPLE).text("ATUALIZADO", LEFT + 190, metaY + 13);
  const updated = new Date(note.updatedAt || note.updated_at || Date.now());
  doc.font("Primo").fontSize(10).fillColor(INK).text(updated.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }), LEFT + 190, metaY + 29, { width: 105 });
  doc.font("PrimoBold").fontSize(8).fillColor(PURPLE).text("DOCUMENTO", LEFT + 325, metaY + 13);
  doc.font("Primo").fontSize(10).fillColor(INK).text(String(note.id || "").slice(0, 8).toUpperCase() || "PESSOAL", LEFT + 325, metaY + 29, { width: 130 });
  doc.y = metaY + 76;

  if (Array.isArray(note.tags) && note.tags.length) {
    doc.font("PrimoBold").fontSize(8).fillColor(MUTED).text("TAGS", LEFT, doc.y);
    doc.moveDown(.35);
    doc.font("Primo").fontSize(9).fillColor(PURPLE).text(note.tags.map((tag) => `#${tag}`).join("   "), LEFT, doc.y, { width: WIDTH, lineGap: 3 });
    doc.moveDown(.8);
  }
}

function renderContent(doc, note) {
  const parsed = blocks(note.conteudo || "");
  if (!parsed.length) {
    roundedCard(doc, LEFT, doc.y, WIDTH, 72, PAPER, BORDER);
    doc.font("Primo").fontSize(10).fillColor(MUTED).text("Esta anotação ainda não possui conteúdo.", LEFT + 18, doc.y + 25, { width: WIDTH - 36 });
    doc.y += 90;
    return;
  }

  for (const block of parsed) {
    ensureSpace(doc, /^h/.test(block.kind) ? 74 : 48);
    if (block.kind === "hr") {
      doc.moveDown(.35).moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).strokeColor(BORDER).lineWidth(1).stroke().moveDown(.75);
      continue;
    }
    const heading = /^h/.test(block.kind);
    const quote = block.kind === "blockquote";
    const indent = block.kind === "li" ? Math.min(block.depth || 0, 5) * 14 : quote ? 16 : 0;
    const size = heading ? (block.kind === "h1" ? 18 : block.kind === "h2" ? 15 : 12.5) : 10.5;
    if (quote) {
      doc.save().roundedRect(LEFT, doc.y - 5, WIDTH, 10, 5).fill("#f3edf8").restore();
      doc.save().rect(LEFT, doc.y - 5, 4, 30).fill(PURPLE).restore();
    }
    block.runs.forEach((run, index) => {
      doc.font(run.bold || heading ? "PrimoBold" : "Primo").fontSize(size).fillColor(run.link ? PURPLE : heading ? PURPLE_DARK : INK);
      const options = { width: WIDTH - indent, lineGap: heading ? 3 : 4, continued: index < block.runs.length - 1, underline: Boolean(run.underline || run.link), oblique: Boolean(run.italic), link: run.link || null };
      if (index === 0) doc.text(run.text, LEFT + indent, doc.y, options); else doc.text(run.text, options);
    });
    doc.x = LEFT;
    doc.moveDown(heading ? .55 : .68);
  }
}

function renderExtras(doc, note) {
  const groups = [
    ["Checklist", (note.checklist || []).map((item) => `${item.concluido || item.done ? "✓" : "○"}  ${item.texto || item.text || "Item"}`)],
    ["Links de referência", (note.anexos || []).map((item) => `${item.nome || item.label || "Referência"}: ${item.url || ""}`)],
  ];
  for (const [title, items] of groups) {
    if (!items.length) continue;
    ensureSpace(doc, 105);
    doc.moveDown(.5);
    doc.font("PrimoBold").fontSize(12).fillColor(PURPLE_DARK).text(title, LEFT, doc.y, { width: WIDTH });
    doc.moveDown(.45);
    roundedCard(doc, LEFT, doc.y, WIDTH, Math.max(54, items.length * 25 + 24), "#ffffff", BORDER);
    let y = doc.y + 14;
    for (const item of items) {
      doc.font("Primo").fontSize(9.5).fillColor(INK).text(item, LEFT + 16, y, { width: WIDTH - 32, lineGap: 3 });
      y = doc.y + 6;
    }
    doc.y = y + 8;
  }
}

function footer(doc, note) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(i);
    doc.moveTo(LEFT, 782).lineTo(RIGHT, 782).strokeColor(BORDER).lineWidth(1).stroke();
    doc.font("PrimoBold").fontSize(7.5).fillColor(PURPLE).text("TURMA DO PRIMO", LEFT, 795, { lineBreak: false });
    doc.font("Primo").fontSize(7.5).fillColor(MUTED).text("Documento de estudo • uso pessoal do aluno", 132, 795, { lineBreak: false });
    doc.text(`${i + 1} / ${range.count}`, 500, 795, { width: 41, align: "right", lineBreak: false });
  }
}

function create(note, student) {
  const doc = registerFonts(new PDFDocument({
    size: "A4",
    margins: { top: 54, bottom: 78, left: LEFT, right: 54 },
    bufferPages: true,
    info: { Title: note.titulo || "Anotação", Author: student, Subject: "Caderno pessoal - Turma do Primo" },
  }));
  doc.on("pageAdded", () => { doc.y = 60; });
  header(doc, note, student);
  renderContent(doc, note);
  renderExtras(doc, note);
  footer(doc, note);
  return doc;
}

module.exports = { create, blocks };
