"use strict";

const express = require("express");
const { auth, montarUsuarioSeguro } = require("../middleware/auth");
const Profile = require("../services/profile-security-v6");

const router = express.Router();

router.put("/perfil", auth, async (req, res) => {
  try {
    const user = req.usuarioDoc;
    if (!user) return res.status(401).json({ erro: "Conta não encontrada." });
    const name = Profile.safeDisplayName(req.body?.nome);
    if (!name) return res.status(400).json({ erro: "Nome é obrigatório." });
    user.nome = name;
    if (req.body?.foto !== undefined) {
      const photo = String(req.body.foto || "").trim();
      if (photo && !/^https:\/\//i.test(photo) && !/^data:image\/webp;base64,/i.test(photo)) return res.status(400).json({ erro: "Foto de perfil inválida." });
      if (photo.length > 350000) return res.status(413).json({ erro: "Foto de perfil muito grande." });
      user.foto = photo;
    }
    user.atualizadoPor = "profile-save-v6";
    await user.save({ validateModifiedOnly: true });
    return res.json({ sucesso: true, mensagem: "Perfil atualizado.", usuario: montarUsuarioSeguro(user) });
  } catch (error) {
    console.error("Erro ao salvar perfil V6:", error);
    return res.status(500).json({ erro: "Não foi possível salvar o perfil." });
  }
});

module.exports = router;
