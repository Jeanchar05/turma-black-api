const express = require("express");
const PDFDocument = require("pdfkit");

const Prova = require("../models/Prova");
const ProvaResultado = require("../models/ProvaResultado");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();

function texto(valor, fallback = "") {
  const final = String(valor ?? "").trim();
  return final || fallback;
}

function nomeArquivo(valor) {
  return texto(valor, "resultado")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "resultado";
}

function dataPtBr(valor) {
  const data = valor ? new Date(valor) : new Date();
  if (Number.isNaN(data.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(data);
}

function respostaCorreta(pergunta) {
  if (!pergunta) return "Gabarito indisponivel";

  if (pergunta.tipo === "texto") {
    return texto(
      pergunta.respostaTextoEsperada,
      pergunta.explicacao || "Resposta textual sujeita a analise"
    );
  }

  const alternativa = Array.isArray(pergunta.alternativas)
    ? pergunta.alternativas.find((item) => item.correta)
    : null;

  return texto(alternativa?.texto, "Gabarito indisponivel");
}

function garantirEspaco(doc, altura = 90) {
  const limite = doc.page.height - doc.page.margins.bottom;
  if (doc.y + altura <= limite) return;
  doc.addPage();
}

function desenharSeta(doc, x, y, cor = "#a855f7") {
  doc.save();
  doc.strokeColor(cor).lineWidth(1.8);
  doc.moveTo(x, y).lineTo(x + 14, y).stroke();
  doc.moveTo(x + 14, y).lineTo(x + 9, y - 4).stroke();
  doc.moveTo(x + 14, y).lineTo(x + 9, y + 4).stroke();
  doc.restore();
}

function cabecalho(doc, resultado) {
  doc.rect(0, 0, doc.page.width, 112).fill("#09030f");

  doc
    .fillColor("#f4b942")
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("TURMA DO PRIMO", 46, 34);

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(23)
    .text("Relatorio de respostas", 46, 53);

  doc
    .fillColor("#c7b8d9")
    .font("Helvetica")
    .fontSize(9)
    .text(`Gerado em ${dataPtBr(new Date())}`, 46, 84);

  doc.y = 134;

  const aprovado = Boolean(resultado.aprovado);
  const statusCor = resultado.status === "em_analise"
    ? "#d08b18"
    : aprovado
      ? "#16a34a"
      : "#dc2626";
  const statusTexto = resultado.status === "em_analise"
    ? "EM ANALISE"
    : aprovado
      ? "APROVADO"
      : "REPROVADO";

  doc
    .fillColor("#21152d")
    .roundedRect(46, 132, 503, 96, 10)
    .fill();

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(texto(resultado.provaTitulo, "Prova"), 62, 149, { width: 340 });

  doc
    .fillColor("#d8cde2")
    .font("Helvetica")
    .fontSize(10)
    .text(`Aluno: ${texto(resultado.usuarioNome, resultado.usuarioEmail)}`, 62, 174)
    .text(`E-mail: ${texto(resultado.usuarioEmail, "-")}`, 62, 190)
    .text(`Finalizada em: ${dataPtBr(resultado.finalizadoEm || resultado.createdAt)}`, 62, 206);

  doc
    .fillColor(statusCor)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(statusTexto, 428, 151, { width: 96, align: "right" });

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(24)
    .text(`${Number(resultado.nota || 0).toFixed(0)}%`, 428, 174, {
      width: 96,
      align: "right"
    });

  doc
    .fillColor("#bcaec9")
    .font("Helvetica")
    .fontSize(9)
    .text(
      `${Number(resultado.acertos || 0)} acerto(s) - ${Number(resultado.erros || 0)} erro(s)`,
      399,
      207,
      { width: 125, align: "right" }
    );

  doc.y = 252;
}

router.get(
  "/admin/provas/resultados/:id/relatorio.pdf",
  auth,
  requirePermission("provas"),
  async (req, res) => {
    try {
      const resultado = await ProvaResultado.findById(req.params.id).lean();

      if (!resultado) {
        return res.status(404).json({ erro: "Resultado nao encontrado." });
      }

      const prova = await Prova.findById(resultado.provaId).lean();
      const perguntas = new Map(
        Array.isArray(prova?.perguntas)
          ? prova.perguntas.map((item) => [String(item._id), item])
          : []
      );

      const arquivo = [
        "resultado",
        nomeArquivo(resultado.usuarioNome || resultado.usuarioEmail),
        nomeArquivo(resultado.provaTitulo)
      ].join("-") + ".pdf";

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=\"${arquivo}\"`);
      res.setHeader("Cache-Control", "no-store");

      const doc = new PDFDocument({
        size: "A4",
        margin: 46,
        bufferPages: true,
        info: {
          Title: `Resultado - ${texto(resultado.provaTitulo, "Prova")}`,
          Author: "Turma do Primo",
          Subject: "Relatorio de respostas do aluno"
        }
      });

      doc.pipe(res);
      cabecalho(doc, resultado);

      const respostas = Array.isArray(resultado.respostas) ? resultado.respostas : [];

      if (!respostas.length) {
        doc
          .fillColor("#675a70")
          .font("Helvetica")
          .fontSize(11)
          .text("Este resultado nao possui respostas registradas.", 46, doc.y, {
            width: 503,
            align: "center"
          });
      }

      respostas.forEach((item, indice) => {
        const pergunta = perguntas.get(String(item.perguntaId));
        const textual = item.tipo === "texto";
        const correta = Boolean(item.correta);
        const gabarito = texto(item.respostaCorreta, respostaCorreta(pergunta));
        const respostaAluno = texto(item.resposta, "Nao respondida");
        const explicacao = texto(pergunta?.explicacao || item.comentario, "");

        const mostrarCorreta = !textual && !correta;
        const mostrarReferencia = textual && gabarito && gabarito !== "Resposta textual sujeita a analise";

        const alturaEstimada = 118
          + doc.heightOfString(texto(item.enunciado, `Questao ${indice + 1}`), { width: 475 })
          + doc.heightOfString(respostaAluno, { width: 450 })
          + ((mostrarCorreta || mostrarReferencia) ? doc.heightOfString(gabarito, { width: 430 }) : 0)
          + (explicacao ? doc.heightOfString(explicacao, { width: 450 }) : 0);

        garantirEspaco(doc, Math.min(alturaEstimada, 270));

        const inicioY = doc.y;
        const fundo = textual ? "#fff7e8" : correta ? "#eaf8ef" : "#fff0f0";
        const cor = textual ? "#9a6108" : correta ? "#137333" : "#b42318";
        const titulo = textual
          ? "RESPOSTA TEXTUAL - ANALISE"
          : correta
            ? "RESPOSTA CORRETA"
            : "RESPOSTA INCORRETA";

        doc.roundedRect(46, inicioY, 503, 24, 6).fill(fundo);

        doc
          .fillColor(cor)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(`${indice + 1}. ${titulo}`, 58, inicioY + 7, { width: 470 });

        doc.y = inicioY + 36;
        doc
          .fillColor("#22172b")
          .font("Helvetica-Bold")
          .fontSize(11)
          .text(texto(item.enunciado, `Questao ${indice + 1}`), 58, doc.y, {
            width: 475,
            lineGap: 2
          });

        doc.moveDown(0.7);
        doc
          .fillColor("#675a70")
          .font("Helvetica-Bold")
          .fontSize(9)
          .text("Resposta do aluno:", 58, doc.y, { width: 475 });

        doc
          .fillColor("#22172b")
          .font("Helvetica")
          .fontSize(10)
          .text(respostaAluno, 58, doc.y + 3, { width: 475, lineGap: 2 });

        if (mostrarCorreta) {
          doc.moveDown(0.8);
          const setaY = doc.y + 7;
          desenharSeta(doc, 60, setaY);
          doc
            .fillColor("#7e22ce")
            .font("Helvetica-Bold")
            .fontSize(9)
            .text("Resposta correta:", 82, doc.y, { width: 450 });

          doc
            .fillColor("#3b2450")
            .font("Helvetica")
            .fontSize(10)
            .text(gabarito, 82, doc.y + 3, { width: 450, lineGap: 2 });
        }

        if (mostrarReferencia) {
          doc.moveDown(0.8);
          doc
            .fillColor("#9a6108")
            .font("Helvetica-Bold")
            .fontSize(9)
            .text("Referencia para analise:", 58, doc.y, { width: 475 });
          doc
            .fillColor("#5f4a28")
            .font("Helvetica")
            .fontSize(10)
            .text(gabarito, 58, doc.y + 3, { width: 475, lineGap: 2 });
        }

        if (explicacao) {
          doc.moveDown(0.75);
          doc
            .fillColor("#6f5d7c")
            .font("Helvetica-Oblique")
            .fontSize(9)
            .text(`Explicacao: ${explicacao}`, 58, doc.y, {
              width: 475,
              lineGap: 2
            });
        }

        doc.moveDown(1.25);
        doc
          .strokeColor("#e5dcec")
          .lineWidth(0.7)
          .moveTo(46, doc.y)
          .lineTo(549, doc.y)
          .stroke();
        doc.moveDown(1);
      });

      if (resultado.feedback) {
        garantirEspaco(doc, 90);
        const feedbackY = doc.y;
        doc
          .fillColor("#f4eef9")
          .roundedRect(46, feedbackY, 503, 70, 8)
          .fill();
        doc
          .fillColor("#4c2b62")
          .font("Helvetica-Bold")
          .fontSize(10)
          .text("Feedback da avaliacao", 60, feedbackY + 14);
        doc
          .fillColor("#4e4058")
          .font("Helvetica")
          .fontSize(9)
          .text(texto(resultado.feedback), 60, feedbackY + 31, {
            width: 475,
            height: 34
          });
      }

      const totalPaginas = doc.bufferedPageRange();
      for (let pagina = 0; pagina < totalPaginas.count; pagina++) {
        doc.switchToPage(pagina + totalPaginas.start);
        doc
          .fillColor("#9689a0")
          .font("Helvetica")
          .fontSize(8)
          .text(
            `Turma do Primo - Pagina ${pagina + 1} de ${totalPaginas.count}`,
            46,
            doc.page.height - 30,
            { width: 503, align: "center", lineBreak: false }
          );
      }

      doc.end();
    } catch (error) {
      console.error("Erro ao gerar PDF do resultado:", error);
      if (!res.headersSent) {
        return res.status(500).json({ erro: "Erro interno ao gerar o PDF." });
      }
      res.end();
    }
  }
);

module.exports = router;
