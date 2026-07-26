"use strict";

const express = require("express");
const mongoose = require("mongoose");

const Usuario = require("../models/Usuario");
const { auth } = require("../middleware/auth");
const { requireDev } = require("../middleware/permissions");

const router = express.Router();

router.delete("/dev/usuarios/:id", auth, requireDev, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: "Conta inválida." });
    }

    const usuario = await Usuario.findById(id);

    if (!usuario) {
      return res.status(404).json({ erro: "Conta não encontrada." });
    }

    if (usuario.contaDev || String(usuario.cargo || "").toLowerCase() === "dev") {
      return res.status(403).json({ erro: "A conta Dev principal não pode ser apagada." });
    }

    const usuarioAtualId = String(req.usuarioDoc?._id || req.usuario?.id || req.usuario?._id || "");

    if (usuarioAtualId && usuarioAtualId === String(usuario._id)) {
      return res.status(403).json({ erro: "Você não pode apagar a própria conta durante a sessão." });
    }

    const removido = {
      id: String(usuario._id),
      nome: usuario.nome || "",
      email: usuario.email || "",
      cargo: usuario.cargo || "aluno"
    };

    await Usuario.deleteOne({ _id: usuario._id });

    return res.json({
      sucesso: true,
      mensagem: `${removido.nome || removido.email || "Conta"} foi apagado(a) definitivamente.`,
      usuario: removido
    });
  } catch (error) {
    console.error("Erro Dev ao apagar usuário:", error);
    return res.status(500).json({ erro: "Erro interno ao apagar a conta." });
  }
});

module.exports = router;
