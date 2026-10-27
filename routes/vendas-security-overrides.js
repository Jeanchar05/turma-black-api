"use strict";

const express = require("express");
const database = require("../config/database");
const { withTransaction } = require("../services/db-transaction");
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

function readExtras(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return { ...raw };
  try {
    const parsed = JSON.parse(String(raw || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) { return {}; }
}

async function lockedSaleCustomer(tx, sale) {
  let rows = sale.cliente_id
    ? await tx.query("SELECT * FROM usuarios WHERE id = ? LIMIT 1 FOR UPDATE", [String(sale.cliente_id)])
    : [];
  if (!rows.length && sale.cliente_email) {
    rows = await tx.query("SELECT * FROM usuarios WHERE email = ? LIMIT 1 FOR UPDATE", [String(sale.cliente_email).trim().toLowerCase()]);
  }
  return rows[0] || null;
}

async function applyManualEntitlement(sale, tx) {
  const plan = OFFICIAL_PLANS[String(sale.produto_codigo || "")];
  if (!plan) return { applied: false, reason: "non-official-plan" };
  const user = await lockedSaleCustomer(tx, sale);
  if (!user) return { applied: false, reason: "user-not-found" };
  const extras = readExtras(user.extras);
  if (String(extras.bestfyTransactionId || "").trim()) return { applied: false, reason: "bestfy-entitlement-present" };
  if (Number(user.conta_dev) === 1 || ["dev", "dono", "superadmin"].includes(String(user.cargo || "").toLowerCase())) {
    return { applied: false, reason: "protected-account" };
  }
  if (String(extras.manualSaleId || "") === String(sale.id)) {
    return { applied: false, reason: "already-granted", userId: user.id };
  }
  extras.manualSaleId = String(sale.id);
  extras.manualSaleGrantedAt = new Date().toISOString();
  const blocked = Boolean(Number(user.suspenso)) || ["suspenso", "bloqueado"].includes(String(user.status || "").toLowerCase());
  const newStatus = !blocked && user.status === "pendente" ? "ativo" : user.status;
  await tx.query(
    "UPDATE usuarios SET plano=?, data_expiracao=?, extras=?, aprovado=?, status=?, atualizado_por=? WHERE id=?",
    [String(sale.produto_codigo), addDays(user.data_expiracao, plan.dias), JSON.stringify(extras),
      blocked ? Number(user.aprovado || 0) : 1, newStatus, "venda-manual:" + sale.id, user.id]
  );
  return { applied: true, blockedPreserved: blocked, userId: user.id };
}

async function revokeManualEntitlementIfOwned(sale, tx) {
  const user = await lockedSaleCustomer(tx, sale);
  if (!user) return { revoked: false, reason: "user-not-found" };
  const extras = readExtras(user.extras);
  if (String(extras.bestfyTransactionId || "").trim()) return { revoked: false, reason: "bestfy-entitlement-present" };
  if (String(extras.manualSaleId || "") !== String(sale.id)) {
    return { revoked: false, reason: "entitlement-owned-by-other-source" };
  }
  extras.manualSaleId = "";
  extras.manualSaleGrantedAt = "";
  extras.manualSaleRevokedAt = new Date().toISOString();
  await tx.query(
    "UPDATE usuarios SET plano='free', data_expiracao='', extras=?, atualizado_por=? WHERE id=?",
    [JSON.stringify(extras), "venda-manual-revogada:" + sale.id, user.id]
  );
  return { revoked: true, userId: user.id };
}

router.post("/vendas", auth, requirePermission("painelVendas"), (req, _res, next) => {
  req.body = { ...(req.body || {}), status: "pendente", origem: "painel-vendas" };
  return next();
});

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
    // Sale state and Premium entitlement must succeed or fail in one commit.
    // FOR UPDATE also serializes double clicks and concurrent status requests.
    const result = await withTransaction(async (tx) => {
      const sales = await tx.query("SELECT * FROM vendas WHERE id=? LIMIT 1 FOR UPDATE", [text(req.params.id, 24)]);
      const sale = sales[0];
      if (!sale) return { code: 404, body: { erro: "Venda não encontrada." } };
      if (!canTouchSale(req, sale)) return { code: 403, body: { erro: "Sem permissão para alterar esta venda." } };
      if (String(sale.origem || "").toLowerCase() === "bestfy") {
        return { code: 409, body: { erro: "O status desta venda é controlado pela Bestfy e não pode ser alterado manualmente." } };
      }

      const requested = text(req.body?.status, 30).toLowerCase();
      if (!["pago", "cancelado", "estornado"].includes(requested)) {
        return { code: 400, body: { erro: "Status de venda inválido." } };
      }
      const current = String(sale.status || "pendente").toLowerCase();
      if (requested === "pago" && !hasFullSalesControl(req)) {
        return { code: 403, body: { erro: "Somente a gestão financeira pode confirmar pagamentos." } };
      }
      if (requested === "estornado" && !hasFullSalesControl(req)) {
        return { code: 403, body: { erro: "Somente a gestão financeira pode registrar estorno." } };
      }
      if (requested === "cancelado" && !hasFullSalesControl(req) && current !== "pendente") {
        return { code: 403, body: { erro: "Vendedores só podem cancelar vendas próprias ainda pendentes." } };
      }
      if (current === requested) return { code: 200, body: { sucesso: true, mensagem: "A venda já está com este status." } };
      if (["cancelado", "estornado"].includes(current) && requested === "pago") {
        return { code: 409, body: { erro: "Venda cancelada/estornada não pode ser reaberta diretamente como paga." } };
      }

      const paidAt = requested === "pago" ? sale.pago_em || nowSql() : null;
      const canceledAt = ["cancelado", "estornado"].includes(requested) ? nowSql() : null;
      const commissionStatus = requested === "pago" ? "disponivel" : "prevista";
      await tx.query(
        "UPDATE vendas SET status=?,pago_em=?,cancelado_em=?,comissao_status=?,atualizado_por=? WHERE id=?",
        [requested, paidAt, canceledAt, commissionStatus, req.usuario?.email || "", sale.id]
      );

      let entitlement = null;
      if (requested === "pago") entitlement = await applyManualEntitlement(sale, tx);
      else if (current === "pago") entitlement = await revokeManualEntitlementIfOwned(sale, tx);
      return {
        code: 200,
        body: {
          sucesso: true,
          mensagem: requested === "pago" ? "Pagamento confirmado com segurança." : "Status atualizado.",
          venda: {
            id: sale.id, status: requested, pagoEm: paidAt || "", canceladoEm: canceledAt || "",
            origem: sale.origem || "painel-vendas"
          },
          acesso: entitlement
        },
        log: { saleId: sale.id, previous: current, next: requested, entitlement }
      };
    });

    if (result.log) await logSale(req, result.log.saleId, "status_seguro_alterado", {
      anterior: result.log.previous, novo: result.log.next, entitlement: result.log.entitlement
    });
    return res.status(result.code).json(result.body);
  } catch (error) {
    console.error("Erro ao alterar status de venda com segurança:", error);
    return res.status(500).json({ erro: "Erro interno ao atualizar o status da venda." });
  }
});
router.delete("/vendas/:id", auth, requirePermission("painelVendas"), async (req, res, next) => {
  try {
    const sale = await findSale(req.params.id);
    if (!sale) return res.status(404).json({ erro: "Venda não encontrada." });
    if (String(sale.origem || "").toLowerCase() === "bestfy") {
      return res.status(409).json({ erro: "Transações sincronizadas da Bestfy não podem ser apagadas." });
    }
    if (String(sale.status || "").toLowerCase() === "pago") {
      return res.status(409).json({ erro: "Venda confirmada não pode ser apagada. Registre cancelamento/estorno para preservar a auditoria." });
    }
    return next();
  } catch (error) {
    return res.status(500).json({ erro: "Erro interno ao validar exclusão." });
  }
});

module.exports = router;
