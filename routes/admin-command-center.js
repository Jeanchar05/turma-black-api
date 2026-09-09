"use strict";

const express = require("express");
const database = require("../config/database");
const Usuario = require("../models/Usuario");
const { auth } = require("../middleware/auth");
const { requirePermission, getCargo } = require("../middleware/permissions");
const { sensitiveWriteRateLimit } = require("../middleware/rate-limit");
const { ensureAuditTable, audit } = require("../services/security-audit");
const { ensureStructure: ensureSessionStructure } = require("../services/sessions");
const { statusConfiguracaoBestfy } = require("../services/bestfy");

const router = express.Router();

const PLAN_DAYS = Object.freeze({ black30: 30, black90: 90, black180: 180, black360: 365 });
const SETTINGS_DEFAULTS = Object.freeze({
  nomeSistema: "Turma do Primo",
  nomePremium: "Turma do Primo Premium",
  temaPadrao: "dark",
  modoManutencao: false,
  manutencaoTitulo: "Estamos melhorando a plataforma",
  manutencaoMensagem: "Voltaremos em breve.",
  comissaoPadrao: 20,
  links: { whatsappSuporte: "", whatsappVendas: "", instagram: "" }
});

function n(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return Number(n(value).toFixed(2));
}

function text(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function email(value) {
  return text(value, 190).toLowerCase();
}

function clampDays(value, fallback = 7) {
  const days = Number(value || fallback);
  return Math.min(Math.max(Number.isFinite(days) ? Math.round(days) : fallback, 7), 365);
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

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

async function tableExists(name) {
  try {
    const rows = await database.query(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
      [name]
    );
    return n(rows[0]?.total) > 0;
  } catch (error) {
    console.warn(`[ADMIN_CC] Não foi possível verificar ${name}:`, error.message);
    return false;
  }
}

async function safeCount(table, where = "1=1", params = []) {
  try {
    if (!(await tableExists(table))) return 0;
    const rows = await database.query(`SELECT COUNT(*) AS total FROM \`${table}\` WHERE ${where}`, params);
    return n(rows[0]?.total);
  } catch (error) {
    console.warn(`[ADMIN_CC] Contagem opcional falhou em ${table}:`, error.message);
    return 0;
  }
}

async function ensureApprovalsTable() {
  await database.query(`
    CREATE TABLE IF NOT EXISTS solicitacoes_liberacao (
      id CHAR(24) NOT NULL PRIMARY KEY,
      codigo VARCHAR(64) NOT NULL UNIQUE,
      usuario_id CHAR(24) NOT NULL DEFAULT '',
      nome VARCHAR(160) NOT NULL DEFAULT '',
      email VARCHAR(190) NOT NULL DEFAULT '',
      telefone VARCHAR(40) NOT NULL DEFAULT '',
      plano VARCHAR(32) NOT NULL DEFAULT 'black30',
      valor DECIMAL(12,2) NOT NULL DEFAULT 0,
      referencia_pagamento VARCHAR(190) NOT NULL DEFAULT '',
      comprovante LONGTEXT NULL,
      observacao TEXT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'pendente',
      analisado_em DATETIME NULL,
      analisado_por VARCHAR(190) NOT NULL DEFAULT '',
      motivo_recusa VARCHAR(1000) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_liberacao_user (usuario_id, status),
      KEY idx_liberacao_status (status, created_at),
      KEY idx_liberacao_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureSettingsTable() {
  await database.query(`
    CREATE TABLE IF NOT EXISTS admin_configuracoes (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      dados LONGTEXT NULL,
      atualizado_por VARCHAR(190) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await database.query(
    "INSERT IGNORE INTO admin_configuracoes (id,dados,atualizado_por) VALUES (1,?,?)",
    [JSON.stringify(SETTINGS_DEFAULTS), "bootstrap"]
  );
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

async function financeData(days = 30) {
  const start = new Date(Date.now() - (days - 1) * 86400000);
  start.setHours(0, 0, 0, 0);
  const startKey = dateKey(start);

  const result = {
    periodo: { dias: days, inicio: start.toISOString(), fim: new Date().toISOString() },
    resumo: { total: 0, pagas: 0, pendentes: 0, canceladas: 0, estornadas: 0, faturamento: 0, reembolsos: 0, comissoes: 0, ticketMedio: 0 },
    serie: [], ranking: [], ultimasVendas: [], planos: []
  };

  if (!(await tableExists("vendas"))) return result;

  try {
    const [summaryRows, seriesRows, rankingRows, recentRows, planRows] = await Promise.all([
      database.query(`
        SELECT COUNT(*) AS total,
          SUM(status='pago') AS pagas,
          SUM(status='pendente') AS pendentes,
          SUM(status='cancelado') AS canceladas,
          SUM(status='estornado') AS estornadas,
          COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento,
          COALESCE(SUM(CASE WHEN status='estornado' THEN valor ELSE 0 END),0) AS reembolsos,
          COALESCE(SUM(CASE WHEN status='pago' THEN comissao ELSE 0 END),0) AS comissoes
        FROM vendas WHERE data_venda >= ?`, [startKey]),
      database.query(`
        SELECT data_venda AS data,
          SUM(status='pago') AS vendas,
          COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento
        FROM vendas WHERE data_venda >= ? GROUP BY data_venda ORDER BY data_venda`, [startKey]),
      database.query(`
        SELECT vendedor_id,vendedor_nome,vendedor_email,
          SUM(status='pago') AS vendas,
          COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento,
          COALESCE(SUM(CASE WHEN status='pago' THEN comissao ELSE 0 END),0) AS comissao
        FROM vendas WHERE data_venda >= ? GROUP BY vendedor_id,vendedor_nome,vendedor_email
        HAVING vendas > 0 ORDER BY faturamento DESC LIMIT 12`, [startKey]),
      database.query(`
        SELECT id,cliente_id,cliente_nome,cliente_email,vendedor_nome,vendedor_email,
          produto_codigo,produto_nome,valor,forma_pagamento,status,origem,data_venda,pago_em,created_at
        FROM vendas WHERE data_venda >= ? ORDER BY COALESCE(pago_em,created_at) DESC LIMIT 40`, [startKey]),
      database.query(`
        SELECT produto_codigo AS plano,produto_nome AS nome,
          SUM(status='pago') AS vendas,
          COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento
        FROM vendas WHERE data_venda >= ? GROUP BY produto_codigo,produto_nome ORDER BY faturamento DESC`, [startKey])
    ]);

    const s = summaryRows[0] || {};
    result.resumo = {
      total: n(s.total), pagas: n(s.pagas), pendentes: n(s.pendentes), canceladas: n(s.canceladas), estornadas: n(s.estornadas),
      faturamento: money(s.faturamento), reembolsos: money(s.reembolsos), comissoes: money(s.comissoes),
      ticketMedio: n(s.pagas) ? money(n(s.faturamento) / n(s.pagas)) : 0
    };
    result.serie = seriesRows.map((row) => ({ data: dateKey(row.data), rotulo: `${dateKey(row.data).slice(8,10)}/${dateKey(row.data).slice(5,7)}`, vendas: n(row.vendas), faturamento: money(row.faturamento) }));
    result.ranking = rankingRows.map((row, index) => ({ posicao: index + 1, vendedorId: row.vendedor_id || "", nome: row.vendedor_nome || "Sem vendedor", email: row.vendedor_email || "", vendas: n(row.vendas), faturamento: money(row.faturamento), comissao: money(row.comissao) }));
    result.ultimasVendas = recentRows.map((row) => ({ id: row.id, clienteId: row.cliente_id || "", alunoNome: row.cliente_nome || "Cliente", alunoEmail: row.cliente_email || "", vendedorNome: row.vendedor_nome || "", vendedorEmail: row.vendedor_email || "", plano: row.produto_codigo || "", produtoNome: row.produto_nome || row.produto_codigo || "Plano", valor: money(row.valor), formaPagamento: row.forma_pagamento || "", status: row.status || "pendente", origem: row.origem || "", dataVenda: row.data_venda || "", pagoEm: row.pago_em || "", createdAt: row.created_at || "" }));
    result.planos = planRows.map((row, index) => ({ posicao: index + 1, plano: row.plano || "", nome: row.nome || row.plano || "Plano", vendas: n(row.vendas), faturamento: money(row.faturamento) }));
  } catch (error) {
    console.warn("[ADMIN_CC] Financeiro parcial:", error.message);
  }

  return result;
}

async function overviewData(days) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const seriesStart = new Date(Date.now() - (days - 1) * 86400000);
  seriesStart.setHours(0, 0, 0, 0);
  const sevenDays = new Date(Date.now() + 7 * 86400000);

  await ensureApprovalsTable();

  const userRows = await database.query(`
    SELECT COUNT(*) AS total,
      SUM(cargo='aluno') AS alunos,
      SUM(cargo='aluno' AND status='ativo' AND suspenso=0 AND plano='free') AS free_ativos,
      SUM(cargo='aluno' AND status='ativo' AND suspenso=0 AND plano NOT IN ('free','admin') AND data_expiracao <> '' AND data_expiracao >= CURDATE()) AS premium_ativos,
      SUM(cargo='aluno' AND status='suspenso') AS suspensos,
      SUM(cargo='aluno' AND status='bloqueado') AS bloqueados,
      SUM(cargo='aluno' AND status='ativo' AND suspenso=0 AND plano NOT IN ('free','admin') AND data_expiracao <> '' AND data_expiracao BETWEEN CURDATE() AND ?) AS expirando
    FROM usuarios WHERE conta_dev=0
  `, [dateKey(sevenDays)]);
  const users = userRows[0] || {};

  const [currentUsersRows, previousUsersRows] = await Promise.all([
    database.query("SELECT COUNT(*) AS total FROM usuarios WHERE conta_dev=0 AND created_at >= ?", [sqlDate(monthStart)]),
    database.query("SELECT COUNT(*) AS total FROM usuarios WHERE conta_dev=0 AND created_at BETWEEN ? AND ?", [sqlDate(previousStart), sqlDate(previousEnd)])
  ]);

  const financeMonth = await financeData(Math.max(31, now.getDate()));
  const series = emptySeries(days);
  const newUsers = await database.query(
    "SELECT DATE(created_at) AS data,COUNT(*) AS total FROM usuarios WHERE conta_dev=0 AND created_at >= ? GROUP BY DATE(created_at) ORDER BY DATE(created_at)",
    [sqlDate(seriesStart)]
  );
  for (const row of newUsers) {
    const key = dateKey(row.data);
    if (series.has(key)) series.get(key).usuarios = n(row.total);
  }

  if (await tableExists("vendas")) {
    try {
      const salesSeries = await database.query(`SELECT data_venda AS data,SUM(status='pago') AS vendas,COALESCE(SUM(CASE WHEN status='pago' THEN valor ELSE 0 END),0) AS faturamento FROM vendas WHERE data_venda >= ? GROUP BY data_venda ORDER BY data_venda`, [dateKey(seriesStart)]);
      for (const row of salesSeries) {
        const key = dateKey(row.data);
        if (series.has(key)) {
          series.get(key).vendas = n(row.vendas);
          series.get(key).faturamento = money(row.faturamento);
        }
      }
    } catch (error) { console.warn("[ADMIN_CC] Série de vendas indisponível:", error.message); }
  }

  const [approvals, urgentSupport, openSupport, examsReview, notificationsActive] = await Promise.all([
    safeCount("solicitacoes_liberacao", "status=?", ["pendente"]),
    safeCount("support_tickets", "prioridade='urgente' AND status NOT IN ('resolvido','fechado')"),
    safeCount("support_tickets", "status IN ('aberto','em_atendimento','respondido')"),
    safeCount("provas_resultados", "status IN ('pendente','em_analise')"),
    safeCount("notificacoes", "ativa=1")
  ]);

  const recentUsers = await database.query("SELECT id,nome,email,plano,status,ultimo_login,created_at FROM usuarios WHERE conta_dev=0 ORDER BY created_at DESC LIMIT 8");
  let recentTickets = [];
  if (await tableExists("support_tickets")) {
    try { recentTickets = await database.query("SELECT id,assunto,usuario_nome,usuario_email,prioridade,status,updated_at,created_at FROM support_tickets ORDER BY updated_at DESC LIMIT 6"); } catch (_) {}
  }

  let recentAudit = [];
  try {
    await ensureAuditTable();
    recentAudit = await database.query("SELECT event,actor_email,target_email,created_at FROM security_audit_log ORDER BY created_at DESC LIMIT 8");
  } catch (_) {}

  const activities = [
    ...recentUsers.map((row) => ({ type: "user", title: "Novo usuário cadastrado", description: `${row.nome || "Usuário"}${row.email ? ` • ${row.email}` : ""}`, createdAt: row.created_at, status: row.status || "ativo" })),
    ...financeMonth.ultimasVendas.slice(0, 6).map((row) => ({ type: "payment", title: row.status === "pago" ? "Pagamento confirmado" : "Venda atualizada", description: `${row.alunoNome} • ${row.produtoNome} • R$ ${money(row.valor).toFixed(2).replace(".", ",")}`, createdAt: row.pagoEm || row.createdAt, status: row.status })),
    ...recentTickets.map((row) => ({ type: "support", title: row.prioridade === "urgente" ? "Chamado urgente" : "Chamado de suporte", description: `${row.assunto || "Suporte"} • ${row.usuario_nome || row.usuario_email || "Usuário"}`, createdAt: row.updated_at || row.created_at, status: row.status || "aberto" })),
    ...recentAudit.map((row) => ({ type: "security", title: String(row.event || "Evento de segurança").replaceAll(".", " "), description: row.target_email || row.actor_email || "Evento administrativo", createdAt: row.created_at, status: "audit" }))
  ].filter((item) => item.createdAt).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 16);

  const total = n(users.total);
  const premium = n(users.premium_ativos);
  const free = n(users.free_ativos);

  return {
    periodo: { dias: days, inicio: seriesStart.toISOString(), fim: now.toISOString() },
    indicadores: {
      totalUsuarios: total,
      totalAlunos: n(users.alunos),
      premiumAtivos: premium,
      freeAtivos: free,
      faturamentoMes: financeMonth.resumo.faturamento,
      vendasMes: financeMonth.resumo.pagas,
      ticketsAbertos: openSupport,
      conversao: total ? Number(((premium / total) * 100).toFixed(2)) : 0,
      crescimentoUsuarios: percent(currentUsersRows[0]?.total, previousUsersRows[0]?.total),
      crescimentoVendas: 0,
      crescimentoFaturamento: 0
    },
    operacao: {
      aprovacoesPendentes: approvals,
      chamadosUrgentes: urgentSupport,
      chamadosAbertos: openSupport,
      provasEmAnalise: examsReview,
      premiumExpirando: n(users.expirando),
      notificacoesAtivas: notificationsActive
    },
    serie: Array.from(series.values()),
    atividades: activities,
    topPlanos: financeMonth.planos.slice(0, 5),
    alunosRecentes: recentUsers.map((row) => ({ id: row.id, nome: row.nome || "Aluno", email: row.email || "", plano: row.plano || "free", status: row.status || "ativo", ultimoLogin: row.ultimo_login || "", createdAt: row.created_at }))
  };
}

function approvalRow(row) {
  return {
    id: row.id, _id: row.id, codigo: row.codigo || "", usuarioId: row.usuario_id || "", nome: row.nome || "Aluno", email: row.email || "", telefone: row.telefone || "",
    plano: row.plano || "black30", valor: money(row.valor), referenciaPagamento: row.referencia_pagamento || "", comprovante: row.comprovante || "", observacao: row.observacao || "", status: row.status || "pendente",
    analisadoEm: row.analisado_em || "", analisadoPor: row.analisado_por || "", motivoRecusa: row.motivo_recusa || "", createdAt: row.created_at || "", updatedAt: row.updated_at || ""
  };
}

router.get("/command-center/overview", auth, requirePermission("painelAdmin"), async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const data = await overviewData(clampDays(req.query?.dias, 7));
    return res.json({ sucesso: true, origem: "mysql", ...data });
  } catch (error) {
    console.error("Erro no Admin Command Center:", error);
    return res.status(503).json({ erro: "Os dados do Command Center estão temporariamente indisponíveis.", codigo: "ADMIN_CC_DATA_UNAVAILABLE" });
  }
});

router.get("/command-center/status", auth, requirePermission("painelAdmin"), async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const services = {
    api: { status: "online", label: "API" }, database: { status: "indisponivel", label: "MySQL" }, bestfy: { status: "indisponivel", label: "Bestfy" }, auth: { status: "online", label: "Autenticação" }
  };
  try { await database.query("SELECT 1 AS ok"); services.database.status = "online"; } catch (_) {}
  try { const config = statusConfiguracaoBestfy(); services.bestfy.status = config.apiKeyConfigurada ? "configurada" : "indisponivel"; } catch (_) {}
  return res.json({ sucesso: true, services });
});

router.get("/financeiro/resumo", auth, requirePermission("financas"), async (req, res) => {
  try { return res.json({ sucesso: true, origem: "mysql", ...(await financeData(clampDays(req.query?.dias, 30))) }); }
  catch (error) { console.error("Erro financeiro Admin CC:", error); return res.status(500).json({ erro: "Não foi possível carregar o financeiro." }); }
});

router.get("/command-center/reports", auth, requirePermission("relatorios"), async (req, res) => {
  try {
    const days = clampDays(req.query?.dias, 30);
    const [overview, finance] = await Promise.all([overviewData(days), financeData(days)]);
    const start = new Date(Date.now() - (days - 1) * 86400000); start.setHours(0,0,0,0);
    const userRows = await database.query("SELECT DATE(created_at) AS data,COUNT(*) AS novos FROM usuarios WHERE conta_dev=0 AND created_at >= ? GROUP BY DATE(created_at) ORDER BY DATE(created_at)", [sqlDate(start)]);
    const userSeries = emptySeries(days);
    userRows.forEach((row) => { const key = dateKey(row.data); if (userSeries.has(key)) userSeries.get(key).usuarios = n(row.novos); });
    return res.json({ sucesso: true, origem: "mysql", periodo: { dias: days }, indicadores: overview.indicadores, usuariosSerie: Array.from(userSeries.values()), financeiro: finance, funil: [
      { etapa: "Contas cadastradas", total: overview.indicadores.totalUsuarios },
      { etapa: "Free ativos", total: overview.indicadores.freeAtivos },
      { etapa: "Premium ativos", total: overview.indicadores.premiumAtivos },
      { etapa: "Vendas confirmadas", total: finance.resumo.pagas }
    ] });
  } catch (error) { console.error("Erro relatórios Admin CC:", error); return res.status(500).json({ erro: "Não foi possível carregar os relatórios." }); }
});

router.get("/liberacoes/resumo", auth, requirePermission("aprovacoes"), async (_req, res) => {
  try {
    await ensureApprovalsTable();
    const rows = await database.query("SELECT COUNT(*) AS total,SUM(status='pendente') AS pendentes,SUM(status='aprovado') AS aprovadas,SUM(status='recusado') AS recusadas FROM solicitacoes_liberacao");
    const r = rows[0] || {};
    return res.json({ sucesso: true, origem: "mysql", resumo: { total: n(r.total), pendentes: n(r.pendentes), aprovadas: n(r.aprovadas), recusadas: n(r.recusadas) } });
  } catch (error) { return res.status(500).json({ erro: "Não foi possível carregar o resumo de aprovações." }); }
});

router.get("/liberacoes", auth, requirePermission("aprovacoes"), async (req, res) => {
  try {
    await ensureApprovalsTable();
    const conditions = ["1=1"]; const params = [];
    const status = text(req.query?.status, 24).toLowerCase();
    const search = text(req.query?.busca, 160);
    if (["pendente","aprovado","recusado","cancelado"].includes(status)) { conditions.push("status=?"); params.push(status); }
    if (search) { conditions.push("(codigo LIKE ? OR nome LIKE ? OR email LIKE ?)"); const like=`%${search}%`; params.push(like,like,like); }
    const rows = await database.query(`SELECT * FROM solicitacoes_liberacao WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT 300`, params);
    return res.json({ sucesso: true, origem: "mysql", total: rows.length, solicitacoes: rows.map(approvalRow) });
  } catch (error) { return res.status(500).json({ erro: "Não foi possível listar as aprovações." }); }
});

router.post("/liberacoes/:id/aprovar", auth, sensitiveWriteRateLimit, requirePermission("aprovacoes"), async (req, res) => {
  const connection = await database.getPool().getConnection();
  try {
    await ensureApprovalsTable();
    await connection.beginTransaction();
    const [requests] = await connection.execute("SELECT * FROM solicitacoes_liberacao WHERE id=? LIMIT 1 FOR UPDATE", [text(req.params.id,24)]);
    const request = requests[0];
    if (!request) { await connection.rollback(); return res.status(404).json({ erro: "Solicitação não encontrada." }); }
    if (request.status !== "pendente") { await connection.rollback(); return res.status(409).json({ erro: "Esta solicitação já foi analisada." }); }
    const [users] = await connection.execute("SELECT * FROM usuarios WHERE id=? LIMIT 1 FOR UPDATE", [request.usuario_id]);
    const user = users[0];
    if (!user) { await connection.rollback(); return res.status(404).json({ erro: "Conta vinculada não encontrada." }); }
    if (Number(user.conta_dev || 0) === 1 || String(user.cargo || "") !== "aluno") { await connection.rollback(); return res.status(403).json({ erro: "A liberação só pode ser aplicada a alunos." }); }
    if (Number(user.suspenso || 0) === 1 || ["suspenso","bloqueado"].includes(String(user.status || "").toLowerCase())) { await connection.rollback(); return res.status(409).json({ erro: "A conta está suspensa ou bloqueada." }); }
    if (email(user.email) !== email(request.email)) { await connection.rollback(); return res.status(409).json({ erro: "A solicitação não corresponde ao e-mail da conta." }); }
    const plan = String(request.plano || "").toLowerCase(); const days = PLAN_DAYS[plan];
    if (!days) { await connection.rollback(); return res.status(400).json({ erro: "Plano inválido." }); }
    const now = new Date(); const current = new Date(user.data_expiracao || ""); const base = !Number.isNaN(current.getTime()) && current > now ? current : now; base.setUTCDate(base.getUTCDate() + days); const expires = base.toISOString();
    await connection.execute("UPDATE usuarios SET plano=?,data_expiracao=?,aprovado=1,status='ativo',codigo=?,aprovado_em=IF(aprovado_em='',?,aprovado_em),atualizado_por=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", [plan, expires, request.codigo, now.toISOString(), req.usuario.email, user.id]);
    await connection.execute("UPDATE solicitacoes_liberacao SET status='aprovado',analisado_em=NOW(),analisado_por=?,motivo_recusa='',updated_at=NOW() WHERE id=?", [req.usuario.email, request.id]);
    await connection.commit();
    await audit(req, "premium.manual-approved", { metadata: { plano: plan, dias: days, codigo: request.codigo, usuarioId: user.id } });
    return res.json({ sucesso: true, mensagem: "Acesso Premium liberado.", diasLiberados: days, expiraEm: expires });
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    console.error("Erro ao aprovar liberação MySQL:", error);
    return res.status(500).json({ erro: "Não foi possível aprovar esta solicitação." });
  } finally { connection.release(); }
});

router.post("/liberacoes/:id/recusar", auth, sensitiveWriteRateLimit, requirePermission("aprovacoes"), async (req, res) => {
  try {
    await ensureApprovalsTable();
    const result = await database.query("UPDATE solicitacoes_liberacao SET status='recusado',analisado_em=NOW(),analisado_por=?,motivo_recusa=?,updated_at=NOW() WHERE id=? AND status='pendente'", [req.usuario.email, text(req.body?.motivo || "Pagamento não confirmado.",1000), text(req.params.id,24)]);
    if (!result.affectedRows) return res.status(409).json({ erro: "Solicitação não encontrada ou já analisada." });
    await audit(req, "premium.manual-rejected", { metadata: { solicitacaoId: text(req.params.id,24) } });
    return res.json({ sucesso: true, mensagem: "Solicitação recusada." });
  } catch (error) { return res.status(500).json({ erro: "Não foi possível recusar esta solicitação." }); }
});

router.get("/configuracoes-painel", auth, requirePermission("configuracoes"), async (_req, res) => {
  try {
    await ensureSettingsTable();
    const rows = await database.query("SELECT dados,atualizado_por,updated_at FROM admin_configuracoes WHERE id=1 LIMIT 1");
    const saved = parseJson(rows[0]?.dados, {});
    return res.json({ sucesso: true, origem: "mysql", configuracoes: { ...SETTINGS_DEFAULTS, ...saved, links: { ...SETTINGS_DEFAULTS.links, ...(saved.links || {}) } }, atualizadoPor: rows[0]?.atualizado_por || "", updatedAt: rows[0]?.updated_at || "" });
  } catch (error) { return res.status(500).json({ erro: "Não foi possível carregar as configurações." }); }
});

router.put("/configuracoes-painel", auth, sensitiveWriteRateLimit, requirePermission("configuracoes"), async (req, res) => {
  try {
    await ensureSettingsTable();
    const rows = await database.query("SELECT dados FROM admin_configuracoes WHERE id=1 LIMIT 1");
    const current = { ...SETTINGS_DEFAULTS, ...parseJson(rows[0]?.dados, {}) };
    const body = req.body || {};
    const next = {
      ...current,
      nomeSistema: text(body.nomeSistema ?? current.nomeSistema,120) || SETTINGS_DEFAULTS.nomeSistema,
      nomePremium: text(body.nomePremium ?? current.nomePremium,120) || SETTINGS_DEFAULTS.nomePremium,
      temaPadrao: ["dark","light"].includes(body.temaPadrao) ? body.temaPadrao : current.temaPadrao,
      modoManutencao: Boolean(body.modoManutencao),
      manutencaoTitulo: text(body.manutencaoTitulo ?? current.manutencaoTitulo,180),
      manutencaoMensagem: text(body.manutencaoMensagem ?? current.manutencaoMensagem,2000),
      comissaoPadrao: Math.min(Math.max(n(body.comissaoPadrao ?? current.comissaoPadrao),0),100),
      links: {
        whatsappSuporte: text(body.links?.whatsappSuporte ?? current.links?.whatsappSuporte,200),
        whatsappVendas: text(body.links?.whatsappVendas ?? current.links?.whatsappVendas,200),
        instagram: text(body.links?.instagram ?? current.links?.instagram,200)
      }
    };
    await database.query("UPDATE admin_configuracoes SET dados=?,atualizado_por=?,updated_at=NOW() WHERE id=1", [JSON.stringify(next), req.usuario.email]);
    await audit(req, "admin.settings-updated", { metadata: { manutencao: next.modoManutencao, cargo: getCargo(req.usuarioDoc || req.usuario) } });
    return res.json({ sucesso: true, mensagem: "Configurações salvas.", configuracoes: next });
  } catch (error) { console.error("Erro settings Admin CC:", error); return res.status(500).json({ erro: "Não foi possível salvar as configurações." }); }
});

router.get("/sistema/logs", auth, requirePermission("seguranca"), async (_req, res) => {
  try {
    await ensureAuditTable();
    const rows = await database.query("SELECT id,event,actor_email,target_email,metadata,created_at FROM security_audit_log ORDER BY created_at DESC LIMIT 120");
    return res.json({ sucesso: true, origem: "mysql", total: rows.length, logs: rows.map((row) => ({ id: row.id, evento: row.event, titulo: String(row.event || "Evento").replaceAll(".", " "), descricao: row.target_email || row.actor_email || "Evento administrativo", ator: row.actor_email || "", alvo: row.target_email || "", createdAt: row.created_at })) });
  } catch (error) { return res.status(500).json({ erro: "Não foi possível carregar a auditoria." }); }
});

router.get("/command-center/security", auth, requirePermission("seguranca"), async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    await Promise.all([ensureAuditTable(), ensureSessionStructure()]);
    const [suspendedRows, blockedRows, revokedRows, auditCountRows, criticalRows, events] = await Promise.all([
      database.query("SELECT COUNT(*) AS total FROM usuarios WHERE cargo='aluno' AND status='suspenso'"),
      database.query("SELECT COUNT(*) AS total FROM usuarios WHERE cargo='aluno' AND status='bloqueado'"),
      database.query("SELECT COUNT(*) AS total FROM revoked_tokens WHERE revoked_at >= (CURRENT_TIMESTAMP - INTERVAL 24 HOUR)"),
      database.query("SELECT COUNT(*) AS total FROM security_audit_log WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL 24 HOUR)"),
      database.query("SELECT COUNT(*) AS total FROM security_audit_log WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL 24 HOUR) AND (event LIKE '%block%' OR event LIKE '%suspend%' OR event LIKE '%role%' OR event LIKE '%permission%' OR event LIKE '%session%' OR event LIKE '%password%')"),
      database.query("SELECT id,event,actor_email,target_email,metadata,created_at FROM security_audit_log ORDER BY created_at DESC LIMIT 80")
    ]);
    return res.json({ sucesso: true, resumo: { revogacoes24h: n(revokedRows[0]?.total), contasSuspensas: n(suspendedRows[0]?.total), contasBloqueadas: n(blockedRows[0]?.total), eventos24h: n(auditCountRows[0]?.total), eventosCriticos24h: n(criticalRows[0]?.total) }, eventos: events.map((row) => ({ id: row.id, evento: row.event, ator: row.actor_email || "", alvo: row.target_email || "", metadata: parseJson(row.metadata, {}), createdAt: row.created_at })) });
  } catch (error) { console.error("Erro segurança Admin CC:", error); return res.status(500).json({ erro: "Não foi possível carregar a auditoria." }); }
});

module.exports = router;
