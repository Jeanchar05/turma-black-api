"use strict";

const crypto = require("crypto");
const express = require("express");
const database = require("../config/database");
const { auth } = require("../middleware/auth");
const { requirePermission, getCargo } = require("../middleware/permissions");

const router = express.Router();
const FULL_ROLES = new Set(["dev", "dono", "superadmin", "admin", "financeiro"]);
let ensurePromise = null;

function text(value, max = 190) {
  return String(value ?? "").trim().slice(0, max);
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value) {
  return Number(number(value).toFixed(2));
}

function id24(seed = "") {
  if (seed) return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24);
  return crypto.randomBytes(12).toString("hex");
}

function userId(req) {
  return String(req.usuario?.id || req.usuario?._id || req.usuarioDoc?.id || req.usuarioDoc?._id || "");
}

function role(req) {
  return String(getCargo(req.usuarioDoc || req.usuario) || "aluno").toLowerCase();
}

function canManage(req) {
  return FULL_ROLES.has(role(req));
}

function competence(value = "") {
  const raw = text(value, 7);
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 7);
}

function startDateFromDays(days) {
  return new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
}

function monthStart(comp) {
  return `${comp}-01`;
}

function nextMonthStart(comp) {
  const [year, month] = comp.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return date.toISOString().slice(0, 10);
}

function scope(req, alias = "v") {
  if (canManage(req)) return { sql: "1=1", params: [] };
  return { sql: `${alias}.vendedor_id=?`, params: [userId(req)] };
}

async function ensureTables() {
  await database.query(`
    CREATE TABLE IF NOT EXISTS vendas_metas (
      id CHAR(24) NOT NULL PRIMARY KEY,
      competencia CHAR(7) NOT NULL,
      vendedor_id CHAR(24) NOT NULL DEFAULT '',
      meta_faturamento DECIMAL(14,2) NOT NULL DEFAULT 0,
      meta_vendas INT NOT NULL DEFAULT 0,
      criado_por VARCHAR(190) NOT NULL DEFAULT '',
      atualizado_por VARCHAR(190) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_vendas_meta (competencia,vendedor_id),
      KEY idx_vendas_meta_competencia (competencia),
      KEY idx_vendas_meta_vendedor (vendedor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function prepareCommandCenter(req, res, next) {
  try {
    if (!ensurePromise) {
      ensurePromise = ensureTables().catch((error) => {
        ensurePromise = null;
        throw error;
      });
    }
    await ensurePromise;
    return next();
  } catch (error) {
    console.error("Erro ao preparar metas do Sales Command Center:", error);
    return res.status(503).json({ erro: "Não foi possível preparar o Sales Command Center." });
  }
}

// Não intercepta mais o módulo /vendas inteiro. Apenas as rotas exclusivas do
// Command Center dependem desta tabela auxiliar, evitando que uma falha em
// metas torne listagem/registro de vendas indisponível.
router.use(["/vendas/command-center", "/vendas/metas"], prepareCommandCenter);

router.get("/vendas/command-center", auth, requirePermission("painelVendas"), async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.dias || 30), 7), 365);
    const begin = startDateFromDays(days);
    const comp = competence(req.query.competencia);
    const monthBegin = monthStart(comp);
    const monthEnd = nextMonthStart(comp);
    const currentScope = scope(req, "v");
    const currentUserId = userId(req);
    const manager = canManage(req);
    const metaSellerId = manager ? "" : currentUserId;

    const [summaryRows, planRows, sourceRows, statusRows, monthRows, metaRows, paymentRows, bestfyRows, logRows] = await Promise.all([
      database.query(
        `SELECT
           COUNT(*) total,
           SUM(status='pago') pagas,
           SUM(status='pendente') pendentes,
           SUM(status='cancelado') canceladas,
           SUM(status='estornado') estornadas,
           COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) faturamento,
           COALESCE(SUM(CASE WHEN status='pago' THEN comissao ELSE 0 END),0) comissoes,
           COALESCE(SUM(CASE WHEN status='estornado' THEN valor ELSE 0 END),0) estornos
         FROM vendas v
         WHERE ${currentScope.sql} AND v.data_venda>=?`,
        [...currentScope.params, begin]
      ),
      database.query(
        `SELECT produto_codigo codigo,produto_nome nome,COUNT(*) vendas,
                COALESCE(SUM(valor),0) faturamento
         FROM vendas v
         WHERE ${currentScope.sql} AND v.status='pago' AND v.data_venda>=?
         GROUP BY produto_codigo,produto_nome
         ORDER BY faturamento DESC`,
        [...currentScope.params, begin]
      ),
      database.query(
        `SELECT origem,COUNT(*) total,
                SUM(status='pago') pagas,
                COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) faturamento
         FROM vendas v
         WHERE ${currentScope.sql} AND v.data_venda>=?
         GROUP BY origem
         ORDER BY faturamento DESC`,
        [...currentScope.params, begin]
      ),
      database.query(
        `SELECT status,COUNT(*) total,COALESCE(SUM(valor),0) valor
         FROM vendas v
         WHERE ${currentScope.sql} AND v.data_venda>=?
         GROUP BY status`,
        [...currentScope.params, begin]
      ),
      database.query(
        `SELECT
           SUM(status='pago') pagas,
           COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) faturamento,
           COALESCE(SUM(CASE WHEN status='pago' THEN comissao ELSE 0 END),0) comissoes
         FROM vendas v
         WHERE ${currentScope.sql} AND v.data_venda>=? AND v.data_venda<?`,
        [...currentScope.params, monthBegin, monthEnd]
      ),
      database.query(
        `SELECT * FROM vendas_metas WHERE competencia=? AND vendedor_id=? LIMIT 1`,
        [comp, metaSellerId]
      ),
      database.query(
        `SELECT forma_pagamento codigo,COUNT(*) total,
                COALESCE(SUM(valor),0) faturamento
         FROM vendas v
         WHERE ${currentScope.sql} AND v.status='pago' AND v.data_venda>=?
         GROUP BY forma_pagamento ORDER BY faturamento DESC`,
        [...currentScope.params, begin]
      ),
      database.query(
        `SELECT MAX(updated_at) ultima_sincronizacao,
                SUM(status='PAID' AND revoked_at IS NULL) pagas_verificadas
         FROM bestfy_transactions`
      ).catch((error) => error?.code === "ER_NO_SUCH_TABLE" ? [{ ultima_sincronizacao: null, pagas_verificadas: 0 }] : Promise.reject(error)),
      manager
        ? database.query(
            `SELECT venda_id,usuario_email,acao,created_at
             FROM vendas_logs ORDER BY created_at DESC LIMIT 12`
          )
        : Promise.resolve([])
    ]);

    const summary = summaryRows[0] || {};
    const month = monthRows[0] || {};
    const meta = metaRows[0] || {};
    const revenue = money(summary.faturamento);
    const paid = Number(summary.pagas || 0);
    const commissions = money(summary.comissoes);
    const monthlyRevenue = money(month.faturamento);
    const goalRevenue = money(meta.meta_faturamento);
    const monthlyPaid = Number(month.pagas || 0);
    const goalSales = Number(meta.meta_vendas || 0);

    const statuses = Object.fromEntries(statusRows.map((row) => [String(row.status), Number(row.total || 0)]));
    const pipeline = [
      { key: "registradas", label: "Vendas registradas", total: Number(summary.total || 0) },
      { key: "pendentes", label: "Aguardando pagamento", total: Number(statuses.pendente || 0) },
      { key: "pagas", label: "Confirmadas", total: Number(statuses.pago || 0) },
      { key: "perdidas", label: "Canceladas / estornadas", total: Number(statuses.cancelado || 0) + Number(statuses.estornado || 0) }
    ];

    return res.json({
      sucesso: true,
      origem: "mysql",
      periodo: { dias: days, inicio: begin, competencia: comp },
      acesso: {
        cargo: role(req),
        podeGerenciar: manager,
        podeGerenciarMetas: manager,
        escopo: manager ? "equipe" : "proprio"
      },
      indicadores: {
        faturamento: revenue,
        vendasConfirmadas: paid,
        vendasPendentes: Number(summary.pendentes || 0),
        canceladas: Number(summary.canceladas || 0),
        estornadas: Number(summary.estornadas || 0),
        estornosValor: money(summary.estornos),
        ticketMedio: paid ? money(revenue / paid) : 0,
        comissoes,
        receitaAposComissoes: money(Math.max(0, revenue - commissions))
      },
      meta: {
        competencia: comp,
        faturamento: goalRevenue,
        vendas: goalSales,
        realizadoFaturamento: monthlyRevenue,
        realizadoVendas: monthlyPaid,
        progressoFaturamento: goalRevenue ? Number(Math.min(999, (monthlyRevenue / goalRevenue) * 100).toFixed(1)) : 0,
        progressoVendas: goalSales ? Number(Math.min(999, (monthlyPaid / goalSales) * 100).toFixed(1)) : 0
      },
      pipeline,
      planos: planRows.map((row) => ({
        codigo: row.codigo || "",
        nome: row.nome || row.codigo || "Plano",
        vendas: Number(row.vendas || 0),
        faturamento: money(row.faturamento)
      })),
      origens: sourceRows.map((row) => ({
        codigo: row.origem || "painel-vendas",
        total: Number(row.total || 0),
        pagas: Number(row.pagas || 0),
        faturamento: money(row.faturamento)
      })),
      pagamentos: paymentRows.map((row) => ({
        codigo: row.codigo || "",
        total: Number(row.total || 0),
        faturamento: money(row.faturamento)
      })),
      bestfy: {
        ultimaSincronizacao: bestfyRows[0]?.ultima_sincronizacao || null,
        pagasVerificadas: Number(bestfyRows[0]?.pagas_verificadas || 0)
      },
      auditoria: logRows.map((row) => ({
        vendaId: row.venda_id || "",
        usuarioEmail: row.usuario_email || "",
        acao: row.acao || "",
        createdAt: row.created_at || null
      }))
    });
  } catch (error) {
    console.error("Erro no Sales Command Center:", error);
    return res.status(500).json({ erro: "Erro interno ao carregar o Sales Command Center." });
  }
});

router.get("/vendas/metas", auth, requirePermission("painelVendas"), async (req, res) => {
  try {
    const comp = competence(req.query.competencia);
    const manager = canManage(req);
    const params = [comp];
    let where = "m.competencia=?";
    if (!manager) {
      where += " AND m.vendedor_id=?";
      params.push(userId(req));
    }

    const rows = await database.query(
      `SELECT m.*,u.nome vendedor_nome,u.email vendedor_email
         FROM vendas_metas m
         LEFT JOIN usuarios u ON u.id=m.vendedor_id
        WHERE ${where}
        ORDER BY (m.vendedor_id='') DESC,u.nome`,
      params
    );

    return res.json({
      sucesso: true,
      competencia: comp,
      podeGerenciar: manager,
      metas: rows.map((row) => ({
        id: row.id,
        competencia: row.competencia,
        vendedorId: row.vendedor_id || "",
        vendedorNome: row.vendedor_id ? (row.vendedor_nome || "Vendedor") : "Meta geral da equipe",
        vendedorEmail: row.vendedor_email || "",
        metaFaturamento: money(row.meta_faturamento),
        metaVendas: Number(row.meta_vendas || 0),
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    console.error("Erro ao listar metas comerciais:", error);
    return res.status(500).json({ erro: "Erro interno ao listar metas." });
  }
});

router.put("/vendas/metas", auth, requirePermission("painelVendas"), async (req, res) => {
  try {
    if (!canManage(req)) return res.status(403).json({ erro: "Sem permissão para alterar metas comerciais." });

    const comp = competence(req.body?.competencia);
    const sellerId = text(req.body?.vendedorId, 24);
    const revenueGoal = Math.max(0, Math.min(999999999.99, money(req.body?.metaFaturamento)));
    const salesGoal = Math.max(0, Math.min(1000000, Math.floor(number(req.body?.metaVendas))));

    if (sellerId) {
      const sellers = await database.query(
        `SELECT id FROM usuarios
          WHERE id=? AND cargo IN ('dev','dono','superadmin','admin','financeiro','vendedor')
          LIMIT 1`,
        [sellerId]
      );
      if (!sellers.length) return res.status(400).json({ erro: "Vendedor inválido para esta meta." });
    }

    const id = id24(`meta:${comp}:${sellerId || "equipe"}`);
    await database.query(
      `INSERT INTO vendas_metas
       (id,competencia,vendedor_id,meta_faturamento,meta_vendas,criado_por,atualizado_por)
       VALUES(?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         meta_faturamento=VALUES(meta_faturamento),meta_vendas=VALUES(meta_vendas),
         atualizado_por=VALUES(atualizado_por)`,
      [id, comp, sellerId, revenueGoal, salesGoal, req.usuario?.email || "", req.usuario?.email || ""]
    );

    return res.json({
      sucesso: true,
      mensagem: "Meta comercial salva.",
      meta: { competencia: comp, vendedorId: sellerId, metaFaturamento: revenueGoal, metaVendas: salesGoal }
    });
  } catch (error) {
    console.error("Erro ao salvar meta comercial:", error);
    return res.status(500).json({ erro: "Erro interno ao salvar a meta." });
  }
});

router.delete("/vendas/metas", auth, requirePermission("painelVendas"), async (req, res) => {
  try {
    if (!canManage(req)) return res.status(403).json({ erro: "Sem permissão para excluir metas comerciais." });
    const comp = competence(req.query.competencia);
    const sellerId = text(req.query.vendedorId, 24);
    await database.query("DELETE FROM vendas_metas WHERE competencia=? AND vendedor_id=?", [comp, sellerId]);
    return res.json({ sucesso: true, mensagem: "Meta removida." });
  } catch (error) {
    return res.status(500).json({ erro: "Erro interno ao remover a meta." });
  }
});

module.exports = router;
