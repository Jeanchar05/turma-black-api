"use strict";
const PDFDocument = require("pdfkit");
const registerFonts = require("./pdf-fonts");
const C = require("../public/study-curriculum");
const { guides } = require("../public/study-guides");
// The PDF is generated from the published written summary. Before publication,
// it is explicitly a study guide, never a claimed transcript of an unseen video.
function create(content) {
  const module = C.modules.find((m) => m.id === content.id),
    guide = guides[content.id];
  if (!module) throw new Error("Módulo inválido");
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 64, bottom: 66, left: 52, right: 52 },
    bufferPages: true,
    info: {
      Title: `${module.name} - Turma do Primo`,
      Author: "Turma do Primo",
    },
  });
  registerFonts(doc);
  const clean = (value) =>
    String(value)
      .replace(/[→↔]/g, " / ")
      .replace(/[−–—]/g, "-")
      .replace(/²/g, "2")
      .replace(/✓/g, "");
  const width = 491;
  function heading(text) {
    if (doc.y > 700) doc.addPage();
    doc
      .moveDown(0.7)
      .font("PrimoBold")
      .fontSize(13)
      .fillColor("#64458d")
      .text(clean(text), { width });
    doc.moveDown(0.45);
  }
  function paragraph(text) {
    doc
      .font("Primo")
      .fontSize(10.5)
      .fillColor("#393443")
      .text(clean(text), { width, lineGap: 5 });
    doc.moveDown(0.6);
  }
  doc
    .font("PrimoBold")
    .fontSize(9)
    .fillColor("#806499")
    .text("TURMA DO PRIMO  /  MATERIAL DE APOIO", {});
  doc
    .moveDown(1.2)
    .fontSize(29)
    .fillColor("#23192e")
    .text(module.name, { characterSpacing: 0 });
  doc
    .moveDown(0.4)
    .fontSize(10)
    .fillColor("#786385")
    .text(
      content.summary
        ? "Resumo da videoaula"
        : "Guia de estudo - videoaula em preparação",
    );
  doc.moveDown();
  if (content.summary) {
    heading("O que vimos na aula");
    content.summary
      .split(/\n\s*\n/)
      .filter(Boolean)
      .forEach(paragraph);
  } else {
    heading("O que você vai aprender");
    paragraph(guide.goal);
    heading("Entenda o conceito");
    paragraph(module.intro);
    for (const [title, copy] of module.rules) {
      heading(title);
      paragraph(copy);
    }
  }
  doc.addPage();
  heading("Um exemplo resolvido");
  guide.steps.forEach(([title, copy], i) => {
    heading(`${i + 1}. ${title}`);
    paragraph(copy);
  });
  heading("Evite esta confusão");
  paragraph(guide.mistake);
  heading("Confira se entendeu");
  paragraph(guide.check.question);
  paragraph(
    `Resposta: ${guide.check.options[guide.check.answer]}. ${guide.check.why}`,
  );
  heading("Para continuar");
  paragraph(
    `Abra Estudo > ${module.name}, altere o exemplo interativo e pratique o minigame. ${module.remember}`,
  );
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .save()
      .strokeColor("#e4dbea")
      .lineWidth(1)
      .moveTo(52, 785)
      .lineTo(543, 785)
      .stroke()
      .restore();
    doc
      .font("Primo")
      .fontSize(8)
      .fillColor("#85748e")
      .text("Turma do Primo | Exercícios educacionais", 52, 797, {
        lineBreak: false,
      });
    doc.text(`${i + 1} / ${range.count}`, 490, 797, { lineBreak: false });
  }
  return doc;
}
module.exports = { create };
