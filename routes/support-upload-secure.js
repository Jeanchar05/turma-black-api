"use strict";

const crypto = require("crypto");
const express = require("express");
const database = require("../config/database");
const { auth } = require("../middleware/auth");
const { getCargo } = require("../middleware/permissions");
const { sanitizeUpload } = require("../services/upload-sanitizer");

const router = express.Router();
const TEAM_ROLES = new Set(["dev", "dono", "superadmin", "admin", "suporte", "moderador"]);
const MAX_FILES_PER_TICKET = 3;

function id24() {
  return crypto.randomBytes(12).toString("hex");
}

function userId(req) {
  return String(req.usuario?.id || req.usuario?._id || req.usuarioDoc?.id || req.usuarioDoc?._id || "");
}

function email(value) {
  return String(value || "").trim().toLowerCase().slice(0, 190);
}

function isTeam(req) {
  return TEAM_ROLES.has(String(getCargo(req.usuarioDoc || req.usuario) || "aluno").toLowerCase());
}

function canAccess(req, ticket) {
  if (isTeam(req)) return true;
  const id = userId(req);
  const currentEmail = email(req.usuario?.email);
  return Boolean(
    (id && String(ticket.usuario_id || "") === id) ||
    (currentEmail && email(ticket.usuario_email) === currentEmail)
  );
}

router.post("/suporte/:id/anexos", auth, async (req, res) => {
  try {
    const ticketId = String(req.params.id || "").trim().slice(0, 24);
    const tickets = await database.query(
      "SELECT id,usuario_id,usuario_email FROM support_tickets WHERE id=? LIMIT 1",
      [ticketId]
    );
    const ticket = tickets[0] || null;
    if (!ticket) return res.status(404).json({ erro: "Chamado não encontrado." });
    if (!canAccess(req, ticket)) return res.status(403).json({ erro: "Você não pode anexar neste chamado." });

    const raw = String(req.body?.base64 || "")
      .replace(/^data:[^;]+;base64,/, "")
      .replace(/\s+/g, "");
    if (!raw || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) {
      return res.status(400).json({ erro: "Arquivo inválido." });
    }

    const buffer = Buffer.from(raw, "base64");
    const sanitized = await sanitizeUpload(buffer, {
      name: req.body?.nome,
      informedMime: req.body?.mime
    });

    const countRows = await database.query(
      "SELECT COUNT(*) AS total FROM support_files WHERE ticket_id=?",
      [ticketId]
    );
    if (Number(countRows[0]?.total || 0) >= MAX_FILES_PER_TICKET) {
      return res.status(409).json({ erro: "Limite de 3 anexos por chamado atingido." });
    }

    const fileId = id24();
    const messageId = String(req.body?.mensagemId || "").trim().slice(0, 24) || null;
    if (messageId) {
      const messages = await database.query(
        "SELECT id FROM support_messages WHERE id=? AND ticket_id=? LIMIT 1",
        [messageId, ticketId]
      );
      if (!messages.length) return res.status(400).json({ erro: "Mensagem vinculada inválida." });
    }

    await database.query(
      `INSERT INTO support_files
       (id,ticket_id,mensagem_id,usuario_id,nome,mime,tamanho,dados)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        fileId,
        ticketId,
        messageId,
        userId(req) || null,
        sanitized.name,
        sanitized.mime,
        sanitized.size,
        sanitized.buffer
      ]
    );

    return res.status(201).json({
      sucesso: true,
      mensagem: "Arquivo validado, sanitizado e anexado com segurança.",
      arquivo: {
        id: fileId,
        nome: sanitized.name,
        mime: sanitized.mime,
        tamanho: sanitized.size,
        url: `/suporte/anexos/${fileId}`
      }
    });
  } catch (error) {
    const code = String(error?.code || "");
    if (code.startsWith("UPLOAD_")) {
      return res.status(code === "UPLOAD_TYPE_INVALID" ? 415 : 400).json({
        erro: error.message || "Arquivo rejeitado por segurança.",
        codigo: code
      });
    }
    console.error("Erro no upload sanitizado de suporte:", error);
    return res.status(500).json({ erro: "Erro interno ao anexar arquivo." });
  }
});

module.exports = router;
