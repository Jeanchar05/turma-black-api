"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Usuario = require("../models/Usuario");
const database = require("../config/database");
const { sessionIsValid } = require("../services/sessions");
const { isDevAccount } = require("./permissions");

const JWT_ISSUER = "turma-do-primo";
const JWT_AUDIENCE = "turmablack.com.br";
const JWT_EXPIRES_IN = "24h";
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

function carregarJwtConfig() {
  const secret = String(process.env.JWT_SECRET || "").trim();
  const producao = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
  const placeholders = new Set([
    "turma_black_secret_dev",
    "troque-por-uma-chave-segura-e-unica",
    "troque-por-uma-chave-aleatoria-segura-com-32-ou-mais-caracteres",
    "changeme",
    "secret"
  ]);
  const invalidoEmProducao = producao && (
    secret.length < 32 || placeholders.has(secret.toLowerCase())
  );

  if (invalidoEmProducao) {
    console.error(
      "[SECURITY] JWT_SECRET ausente, fraco ou usando valor de exemplo. " +
      "O site público continuará online, mas autenticação e emissão de tokens permanecerão bloqueadas até a variável ser corrigida."
    );
    return { secret: "", valido: false, producao: true, tamanho: secret.length };
  }

  return {
    secret: secret || "turma_black_secret_dev",
    valido: true,
    producao,
    tamanho: secret.length
  };
}

const JWT_CONFIG = carregarJwtConfig();
const SECRET = JWT_CONFIG.secret;
const SESSION_COOKIE = "tp_page_session";

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

function lerCookies(req) {
  const header = String(req.headers?.cookie || "");
  const cookies = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try { cookies[key] = decodeURIComponent(value); }
    catch (_) { cookies[key] = value; }
  }
  return cookies;
}

function extrairTokenPagina(req) {
  return String(lerCookies(req)[SESSION_COOKIE] || "").trim() || null;
}

function definirCookieSessao(res, token) {
  const secure = JWT_CONFIG.producao ? "; Secure" : "";
  res.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(String(token || ""))}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}; Priority=High`
  );
}

function limparCookieSessao(res) {
  const secure = JWT_CONFIG.producao ? "; Secure" : "";
  res.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}; Priority=High`
  );
}

function normalizarCargo(usuario) {
  if (!usuario) return "aluno";
  if (isDevAccount(usuario)) return "dev";
  if (usuario.cargo) {
    const cargo = String(usuario.cargo).trim().toLowerCase().replaceAll("_", "-");
    return cargo === "dev" ? "aluno" : cargo;
  }
  if (usuario.tipo === "admin") return "admin";
  return "aluno";
}

function obterId(usuario) {
  return String(usuario?._id || usuario?.id || "");
}

function semPremium(motivo, expirado = false) {
  return {
    acessoPremium: false,
    planoAtivo: "free",
    planoExpirado: Boolean(expirado),
    diasRestantes: 0,
    motivoAcesso: motivo
  };
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

  if (cargo === "aluno" && usuario?.aprovado !== true) {
    return semPremium("nao-aprovado");
  }

  if (!PLANOS_PREMIUM.has(plano)) return semPremium("free");

  const expiracaoMs = new Date(usuario?.dataExpiracao || "").getTime();
  if (!Number.isFinite(expiracaoMs)) return semPremium("validade-invalida", true);

  const restanteMs = expiracaoMs - agoraMs;
  if (restanteMs <= 0) return semPremium("expirado", true);

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
  if (origem === "bestfy-webhook") return Math.abs(expLedger - expUsuario) <= 60000;
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

  if (cargo === "aluno" && PLANOS_PREMIUM.has(plano) && !estado.acessoPremium && estado.planoExpirado) {
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
    contaDev: Boolean(isDevAccount(usuario) && cargo === "dev"),
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
  if (!JWT_CONFIG.valido || !SECRET) return { erro: "JWT_NAO_CONFIGURADO" };

  let decoded;
  try {
    decoded = jwt.verify(token, SECRET, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
  } catch (_) {
    return { erro: "TOKEN_INVALIDO" };
  }

  const payload = decoded.usuario || decoded.user || decoded;
  const id = String(payload.id || payload._id || payload.usuarioId || "").trim();
  const email = String(payload.email || "").toLowerCase().trim();
  const jti = String(decoded.jti || payload.jti || "").trim();

  if (!jti || !id) return { erro: "TOKEN_LEGADO_RELOGIN" };

  const sessaoValida = await sessionIsValid({ jti, userId: id, iat: decoded.iat });
  if (!sessaoValida) return { erro: "TOKEN_REVOGADO" };

  let usuario = await Usuario.findById(id);
  if (!usuario && email) usuario = await Usuario.findOne({ email });

  if (usuario && obterId(usuario) !== id) return { erro: "TOKEN_IDENTIDADE_INVALIDA" };

  return { usuario, payload: decoded };
}

async function prepararUsuarioAutenticado(req, token) {
  const resultado = await localizarUsuarioPorToken(token);
  if (resultado.erro) return resultado;

  const usuario = resultado.usuario;
  if (!usuario) return { erro: "USUARIO_NAO_ENCONTRADO" };
  if (usuario.suspenso || usuario.status === "suspenso") return { erro: "USUARIO_SUSPENSO", status: 403 };
  if (usuario.status === "bloqueado") return { erro: "USUARIO_BLOQUEADO", status: 403 };
  if (usuario.cargo === "aluno" && usuario.aprovado !== true) return { erro: "USUARIO_NAO_APROVADO", status: 403 };

  await sincronizarExpiracaoPremium(usuario);
  req.usuarioDoc = usuario;
  req.usuario = montarUsuarioSeguro(usuario);
  req.authToken = token;
  req.authPayload = resultado.payload || null;
  return { usuario };
}

async function auth(req, res, next) {
  try {
    if (!JWT_CONFIG.valido) {
      return res.status(503).json({ erro: "Autenticação temporariamente indisponível por configuração de segurança do servidor.", codigo: "JWT_NAO_CONFIGURADO" });
    }

    const token = extrairToken(req);
    if (!token) return res.status(401).json({ erro: "Token não informado.", codigo: "TOKEN_AUSENTE" });

    const resultado = await prepararUsuarioAutenticado(req, token);
    if (resultado.erro) {
      const status = resultado.status || (resultado.erro === "JWT_NAO_CONFIGURADO" ? 503 : 401);
      return res.status(status).json({
        erro: status === 403 ? "Acesso à conta negado." : "Token inválido, expirado ou revogado.",
        codigo: resultado.erro
      });
    }

    return next();
  } catch (error) {
    console.error("Erro no middleware auth:", error);
    return res.status(500).json({ erro: "Erro interno de autenticação." });
  }
}

async function authOpcional(req, res, next) {
  try {
    if (!JWT_CONFIG.valido) {
      req.usuario = null;
      req.usuarioDoc = null;
      return next();
    }

    const token = extrairToken(req);
    if (!token) {
      req.usuario = null;
      req.usuarioDoc = null;
      return next();
    }

    const resultado = await prepararUsuarioAutenticado(req, token);
    if (resultado.erro) {
      req.usuario = null;
      req.usuarioDoc = null;
    }
    return next();
  } catch (_) {
    req.usuario = null;
    req.usuarioDoc = null;
    return next();
  }
}

async function authPagina(req, res, next) {
  try {
    if (!JWT_CONFIG.valido) return res.redirect(302, "/");
    const token = extrairTokenPagina(req);
    if (!token) return res.redirect(302, "/");
    const resultado = await prepararUsuarioAutenticado(req, token);
    if (resultado.erro) {
      limparCookieSessao(res);
      return res.redirect(302, "/");
    }
    return next();
  } catch (_) {
    limparCookieSessao(res);
    return res.redirect(302, "/");
  }
}

function requirePremium(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ erro: "Usuário não autenticado.", codigo: "USUARIO_NAO_AUTENTICADO" });
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

function requirePremiumPagina(req, res, next) {
  if (!req.usuario?.acessoPremium) return res.redirect(302, "/dashboard-free#premium");
  return next();
}

function gerarToken(usuario) {
  if (!JWT_CONFIG.valido || !SECRET) {
    const error = new Error("JWT_SECRET precisa ser configurado com pelo menos 32 caracteres seguros no ambiente de produção.");
    error.code = "JWT_NAO_CONFIGURADO";
    throw error;
  }

  const cargo = normalizarCargo(usuario);
  const id = obterId(usuario);
  if (!id) {
    const error = new Error("Não foi possível emitir sessão sem identidade de usuário.");
    error.code = "USUARIO_SEM_ID";
    throw error;
  }

  const jti = crypto.randomUUID();

  return jwt.sign(
    {
      id,
      email: usuario.email,
      nome: usuario.nome || "",
      tipo: usuario.tipo || "aluno",
      cargo,
      contaDev: Boolean(isDevAccount(usuario) && cargo === "dev"),
      vendedor: Boolean(usuario.vendedor || cargo === "vendedor"),
      plano: usuario.plano || "free",
      tokenVersion: 2
    },
    SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      algorithm: "HS256",
      jwtid: jti,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: id
    }
  );
}

function statusJwtConfiguracao() {
  return {
    jwtConfigurado: Boolean(JWT_CONFIG.valido && SECRET),
    producao: Boolean(JWT_CONFIG.producao),
    comprimentoMinimoAtendido: JWT_CONFIG.producao ? Number(JWT_CONFIG.tamanho || 0) >= 32 : true
  };
}

module.exports = {
  auth,
  authOpcional,
  authPagina,
  requirePremium,
  requirePremiumPagina,
  gerarToken,
  extrairToken,
  extrairTokenPagina,
  definirCookieSessao,
  limparCookieSessao,
  normalizarCargo,
  montarUsuarioSeguro,
  estadoAcessoPremium,
  sincronizarExpiracaoPremium,
  statusJwtConfiguracao
};
