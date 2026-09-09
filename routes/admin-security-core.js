"use strict";

const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");

require("../services/password-model-guard");
const Usuario = require("../models/Usuario");
const SolicitacaoLiberacao = require("../models/SolicitacaoLiberacao");
const { validatePasswordPolicy, MIN_STAFF_PASSWORD_LENGTH } = require("../services/passwords");
const { revokeAllUserSessions } = require("../services/sessions");
const { audit } = require("../services/security-audit");
const { auth, montarUsuarioSeguro } = require("../middleware/auth");
const {
  CARGOS,
  getCargo,
  requirePermission
} = require("../middleware/permissions");
const { sensitiveWriteRateLimit } = require("../middleware/rate-limit");

const router = express.Router();
const PLANOS_DIAS = Object.freeze({ black30: 30, black90: 90, black180: 180, black360: 365 });
const TEAM_ROLES = new Set(["dono", "admin", "financeiro", "vendedor"]);
const CONTROL_ROLES = new Set(["dono", "superadmin", "admin", "moderador", "suporte", "vendedor"]);
const VALID_STATUS = new Set(["ativo", "suspenso", "bloqueado"]);

function idValido(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function normalizarEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 190);
}

function emailValido(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function devEmail() {
  return normalizarEmail(process.env.DEV_EMAIL || "dev@turmablack.com");
}

function alvoDev(usuario) {
  if (!usuario) return false;
  return usuario.contaDev === true || getCargo(usuario) === CARGOS.DEV || normalizarEmail(usuario.email) === devEmail();
}

function codigoAdmin() {
  return `ADM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function cargoParaTipo(cargo) {
  return cargo === "vendedor" ? "aluno" : "admin";
}

function cargoEquipe(value) {
  const cargo = String(value || "").trim().toLowerCase();
  return TEAM_ROLES.has(cargo) ? cargo : "";
}

function cargoControle(value) {
  const cargo = String(value || "").trim().toLowerCase();
  return CONTROL_ROLES.has(cargo) ? cargo : "";
}

function podeGerenciar(callerRole, targetRole) {
  if (callerRole === CARGOS.DEV) return targetRole !== CARGOS.DEV;
  if ([CARGOS.DONO, CARGOS.SUPERADMIN].includes(callerRole)) return targetRole !== CARGOS.DEV;
  if (callerRole === CARGOS.ADMIN) return [CARGOS.ADMIN, CARGOS.FINANCEIRO, CARGOS.VENDEDOR].includes(targetRole);
  return false;
}

function statusSeguro(value, fallback = "ativo") {
  const status = String(value || fallback).trim().toLowerCase();
  return VALID_STATUS.has(status) ? status : "";
}

function comissaoSegura(value, fallback = 20) {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return fallback;
  return Math.min(Math.max(numero, 0), 100);
}

function usuarioSeguro(usuario) {
  return {
    ...montarUsuarioSeguro(usuario),
    codigo: usuario.codigo || "",
    createdAt: usuario.createdAt || "",
    updatedAt: usuario.updatedAt || ""
  };
}

function expiracaoSegura(usuario, plano) {
  const dias = PLANOS_DIAS[plano];
  if (!dias) throw new Error("Plano sem validade autorizada.");
  const agora = new Date();
  const atual = new Date(usuario?.dataExpiracao || "");
  const base = !Number.isNaN(atual.getTime()) && atual > agora ? atual : agora;
  const expira = new Date(base);
  expira.setUTCDate(expira.getUTCDate() + dias);
  return expira.toISOString();
}

async function revogar(usuario, reason) {
  await revokeAllUserSessions(String(usuario?._id || usuario?.id || ""), reason);
}

const equipeGuard = [auth, sensitiveWriteRateLimit, requirePermission("equipe")];
const controleGuard = [auth, sensitiveWriteRateLimit, requirePermission("controleAdmin")];

router.post("/equipe", ...equipeGuard, async (req, res) => {
  try {
    const callerRole = getCargo(req.usuarioDoc || req.usuario);
    const cargo = cargoEquipe(req.body?.cargo || "vendedor");
    const email = normalizarEmail(req.body?.email);
    const senha = String(req.body?.senha || "");
    const nome = String(req.body?.nome || email.split("@")[0] || "Equipe").trim().slice(0, 160);

    if (!cargo || !podeGerenciar(callerRole, cargo)) return res.status(403).json({ erro: "Você não pode criar este cargo." });
    if (!emailValido(email) || email === devEmail()) return res.status(400).json({ erro: "E-mail inválido ou reservado." });

    const policy = validatePasswordPolicy(senha, { minimumLength: MIN_STAFF_PASSWORD_LENGTH, email, name: nome });
    if (!policy.valid) return res.status(400).json({ erro: policy.reason, codigo: "SENHA_FRACA" });
    if (await Usuario.exists({ email })) return res.status(409).json({ erro: "Já existe uma conta com este e-mail." });

    const usuario = await Usuario.create({
      nome,
      email,
      senha,
      telefone: String(req.body?.telefone || "").trim().slice(0, 40),
      tipo: cargoParaTipo(cargo),
      cargo,
      contaDev: false,
      vendedor: ["dono", "admin", "financeiro", "vendedor"].includes(cargo),
      comissao: comissaoSegura(req.body?.comissao, 20),
      aprovado: true,
      suspenso: false,
      status: "ativo",
      plano: "admin",
      aprovadoEm: new Date().toISOString(),
      criadoPor: req.usuario.email,
      atualizadoPor: req.usuario.email
    });

    await audit(req, "staff.created", { target: usuario, metadata: { cargo } });
    return res.status(201).json({ sucesso: true, mensagem: "Conta da equipe criada com segurança.", usuario: usuarioSeguro(usuario) });
  } catch (error) {
    console.error("Erro ao criar membro da equipe:", error);
    return res.status(500).json({ erro: "Erro interno ao criar membro da equipe." });
  }
});

router.patch("/equipe/:id", ...equipeGuard, async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ erro: "Conta inválida." });
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario || alvoDev(usuario)) return res.status(404).json({ erro: "Conta da equipe não encontrada." });

    const callerRole = getCargo(req.usuarioDoc || req.usuario);
    const roleAtual = getCargo(usuario);
    const cargoFinal = req.body?.cargo !== undefined ? cargoEquipe(req.body.cargo) : roleAtual;
    if (!cargoFinal || !podeGerenciar(callerRole, roleAtual) || !podeGerenciar(callerRole, cargoFinal)) {
      return res.status(403).json({ erro: "Você não pode alterar esta conta." });
    }

    let revokeReason = "";
    if (req.body?.nome !== undefined) usuario.nome = String(req.body.nome).trim().slice(0, 160);
    if (req.body?.telefone !== undefined) usuario.telefone = String(req.body.telefone).trim().slice(0, 40);
    if (req.body?.comissao !== undefined) usuario.comissao = comissaoSegura(req.body.comissao, Number(usuario.comissao || 20));

    if (req.body?.senha) {
      const password = String(req.body.senha);
      const policy = validatePasswordPolicy(password, {
        minimumLength: MIN_STAFF_PASSWORD_LENGTH,
        email: usuario.email,
        name: usuario.nome
      });
      if (!policy.valid) return res.status(400).json({ erro: policy.reason, codigo: "SENHA_FRACA" });
      usuario.senha = password;
      revokeReason = "staff-password-changed";
    }

    if (cargoFinal !== roleAtual) {
      usuario.cargo = cargoFinal;
      usuario.tipo = cargoParaTipo(cargoFinal);
      revokeReason = "staff-role-changed";
    }

    if (req.body?.status !== undefined) {
      const status = statusSeguro(req.body.status);
      if (!status) return res.status(400).json({ erro: "Status inválido." });
      usuario.status = status;
      usuario.suspenso = status === "suspenso" || status === "bloqueado";
      revokeReason = `staff-status-${status}`;
    }

    usuario.vendedor = ["dono", "admin", "financeiro", "vendedor"].includes(cargoFinal);
    usuario.plano = "admin";
    usuario.aprovado = true;
    usuario.atualizadoPor = req.usuario.email;
    await usuario.save();
    if (revokeReason) await revogar(usuario, revokeReason);

    await audit(req, "staff.updated", { target: usuario, metadata: { cargo: cargoFinal, status: usuario.status, sessionsRevoked: Boolean(revokeReason) } });
    return res.json({ sucesso: true, mensagem: "Conta atualizada com segurança.", usuario: usuarioSeguro(usuario) });
  } catch (error) {
    console.error("Erro ao atualizar equipe:", error);
    return res.status(500).json({ erro: "Erro interno ao atualizar equipe." });
  }
});

router.post("/liberacoes/:id/aprovar", auth, sensitiveWriteRateLimit, requirePermission("aprovacoes"), async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ erro: "Solicitação inválida." });
    const solicitacao = await SolicitacaoLiberacao.findById(req.params.id);
    if (!solicitacao) return res.status(404).json({ erro: "Solicitação não encontrada." });
    if (solicitacao.status !== "pendente") return res.status(409).json({ erro: "Esta solicitação já foi analisada." });

    const usuario = await Usuario.findById(solicitacao.usuarioId);
    if (!usuario) return res.status(404).json({ erro: "Conta vinculada não encontrada." });
    if (alvoDev(usuario) || getCargo(usuario) !== CARGOS.ALUNO) return res.status(403).json({ erro: "Liberação manual só pode ser aplicada a alunos." });

    const restrito = Boolean(usuario.suspenso) || ["suspenso", "bloqueado"].includes(String(usuario.status || "").toLowerCase());
    if (restrito) return res.status(409).json({ erro: "A conta está suspensa ou bloqueada. A liberação de plano não pode reativá-la." });

    const emailSolicitacao = normalizarEmail(solicitacao.email);
    const emailUsuario = normalizarEmail(usuario.email);
    if (!emailSolicitacao || emailSolicitacao !== emailUsuario) return res.status(409).json({ erro: "Solicitação e conta não possuem o mesmo e-mail." });

    const plano = String(solicitacao.plano || "").trim().toLowerCase();
    const dias = PLANOS_DIAS[plano];
    if (!dias) return res.status(400).json({ erro: "Plano sem validade autorizada." });
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "dias") && Number(req.body.dias) !== dias) {
      return res.status(400).json({ erro: "A validade do plano é definida exclusivamente pelo servidor." });
    }

    usuario.plano = plano;
    usuario.dataExpiracao = expiracaoSegura(usuario, plano);
    usuario.aprovado = true;
    usuario.status = "ativo";
    usuario.codigo = solicitacao.codigo;
    usuario.aprovadoEm = usuario.aprovadoEm || new Date().toISOString();
    usuario.atualizadoPor = req.usuario.email;
    await usuario.save();

    solicitacao.status = "aprovado";
    solicitacao.analisadoEm = new Date();
    solicitacao.analisadoPor = req.usuario.email;
    solicitacao.motivoRecusa = "";
    await solicitacao.save();

    await audit(req, "premium.manual-approved", { target: usuario, metadata: { plano, dias, codigo: solicitacao.codigo } });
    return res.json({ sucesso: true, mensagem: "Plano Premium liberado sem alterar restrições de conta.", diasLiberados: dias, expiraEm: usuario.dataExpiracao, usuario: usuarioSeguro(usuario) });
  } catch (error) {
    console.error("Erro ao aprovar liberação segura:", error);
    return res.status(500).json({ erro: "Erro interno ao aprovar liberação." });
  }
});

router.post("/controle-admins", ...controleGuard, async (req, res) => {
  try {
    const callerRole = getCargo(req.usuarioDoc || req.usuario);
    const email = normalizarEmail(req.body?.email);
    const cargo = cargoControle(req.body?.cargo || "admin");
    const status = statusSeguro(req.body?.status || "ativo");
    if (!emailValido(email) || email === devEmail()) return res.status(400).json({ erro: "E-mail inválido ou reservado." });
    if (!cargo || !status || !podeGerenciar(callerRole, cargo)) return res.status(403).json({ erro: "Operação administrativa não permitida." });

    let usuario = await Usuario.findOne({ email });
    if (usuario && alvoDev(usuario)) return res.status(403).json({ erro: "A conta Dev não pode ser alterada por esta rota." });

    const nome = String(req.body?.nome || usuario?.nome || email.split("@")[0]).trim().slice(0, 160);
    const senha = String(req.body?.senha || "");

    if (!usuario) {
      const policy = validatePasswordPolicy(senha, { minimumLength: MIN_STAFF_PASSWORD_LENGTH, email, name: nome });
      if (!policy.valid) return res.status(400).json({ erro: policy.reason, codigo: "SENHA_FRACA" });

      usuario = await Usuario.create({
        nome,
        email,
        senha,
        telefone: String(req.body?.telefone || "").trim().slice(0, 40),
        tipo: cargoParaTipo(cargo),
        cargo,
        contaDev: false,
        vendedor: cargo === "vendedor" || ["dono", "superadmin", "admin"].includes(cargo),
        comissao: comissaoSegura(req.body?.comissao, 20),
        aprovado: true,
        suspenso: status === "suspenso" || status === "bloqueado",
        status,
        codigo: codigoAdmin(),
        plano: "admin",
        dataExpiracao: "",
        aprovadoEm: new Date().toISOString(),
        criadoPor: req.usuario.email,
        atualizadoPor: req.usuario.email
      });
      await audit(req, "admin.created", { target: usuario, metadata: { cargo, status } });
      return res.status(201).json({ sucesso: true, mensagem: "Conta administrativa criada com senha forte obrigatória.", admin: usuarioSeguro(usuario), usuario: usuarioSeguro(usuario) });
    }

    const roleAtual = getCargo(usuario);
    if (!podeGerenciar(callerRole, roleAtual) || !podeGerenciar(callerRole, cargo)) return res.status(403).json({ erro: "Você não pode alterar esta conta." });

    if (senha) {
      const policy = validatePasswordPolicy(senha, { minimumLength: MIN_STAFF_PASSWORD_LENGTH, email, name: nome });
      if (!policy.valid) return res.status(400).json({ erro: policy.reason, codigo: "SENHA_FRACA" });
      usuario.senha = senha;
    }
    usuario.nome = nome;
    if (req.body?.telefone !== undefined) usuario.telefone = String(req.body.telefone).trim().slice(0, 40);
    usuario.tipo = cargoParaTipo(cargo);
    usuario.cargo = cargo;
    usuario.vendedor = req.body?.vendedor !== undefined ? Boolean(req.body.vendedor) : cargo === "vendedor" || ["dono", "superadmin", "admin"].includes(cargo);
    usuario.comissao = comissaoSegura(req.body?.comissao, Number(usuario.comissao || 20));
    usuario.aprovado = true;
    usuario.suspenso = status === "suspenso" || status === "bloqueado";
    usuario.status = status;
    usuario.plano = "admin";
    usuario.dataExpiracao = "";
    usuario.codigo = usuario.codigo || codigoAdmin();
    usuario.aprovadoEm = usuario.aprovadoEm || new Date().toISOString();
    usuario.atualizadoPor = req.usuario.email;
    await usuario.save();
    await revogar(usuario, "admin-account-updated");

    await audit(req, "admin.updated", { target: usuario, metadata: { cargo, status } });
    return res.json({ sucesso: true, mensagem: "Conta administrativa atualizada e sessões anteriores encerradas.", admin: usuarioSeguro(usuario), usuario: usuarioSeguro(usuario) });
  } catch (error) {
    console.error("Erro ao criar/promover admin com segurança:", error);
    return res.status(500).json({ erro: "Erro interno ao criar/promover admin." });
  }
});

async function atualizarAdmin(req, res, mode) {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ erro: "Conta inválida." });
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) return res.status(404).json({ erro: "Conta não encontrada." });
    if (alvoDev(usuario)) return res.status(403).json({ erro: "A conta Dev não pode ser alterada por esta rota." });

    const callerRole = getCargo(req.usuarioDoc || req.usuario);
    const roleAtual = getCargo(usuario);
    if (!podeGerenciar(callerRole, roleAtual)) return res.status(403).json({ erro: "Você não pode alterar esta conta." });

    if (mode === "remove") {
      usuario.cargo = "aluno";
      usuario.tipo = "aluno";
      usuario.vendedor = false;
      usuario.comissao = 20;
      usuario.plano = usuario.plano === "admin" ? "free" : usuario.plano;
      usuario.atualizadoPor = req.usuario.email;
      await usuario.save();
      await revogar(usuario, "admin-access-removed");
      await audit(req, "admin.access-removed", { target: usuario });
      return res.json({ sucesso: true, mensagem: "Acesso administrativo removido e sessões encerradas.", usuario: usuarioSeguro(usuario) });
    }

    if (mode === "cargo") {
      const cargo = cargoControle(req.body?.cargo);
      if (!cargo || !podeGerenciar(callerRole, cargo)) return res.status(403).json({ erro: "Cargo não permitido." });
      usuario.cargo = cargo;
      usuario.tipo = cargoParaTipo(cargo);
      usuario.plano = "admin";
      usuario.aprovado = true;
      // Trocar cargo nunca reativa automaticamente conta suspensa/bloqueada.
      usuario.vendedor = cargo === "vendedor" || ["dono", "superadmin", "admin"].includes(cargo);
      usuario.atualizadoPor = req.usuario.email;
      await usuario.save();
      await revogar(usuario, "admin-role-changed");
      await audit(req, "admin.role-changed", { target: usuario, metadata: { cargo } });
      return res.json({ sucesso: true, mensagem: "Cargo atualizado e sessões anteriores encerradas.", admin: usuarioSeguro(usuario), usuario: usuarioSeguro(usuario) });
    }

    if (mode === "status") {
      const status = statusSeguro(req.body?.status);
      if (!status) return res.status(400).json({ erro: "Status inválido." });
      usuario.status = status;
      usuario.suspenso = status === "suspenso" || status === "bloqueado";
      usuario.atualizadoPor = req.usuario.email;
      await usuario.save();
      await revogar(usuario, `admin-status-${status}`);
      await audit(req, "admin.status-changed", { target: usuario, metadata: { status } });
      return res.json({ sucesso: true, mensagem: "Status atualizado e sessões anteriores encerradas.", admin: usuarioSeguro(usuario), usuario: usuarioSeguro(usuario) });
    }

    if (req.body?.nome !== undefined) usuario.nome = String(req.body.nome).trim().slice(0, 160);
    if (req.body?.telefone !== undefined) usuario.telefone = String(req.body.telefone).trim().slice(0, 40);
    if (req.body?.foto !== undefined) usuario.foto = String(req.body.foto).trim().slice(0, 2000);
    if (req.body?.codigo !== undefined) usuario.codigo = String(req.body.codigo).trim().slice(0, 64);

    if (req.body?.senha) {
      const password = String(req.body.senha);
      const policy = validatePasswordPolicy(password, { minimumLength: MIN_STAFF_PASSWORD_LENGTH, email: usuario.email, name: usuario.nome });
      if (!policy.valid) return res.status(400).json({ erro: policy.reason, codigo: "SENHA_FRACA" });
      usuario.senha = password;
    }

    if (req.body?.cargo !== undefined) {
      const cargo = cargoControle(req.body.cargo);
      if (!cargo || !podeGerenciar(callerRole, cargo)) return res.status(403).json({ erro: "Cargo não permitido." });
      usuario.cargo = cargo;
      usuario.tipo = cargoParaTipo(cargo);
      usuario.plano = "admin";
    }
    if (req.body?.status !== undefined) {
      const status = statusSeguro(req.body.status);
      if (!status) return res.status(400).json({ erro: "Status inválido." });
      usuario.status = status;
      usuario.suspenso = status === "suspenso" || status === "bloqueado";
    }
    if (req.body?.vendedor !== undefined) usuario.vendedor = Boolean(req.body.vendedor);
    if (req.body?.comissao !== undefined) usuario.comissao = comissaoSegura(req.body.comissao, Number(usuario.comissao || 20));

    usuario.aprovado = true;
    usuario.aprovadoEm = usuario.aprovadoEm || new Date().toISOString();
    usuario.atualizadoPor = req.usuario.email;
    await usuario.save();
    await revogar(usuario, "admin-security-update");
    await audit(req, "admin.updated", { target: usuario, metadata: { cargo: getCargo(usuario), status: usuario.status } });
    return res.json({ sucesso: true, mensagem: "Admin atualizado e sessões anteriores encerradas.", admin: usuarioSeguro(usuario), usuario: usuarioSeguro(usuario) });
  } catch (error) {
    console.error("Erro na alteração administrativa segura:", error);
    return res.status(500).json({ erro: "Erro interno ao atualizar conta administrativa." });
  }
}

router.put("/controle-admins/:id", ...controleGuard, (req, res) => atualizarAdmin(req, res, "update"));
router.post("/controle-admins/:id/cargo", ...controleGuard, (req, res) => atualizarAdmin(req, res, "cargo"));
router.post("/controle-admins/:id/status", ...controleGuard, (req, res) => atualizarAdmin(req, res, "status"));
router.delete("/controle-admins/:id", ...controleGuard, (req, res) => atualizarAdmin(req, res, "remove"));

module.exports = router;
