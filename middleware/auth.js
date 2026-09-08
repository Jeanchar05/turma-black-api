"use strict";

const jwt = require("jsonwebtoken");
const Usuario = require("../models/Usuario");
const database = require("../config/database");

const SECRET = process.env.JWT_SECRET || "turma_black_secret_dev";

const PLANOS_PREMIUM = new Set(["black30", "black90", "black180", "black360"]);
const PLANOS_BESTFY = Object.freeze({
  black30: { valorCentavos: 9999 },
  black180: { valorCentavos: 24999 },
  black360: { valorCentavos: 39700 }
});
const CARGOS_ACESSO_TOTAL = new Set([
  "dev",
  "dono",
  "superadmin",
  "admin",
  "financeiro",
  "vendedor",
  "moderador",
  "suporte"
]);

function extrairToken(req) {
  const authHeader = req.headers.authorization || "";

  if (authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim();
  }

  if (req.headers["x-access-token"]) {
    return String(req.headers["x-access-token"]).trim();
  }

  return null;
}

function normalizarCargo(usuario) {
  if (!usuario) return "aluno";
  if (usuario.contaDev === true) return "dev";
  if (usuario.cargo) return String(usuario.cargo).trim().toLowerCase().replaceAll("_", "-");
  if (usuario.tipo === "admin") return "admin";
  return "aluno";
}

function obterId(usuario) {
  return String(usuario?._id || usuario?.id || "");
}

function estadoAcessoPremium(usuario, agoraMs = Date.now()) {
  const cargo = normalizarCargo(usuario);
  const plano = String(usuario?.plano || "free").trim().toLowerCase();

  if (CARGOS_ACESSO_TOTAL.has(cargo)) {
    return {
      acessoPremium: true,
      planoAtivo: plano === "free" ? "admin" : plano,
      planoExpirado: false,
      diasRestantes: null,
      motivoAcesso: "equipe"
    };
  }

  if (!PLANOS_PREMIUM.has(plano)) {
    return {
      acessoPremium: false,
      planoAtivo: "free",
      planoExpirado: false,
      diasRestantes: 0,
      motivoAcesso: "free"
    };
  }

  const expiracaoMs = new Date(usuario?.dataExpiracao || "").getTime();

  if (!Number.isFinite(expiracaoMs)) {
    return {
      acessoPremium: false,
      planoAtivo: "free",
      planoExpirado: true,
      diasRestantes: 0,
      motivoAcesso: "validade-invalida"
    };
  }

  const restanteMs = expiracaoMs - agoraMs;
  if (restanteMs <= 0) {
    return {
      acessoPremium: false,
      planoAtivo: "free",
      planoExpirado: true,
      diasRestantes: 0,
      motivoAcesso: "expirado"
    };
  }

  return {
    acessoPremium: true,
    planoAtivo: plano,
    planoExpirado: false,
    diasRestantes: Math.max(1, Math.ceil(restanteMs / 86400000)),
    motivoAcesso: "plano-pago"
  };
}

async function validarLedgerBestfyLocal(usuario) {
  const transactionId = String(usuario?.bestfyTransactionId || "").trim();
  const plano = String(usuario?.plano || "").trim().toLowerCase();
  const esperado = PLANOS_BESTFY[plano];

  if (!transactionId || !esperado) return true;

  const rows = await database.query(
    `SELECT transaction_id, status, customer_email, plan, amount_cents,
            verified_at, applied_at, access_expires_at, revoked_at
       FROM bestfy_transactions
      WHERE transaction_id = ?
      LIMIT 1`,
    [transactionId]
  );

  const registro = rows[0] || null;
  if (!registro) return false;

  if (String(registro.status || "").trim().toUpperCase() !== "PAID") return false;
  if (!registro.verified_at || !registro.applied_at || registro.revoked_at) return false;
  if (String(registro.plan || "").trim().toLowerCase() !== plano) return false;
  if (Number(registro.amount_cents || 0) !== esperado.valorCentavos) return false;

  const emailRegistro = String(registro.customer_email || "").trim().toLowerCase();
  const emailUsuario = String(usuario?.email || "").trim().toLowerCase();
  if (!emailRegistro || emailRegistro !== emailUsuario) return false;

  const expLedger = new Date(registro.access_expires_at || "").getTime();
  const expUsuario = new Date(usuario?.dataExpiracao || "").getTime();
  const agora = Date.now();
  if (!Number.isFinite(expLedger) || !Number.isFinite(expUsuario)) return false;
  if (expLedger <= agora - 60000 || expUsuario <= agora) return false;

  const origem = String(usuario?.atualizadoPor || "").trim().toLowerCase();

  if (origem === "bestfy-webhook") {
    return Math.abs(expLedger - expUsuario) <= 60000;
  }

  return expUsuario + 60000 >= expLedger;
}

async function revogarAcessoInvalido(usuario, motivo) {
  usuario.plano = "free";
  usuario.dataExpiracao = "";
  usuario.bestfyTransactionId = "";
  usuario.bestfyStatus = motivo || "ACCESS_REVOKED";
  usuario.bestfyRevokedAt = new Date().toISOString();
  usuario.atualizadoPor = "seguranca-acesso";
  await usuario.save({ validateModifiedOnly: true });
}

async function sincronizarExpiracaoPremium(usuario) {
  if (!usuario) return estadoAcessoPremium(usuario);

  let estado = estadoAcessoPremium(usuario);
  const cargo = normalizarCargo(usuario);
  const plano = String(usuario.plano || "free").trim().toLowerCase();

  if (cargo === "aluno" && PLANOS_PREMIUM.has(plano) && estado.acessoPremium) {
    const possuiBestfy = Boolean(String(usuario.bestfyTransactionId || "").trim());
    if (possuiBestfy && PLANOS_BESTFY[plano]) {
      const ledgerValido = await validarLedgerBestfyLocal(usuario);
      if (!ledgerValido) {
        await revogarAcessoInvalido(usuario, "BESTFY_LEDGER_INVALID");
        return estadoAcessoPremium(usuario);
      }
    }
  }

  estado = estadoAcessoPremium(usuario);

  if (
    cargo === "aluno" &&
    PLANOS_PREMIUM.has(plano) &&
    !estado.acessoPremium
  ) {
    await revogarAcessoInvalido(usuario, "PLAN_EXPIRED");
    return estadoAcessoPremium(usuario);
  }

  return estado;
}

function montarUsuarioSeguro(usuario) {
  const cargo = normalizarCargo(usuario);
  const id = obterId(usuario);
  const acesso = estadoAcessoPremium(usuario);

  return {
    id,
    _id: id,
    nome: usuario.nome || "",
    email: usuario.email || "",
    tipo: usuario.tipo || "aluno",
    cargo,
    contaDev: Boolean(usuario.contaDev || cargo === "dev"),
    permissoesPersonalizadas: usuario.permissoesPersonalizadas || {},
    vendedor: Boolean(usuario.vendedor || cargo === "vendedor"),
    comissao: Number(usuario.comissao || 20),
    aprovado: Boolean(usuario.aprovado),
    suspenso: Boolean(usuario.suspenso),
    status: usuario.status || "pendente",
    plano: usuario.plano || "free",
    dataExpiracao: usuario.dataExpiracao || "",
    acessoPremium: acesso.acessoPremium,
    planoAtivo: acesso.planoAtivo,
    planoExpirado: acesso.planoExpirado,
    diasRestantes: acesso.diasRestantes,
    motivoAcesso: acesso.motivoAcesso,
    telefone: usuario.telefone || "",
    foto: usuario.foto || ""
  };
}

async function localizarUsuarioPorToken(token) {
  let decoded;

  try {
    decoded = jwt.verify(token, SECRET);
  } catch (_) {
    return { erro: "TOKEN_INVALIDO" };
  }

  const payload = decoded.usuario || decoded.user || decoded;
  const id = String(payload.id || payload._id || payload.usuarioId || "").trim();
  const email = String(payload.email || "").toLowerCase().trim();

  let usuario = null;

  if (id) {
    usuario = await Usuario.findById(id);
  }

  if (!usuario && email) {
    usuario = await Usuario.findOne({ email });
  }

  return { usuario };
}

async function auth(req, res, next) {
  try {
    const token = extrairToken(req);

    if (!token) {
      return res.status(401).json({
        erro: "Token não informado.",
        codigo: "TOKEN_AUSENTE"
      });
    }

    const resultado = await localizarUsuarioPorToken(token);

    if (resultado.erro) {
      return res.status(401).json({
        erro: "Token inválido ou expirado.",
        codigo: resultado.erro
      });
    }

    const usuario = resultado.usuario;

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

    await sincronizarExpiracaoPremium(usuario);

    req.usuarioDoc = usuario;
    req.usuario = montarUsuarioSeguro(usuario);
    return next();
  } catch (error) {
    console.error("Erro no middleware auth:", error);
    return res.status(500).json({ erro: "Erro interno de autenticação." });
  }
}

async function authOpcional(req, res, next) {
  try {
    const token = extrairToken(req);

    if (!token) {
      req.usuario = null;
      req.usuarioDoc = null;
      return next();
    }

    const resultado = await localizarUsuarioPorToken(token);
    const usuario = resultado.usuario;

    if (!usuario) {
      req.usuario = null;
      req.usuarioDoc = null;
      return next();
    }

    await sincronizarExpiracaoPremium(usuario);
    req.usuarioDoc = usuario;
    req.usuario = montarUsuarioSeguro(usuario);
    return next();
  } catch (_) {
    req.usuario = null;
    req.usuarioDoc = null;
    return next();
  }
}

function requirePremium(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({
      erro: "Usuário não autenticado.",
      codigo: "USUARIO_NAO_AUTENTICADO"
    });
  }

  if (!req.usuario.acessoPremium) {
    return res.status(403).json({
      erro: "Este recurso exige um plano Premium ativo.",
      codigo: req.usuario.planoExpirado ? "PLANO_EXPIRADO" : "PLANO_PREMIUM_NECESSARIO",
      plano: req.usuario.planoAtivo || "free",
      diasRestantes: req.usuario.diasRestantes || 0
    });
  }

  return next();
}

function gerarToken(usuario) {
  const cargo = normalizarCargo(usuario);
  const id = obterId(usuario);

  return jwt.sign(
    {
      id,
      email: usuario.email,
      nome: usuario.nome || "",
      tipo: usuario.tipo || "aluno",
      cargo,
      contaDev: Boolean(usuario.contaDev || cargo === "dev"),
      vendedor: Boolean(usuario.vendedor || cargo === "vendedor"),
      plano: usuario.plano || "free"
    },
    SECRET,
    { expiresIn: "7d" }
  );
}

module.exports = {
  auth,
  authOpcional,
  requirePremium,
  gerarToken,
  extrairToken,
  normalizarCargo,
  montarUsuarioSeguro,
  estadoAcessoPremium,
  sincronizarExpiracaoPremium
};