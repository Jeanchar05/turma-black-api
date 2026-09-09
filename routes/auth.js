"use strict";

const crypto = require("crypto");
const express = require("express");
require("../services/password-model-guard");
const Usuario = require("../models/Usuario");
const {
  hashPassword,
  verifyPassword,
  validatePasswordPolicy,
  MIN_USER_PASSWORD_LENGTH
} = require("../services/passwords");
const { revokeToken, revokeAllUserSessions } = require("../services/sessions");
const {
  loginRateLimit,
  loginIpRateLimit,
  signupRateLimit,
  webhookRateLimit,
  setupRateLimit
} = require("../middleware/rate-limit");

const {
  auth,
  gerarToken,
  montarUsuarioSeguro,
  definirCookieSessao,
  limparCookieSessao
} = require("../middleware/auth");
const { getPermissoesEfetivas, getCargo } = require("../middleware/permissions");
const {
  processarWebhookBestfy,
  aplicarCompraPendentePorEmail
} = require("../services/bestfy");

const router = express.Router();

function normalizarEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function emailValido(email) {
  return email.length <= 190 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function emailDevReservado(email) {
  const dev = normalizarEmail(process.env.DEV_EMAIL || "dev@turmablack.com");
  return Boolean(dev && email === dev);
}

function gerarCodigoAluno() {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numeros = "0123456789";
  let codigo = "TB-";

  for (let i = 0; i < 3; i += 1) codigo += letras[Math.floor(Math.random() * letras.length)];
  codigo += "-";
  for (let i = 0; i < 4; i += 1) codigo += numeros[Math.floor(Math.random() * numeros.length)];
  return codigo;
}

function compararSegredo(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (!aa.length || aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
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

async function criarConta(req, res) {
  try {
    const { nome, email, senha, telefone } = req.body || {};
    const nomeTexto = String(nome || "").trim().slice(0, 160);
    const emailNormalizado = normalizarEmail(email);
    const senhaTexto = String(senha || "");

    if (!nomeTexto || !emailNormalizado || !senhaTexto) {
      return res.status(400).json({ erro: "Nome, e-mail e senha são obrigatórios." });
    }

    if (!emailValido(emailNormalizado)) {
      return res.status(400).json({ erro: "Informe um e-mail válido." });
    }

    // A identidade Dev nunca pode nascer pelo cadastro público.
    if (emailDevReservado(emailNormalizado)) {
      return res.status(403).json({ erro: "Este e-mail não está disponível para cadastro público." });
    }

    const politicaSenha = validatePasswordPolicy(senhaTexto, {
      minimumLength: MIN_USER_PASSWORD_LENGTH,
      email: emailNormalizado,
      name: nomeTexto
    });
    if (!politicaSenha.valid) {
      return res.status(400).json({ erro: politicaSenha.reason, codigo: "SENHA_FRACA" });
    }

    if (await Usuario.exists({ email: emailNormalizado })) {
      return res.status(409).json({ erro: "Já existe uma conta cadastrada com este e-mail." });
    }

    const agora = new Date().toISOString();
    const usuario = await Usuario.create({
      nome: nomeTexto,
      email: emailNormalizado,
      senha: await hashPassword(senhaTexto),
      telefone: String(telefone || "").trim().slice(0, 40),
      tipo: "aluno",
      cargo: "aluno",
      contaDev: false,
      permissoesPersonalizadas: {},
      vendedor: false,
      comissao: 20,
      aprovado: true,
      suspenso: false,
      status: "ativo",
      codigo: "",
      plano: "free",
      dataExpiracao: "",
      acessos: 0,
      dispositivos: [],
      ultimoLogin: "",
      aprovadoEm: agora,
      criadoPor: "cadastro-online",
      atualizadoPor: "cadastro-online"
    });

    let compraBestfy = { aplicado: false };
    try {
      compraBestfy = await aplicarCompraPendentePorEmail(usuario);
    } catch (error) {
      console.warn("Conta criada, mas não foi possível consultar compra Bestfy pendente:", error.message);
    }

    return res.status(201).json({
      sucesso: true,
      mensagem: compraBestfy.aplicado
        ? "Conta criada e pagamento localizado. Seu acesso Premium foi liberado."
        : "Conta criada com sucesso. Faça login para acessar a plataforma.",
      premiumLiberado: Boolean(compraBestfy.aplicado),
      usuario: await respostaUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro ao criar conta:", error);
    return res.status(500).json({ erro: "Erro interno ao criar conta." });
  }
}

async function login(req, res) {
  try {
    const email = normalizarEmail(req.body?.email);
    const senha = String(req.body?.senha || "");

    if (!email || !senha) {
      return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });
    }

    const usuario = await Usuario.findOne({ email });
    const passwordCheck = usuario
      ? await verifyPassword(usuario.senha, senha)
      : { valid: false, needsRehash: false };

    if (!usuario || !passwordCheck.valid) {
      return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    }

    if (passwordCheck.needsRehash) {
      usuario.senha = senha;
      usuario.atualizadoPor = "migracao-senha-segura";
      await usuario.save();
    }

    if (usuario.suspenso || usuario.status === "suspenso") {
      return res.status(403).json({ erro: "Sua conta está suspensa.", status: "suspenso" });
    }

    if (usuario.status === "bloqueado") {
      return res.status(403).json({ erro: "Sua conta está bloqueada.", status: "bloqueado" });
    }

    try {
      await aplicarCompraPendentePorEmail(usuario);
    } catch (error) {
      console.warn("Não foi possível aplicar compra Bestfy pendente no login:", error.message);
    }

    if (!usuario.aprovado && usuario.plano === "free" && usuario.cargo === "aluno") {
      usuario.aprovado = true;
      usuario.status = "ativo";
      usuario.aprovadoEm = usuario.aprovadoEm || new Date().toISOString();
    }

    if (!usuario.aprovado && !usuario.contaDev) {
      return res.status(403).json({
        erro: "Sua conta ainda está pendente de aprovação.",
        status: "pendente",
        aprovado: false
      });
    }

    usuario.acessos = Number(usuario.acessos || 0) + 1;
    usuario.ultimoLogin = new Date().toISOString();
    usuario.status = usuario.status === "pendente" ? "ativo" : usuario.status;
    usuario.plano = usuario.plano || "free";
    await usuario.save({ validateModifiedOnly: true });

    const token = gerarToken(usuario);
    definirCookieSessao(res, token);

    return res.json({
      sucesso: true,
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: await respostaUsuario(usuario)
    });
  } catch (error) {
    console.error("Erro no login:", error);

    if (error?.code === "JWT_NAO_CONFIGURADO") {
      return res.status(503).json({
        erro: "Login temporariamente indisponível: a chave de segurança JWT do servidor precisa ser configurada.",
        codigo: "JWT_NAO_CONFIGURADO"
      });
    }

    return res.status(500).json({
      erro: "Não foi possível concluir o login. Tente novamente em alguns instantes.",
      codigo: "LOGIN_INTERNAL_ERROR"
    });
  }
}

async function me(req, res) {
  try {
    if (!req.usuarioDoc) return res.status(401).json({ erro: "Usuário não encontrado." });
    return res.json({ sucesso: true, usuario: await respostaUsuario(req.usuarioDoc) });
  } catch (error) {
    console.error("Erro na rota /me:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar usuário." });
  }
}

async function validarToken(req, res) {
  try {
    return res.json({ valido: true, usuario: await respostaUsuario(req.usuarioDoc) });
  } catch (_) {
    return res.status(500).json({ valido: false, erro: "Erro ao validar token." });
  }
}

async function logout(req, res) {
  try {
    const payload = req.authPayload || {};
    await revokeToken({
      jti: payload.jti,
      userId: req.usuario?.id || req.usuario?._id || "",
      exp: payload.exp,
      reason: "logout"
    });
    limparCookieSessao(res);
    return res.json({ sucesso: true, mensagem: "Logout realizado com sucesso." });
  } catch (error) {
    console.error("Erro ao revogar sessão no logout:", error);
    limparCookieSessao(res);
    return res.status(500).json({ erro: "Não foi possível encerrar a sessão com segurança." });
  }
}

router.post("/criar", signupRateLimit, criarConta);
router.post("/login", loginIpRateLimit, loginRateLimit, login);
router.get("/me", auth, me);
router.get("/validar-token", auth, validarToken);
router.post("/logout", auth, logout);

router.post("/auth/criar", signupRateLimit, criarConta);
router.post("/auth/login", loginIpRateLimit, loginRateLimit, login);
router.get("/auth/me", auth, me);
router.get("/auth/validar-token", auth, validarToken);
router.post("/auth/logout", auth, logout);

router.post("/webhooks/bestfy", webhookRateLimit, async (req, res) => {
  try {
    const resultado = await processarWebhookBestfy(req.body || {});
    return res.status(200).json({ sucesso: true, ...resultado });
  } catch (error) {
    const codigo = String(error?.code || "BESTFY_WEBHOOK_ERROR");
    console.error(`Erro no webhook Bestfy (${codigo}):`, error?.message || error);

    if (codigo === "BESTFY_WEBHOOK_INVALID") return res.status(400).json({ erro: error.message, codigo });
    if (codigo === "BESTFY_COMPANY_MISMATCH") return res.status(403).json({ erro: "Evento rejeitado.", codigo });
    if (codigo === "BESTFY_NOT_CONFIGURED" || codigo === "BESTFY_COMPANY_INVALID") {
      return res.status(503).json({ erro: "Integração Bestfy ainda não configurada no servidor.", codigo });
    }

    return res.status(503).json({ erro: "Não foi possível processar o evento Bestfy agora.", codigo });
  }
});

// Health check propositalmente não informa presença/ausência de chaves secretas.
router.get("/webhooks/bestfy/status", (_req, res) => {
  return res.json({ status: "online", integracao: "Bestfy", validacaoEstrita: true });
});

router.post("/setup/superadmin", setupRateLimit, async (req, res) => {
  try {
    const setupEnabled = String(process.env.ENABLE_SETUP_SUPERADMIN || "").trim().toLowerCase() === "true";
    const chaveCorreta = String(process.env.SETUP_SECRET || "").trim();

    if (!setupEnabled || !chaveCorreta || chaveCorreta.length < 32) {
      return res.status(404).json({ erro: "Rota não encontrada." });
    }

    if (!compararSegredo(req.body?.setupKey, chaveCorreta)) {
      return res.status(403).json({ erro: "Chave de setup inválida." });
    }

    const email = normalizarEmail(req.body?.email);
    if (!emailValido(email) || emailDevReservado(email)) {
      return res.status(400).json({ erro: "Conta inválida para promoção por setup." });
    }

    const usuario = await Usuario.findOne({ email });
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
    if (usuario.contaDev === true || getCargo(usuario) === "dev") {
      return res.status(403).json({ erro: "A conta Dev não pode ser alterada por esta rota." });
    }

    usuario.tipo = "admin";
    usuario.cargo = "dono";
    usuario.contaDev = false;
    usuario.vendedor = true;
    usuario.aprovado = true;
    usuario.status = usuario.status === "suspenso" || usuario.status === "bloqueado" ? usuario.status : "ativo";
    usuario.plano = "admin";
    usuario.dataExpiracao = "";
    usuario.codigo = usuario.codigo || gerarCodigoAluno();
    usuario.aprovadoEm = usuario.aprovadoEm || new Date().toISOString();
    usuario.atualizadoPor = "setup-dono";
    await usuario.save();
    await revokeAllUserSessions(String(usuario._id || usuario.id || ""), "setup-role-change");

    return res.json({
      sucesso: true,
      mensagem: "Usuário promovido para Dono com sucesso. Sessões anteriores foram encerradas; faça login novamente."
    });
  } catch (error) {
    console.error("Erro no setup dono:", error);
    return res.status(500).json({ erro: "Erro interno ao configurar Dono." });
  }
});

// Health check mínimo: não revela estado da chave JWT, detalhes do fluxo ou configuração de secrets.
router.get("/auth/status", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  return res.json({ status: "online", modulo: "auth" });
});

module.exports = router;
