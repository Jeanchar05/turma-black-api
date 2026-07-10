const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Usuario = require("../models/Usuario");

const SECRET = process.env.JWT_SECRET || "turma_black_secret_dev";

/* ===============================
   PEGAR TOKEN
=============================== */

function extrairToken(req) {
  const authHeader = req.headers.authorization || "";

  if (authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim();
  }

  if (req.headers["x-access-token"]) {
    return req.headers["x-access-token"];
  }

  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
}

/* ===============================
   NORMALIZAR USUÁRIO
=============================== */

function normalizarCargo(usuario) {
  if (!usuario) return "aluno";

  if (usuario.cargo) {
    return usuario.cargo;
  }

  if (usuario.tipo === "admin") {
    return "admin";
  }

  return "aluno";
}

function montarUsuarioSeguro(usuario) {
  const cargo = normalizarCargo(usuario);

  return {
    id: String(usuario._id),
    _id: usuario._id,
    nome: usuario.nome || "",
    email: usuario.email || "",
    tipo: usuario.tipo || "aluno",
    cargo,
    vendedor: Boolean(usuario.vendedor || cargo === "vendedor"),
    comissao: Number(usuario.comissao || 20),
    aprovado: Boolean(usuario.aprovado),
    suspenso: Boolean(usuario.suspenso),
    status: usuario.status || "pendente",
    plano: usuario.plano || "free",
    dataExpiracao: usuario.dataExpiracao || "",
    telefone: usuario.telefone || "",
    foto: usuario.foto || ""
  };
}

/* ===============================
   AUTH OBRIGATÓRIO
=============================== */

async function auth(req, res, next) {
  try {
    const token = extrairToken(req);

    if (!token) {
      return res.status(401).json({
        erro: "Token não informado.",
        codigo: "TOKEN_AUSENTE"
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, SECRET);
    } catch (error) {
      return res.status(401).json({
        erro: "Token inválido ou expirado.",
        codigo: "TOKEN_INVALIDO"
      });
    }

    const payload = decoded.usuario || decoded.user || decoded;

    const id = payload.id || payload._id || payload.usuarioId || "";
    const email = String(payload.email || "").toLowerCase().trim();

    let usuario = null;

    if (id && mongoose.Types.ObjectId.isValid(id)) {
      usuario = await Usuario.findById(id);
    }

    if (!usuario && email) {
      usuario = await Usuario.findOne({ email });
    }

    if (!usuario) {
      return res.status(401).json({
        erro: "Usuário não encontrado.",
        codigo: "USUARIO_NAO_ENCONTRADO"
      });
    }

    if (usuario.suspenso || usuario.status === "suspenso") {
      return res.status(403).json({
        erro: "Usuário suspenso.",
        codigo: "USUARIO_SUSPENSO"
      });
    }

    if (usuario.status === "bloqueado") {
      return res.status(403).json({
        erro: "Usuário bloqueado.",
        codigo: "USUARIO_BLOQUEADO"
      });
    }

    req.usuarioDoc = usuario;
    req.usuario = montarUsuarioSeguro(usuario);

    next();
  } catch (error) {
    console.error("Erro no middleware auth:", error);

    return res.status(500).json({
      erro: "Erro interno de autenticação."
    });
  }
}

/* ===============================
   AUTH OPCIONAL
=============================== */

async function authOpcional(req, res, next) {
  try {
    const token = extrairToken(req);

    if (!token) {
      req.usuario = null;
      req.usuarioDoc = null;
      return next();
    }

    let decoded;

    try {
      decoded = jwt.verify(token, SECRET);
    } catch (error) {
      req.usuario = null;
      req.usuarioDoc = null;
      return next();
    }

    const payload = decoded.usuario || decoded.user || decoded;

    const id = payload.id || payload._id || payload.usuarioId || "";
    const email = String(payload.email || "").toLowerCase().trim();

    let usuario = null;

    if (id && mongoose.Types.ObjectId.isValid(id)) {
      usuario = await Usuario.findById(id);
    }

    if (!usuario && email) {
      usuario = await Usuario.findOne({ email });
    }

    if (!usuario) {
      req.usuario = null;
      req.usuarioDoc = null;
      return next();
    }

    req.usuarioDoc = usuario;
    req.usuario = montarUsuarioSeguro(usuario);

    next();
  } catch (error) {
    req.usuario = null;
    req.usuarioDoc = null;
    next();
  }
}

/* ===============================
   GERAR TOKEN
=============================== */

function gerarToken(usuario) {
  const cargo = normalizarCargo(usuario);

  return jwt.sign(
    {
      id: String(usuario._id),
      email: usuario.email,
      nome: usuario.nome || "",
      tipo: usuario.tipo || "aluno",
      cargo,
      vendedor: Boolean(usuario.vendedor || cargo === "vendedor"),
      plano: usuario.plano || "free"
    },
    SECRET,
    {
      expiresIn: "7d"
    }
  );
}

module.exports = {
  auth,
  authOpcional,
  gerarToken,
  extrairToken,
  normalizarCargo,
  montarUsuarioSeguro
};
