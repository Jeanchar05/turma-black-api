"use strict";

const express = require("express");
const Usuario = require("../models/Usuario");
const database = require("../config/database");
const { gerarToken, montarUsuarioSeguro } = require("../middleware/auth");
const {
  getPermissoesEfetivas,
  getCargo
} = require("../middleware/permissions");

const router = express.Router();

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizarCargo(valor, tipo, contaDev = false) {
  if (contaDev) return "dev";

  const cargo = String(valor || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replace(/\s+/g, "-");

  const mapa = {
    "super-admin": "superadmin",
    administrador: "admin",
    proprietario: "dono",
    owner: "dono",
    developer: "dev",
    finance: "financeiro",
    seller: "vendedor",
    support: "suporte"
  };

  const normalizado = mapa[cargo] || cargo;
  const permitidos = [
    "aluno",
    "vendedor",
    "financeiro",
    "admin",
    "dono",
    "dev",
    "suporte",
    "moderador",
    "superadmin"
  ];

  if (permitidos.includes(normalizado)) return normalizado;
  return String(tipo || "").toLowerCase() === "admin" ? "admin" : "aluno";
}

function normalizarPlano(valor, cargo) {
  const plano = String(valor || "free")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (
    [
      "dev",
      "dono",
      "superadmin",
      "admin",
      "moderador",
      "suporte",
      "financeiro",
      "vendedor"
    ].includes(cargo)
  ) {
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
  const base = typeof usuario?.toObject === "function"
    ? usuario.toObject()
    : { ...usuario };

  const cargo = normalizarCargo(base.cargo, base.tipo, base.contaDev);
  const plano = normalizarPlano(base.plano, cargo);
  const administrativo = cargo !== "aluno";

  return {
    ...base,
    tipo: administrativo ? "admin" : "aluno",
    cargo,
    contaDev: Boolean(base.contaDev || cargo === "dev"),
    plano,
    status: base.status || "ativo",
    aprovado: base.aprovado !== false || plano === "free",
    suspenso: Boolean(base.suspenso),
    vendedor: Boolean(
      base.vendedor ||
      ["dev", "dono", "superadmin", "admin", "financeiro", "vendedor"].includes(cargo)
    )
  };
}

async function respostaUsuario(usuario) {
  const seguro = montarUsuarioSeguro(usuario);
  const permissoes = await getPermissoesEfetivas(usuario);

  return {
    ...seguro,
    cargo: getCargo(usuario),
    permissoes,
    acessosRapidos: {
      dashboard: Boolean(permissoes.dashboard),
      painelAdmin: Boolean(permissoes.painelAdmin),
      painelVendas: Boolean(permissoes.painelVendas),
      financas: Boolean(permissoes.financas),
      suporte: Boolean(permissoes.suporte),
      permissoesSistema: Boolean(permissoes.permissoesSistema)
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

    if (!database.isConnected()) {
      return res.status(503).json({
        erro: "O banco MySQL ainda está conectando. Aguarde alguns segundos e tente novamente.",
        codigo: "BANCO_INDISPONIVEL"
      });
    }

    const encontrado = await Usuario.findOne({ email });

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

    if (!usuario.aprovado && usuario.cargo !== "dev") {
      return res.status(403).json({
        erro: "Sua conta ainda está pendente de aprovação.",
        status: "pendente",
        aprovado: false
      });
    }

    const agora = new Date().toISOString();

    await Usuario.updateOne(
      { _id: encontrado._id },
      {
        $inc: { acessos: 1 },
        $set: {
          ultimoLogin: agora,
          status: usuario.status === "pendente" ? "ativo" : usuario.status
        }
      }
    );

    usuario.acessos = Number(encontrado.acessos || 0) + 1;
    usuario.ultimoLogin = agora;
    usuario.status = usuario.status === "pendente" ? "ativo" : usuario.status;

    const token = gerarToken(usuario);

    return res.json({
      sucesso: true,
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: await respostaUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro no login MySQL:", error);

    return res.status(500).json({
      erro: "Não foi possível concluir o login. Tente novamente em alguns instantes.",
      codigo: "LOGIN_INTERNO"
    });
  }
}

router.post("/login", loginCompativel);
router.post("/auth/login", loginCompativel);

module.exports = router;
