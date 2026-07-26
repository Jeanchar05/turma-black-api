const express = require("express");
const mongoose = require("mongoose");
const Usuario = require("../models/Usuario");
const { gerarToken, montarUsuarioSeguro } = require("../middleware/auth");
const { getPermissoes } = require("../middleware/permissions");

const router = express.Router();

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizarCargo(valor, tipo) {
  const cargo = String(valor || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replace(/\s+/g, "-");

  const mapa = {
    "super-admin": "superadmin",
    administrador: "admin",
    administrator: "admin",
    seller: "vendedor",
    support: "suporte"
  };

  const normalizado = mapa[cargo] || cargo;
  const permitidos = ["aluno", "vendedor", "suporte", "moderador", "admin", "superadmin"];

  if (permitidos.includes(normalizado)) return normalizado;
  return String(tipo || "").toLowerCase() === "admin" ? "admin" : "aluno";
}

function normalizarPlano(valor, cargo) {
  const plano = String(valor || "free")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (["superadmin", "admin", "moderador", "suporte", "vendedor"].includes(cargo)) {
    return "admin";
  }

  const mapa = {
    premium: "black30",
    black: "black30",
    mensal: "black30",
    blackmensal: "black30",
    trimestral: "black90",
    semestral: "black180",
    anual: "black360"
  };

  const normalizado = mapa[plano] || plano;
  const permitidos = ["free", "black30", "black90", "black180", "black360", "admin"];
  return permitidos.includes(normalizado) ? normalizado : "free";
}

function montarCompatibilidade(usuario) {
  const cargo = normalizarCargo(usuario.cargo, usuario.tipo);
  const plano = normalizarPlano(usuario.plano, cargo);
  const tipo = ["admin", "superadmin", "moderador", "suporte", "vendedor"].includes(cargo)
    ? "admin"
    : "aluno";

  return {
    ...usuario,
    tipo,
    cargo,
    plano,
    status: usuario.status || "ativo",
    aprovado: usuario.aprovado !== false || plano === "free",
    suspenso: Boolean(usuario.suspenso),
    vendedor: Boolean(usuario.vendedor || cargo === "vendedor" || cargo === "superadmin")
  };
}

function respostaUsuario(usuario) {
  const seguro = montarUsuarioSeguro(usuario);
  const permissoes = getPermissoes(seguro);

  return {
    ...seguro,
    permissoes,
    acessosRapidos: {
      dashboard: true,
      painelAdmin: Boolean(permissoes.painelAdmin),
      painelVendas: Boolean(permissoes.painelVendas),
      suporte: Boolean(permissoes.suporte)
    }
  };
}

async function loginCompativel(req, res) {
  try {
    const email = normalizarEmail(req.body?.email);
    const senha = String(req.body?.senha || "");

    if (!email || !senha) {
      return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        erro: "O banco de dados ainda está conectando. Aguarde alguns segundos e tente novamente.",
        codigo: "BANCO_INDISPONIVEL"
      });
    }

    const encontrado = await Usuario.findOne({ email }).lean();

    if (!encontrado || String(encontrado.senha) !== senha) {
      return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    }

    const usuario = montarCompatibilidade(encontrado);

    if (usuario.suspenso || usuario.status === "suspenso") {
      return res.status(403).json({ erro: "Sua conta está suspensa.", status: "suspenso" });
    }

    if (usuario.status === "bloqueado") {
      return res.status(403).json({ erro: "Sua conta está bloqueada.", status: "bloqueado" });
    }

    if (!usuario.aprovado && usuario.cargo !== "superadmin") {
      return res.status(403).json({
        erro: "Sua conta ainda está pendente de aprovação.",
        status: "pendente",
        aprovado: false
      });
    }

    const agora = new Date().toISOString();
    const atualizacoes = { ultimoLogin: agora };

    if (!encontrado.status || encontrado.status === "pendente") atualizacoes.status = "ativo";
    if (encontrado.aprovado === false && usuario.plano === "free" && usuario.cargo === "aluno") {
      atualizacoes.aprovado = true;
      atualizacoes.aprovadoEm = encontrado.aprovadoEm || agora;
    }

    await Usuario.updateOne(
      { _id: encontrado._id },
      {
        $inc: { acessos: 1 },
        $set: atualizacoes
      },
      { runValidators: false }
    );

    usuario.acessos = Number(encontrado.acessos || 0) + 1;
    usuario.ultimoLogin = agora;
    if (atualizacoes.status) usuario.status = atualizacoes.status;
    if (atualizacoes.aprovado) usuario.aprovado = true;

    const token = gerarToken(usuario);

    return res.json({
      sucesso: true,
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: respostaUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro no login compatível:", error);

    return res.status(500).json({
      erro: "Não foi possível concluir o login. Tente novamente em alguns instantes.",
      codigo: "LOGIN_INTERNO"
    });
  }
}

router.post("/login", loginCompativel);
router.post("/auth/login", loginCompativel);

module.exports = router;
