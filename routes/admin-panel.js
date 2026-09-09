"use strict";

const express = require("express");
const mongoose = require("mongoose");

const Usuario = require("../models/Usuario");
const SolicitacaoLiberacao = require("../models/SolicitacaoLiberacao");
const PermissaoSistema = require("../models/PermissaoSistema");
const { audit } = require("../services/security-audit");
const { auth, montarUsuarioSeguro } = require("../middleware/auth");
const {
  CHAVES_PERMISSAO,
  PERMISSOES_PADRAO,
  getPermissoesEfetivas,
  sanitizarPermissoes,
  requirePermission,
  requireDev
} = require("../middleware/permissions");
const { sensitiveWriteRateLimit } = require("../middleware/rate-limit");

const router = express.Router();
const CARGOS_GERENCIAVEIS = ["dono", "admin", "financeiro", "vendedor"];

function validarId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function texto(value, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function formatarUsuario(usuario) {
  if (!usuario) return null;
  return {
    ...montarUsuarioSeguro(usuario),
    codigo: usuario.codigo || "",
    createdAt: usuario.createdAt || "",
    updatedAt: usuario.updatedAt || "",
    ultimoLogin: usuario.ultimoLogin || "",
    aprovadoEm: usuario.aprovadoEm || ""
  };
}

// As mutações de equipe, aprovação Premium e controle de administradores vivem
// exclusivamente em admin-security-core.js. Este módulo mantém consultas e
// administração da matriz Dev sem duplicar rotas de escrita enfraquecidas.

router.get("/liberacoes/resumo", auth, requirePermission("aprovacoes"), async (_req, res) => {
  try {
    const [pendentes, aprovadas, recusadas, total] = await Promise.all([
      SolicitacaoLiberacao.countDocuments({ status: "pendente" }),
      SolicitacaoLiberacao.countDocuments({ status: "aprovado" }),
      SolicitacaoLiberacao.countDocuments({ status: "recusado" }),
      SolicitacaoLiberacao.countDocuments()
    ]);
    return res.json({ sucesso: true, resumo: { pendentes, aprovadas, recusadas, total } });
  } catch (error) {
    console.error("Erro no resumo de liberações:", error);
    return res.status(500).json({ erro: "Erro interno ao gerar resumo de liberações." });
  }
});

router.get("/liberacoes", auth, requirePermission("aprovacoes"), async (req, res) => {
  try {
    const filtro = {};
    const status = String(req.query?.status || "").trim().toLowerCase();
    if (["pendente", "aprovado", "recusado", "cancelado"].includes(status)) filtro.status = status;

    const busca = texto(req.query?.busca, 160);
    if (busca) {
      filtro.$or = [
        { codigo: { $regex: busca, $options: "i" } },
        { nome: { $regex: busca, $options: "i" } },
        { email: { $regex: busca, $options: "i" } }
      ];
    }

    const solicitacoes = await SolicitacaoLiberacao.find(filtro)
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(Number(req.query?.limite) || 150, 1), 500));

    return res.json({ sucesso: true, total: solicitacoes.length, solicitacoes });
  } catch (error) {
    console.error("Erro ao listar liberações:", error);
    return res.status(500).json({ erro: "Erro interno ao listar liberações." });
  }
});

router.post(
  "/liberacoes/:id/recusar",
  auth,
  sensitiveWriteRateLimit,
  requirePermission("aprovacoes"),
  async (req, res) => {
    try {
      if (!validarId(req.params.id)) return res.status(400).json({ erro: "Solicitação inválida." });
      const solicitacao = await SolicitacaoLiberacao.findById(req.params.id);
      if (!solicitacao) return res.status(404).json({ erro: "Solicitação não encontrada." });
      if (solicitacao.status !== "pendente") return res.status(409).json({ erro: "Esta solicitação já foi analisada." });

      solicitacao.status = "recusado";
      solicitacao.analisadoEm = new Date();
      solicitacao.analisadoPor = req.usuario.email;
      solicitacao.motivoRecusa = texto(req.body?.motivo || "Pagamento não confirmado.", 1000);
      await solicitacao.save();

      await audit(req, "premium.manual-rejected", {
        metadata: { codigo: solicitacao.codigo, plano: solicitacao.plano }
      });
      return res.json({ sucesso: true, mensagem: "Solicitação recusada.", solicitacao });
    } catch (error) {
      console.error("Erro ao recusar liberação:", error);
      return res.status(500).json({ erro: "Erro interno ao recusar liberação." });
    }
  }
);

router.get("/equipe", auth, requirePermission("equipe"), async (_req, res) => {
  try {
    const usuarios = await Usuario.find({
      cargo: { $in: CARGOS_GERENCIAVEIS },
      contaDev: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .limit(300);

    return res.json({ sucesso: true, total: usuarios.length, equipe: usuarios.map(formatarUsuario) });
  } catch (error) {
    console.error("Erro ao listar equipe:", error);
    return res.status(500).json({ erro: "Erro interno ao listar equipe." });
  }
});

router.get("/dev/permissoes", auth, requireDev, async (_req, res) => {
  try {
    const registro = await PermissaoSistema.obter();
    const matriz = {};

    CARGOS_GERENCIAVEIS.forEach((cargo) => {
      matriz[cargo] = {
        ...(PERMISSOES_PADRAO[cargo] || {}),
        ...sanitizarPermissoes(registro.matriz?.[cargo] || {})
      };
    });

    const contas = await Usuario.find({ contaDev: { $ne: true } })
      .select("nome email cargo status permissoesPersonalizadas")
      .sort({ nome: 1 })
      .limit(500)
      .lean();

    return res.json({
      sucesso: true,
      chaves: CHAVES_PERMISSAO,
      matriz,
      contas,
      atualizadoPor: registro.atualizadoPor || "",
      updatedAt: registro.updatedAt || ""
    });
  } catch (error) {
    console.error("Erro ao carregar Central Dev:", error);
    return res.status(500).json({ erro: "Erro interno ao carregar Central Dev." });
  }
});

router.put("/dev/permissoes/:cargo", auth, sensitiveWriteRateLimit, requireDev, async (req, res) => {
  try {
    const cargo = String(req.params.cargo || "").toLowerCase();
    if (!CARGOS_GERENCIAVEIS.includes(cargo)) return res.status(400).json({ erro: "Cargo inválido para configuração." });

    const registro = await PermissaoSistema.obter();
    const anterior = sanitizarPermissoes(registro.matriz?.[cargo] || {});
    const novas = sanitizarPermissoes(req.body?.permissoes || {});

    // Nenhum cargo que não seja Dev pode receber a chave que altera a própria matriz.
    novas.permissoesSistema = false;
    registro.matriz = { ...(registro.matriz || {}), [cargo]: novas };
    registro.historico.push({
      tipo: "cargo",
      cargo,
      anterior,
      novo: novas,
      alteradoPor: req.usuario.email,
      data: new Date().toISOString()
    });
    registro.historico = registro.historico.slice(-100);
    registro.atualizadoPor = req.usuario.email;
    if (typeof registro.markModified === "function") {
      registro.markModified("matriz");
      registro.markModified("historico");
    }
    await registro.save();

    await audit(req, "permissions.role-matrix-updated", { metadata: { cargo } });
    return res.json({
      sucesso: true,
      mensagem: `Permissões de ${cargo} atualizadas.`,
      permissoes: { ...(PERMISSOES_PADRAO[cargo] || {}), ...novas, permissoesSistema: false }
    });
  } catch (error) {
    console.error("Erro ao atualizar matriz de permissões:", error);
    return res.status(500).json({ erro: "Erro interno ao atualizar permissões." });
  }
});

router.put("/dev/usuarios/:id/permissoes", auth, sensitiveWriteRateLimit, requireDev, async (req, res) => {
  try {
    if (!validarId(req.params.id)) return res.status(400).json({ erro: "Conta inválida." });
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario || usuario.contaDev === true) return res.status(404).json({ erro: "Conta não encontrada." });

    const personalizadas = sanitizarPermissoes(req.body?.permissoes || {});
    personalizadas.permissoesSistema = false;
    usuario.permissoesPersonalizadas = personalizadas;
    usuario.atualizadoPor = req.usuario.email;
    if (typeof usuario.markModified === "function") usuario.markModified("permissoesPersonalizadas");
    await usuario.save();

    await audit(req, "permissions.user-overrides-updated", {
      target: usuario,
      metadata: { cargo: usuario.cargo }
    });
    return res.json({
      sucesso: true,
      mensagem: "Permissões individuais atualizadas.",
      usuario: formatarUsuario(usuario),
      permissoes: await getPermissoesEfetivas(usuario)
    });
  } catch (error) {
    console.error("Erro ao atualizar permissões individuais:", error);
    return res.status(500).json({ erro: "Erro interno ao atualizar permissões individuais." });
  }
});

module.exports = router;
