"use strict";

const express = require("express");
const mongoose = require("mongoose");

const Usuario = require("../models/Usuario");
const { revokeAllUserSessions } = require("../services/sessions");
const { auth, montarUsuarioSeguro } = require("../middleware/auth");
const {
  requirePermission,
  requireSuperAdmin,
  getPermissoes
} = require("../middleware/permissions");

const router = express.Router();

const PLANOS_DIAS = Object.freeze({
  free: 0,
  black30: 30,
  black90: 90,
  black180: 180,
  black360: 365,
  admin: 0
});
const STATUS_VALIDOS = new Set(["ativo", "pendente", "suspenso", "bloqueado"]);

function normalizarEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function hojeISO() {
  return new Date().toISOString();
}

function somarDiasSeguro(dataBase, dias) {
  const quantidade = Number(dias);
  if (!Number.isInteger(quantidade) || quantidade <= 0 || !Object.values(PLANOS_DIAS).includes(quantidade)) {
    throw new Error("Quantidade de dias não autorizada.");
  }
  const data = new Date(dataBase);
  if (Number.isNaN(data.getTime())) throw new Error("Data base inválida.");
  data.setUTCDate(data.getUTCDate() + quantidade);
  return data.toISOString();
}

function dataBasePlano(usuario) {
  const agora = new Date();
  const atual = new Date(usuario?.dataExpiracao || "");
  if (!Number.isNaN(atual.getTime()) && atual > agora) return atual;
  return agora;
}

function normalizarPlano(plano) {
  const valor = String(plano || "").toLowerCase().trim();
  const mapa = {
    free: "free",
    gratis: "free",
    gratuito: "free",
    premium: "black30",
    black: "black30",
    turma_black: "black30",
    turmablack: "black30",
    mensal: "black30",
    black30: "black30",
    trimestral: "black90",
    black90: "black90",
    semestral: "black180",
    black180: "black180",
    anual: "black360",
    black360: "black360",
    admin: "admin"
  };
  return mapa[valor] || "";
}

function normalizarCargo(cargo) {
  const valor = String(cargo || "").toLowerCase().trim();
  const permitidos = ["aluno", "vendedor", "suporte", "moderador", "admin", "superadmin"];
  return permitidos.includes(valor) ? valor : "aluno";
}

function limparUsuario(usuario) {
  if (!usuario) return null;
  const seguro = montarUsuarioSeguro(usuario);
  return {
    ...seguro,
    codigo: usuario.codigo || "",
    criadoEm: usuario.criadoEm || usuario.createdAt || "",
    createdAt: usuario.createdAt || "",
    updatedAt: usuario.updatedAt || "",
    aprovadoEm: usuario.aprovadoEm || "",
    ultimoLogin: usuario.ultimoLogin || "",
    permissoes: getPermissoes(seguro)
  };
}

async function buscarUsuarioPorIdentificador(identificador) {
  const valor = String(identificador || "").trim();
  if (!valor) return null;

  if (mongoose.Types.ObjectId.isValid(valor)) {
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

function gerarCodigoAluno() {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numeros = "0123456789";
  let codigo = "TB-";
  for (let i = 0; i < 3; i += 1) codigo += letras[Math.floor(Math.random() * letras.length)];
  codigo += "-";
  for (let i = 0; i < 4; i += 1) codigo += numeros[Math.floor(Math.random() * numeros.length)];
  return codigo;
}

function contaRestrita(usuario) {
  return Boolean(usuario?.suspenso) || ["suspenso", "bloqueado"].includes(String(usuario?.status || "").toLowerCase());
}

async function revogarSessoes(usuario, motivo) {
  try {
    await revokeAllUserSessions(String(usuario?._id || usuario?.id || ""), motivo);
  } catch (error) {
    console.error("Falha ao revogar sessões do usuário:", error.message);
    throw error;
  }
}

router.get("/usuarios", auth, requirePermission("usuarios"), async (req, res) => {
  try {
    const { busca = "", status = "", cargo = "", plano = "", aprovado = "", limite = 200 } = req.query;
    const filtro = {};
    if (busca) {
      const termo = String(busca).trim().slice(0, 160);
      filtro.$or = [
        { nome: { $regex: termo, $options: "i" } },
        { email: { $regex: termo, $options: "i" } },
        { codigo: { $regex: termo, $options: "i" } },
        { telefone: { $regex: termo, $options: "i" } }
      ];
    }
    if (status) filtro.status = String(status).slice(0, 30);
    if (cargo) filtro.cargo = String(cargo).slice(0, 30);
    if (plano) filtro.plano = String(plano).slice(0, 30);
    if (aprovado === "true") filtro.aprovado = true;
    if (aprovado === "false") filtro.aprovado = false;

    const usuarios = await Usuario.find(filtro)
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(Number(limite) || 200, 1), 500));

    return res.json({ sucesso: true, total: usuarios.length, usuarios: usuarios.map(limparUsuario) });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    return res.status(500).json({ erro: "Erro interno ao listar usuários." });
  }
});

router.get("/usuarios/resumo", auth, requirePermission("usuarios"), async (_req, res) => {
  try {
    const [total, aprovados, pendentes, suspensos, bloqueados, admins, vendedores, suporte, moderadores] = await Promise.all([
      Usuario.countDocuments(),
      Usuario.countDocuments({ aprovado: true }),
      Usuario.countDocuments({ status: "pendente" }),
      Usuario.countDocuments({ status: "suspenso" }),
      Usuario.countDocuments({ status: "bloqueado" }),
      Usuario.countDocuments({ cargo: { $in: ["admin", "superadmin"] } }),
      Usuario.countDocuments({ $or: [{ vendedor: true }, { cargo: "vendedor" }] }),
      Usuario.countDocuments({ cargo: "suporte" }),
      Usuario.countDocuments({ cargo: "moderador" })
    ]);
    return res.json({ sucesso: true, resumo: { total, aprovados, pendentes, suspensos, bloqueados, admins, vendedores, suporte, moderadores } });
  } catch (error) {
    console.error("Erro ao gerar resumo de usuários:", error);
    return res.status(500).json({ erro: "Erro interno ao gerar resumo." });
  }
});

router.get("/usuario/:identificador", auth, requirePermission("usuarios"), async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorIdentificador(req.params.identificador);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
    return res.json({ sucesso: true, usuario: limparUsuario(usuario) });
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar usuário." });
  }
});

router.post("/aprovar", auth, requirePermission("aprovacoes"), async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorIdentificador(req.body?.email || req.body?.id || req.body?.codigo);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
    if (contaRestrita(usuario)) {
      return res.status(409).json({ erro: "A conta está suspensa ou bloqueada. Use a ação explícita de reativação antes de aprovar." });
    }

    const planoFinal = normalizarPlano(req.body?.plano || usuario.plano || "black30");
    if (!planoFinal) return res.status(400).json({ erro: "Plano inválido." });
    const diasPlano = PLANOS_DIAS[planoFinal];

    usuario.aprovado = true;
    usuario.status = "ativo";
    usuario.aprovadoEm = usuario.aprovadoEm || hojeISO();
    usuario.plano = planoFinal;

    if (diasPlano > 0) usuario.dataExpiracao = somarDiasSeguro(dataBasePlano(usuario), diasPlano);
    else usuario.dataExpiracao = "";

    if (!usuario.codigo) usuario.codigo = gerarCodigoAluno();
    usuario.atualizadoPor = req.usuario.email;
    await usuario.save();

    return res.json({ sucesso: true, mensagem: "Usuário aprovado com sucesso.", diasLiberados: diasPlano, usuario: limparUsuario(usuario) });
  } catch (error) {
    console.error("Erro ao aprovar usuário:", error);
    return res.status(500).json({ erro: "Erro interno ao aprovar usuário." });
  }
});

router.post("/usuario/plano", auth, requirePermission("planos"), async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorIdentificador(req.body?.email || req.body?.id || req.body?.codigo);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

    const planoFinal = normalizarPlano(req.body?.plano);
    if (!planoFinal) return res.status(400).json({ erro: "Plano inválido." });
    const diasPlano = PLANOS_DIAS[planoFinal];

    usuario.plano = planoFinal;
    if (diasPlano > 0) {
      usuario.dataExpiracao = somarDiasSeguro(dataBasePlano(usuario), diasPlano);
      usuario.aprovado = true;
    } else {
      usuario.dataExpiracao = "";
      if (planoFinal === "admin") usuario.aprovado = true;
    }

    // Alterar assinatura nunca remove suspensão/bloqueio. Estado disciplinar é separado.
    usuario.atualizadoPor = req.usuario.email;
    await usuario.save();

    return res.json({ sucesso: true, mensagem: "Plano atualizado com sucesso.", diasLiberados: diasPlano, usuario: limparUsuario(usuario) });
  } catch (error) {
    console.error("Erro ao alterar plano:", error);
    return res.status(500).json({ erro: "Erro interno ao alterar plano." });
  }
});

router.post("/suspender", auth, requirePermission("usuarios"), async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorIdentificador(req.body?.email || req.body?.id || req.body?.codigo);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
    if (["superadmin", "dono", "dev"].includes(String(usuario.cargo || "").toLowerCase())) {
      return res.status(403).json({ erro: "Não é permitido suspender esta conta administrativa por esta rota." });
    }

    usuario.suspenso = true;
    usuario.status = "suspenso";
    usuario.atualizadoPor = req.usuario.email;
    if (req.body?.motivo) usuario.observacaoSuspensao = String(req.body.motivo).slice(0, 1000);
    await usuario.save();
    await revogarSessoes(usuario, "account-suspended");

    return res.json({ sucesso: true, mensagem: "Usuário suspenso com sucesso e sessões encerradas.", usuario: limparUsuario(usuario) });
  } catch (error) {
    console.error("Erro ao suspender usuário:", error);
    return res.status(500).json({ erro: "Erro interno ao suspender usuário." });
  }
});

router.post("/reativar", auth, requirePermission("usuarios"), async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorIdentificador(req.body?.email || req.body?.id || req.body?.codigo);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

    usuario.suspenso = false;
    usuario.status = "ativo";
    usuario.aprovado = true;
    usuario.atualizadoPor = req.usuario.email;
    if (!usuario.aprovadoEm) usuario.aprovadoEm = hojeISO();
    await usuario.save();

    return res.json({ sucesso: true, mensagem: "Usuário reativado com sucesso. Um novo login será necessário.", usuario: limparUsuario(usuario) });
  } catch (error) {
    console.error("Erro ao reativar usuário:", error);
    return res.status(500).json({ erro: "Erro interno ao reativar usuário." });
  }
});

router.post("/usuario/bloquear", auth, requirePermission("usuarios"), async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorIdentificador(req.body?.email || req.body?.id || req.body?.codigo);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
    if (["superadmin", "dono", "dev"].includes(String(usuario.cargo || "").toLowerCase())) {
      return res.status(403).json({ erro: "Não é permitido bloquear esta conta administrativa por esta rota." });
    }

    usuario.status = "bloqueado";
    usuario.suspenso = true;
    usuario.atualizadoPor = req.usuario.email;
    await usuario.save();
    await revogarSessoes(usuario, "account-blocked");

    return res.json({ sucesso: true, mensagem: "Usuário bloqueado com sucesso e sessões encerradas.", usuario: limparUsuario(usuario) });
  } catch (error) {
    console.error("Erro ao bloquear usuário:", error);
    return res.status(500).json({ erro: "Erro interno ao bloquear usuário." });
  }
});

router.put("/usuario/:identificador", auth, requirePermission("usuarios"), async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorIdentificador(req.params.identificador);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

    if (req.body?.nome !== undefined) usuario.nome = String(req.body.nome).trim().slice(0, 160);
    if (req.body?.telefone !== undefined) usuario.telefone = String(req.body.telefone).trim().slice(0, 40);
    if (req.body?.foto !== undefined) usuario.foto = String(req.body.foto).trim().slice(0, 2000);
    if (req.body?.codigo !== undefined) usuario.codigo = String(req.body.codigo).trim().slice(0, 80);
    if (req.body?.aprovado !== undefined) usuario.aprovado = Boolean(req.body.aprovado);

    let securityStateChanged = false;
    if (req.body?.status !== undefined) {
      const status = String(req.body.status).toLowerCase();
      if (!STATUS_VALIDOS.has(status)) return res.status(400).json({ erro: "Status inválido." });
      usuario.status = status;
      usuario.suspenso = status === "suspenso" || status === "bloqueado";
      securityStateChanged = usuario.suspenso;
    } else if (req.body?.suspenso !== undefined) {
      usuario.suspenso = Boolean(req.body.suspenso);
      if (usuario.suspenso) {
        usuario.status = "suspenso";
        securityStateChanged = true;
      }
    }

    usuario.atualizadoPor = req.usuario.email;
    await usuario.save();
    if (securityStateChanged) await revogarSessoes(usuario, "account-security-state-change");

    return res.json({ sucesso: true, mensagem: "Usuário atualizado com sucesso.", usuario: limparUsuario(usuario) });
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    return res.status(500).json({ erro: "Erro interno ao atualizar usuário." });
  }
});

router.post("/usuario/cargo", auth, requireSuperAdmin, async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorIdentificador(req.body?.email || req.body?.id || req.body?.codigo);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

    const cargoFinal = normalizarCargo(req.body?.cargo);
    usuario.cargo = cargoFinal;
    usuario.tipo = cargoFinal === "aluno" || cargoFinal === "vendedor" ? "aluno" : "admin";
    usuario.vendedor = cargoFinal === "vendedor" ? true : req.body?.vendedor !== undefined ? Boolean(req.body.vendedor) : usuario.vendedor;
    if (req.body?.comissao !== undefined) usuario.comissao = Number(req.body.comissao || 20);

    if (cargoFinal !== "aluno" && !contaRestrita(usuario)) {
      usuario.aprovado = true;
      usuario.status = "ativo";
      usuario.aprovadoEm = usuario.aprovadoEm || hojeISO();
    }
    if (["admin", "superadmin"].includes(cargoFinal)) {
      usuario.plano = "admin";
      usuario.dataExpiracao = "";
    }

    usuario.atualizadoPor = req.usuario.email;
    await usuario.save();
    await revogarSessoes(usuario, "role-changed");

    return res.json({ sucesso: true, mensagem: "Cargo atualizado. Sessões anteriores foram encerradas.", usuario: limparUsuario(usuario) });
  } catch (error) {
    console.error("Erro ao alterar cargo:", error);
    return res.status(500).json({ erro: "Erro interno ao alterar cargo." });
  }
});

router.delete("/usuario/:identificador", auth, requireSuperAdmin, async (req, res) => {
  try {
    const usuario = await buscarUsuarioPorIdentificador(req.params.identificador);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
    if (["superadmin", "dono", "dev"].includes(String(usuario.cargo || "").toLowerCase())) {
      return res.status(403).json({ erro: "Não é permitido excluir esta conta administrativa por esta rota." });
    }

    await revogarSessoes(usuario, "account-deleted");
    await Usuario.deleteOne({ _id: usuario._id });
    return res.json({ sucesso: true, mensagem: "Usuário excluído com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir usuário:", error);
    return res.status(500).json({ erro: "Erro interno ao excluir usuário." });
  }
});

router.get("/usuarios/status", (_req, res) => {
  res.json({ status: "online", modulo: "usuarios" });
});

module.exports = router;
