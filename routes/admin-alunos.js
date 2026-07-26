const express = require("express");
const mongoose = require("mongoose");

const Usuario = require("../models/Usuario");
const { auth, montarUsuarioSeguro } = require("../middleware/auth");
const { requirePermission, getCargo } = require("../middleware/permissions");

const router = express.Router();

function validarId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function hojeISO() {
  return new Date().toISOString();
}

function formatarUsuario(usuario) {
  if (!usuario) return null;

  return {
    ...montarUsuarioSeguro(usuario),
    codigo: usuario.codigo || "",
    createdAt: usuario.createdAt || "",
    updatedAt: usuario.updatedAt || "",
    aprovadoEm: usuario.aprovadoEm || "",
    ultimoLogin: usuario.ultimoLogin || ""
  };
}

router.patch(
  "/alunos/:id/status",
  auth,
  requirePermission("controleAlunos"),
  async (req, res) => {
    try {
      if (!validarId(req.params.id)) {
        return res.status(400).json({ erro: "Aluno inválido." });
      }

      const usuario = await Usuario.findById(req.params.id);

      if (!usuario) {
        return res.status(404).json({ erro: "Aluno não encontrado." });
      }

      if (usuario.contaDev === true || getCargo(usuario) !== "aluno") {
        return res.status(403).json({
          erro: "Esta ação é permitida somente para contas de alunos."
        });
      }

      const acao = String(req.body?.acao || "").trim().toLowerCase();
      const permitidas = ["aprovar", "suspender", "reativar", "bloquear"];

      if (!permitidas.includes(acao)) {
        return res.status(400).json({ erro: "Ação inválida para o aluno." });
      }

      if (acao === "aprovar") {
        usuario.aprovado = true;
        usuario.suspenso = false;
        usuario.status = "ativo";
        usuario.plano = usuario.plano || "free";
        usuario.aprovadoEm = usuario.aprovadoEm || hojeISO();
      }

      if (acao === "suspender") {
        usuario.suspenso = true;
        usuario.status = "suspenso";
      }

      if (acao === "reativar") {
        usuario.aprovado = true;
        usuario.suspenso = false;
        usuario.status = "ativo";
        usuario.aprovadoEm = usuario.aprovadoEm || hojeISO();
      }

      if (acao === "bloquear") {
        usuario.suspenso = true;
        usuario.status = "bloqueado";
      }

      usuario.atualizadoPor = req.usuario.email;
      await usuario.save({ validateModifiedOnly: true });

      const mensagens = {
        aprovar: "Aluno aprovado com sucesso.",
        suspender: "Aluno suspenso com sucesso.",
        reativar: "Aluno reativado com sucesso.",
        bloquear: "Aluno bloqueado com sucesso."
      };

      return res.json({
        sucesso: true,
        mensagem: mensagens[acao],
        usuario: formatarUsuario(usuario)
      });
    } catch (error) {
      console.error("Erro ao alterar status do aluno:", error);
      return res.status(500).json({
        erro: "Erro interno ao atualizar o aluno."
      });
    }
  }
);

module.exports = router;
