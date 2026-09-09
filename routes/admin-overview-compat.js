"use strict";

const express = require("express");
const database = require("../config/database");
const Usuario = require("../models/Usuario");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();

const num = (value) => Number(value || 0) || 0;
const money = (value) => Number(num(value).toFixed(2));
const key = (value) => new Date(value).toISOString().slice(0, 10);
const sqlDate = (value) => new Date(value).toISOString().slice(0, 19).replace("T", " ");

async function tableExists(name) {
  const rows = await database.query("SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?", [name]);
  return num(rows[0]?.total) > 0;
}

async function count(table, where = "1=1", params = []) {
  if (!(await tableExists(table))) return 0;
  const rows = await database.query(`SELECT COUNT(*) AS total FROM \`${table}\` WHERE ${where}`, params);
  return num(rows[0]?.total);
}

function percentage(current, previous) {
  const a = num(current), b = num(previous);
  if (!b) return a > 0 ? 100 : 0;
  return Number((((a - b) / b) * 100).toFixed(1));
}

router.get("/dashboard/visao-geral", auth, requirePermission("painelAdmin"), async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query?.dias || 7), 7), 90);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const seriesStart = new Date(Date.now() - (days - 1) * 86400000);
    seriesStart.setHours(0, 0, 0, 0);

    const [totalUsers, freeActive, premiumActive, usersCurrentRows, usersPreviousRows] = await Promise.all([
      Usuario.countDocuments({ contaDev: { $ne: true } }),
      Usuario.countDocuments({ cargo: "aluno", status: "ativo", plano: "free" }),
      Usuario.countDocuments({ cargo: "aluno", status: "ativo", plano: { $nin: ["free", "admin"] } }),
      database.query("SELECT COUNT(*) AS total FROM usuarios WHERE conta_dev=0 AND created_at>=?", [sqlDate(monthStart)]),
      database.query("SELECT COUNT(*) AS total FROM usuarios WHERE conta_dev=0 AND created_at BETWEEN ? AND ?", [sqlDate(previousStart), sqlDate(previousEnd)])
    ]);

    const series = new Map();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const k = key(d);
      series.set(k, { data: k, rotulo: `${k.slice(8,10)}/${k.slice(5,7)}`, vendas: 0, faturamento: 0 });
    }

    let salesNow = { pagas: 0, faturamento: 0 }, salesPrevious = { pagas: 0, faturamento: 0 };
    let topPlans = [], recentSales = [];
    if (await tableExists("vendas")) {
      const [currentRows, previousRows, seriesRows, plansRows, recentRows] = await Promise.all([
        database.query("SELECT SUM(status='pago') AS pagas,COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento FROM vendas WHERE data_venda>=?", [key(monthStart)]),
        database.query("SELECT SUM(status='pago') AS pagas,COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento FROM vendas WHERE data_venda BETWEEN ? AND ?", [key(previousStart), key(previousEnd)]),
        database.query("SELECT data_venda AS data,SUM(status='pago') AS vendas,COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento FROM vendas WHERE data_venda>=? GROUP BY data_venda ORDER BY data_venda", [key(seriesStart)]),
        database.query("SELECT produto_codigo AS plano,COUNT(*) AS vendas,COALESCE(SUM(valor),0) AS faturamento FROM vendas WHERE status='pago' GROUP BY produto_codigo ORDER BY faturamento DESC LIMIT 5"),
        database.query("SELECT cliente_nome,cliente_email,produto_nome,produto_codigo,valor,pago_em,created_at FROM vendas WHERE status='pago' ORDER BY COALESCE(pago_em,created_at) DESC LIMIT 6")
      ]);
      salesNow = currentRows[0] || salesNow;
      salesPrevious = previousRows[0] || salesPrevious;
      seriesRows.forEach((row) => { const k = key(row.data); if (series.has(k)) series.set(k, { ...series.get(k), vendas: num(row.vendas), faturamento: money(row.faturamento) }); });
      topPlans = plansRows.map((row, index) => ({ posicao: index + 1, plano: row.plano || "", vendas: num(row.vendas), faturamento: money(row.faturamento) }));
      recentSales = recentRows;
    }

    const [pendingCodes, openTickets, activeExams] = await Promise.all([
      count("solicitacoes_liberacao", "status='pendente'"),
      count("support_tickets", "status IN ('aberto','em_atendimento','respondido')"),
      count("provas_resultados", "status IN ('pendente','em_analise')")
    ]);

    const recentUsers = await database.query("SELECT nome,email,status,created_at FROM usuarios WHERE conta_dev=0 ORDER BY created_at DESC LIMIT 6");
    const activities = [
      ...recentUsers.map((row) => ({ tipo: "usuario", icone: "•", titulo: "Novo usuário cadastrado", descricao: `${row.nome || "Usuário"} • ${row.email || ""}`, createdAt: row.created_at, status: row.status || "ativo" })),
      ...recentSales.map((row) => ({ tipo: "venda", icone: "$", titulo: "Pagamento confirmado", descricao: `${row.cliente_nome || row.cliente_email || "Cliente"} • ${row.produto_nome || row.produto_codigo || "Plano"}`, createdAt: row.pago_em || row.created_at, status: "pago" }))
    ].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,12);

    const alerts = [];
    if (pendingCodes) alerts.push({ tipo: "warning", titulo: `${pendingCodes} aprovação(ões) pendente(s)`, descricao: "Revise as solicitações Premium.", destino: "approvals" });
    if (openTickets) alerts.push({ tipo: "danger", titulo: `${openTickets} chamado(s) aberto(s)`, descricao: "Acompanhe a fila de suporte.", destino: "support" });

    return res.json({
      sucesso: true,
      origem: "mysql",
      periodo: { dias: days, inicio: seriesStart, fim: now },
      indicadores: {
        totalUsuarios: num(totalUsers),
        usuariosMes: num(usersCurrentRows[0]?.total),
        crescimentoUsuarios: percentage(usersCurrentRows[0]?.total, usersPreviousRows[0]?.total),
        freeAtivos: num(freeActive),
        premiumAtivos: num(premiumActive),
        vendasMes: num(salesNow.pagas),
        crescimentoVendas: percentage(salesNow.pagas, salesPrevious.pagas),
        faturamentoMes: money(salesNow.faturamento),
        crescimentoFaturamento: percentage(salesNow.faturamento, salesPrevious.faturamento),
        conversao: num(totalUsers) ? Number(((num(premiumActive) / num(totalUsers)) * 100).toFixed(2)) : 0,
        codigosPendentes: pendingCodes,
        chamadosAbertos: openTickets,
        provasAtivas: activeExams
      },
      serieVendas: Array.from(series.values()),
      atividades: activities,
      alertas: alerts,
      topPlanos,
      funil: [
        { etapa: "Contas cadastradas", total: num(totalUsers) },
        { etapa: "Usuários Free ativos", total: num(freeActive) },
        { etapa: "Solicitações pendentes", total: pendingCodes },
        { etapa: "Premium ativos", total: num(premiumActive) }
      ]
    });
  } catch (error) {
    console.error("Erro no overview de compatibilidade MySQL:", error);
    return res.status(500).json({ erro: "Erro interno ao carregar a visão geral." });
  }
});

module.exports = router;
