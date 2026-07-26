const express = require("express");
const mongoose = require("mongoose");

const Usuario = require("../models/Usuario");
const { auth } = require("../middleware/auth");
const { getCargo } = require("../middleware/permissions");

const router = express.Router();

async function buscarAlvo(req) {
  const id = String(req.body?.id || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const codigo = String(req.body?.codigo || "").trim();

  if (id && mongoose.Types.ObjectId.isValid(id)) {
    const usuario = await Usuario.findById(id);
    if (usuario) return usuario;
  }

  if (email) {
    const usuario = await Usuario.findOne({ email });
    if (usuario) return usuario;
  }

  if (codigo) {
    return Usuario.findOne({ codigo });
  }

  return null;
}

async function protegerContaAluno(req, res, next) {
  try {
    const alvo = await buscarAlvo(req);

    if (!alvo) {
      return next();
    }

    if (alvo.contaDev === true || getCargo(alvo) !== "aluno") {
      return res.status(403).json({
        erro: "Esta ação é permitida somente para contas de alunos.",
        codigo: "CONTA_EQUIPE_PROTEGIDA"
      });
    }

    req.alunoAlvo = alvo;
    next();
  } catch (error) {
    console.error("Erro na proteção de conta de aluno:", error);
    return res.status(500).json({
      erro: "Erro interno ao validar a conta selecionada."
    });
  }
}

router.post("/aprovar", auth, protegerContaAluno);
router.post("/suspender", auth, protegerContaAluno);
router.post("/reativar", auth, protegerContaAluno);
router.post("/usuario/bloquear", auth, protegerContaAluno);

module.exports = router;
