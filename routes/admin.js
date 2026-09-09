"use strict";

const express = require("express");
const mongoose = require("mongoose");

const Usuario = require("../models/Usuario");
const Configuracao = require("../models/Configuracao");
const { revokeAllUserSessions } = require("../services/sessions");
const { audit } = require("../services/security-audit");
const { auth, montarUsuarioSeguro } = require("../middleware/auth");
const {
  requirePermission,
  requireSuperAdmin,
  getPermissoes,
  getCargo
} = require("../middleware/permissions");
const { sensitiveWriteRateLimit } = require("../middleware/rate-limit");

const router = express.Router();

function normalizarEmail(email) {
  return String(email || "").toLowerCase().trim().slice(0, 190);
}

function validarId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function statusConsulta(status) {
  const valor = String(status || "").toLowerCase().trim();
  return ["pendente", "ativo", "suspenso", "bloqueado"].includes(valor) ? valor : "";
}

function cargoConsulta(cargo) {
  const valor = String(cargo || "").toLowerCase().trim();
  return ["aluno", "vendedor", "suporte", "moderador", "admin", "superadmin", "dono", "financeiro"].includes(valor)
    ? valor
    : "";
}

function clampNumero(value, min, max, fallback) {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return fallback;
  return Math.min(Math.max(numero, min), max);
}

function texto(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function sanitizarJson(value, depth = 0) {
  if (depth > 6) return null;
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    if (typeof value === "string") return value.slice(0, 4000);
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizarJson(item, depth + 1));
  if (typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 100)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) continue;
      output[String(key).slice(0, 100)] = sanitizarJson(item, depth + 1);
    }
    return output;
  }
  return null;
}

async function buscarUsuario(identificador) {
  const valor = String(identificador || "").trim();
  if (!valor) return null;
  if (validarId(valor)) {
    const porId = await Usuario.findById(valor);
    if (porId) return porId;
  }
  const email = normalizarEmail(valor);
  if (email.includes("@")) {
    const porEmail = await Usuario.findOne({ email });
    if (porEmail) return porEmail;
  }
  return Usuario.findOne({ codigo: valor });
}

function formatarUsuarioAdmin(usuario) {
  if (!usuario) return null;
  const seguro = montarUsuarioSeguro(usuario);
  const permissoes = getPermissoes(usuario);
  return {
    ...seguro,
    codigo: usuario.codigo || "",
    permissoes,
    acessosRapidos: {
      dashboard: Boolean(permissoes.dashboard),
      painelAdmin: Boolean(permissoes.painelAdmin),
      painelVendas: Boolean(permissoes.painelVendas),
      suporte: Boolean(permissoes.suporte)
    },
    criadoPor: usuario.criadoPor || "",
    atualizadoPor: usuario.atualizadoPor || "",
    criadoEm: usuario.criadoEm || usuario.createdAt || "",
    aprovadoEm: usuario.aprovadoEm || "",
    ultimoLogin: usuario.ultimoLogin || "",
    createdAt: usuario.createdAt || "",
    updatedAt: usuario.updatedAt || ""
  };
}

function filtroEquipeAdmin() {
  return { cargo: { $in: ["dono", "superadmin", "admin", "financeiro", "moderador", "suporte", "vendedor"] } };
}

function filtroVendedores() {
  return {
    $or: [
      { vendedor: true },
      { cargo: "vendedor" },
      { cargo: "admin" },
      { cargo: "superadmin" },
      { cargo: "dono" }
    ]
  };
}

function alvoDev(usuario) {
  return Boolean(usuario?.contaDev === true || getCargo(usuario) === "dev");
}

router.get("/resumo", auth, requirePermission("painelAdmin"), async (_req, res) => {
  try {
    const [totalUsuarios, pendentes, ativos, suspensos, bloqueados, superadmins, admins, moderadores, suporte, vendedores] = await Promise.all([
      Usuario.countDocuments({ contaDev: { $ne: true } }),
      Usuario.countDocuments({ contaDev: { $ne: true }, status: "pendente" }),
      Usuario.countDocuments({ contaDev: { $ne: true }, status: "ativo" }),
      Usuario.countDocuments({ contaDev: { $ne: true }, status: "suspenso" }),
      Usuario.countDocuments({ contaDev: { $ne: true }, status: "bloqueado" }),
      Usuario.countDocuments({ cargo: "superadmin", contaDev: { $ne: true } }),
      Usuario.countDocuments({ cargo: "admin", contaDev: { $ne: true } }),
      Usuario.countDocuments({ cargo: "moderador", contaDev: { $ne: true } }),
      Usuario.countDocuments({ cargo: "suporte", contaDev: { $ne: true } }),
      Usuario.countDocuments({ ...filtroVendedores(), contaDev: { $ne: true } })
    ]);
    return res.json({ sucesso: true, resumo: { totalUsuarios, pendentes, ativos, suspensos, bloqueados, superadmins, admins, moderadores, suporte, vendedores } });
  } catch (error) {
    console.error("Erro no resumo admin:", error);
    return res.status(500).json({ erro: "Erro interno ao gerar resumo admin." });
  }
});

router.get("/meu-acesso", auth, async (req, res) => {
  try {
    const usuario = req.usuarioDoc || req.usuario;
    const permissoes = getPermissoes(usuario);
    return res.json({
      sucesso: true,
      usuario: montarUsuarioSeguro(usuario),
      cargo: getCargo(usuario),
      permissoes,
      acessosRapidos: {
        dashboard: Boolean(permissoes.dashboard),
        painelAdmin: Boolean(permissoes.painelAdmin),
        painelVendas: Boolean(permissoes.painelVendas),
        suporte: Boolean(permissoes.suporte),
        provas: Boolean(permissoes.provas)
      }
    });
  } catch (error) {
    console.error("Erro ao buscar meu acesso:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar acesso." });
  }
});

router.get("/permissoes", auth, requirePermission("painelAdmin"), async (req, res) => {
  try {
    const config = await Configuracao.obterConfiguracao();
    return res.json({
      sucesso: true,
      permissoes: sanitizarJson(config?.permissoes || {}),
      usuarioAtual: {
        cargo: getCargo(req.usuarioDoc || req.usuario),
        permissoes: getPermissoes(req.usuarioDoc || req.usuario)
      }
    });
  } catch (error) {
    console.error("Erro ao buscar permissões:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar permissões." });
  }
});

router.get("/controle-admins/resumo", auth, requirePermission("controleAdmin"), async (_req, res) => {
  try {
    const [total, superadmins, admins, moderadores, suporte, vendedores, ativos, suspensos, bloqueados] = await Promise.all([
      Usuario.countDocuments({ ...filtroEquipeAdmin(), contaDev: { $ne: true } }),
      Usuario.countDocuments({ cargo: "superadmin", contaDev: { $ne: true } }),
      Usuario.countDocuments({ cargo: "admin", contaDev: { $ne: true } }),
      Usuario.countDocuments({ cargo: "moderador", contaDev: { $ne: true } }),
      Usuario.countDocuments({ cargo: "suporte", contaDev: { $ne: true } }),
      Usuario.countDocuments({ ...filtroVendedores(), contaDev: { $ne: true } }),
      Usuario.countDocuments({ ...filtroEquipeAdmin(), contaDev: { $ne: true }, status: "ativo" }),
      Usuario.countDocuments({ ...filtroEquipeAdmin(), contaDev: { $ne: true }, status: "suspenso" }),
      Usuario.countDocuments({ ...filtroEquipeAdmin(), contaDev: { $ne: true }, status: "bloqueado" })
    ]);
    return res.json({ sucesso: true, resumo: { total, superadmins, admins, moderadores, suporte, vendedores, ativos, suspensos, bloqueados } });
  } catch (error) {
    console.error("Erro no resumo de controle admins:", error);
    return res.status(500).json({ erro: "Erro interno ao gerar resumo." });
  }
});

router.get("/controle-admins", auth, requirePermission("controleAdmin"), async (req, res) => {
  try {
    const filtro = { ...filtroEquipeAdmin(), contaDev: { $ne: true } };
    const busca = texto(req.query?.busca, 160);
    const cargo = cargoConsulta(req.query?.cargo);
    const status = statusConsulta(req.query?.status);
    if (busca) {
      filtro.$or = [
        { nome: { $regex: busca, $options: "i" } },
        { email: { $regex: busca, $options: "i" } },
        { codigo: { $regex: busca, $options: "i" } },
        { telefone: { $regex: busca, $options: "i" } }
      ];
    }
    if (cargo) filtro.cargo = cargo;
    if (status) filtro.status = status;
    if (req.query?.vendedor === "true") filtro.vendedor = true;
    if (req.query?.vendedor === "false") filtro.vendedor = false;

    const usuarios = await Usuario.find(filtro)
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(Number(req.query?.limite) || 300, 1), 500));
    return res.json({ sucesso: true, total: usuarios.length, admins: usuarios.map(formatarUsuarioAdmin), usuarios: usuarios.map(formatarUsuarioAdmin) });
  } catch (error) {
    console.error("Erro ao listar controle admins:", error);
    return res.status(500).json({ erro: "Erro interno ao listar admins." });
  }
});

router.get("/controle-admins/:id", auth, requirePermission("controleAdmin"), async (req, res) => {
  try {
    const usuario = await buscarUsuario(req.params.id);
    if (!usuario || alvoDev(usuario)) return res.status(404).json({ erro: "Admin não encontrado." });
    return res.json({ sucesso: true, admin: formatarUsuarioAdmin(usuario), usuario: formatarUsuarioAdmin(usuario) });
  } catch (error) {
    console.error("Erro ao buscar admin:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar admin." });
  }
});

router.get("/vendedores", auth, requirePermission("vendedores"), async (req, res) => {
  try {
    const filtro = { ...filtroVendedores(), contaDev: { $ne: true } };
    const busca = texto(req.query?.busca, 160);
    const status = statusConsulta(req.query?.status);
    if (busca) {
      filtro.$and = [{ $or: [
        { nome: { $regex: busca, $options: "i" } },
        { email: { $regex: busca, $options: "i" } },
        { telefone: { $regex: busca, $options: "i" } }
      ] }];
    }
    if (status) filtro.status = status;
    const vendedores = await Usuario.find(filtro).sort({ createdAt: -1 }).limit(Math.min(Math.max(Number(req.query?.limite) || 300, 1), 500));
    return res.json({ sucesso: true, total: vendedores.length, vendedores: vendedores.map(formatarUsuarioAdmin) });
  } catch (error) {
    console.error("Erro ao listar vendedores:", error);
    return res.status(500).json({ erro: "Erro interno ao listar vendedores." });
  }
});

router.get("/vendedores/resumo", auth, requirePermission("vendedores"), async (_req, res) => {
  try {
    const [total, ativos, suspensos, bloqueados, cargoVendedor, adminsVendedores] = await Promise.all([
      Usuario.countDocuments({ ...filtroVendedores(), contaDev: { $ne: true } }),
      Usuario.countDocuments({ ...filtroVendedores(), contaDev: { $ne: true }, status: "ativo" }),
      Usuario.countDocuments({ ...filtroVendedores(), contaDev: { $ne: true }, status: "suspenso" }),
      Usuario.countDocuments({ ...filtroVendedores(), contaDev: { $ne: true }, status: "bloqueado" }),
      Usuario.countDocuments({ cargo: "vendedor", contaDev: { $ne: true } }),
      Usuario.countDocuments({ cargo: { $in: ["dono", "admin", "superadmin"] }, vendedor: true, contaDev: { $ne: true } })
    ]);
    return res.json({ sucesso: true, resumo: { total, ativos, suspensos, bloqueados, cargoVendedor, adminsVendedores, comissaoPadrao: 20 } });
  } catch (error) {
    console.error("Erro no resumo vendedores:", error);
    return res.status(500).json({ erro: "Erro interno ao gerar resumo de vendedores." });
  }
});

async function sincronizarVendedores(req, res) {
  try {
    const alvo = await Usuario.find({
      cargo: { $in: ["dono", "superadmin", "admin", "vendedor"] },
      contaDev: { $ne: true }
    }).limit(500);

    for (const usuario of alvo) {
      const mudou = usuario.vendedor !== true || Number(usuario.comissao || 0) !== 20;
      if (!mudou) continue;
      usuario.vendedor = true;
      usuario.comissao = 20;
      usuario.atualizadoPor = req.usuario.email;
      await usuario.save();
      await revokeAllUserSessions(String(usuario._id || usuario.id || ""), "seller-permission-sync");
    }

    await audit(req, "seller.sync", { metadata: { total: alvo.length } });
    const vendedores = await Usuario.find({ ...filtroVendedores(), contaDev: { $ne: true } }).sort({ nome: 1 }).limit(500);
    return res.json({ sucesso: true, mensagem: "Vendedores sincronizados e sessões alteradas encerradas.", total: vendedores.length, vendedores: vendedores.map(formatarUsuarioAdmin) });
  } catch (error) {
    console.error("Erro ao sincronizar vendedores:", error);
    return res.status(500).json({ erro: "Erro interno ao sincronizar vendedores." });
  }
}

router.post("/vendedores/sincronizar", auth, sensitiveWriteRateLimit, requirePermission("vendedores"), sincronizarVendedores);
router.post("/controle-admins/sincronizar-vendedores", auth, sensitiveWriteRateLimit, requirePermission("controleAdmin"), sincronizarVendedores);

router.post("/vendedores/:id/comissao", auth, sensitiveWriteRateLimit, requirePermission("vendedores"), async (req, res) => {
  try {
    const vendedor = await buscarUsuario(req.params.id);
    if (!vendedor || alvoDev(vendedor)) return res.status(404).json({ erro: "Vendedor não encontrado." });
    vendedor.vendedor = true;
    vendedor.comissao = clampNumero(req.body?.comissao, 0, 100, Number(vendedor.comissao || 20));
    vendedor.atualizadoPor = req.usuario.email;
    await vendedor.save();
    await audit(req, "seller.commission-changed", { target: vendedor, metadata: { comissao: vendedor.comissao } });
    return res.json({ sucesso: true, mensagem: "Comissão atualizada com sucesso.", vendedor: formatarUsuarioAdmin(vendedor) });
  } catch (error) {
    console.error("Erro ao atualizar comissão:", error);
    return res.status(500).json({ erro: "Erro interno ao atualizar comissão." });
  }
});

router.post("/vendedores/:id/status", auth, sensitiveWriteRateLimit, requirePermission("vendedores"), async (req, res) => {
  try {
    const vendedor = await buscarUsuario(req.params.id);
    if (!vendedor || alvoDev(vendedor)) return res.status(404).json({ erro: "Vendedor não encontrado." });
    vendedor.vendedor = req.body?.ativo === true;
    vendedor.atualizadoPor = req.usuario.email;
    await vendedor.save();
    await revokeAllUserSessions(String(vendedor._id || vendedor.id || ""), "seller-status-changed");
    await audit(req, "seller.status-changed", { target: vendedor, metadata: { ativo: vendedor.vendedor } });
    return res.json({ sucesso: true, mensagem: vendedor.vendedor ? "Vendedor ativado com sucesso." : "Vendedor desativado e sessões encerradas.", vendedor: formatarUsuarioAdmin(vendedor) });
  } catch (error) {
    console.error("Erro ao alterar status vendedor:", error);
    return res.status(500).json({ erro: "Erro interno ao alterar vendedor." });
  }
});

router.get("/configuracao", auth, requirePermission("painelAdmin"), async (_req, res) => {
  try {
    const config = await Configuracao.obterConfiguracao();
    return res.json({ sucesso: true, configuracao: sanitizarJson(config?.toObject ? config.toObject() : config) });
  } catch (error) {
    console.error("Erro ao buscar configuração:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar configuração." });
  }
});

router.put("/configuracao", auth, sensitiveWriteRateLimit, requireSuperAdmin, async (req, res) => {
  try {
    const serialized = JSON.stringify(req.body || {});
    if (Buffer.byteLength(serialized, "utf8") > 64 * 1024) return res.status(413).json({ erro: "Configuração muito grande." });

    const config = await Configuracao.obterConfiguracao();
    const camposPermitidos = [
      "nomeSistema", "nomePremium", "temaPadrao", "modoManutencao",
      "manutencaoTitulo", "manutencaoMensagem", "previsaoRetorno",
      "comissaoPadrao", "moeda", "planos", "vendas", "notificacoes", "links"
    ];

    for (const campo of camposPermitidos) {
      if (req.body?.[campo] !== undefined) config[campo] = sanitizarJson(req.body[campo]);
    }
    config.atualizadoPor = req.usuario.email;
    await config.save();
    await audit(req, "system.configuration-updated", { metadata: { campos: camposPermitidos.filter((campo) => req.body?.[campo] !== undefined).join(",") } });
    return res.json({ sucesso: true, mensagem: "Configuração atualizada com sucesso.", configuracao: sanitizarJson(config?.toObject ? config.toObject() : config) });
  } catch (error) {
    console.error("Erro ao atualizar configuração:", error);
    return res.status(500).json({ erro: "Erro interno ao atualizar configuração." });
  }
});

router.post("/manutencao/ativar", auth, sensitiveWriteRateLimit, requireSuperAdmin, async (req, res) => {
  try {
    const config = await Configuracao.obterConfiguracao();
    await config.ativarManutencao({
      titulo: texto(req.body?.titulo, 160),
      mensagem: texto(req.body?.mensagem, 2000),
      previsaoRetorno: texto(req.body?.previsaoRetorno, 80),
      atualizadoPor: req.usuario.email
    });
    await audit(req, "system.maintenance-enabled");
    return res.json({ sucesso: true, mensagem: "Modo manutenção ativado." });
  } catch (error) {
    console.error("Erro ao ativar manutenção:", error);
    return res.status(500).json({ erro: "Erro interno ao ativar manutenção." });
  }
});

router.post("/manutencao/desativar", auth, sensitiveWriteRateLimit, requireSuperAdmin, async (req, res) => {
  try {
    const config = await Configuracao.obterConfiguracao();
    await config.desativarManutencao(req.usuario.email);
    await audit(req, "system.maintenance-disabled");
    return res.json({ sucesso: true, mensagem: "Modo manutenção desativado." });
  } catch (error) {
    console.error("Erro ao desativar manutenção:", error);
    return res.status(500).json({ erro: "Erro interno ao desativar manutenção." });
  }
});

router.get("/status", (_req, res) => res.json({ status: "online", modulo: "admin" }));

module.exports = router;
