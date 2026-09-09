"use strict";

const express = require("express");
const database = require("../config/database");
const Usuario = require("../models/Usuario");
const { authPagina } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { ensureAuditTable } = require("../services/security-audit");
const { ensureStructure: ensureSessionStructure } = require("../services/sessions");
const { statusConfiguracaoBestfy } = require("../services/bestfy");

const router = express.Router();

function n(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return Number(n(value).toFixed(2));
}

function clampDays(value, fallback = 7) {
  const days = Number(value || fallback);
  return Math.min(Math.max(Number.isFinite(days) ? Math.round(days) : fallback, 7), 90);
}

function sqlDate(date) {
  return new Date(date).toISOString().slice(0, 19).replace("T", " ");
}

function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function percent(current, previous) {
  const a = n(current);
  const b = n(previous);
  if (!b) return a > 0 ? 100 : 0;
  return Number((((a - b) / b) * 100).toFixed(1));
}

async function tableExists(name) {
  try {
    const rows = await database.query(
      `SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
      [name]
    );
    return n(rows[0]?.total) > 0;
  } catch (error) {
    console.warn(`[ADMIN_CC] Não foi possível verificar a tabela ${name}:`, error.message);
    return false;
  }
}

async function safeCount(table, where = "1=1", params = []) {
  try {
    if (!(await tableExists(table))) return 0;
    const rows = await database.query(`SELECT COUNT(*) AS total FROM \`${table}\` WHERE ${where}`, params);
    return n(rows[0]?.total);
  } catch (error) {
    console.warn(`[ADMIN_CC] Contagem opcional indisponível em ${table}:`, error.message);
    return 0;
  }
}

function emptySeries(days) {
  const map = new Map();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = dateKey(date);
    map.set(key, {
      data: key,
      rotulo: `${key.slice(8, 10)}/${key.slice(5, 7)}`,
      usuarios: 0,
      vendas: 0,
      faturamento: 0
    });
  }
  return map;
}

async function overviewData(days) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const seriesStart = new Date(Date.now() - (days - 1) * 86400000);
  seriesStart.setHours(0, 0, 0, 0);
  const sevenDays = new Date(Date.now() + 7 * 86400000);

  const userRows = await database.query(`
    SELECT
      COUNT(*) AS total,
      SUM(cargo='aluno' AND status='ativo' AND suspenso=0 AND plano='free') AS free_ativos,
      SUM(cargo='aluno' AND status='ativo' AND suspenso=0 AND plano NOT IN ('free','admin') AND (data_expiracao IS NULL OR data_expiracao='' OR data_expiracao >= CURDATE())) AS premium_ativos,
      SUM(cargo='aluno' AND status='suspenso') AS suspensos,
      SUM(cargo='aluno' AND status='bloqueado') AS bloqueados,
      SUM(cargo='aluno' AND status='ativo' AND suspenso=0 AND plano NOT IN ('free','admin') AND data_expiracao <> '' AND data_expiracao BETWEEN CURDATE() AND ?) AS expirando
    FROM usuarios WHERE conta_dev=0
  `, [dateKey(sevenDays)]);
  const users = userRows[0] || {};

  const [currentUsersRows, previousUsersRows] = await Promise.all([
    database.query(
      "SELECT COUNT(*) AS total FROM usuarios WHERE conta_dev=0 AND created_at >= ?",
      [sqlDate(monthStart)]
    ),
    database.query(
      "SELECT COUNT(*) AS total FROM usuarios WHERE conta_dev=0 AND created_at BETWEEN ? AND ?",
      [sqlDate(previousStart), sqlDate(previousEnd)]
    )
  ]);

  let salesCurrent = { pagas: 0, faturamento: 0 };
  let salesPrevious = { pagas: 0, faturamento: 0 };
  let salesSeries = [];
  let topPlans = [];
  let recentSales = [];

  if (await tableExists("vendas")) {
    try {
      const [current, previous, series, plans, recent] = await Promise.all([
        database.query(`SELECT SUM(status='pago') AS pagas, COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento FROM vendas WHERE data_venda >= ?`, [dateKey(monthStart)]),
        database.query(`SELECT SUM(status='pago') AS pagas, COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento FROM vendas WHERE data_venda BETWEEN ? AND ?`, [dateKey(previousStart), dateKey(previousEnd)]),
        database.query(`SELECT data_venda AS data, SUM(status='pago') AS vendas, COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento FROM vendas WHERE data_venda >= ? GROUP BY data_venda ORDER BY data_venda`, [dateKey(seriesStart)]),
        database.query(`SELECT produto_codigo AS plano, produto_nome AS nome, COUNT(*) AS vendas, COALESCE(SUM(valor),0) AS faturamento FROM vendas WHERE status='pago' GROUP BY produto_codigo,produto_nome ORDER BY faturamento DESC LIMIT 5`),
        database.query(`SELECT id,cliente_nome,cliente_email,produto_codigo,produto_nome,valor,pago_em,created_at FROM vendas WHERE status='pago' ORDER BY COALESCE(pago_em,created_at) DESC LIMIT 6`)
      ]);
      salesCurrent = current[0] || salesCurrent;
      salesPrevious = previous[0] || salesPrevious;
      salesSeries = series;
      topPlans = plans.map((row, index) => ({ posicao: index + 1, plano: row.plano || "", nome: row.nome || row.plano || "Plano", vendas: n(row.vendas), faturamento: money(row.faturamento) }));
      recentSales = recent;
    } catch (error) {
      console.warn("[ADMIN_CC] Métricas de vendas indisponíveis; painel continuará com os demais dados:", error.message);
    }
  }

  const series = emptySeries(days);
  const newUsers = await database.query(
    "SELECT DATE(created_at) AS data, COUNT(*) AS total FROM usuarios WHERE conta_dev=0 AND created_at >= ? GROUP BY DATE(created_at) ORDER BY DATE(created_at)",
    [sqlDate(seriesStart)]
  );
  for (const row of newUsers) {
    const key = dateKey(row.data);
    if (series.has(key)) series.get(key).usuarios = n(row.total);
  }
  for (const row of salesSeries) {
    const key = dateKey(row.data);
    if (series.has(key)) {
      series.get(key).vendas = n(row.vendas);
      series.get(key).faturamento = money(row.faturamento);
    }
  }

  const [approvals, urgentSupport, openSupport, examsReview] = await Promise.all([
    safeCount("solicitacoes_liberacao", "status=?", ["pendente"]),
    safeCount("support_tickets", "prioridade='urgente' AND status NOT IN ('resolvido','fechado')"),
    safeCount("support_tickets", "status IN ('aberto','em_atendimento','respondido')"),
    safeCount("provas_resultados", "status='em_analise'")
  ]);

  const recentUsers = await database.query(
    "SELECT id,nome,email,plano,status,created_at FROM usuarios WHERE conta_dev=0 ORDER BY created_at DESC LIMIT 6"
  );

  let recentTickets = [];
  if (await tableExists("support_tickets")) {
    try {
      recentTickets = await database.query("SELECT id,assunto,usuario_nome,usuario_email,prioridade,status,updated_at,created_at FROM support_tickets ORDER BY updated_at DESC LIMIT 6");
    } catch (error) {
      console.warn("[ADMIN_CC] Atividades de suporte indisponíveis:", error.message);
    }
  }

  let recentAudit = [];
  try {
    await ensureAuditTable();
    recentAudit = await database.query(
      "SELECT event,actor_email,target_email,created_at FROM security_audit_log ORDER BY created_at DESC LIMIT 8"
    );
  } catch (error) {
    console.warn("[ADMIN_CC] Auditoria opcional indisponível na visão geral:", error.message);
  }

  const activities = [
    ...recentUsers.map((row) => ({ type: "user", title: "Novo usuário", description: `${row.nome || "Usuário"}${row.email ? ` • ${row.email}` : ""}`, createdAt: row.created_at, status: row.status || "ativo" })),
    ...recentSales.map((row) => ({ type: "payment", title: "Pagamento confirmado", description: `${row.cliente_nome || row.cliente_email || "Cliente"} • ${row.produto_nome || row.produto_codigo || "Plano"} • R$ ${money(row.valor).toFixed(2).replace(".", ",")}`, createdAt: row.pago_em || row.created_at, status: "pago" })),
    ...recentTickets.map((row) => ({ type: "support", title: row.prioridade === "urgente" ? "Chamado urgente" : "Chamado de suporte", description: `${row.assunto || "Suporte"} • ${row.usuario_nome || row.usuario_email || "Usuário"}`, createdAt: row.updated_at || row.created_at, status: row.status || "aberto" })),
    ...recentAudit.map((row) => ({ type: "security", title: String(row.event || "Evento de segurança").replaceAll(".", " "), description: row.target_email || row.actor_email || "Evento administrativo", createdAt: row.created_at, status: "audit" }))
  ]
    .filter((item) => item.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 12);

  const total = n(users.total);
  const premium = n(users.premium_ativos);
  const free = n(users.free_ativos);

  return {
    periodo: { dias: days, inicio: seriesStart.toISOString(), fim: now.toISOString() },
    indicadores: {
      totalUsuarios: total,
      premiumAtivos: premium,
      freeAtivos: free,
      faturamentoMes: money(salesCurrent.faturamento),
      vendasMes: n(salesCurrent.pagas),
      conversao: total ? Number(((premium / total) * 100).toFixed(2)) : 0,
      crescimentoUsuarios: percent(currentUsersRows[0]?.total, previousUsersRows[0]?.total),
      crescimentoVendas: percent(salesCurrent.pagas, salesPrevious.pagas),
      crescimentoFaturamento: percent(salesCurrent.faturamento, salesPrevious.faturamento)
    },
    operacao: {
      aprovacoesPendentes: approvals,
      chamadosUrgentes: urgentSupport,
      chamadosAbertos: openSupport,
      provasEmAnalise: examsReview,
      premiumExpirando: n(users.expirando)
    },
    serie: Array.from(series.values()),
    atividades: activities,
    topPlanos,
    alunosRecentes: recentUsers.map((row) => ({ id: row.id, nome: row.nome || "Aluno", email: row.email || "", plano: row.plano || "free", status: row.status || "ativo", createdAt: row.created_at }))
  };
}

router.get("/command-center/overview", authPagina, requirePermission("painelAdmin"), async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const data = await overviewData(clampDays(req.query?.dias, 7));
    return res.json({ sucesso: true, origem: "mysql", ...data });
  } catch (error) {
    console.error("Erro no Admin Command Center:", error);
    return res.status(503).json({ erro: "Os dados do Command Center estão temporariamente indisponíveis.", codigo: "ADMIN_CC_DATA_UNAVAILABLE" });
  }
});

router.get("/command-center/status", authPagina, requirePermission("painelAdmin"), async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const services = {
    api: { status: "online", label: "API" },
    database: { status: "indisponivel", label: "MySQL" },
    bestfy: { status: "indisponivel", label: "Bestfy" },
    auth: { status: "online", label: "Autenticação" }
  };

  try {
    await database.query("SELECT 1 AS ok");
    services.database.status = "online";
  } catch (_) {}

  try {
    const config = statusConfiguracaoBestfy();
    services.bestfy.status = config.apiKeyConfigurada ? "configurada" : "indisponivel";
  } catch (_) {}

  return res.json({ sucesso: true, services });
});

router.get("/command-center/security", authPagina, requirePermission("seguranca"), async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    await Promise.all([ensureAuditTable(), ensureSessionStructure()]);
    const [suspended, blocked, revokedRows, auditCountRows, criticalRows, events] = await Promise.all([
      Usuario.countDocuments({ cargo: "aluno", status: "suspenso" }),
      Usuario.countDocuments({ cargo: "aluno", status: "bloqueado" }),
      database.query("SELECT COUNT(*) AS total FROM revoked_tokens WHERE revoked_at >= (CURRENT_TIMESTAMP - INTERVAL 24 HOUR)"),
      database.query("SELECT COUNT(*) AS total FROM security_audit_log WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL 24 HOUR)"),
      database.query(`SELECT COUNT(*) AS total FROM security_audit_log WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL 24 HOUR) AND (event LIKE '%block%' OR event LIKE '%suspend%' OR event LIKE '%role%' OR event LIKE '%permission%' OR event LIKE '%session%' OR event LIKE '%password%')`),
      database.query("SELECT id,event,actor_email,target_email,metadata,created_at FROM security_audit_log ORDER BY created_at DESC LIMIT 30")
    ]);

    return res.json({
      sucesso: true,
      resumo: {
        revogacoes24h: n(revokedRows[0]?.total),
        contasSuspensas: n(suspended),
        contasBloqueadas: n(blocked),
        eventos24h: n(auditCountRows[0]?.total),
        eventosCriticos24h: n(criticalRows[0]?.total)
      },
      eventos: events.map((row) => ({
        id: row.id,
        evento: row.event,
        ator: row.actor_email || "",
        alvo: row.target_email || "",
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error("Erro na auditoria do Command Center:", error);
    return res.status(503).json({ erro: "A auditoria está temporariamente indisponível.", codigo: "ADMIN_CC_AUDIT_UNAVAILABLE" });
  }
});

module.exports = router;
