"use strict";

const express = require("express");
const database = require("../config/database");
const { auth } = require("../middleware/auth");
const { getCargo } = require("../middleware/permissions");

const router = express.Router();
const ADMIN_REPLY_ROLES = new Set(["dev", "dono", "superadmin", "admin"]);

function role(req) {
  return String(getCargo(req.usuarioDoc || req.usuario) || "aluno").trim().toLowerCase();
}

function requireAdminReply(req, res, next) {
  if (!ADMIN_REPLY_ROLES.has(role(req))) {
    return res.status(403).json({ erro: "Somente administradores podem responder ou alterar o atendimento." });
  }
  return next();
}

router.post("/admin/suporte/:id/responder", auth, requireAdminReply, (_req, _res, next) => next());
router.post("/admin/suporte/:id/assumir", auth, requireAdminReply, (_req, _res, next) => next());
router.post("/admin/suporte/:id/status", auth, requireAdminReply, (_req, _res, next) => next());

router.delete("/admin/suporte/:id", auth, async (req, res) => {
  try {
    if (role(req) !== "dev") return res.status(403).json({ erro: "Apenas DEV pode apagar chamados." });
    const id = String(req.params.id || "").trim();
    if (!/^[a-f0-9]{24}$/i.test(id)) return res.status(400).json({ erro: "Chamado inválido." });
    const existing = await database.query("SELECT id,assunto FROM support_tickets WHERE id=? LIMIT 1", [id]);
    if (!existing.length) return res.status(404).json({ erro: "Chamado não encontrado." });
    await database.query("DELETE FROM support_tickets WHERE id=?", [id]);
    return res.json({ sucesso: true, mensagem: "Chamado apagado permanentemente.", id });
  } catch (error) {
    console.error("Erro DEV ao apagar chamado:", error);
    return res.status(500).json({ erro: "Não foi possível apagar o chamado." });
  }
});

module.exports = router;
