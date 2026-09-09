"use strict";

const express = require("express");
const database = require("../config/database");
const Usuario = require("../models/Usuario");
const { auth } = require("../middleware/auth");
const { requirePermission, getCargo } = require("../middleware/permissions");

const router = express.Router();
const FULL_ROLES = new Set(["dev", "dono", "superadmin", "admin", "financeiro"]);
const OFFICIAL_PLANS = Object.freeze({
  black30: { dias: 30 },
  black180: { dias: 180 },
  black360: { dias: 365 }
});

function text(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function userId(req) {
  return String(req.usuario?.id || req.usuario?._id || req.usuarioDoc?.id || req.usuarioDoc?._id || "");
}

function role(req) {
  return String(getCargo(req.usuarioDoc || req.usuario) || "aluno").toLowerCase();
}

function hasFullSalesControl(req) {
  return FULL_ROLES.has(role(req));
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

async function findSale(id) {
  const rows = await database.query("SELECT * FROM vendas WHERE id=? LIMIT 1", [text(id, 24)]);
  return rows[0] || null;
}

function canTouchSale(req, sale) {
  return hasFullSalesControl(req) || String(sale?.vendedor_id || "") === userId(req);
}

async function logSale(req, saleId, action, details = {}) {
  try {
    await database.query(
      `INSERT INTO vendas_logs(venda_id,usuario_id,usuario_email,acao,detalhes)
       VALUES(?,?,?,?,?)`,
      [saleId || "", userId(req), req.usuario?.email || "", action, JSON.stringify(details)]
    );
  } catch (error) {
    console.warn("Falha ao registrar auditoria comercial:", error.message);
  }
}

function addDays(baseValue, days) {
  const now = new Date();
  const current = new Date(baseValue || "");
  const base = Number.isFinite(current.getTime()) && current > now ? current : now;
  base.setDate(base.getDate() + Number(days || 0));
  return base.toISOString().slice(0, 10);
}

async function applyManualEntitlement(sale) {
  const plan = OFFICIAL_PLANS[String(sale.produto_codigo || "")];
  if (!plan) return { applied: false, reason: "non-official-plan" };

  let user = sale.cliente_id ? await Usuario.findById(sale.cliente_id) : null;
  if (!user && sale.cliente_email) user = await Usuario.findOne({ email: String(sale.cliente_email).toLowerCase() });
  if (!user) return { applied: false, reason: "user-not-found" };

  // Uma compra manual nunca substitui um entitlement verificado pela Bestfy.
  if (String(user.bestfyTransactionId || "").trim()) {
    return { applied: false, reason: "bestfy-entitlement-present" };
  }

  user.plano = String(sale.produto_codigo);
  user.dataExpiracao = addDays(user.dataExpiracao, plan.dias);
  user.atualizadoPor = `venda-manual:${sale.id}`;

  const blocked = Boolean(user.suspenso) || ["suspenso", "bloqueado"].includes(String(user.status || "").toLowerCase());
  if (!blocked) {
    user.aprovado = true;
    if (String(user.status || "").toLowerCase() === "pendente") user.status = "ativo";
  }

  await user.save();
  return { applied: true, blockedPreserved: blocked, userId: String(user.id || user._id || "") };
}

async function revokeManualEntitlementIfOwned(sale) {
  let user = sale.cliente_id ? await Usuario.findById(sale.cliente_id) : null;
  if (!user && sale.cliente_email) user = await Usuario.findOne({ email: String(sale.cliente_email).toLowerCase() });
  if (!user) return { revoked: false, reason: "user-not-found" };

  if (String(user.bestfyTransactionId || "").trim()) {
    return { revoked: false, reason: "bestfy-entitlement-present" };
  }
  if (String(user.atualizadoPor || "") !== `venda-manual:${sale.id}`) {
    return { revoked: false, reason: "entitlement-owned-by-other-source" };
  }

  user.plano = "free";
  user.dataExpiracao = "";
  user.atualizadoPor = `venda-manual-revogada:${sale.id}`;
  // Não alteramos suspenso/status/aprovado: revogação comercial não muda sanções administrativas.
  await user.save();
  return { revoked: true, userId: String(user.id || user._id || "") };
}

// Toda venda digitada manualmente nasce pendente. Confirmação financeira usa
// exclusivamente a rota dedicada abaixo, com RBAC e auditoria.
router.post("/vendas", auth, requirePermission("painelVendas"), (req, _res, next) => {
  req.body = { ...(req.body || {}), status: "pendente", origem: "painel-vendas" };
  return next();
});

// Bestfy é fonte de verdade e não pode ser editada pelo painel manual. Em
// vendas manuais, status/origem também não podem ser alterados pelo PUT genérico.
router.put("/vendas/:id", auth, requirePermission("painelVendas"), async (req, res, next) => {
  try {
    const sale = await findSale(req.params.id);
    if (!sale) return res.status(404).json({ erro: "Venda não encontrada." });
    if (!canTouchSale(req, sale)) return res.status(403).json({ erro: "Sem permissão para editar esta venda." });
    if (String(sale.origem || "").toLowerCase() === "bestfy") {
      return res.status(409).json({ erro: "Vendas da Bestfy são somente leitura. O status é sincronizado pelo checkout." });
    }
    if (String(sale.status || "").toLowerCase() === "pago") {
      return res.status(409).json({ erro: "Uma venda já confirmada não pode ser editada. Faça estorno/cancelamento pela ação de status quando aplicável." });
    }

    req.body = { ...(req.body || {}) };
    delete req.body.status;
    delete req.body.origem;
    return next();
  } catch (error) {
    console.error("Erro no preflight de edição de venda:", error);
    return res.status(500).json({ erro: "Erro interno ao validar a edição." });
  }
});

router.post("/vendas/:id/status", auth, requirePermission("painelVendas"), async (req, res) => {
  try {
    const sale = await findSale(req.params.id);
    if (!sale) return res.status(404).json({ erro: "Venda não encontrada." });
    if (!canTouchSale(req, sale)) return res.status(403).json({ erro: "Sem permissão para alterar esta venda." });
    if (String(sale.origem || "").toLowerCase() === "bestfy") {
      return res.status(409).json({ erro: "O status desta venda é controlado pela Bestfy e não pode ser alterado manualmente." });
    }

    const requested = text(req.body?.status, 30).toLowerCase();
    if (!["pago", "cancelado", "estornado"].includes(requested)) {
      return res.status(400).json({ erro: "Status de venda inválido." });
    }

    const current = String(sale.status || "pendente").toLowerCase();
    if (requested === "pago" && !hasFullSalesControl(req)) {
      return res.status(403).json({ erro: "Somente Dev, Dono, Super Admin, Admin ou Financeiro pode confirmar pagamentos." });
    }
    if (requested === "estornado" && !hasFullSalesControl(req)) {
      return res.status(403).json({ erro: "Somente a gestão financeira pode registrar estorno." });
    }
    if (requested === "cancelado" && !hasFullSalesControl(req) && current !== "pendente") {
      return res.status(403).json({ erro: "Vendedores só podem cancelar vendas próprias ainda pendentes." });
    }
    if (current === requested) {
      return res.json({ sucesso: true, mensagem: "A venda já está com este status." });
    }
    if (["cancelado", "estornado"].includes(current) && requested === "pago") {
      return res.status(409).json({ erro: "Venda cancelada/estornada não pode ser reaberta diretamente como paga." });
    }

    const paidAt = requested === "pago" ? (sale.pago_em || nowSql()) : null;
    const canceledAt = ["cancelado", "estornado"].includes(requested) ? nowSql() : null;
    const commissionStatus = requested === "pago" ? "disponivel" : "prevista";

    await database.query(
      `UPDATE vendas
          SET status=?,pago_em=?,cancelado_em=?,comissao_status=?,atualizado_por=?
        WHERE id=?`,
      [requested, paidAt, canceledAt, commissionStatus, req.usuario?.email || "", sale.id]
    );

    const updated = await findSale(sale.id);
    let entitlement = null;
    if (requested === "pago") entitlement = await applyManualEntitlement(updated);
    else if (current === "pago") entitlement = await revokeManualEntitlementIfOwned(updated);

    await logSale(req, sale.id, "status_seguro_alterado", {
      anterior: current,
      novo: requested,
      entitlement
    });

    return res.json({
      sucesso: true,
      mensagem: requested === "pago" ? "Pagamento confirmado com segurança." : "Status atualizado.",
      venda: {
        id: updated.id,
        status: updated.status,
        pagoEm: updated.pago_em || "",
        canceladoEm: updated.cancelado_em || "",
        origem: updated.origem || "painel-vendas"
      },
      acesso: entitlement
    });
  } catch (error) {
    console.error("Erro ao alterar status de venda com segurança:", error);
    return res.status(500).json({ erro: "Erro interno ao atualizar o status da venda." });
  }
});

// Vendas Bestfy nunca podem ser apagadas pelo painel, inclusive pelo Dev. O
// histórico financeiro precisa permanecer auditável e reconciliável.
router.delete("/vendas/:id", auth, requirePermission("painelVendas"), async (req, res, next) => {
  try {
    const sale = await findSale(req.params.id);
    if (!sale) return res.status(404).json({ erro: "Venda não encontrada." });
    if (String(sale.origem || "").toLowerCase() === "bestfy") {
      return res.status(409).json({ erro: "Transações sincronizadas da Bestfy não podem ser apagadas." });
    }
    return next();
  } catch (error) {
    return res.status(500).json({ erro: "Erro interno ao validar exclusão." });
  }
});

module.exports = router;
