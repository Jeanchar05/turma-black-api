"use strict";

const express = require("express");
const crypto = require("crypto");
const database = require("../config/database");
const { auth } = require("../middleware/auth");
const { requirePermission, getCargo } = require("../middleware/permissions");

const router = express.Router();
let structureReady = false;

const VALID_STATUS = ["aberto", "em_atendimento", "respondido", "resolvido", "fechado"];
const VALID_PRIORITIES = ["baixa", "normal", "alta", "urgente"];
const VALID_CATEGORIES = ["duvida", "acesso", "pagamento", "prova", "plataforma", "vendas", "bug", "outro"];
const VALID_FEEDBACK_TYPES = ["sugestao", "elogio", "problema", "outro"];
const TEAM_ROLES = ["dev", "dono", "superadmin", "admin", "suporte"];
const MAX_FILE_SIZE = 4 * 1024 * 1024;

function id24() { return crypto.randomBytes(12).toString("hex"); }
function text(value, max = 1000) { return String(value || "").trim().slice(0, max); }
function email(value) { return text(value, 190).toLowerCase(); }
function userId(req) { return String(req.usuario?.id || req.usuario?._id || req.usuarioDoc?.id || req.usuarioDoc?._id || ""); }
function role(req) { return String(getCargo(req.usuarioDoc || req.usuario) || "aluno").toLowerCase(); }
function isTeam(req) { return TEAM_ROLES.includes(role(req)); }
function valid(value, allowed, fallback) { const normalized = String(value || "").trim().toLowerCase(); return allowed.includes(normalized) ? normalized : fallback; }
function sqlDate(value) { return value || ""; }

async function ensureStructure() {
  if (structureReady) return;

  await database.query(`CREATE TABLE IF NOT EXISTS support_tickets (
    id CHAR(24) NOT NULL PRIMARY KEY,
    usuario_id CHAR(24) NULL,
    usuario_nome VARCHAR(160) NOT NULL DEFAULT '',
    usuario_email VARCHAR(190) NOT NULL DEFAULT '',
    assunto VARCHAR(180) NOT NULL,
    categoria VARCHAR(30) NOT NULL DEFAULT 'duvida',
    prioridade VARCHAR(20) NOT NULL DEFAULT 'normal',
    status VARCHAR(30) NOT NULL DEFAULT 'aberto',
    atendente_id CHAR(24) NULL,
    atendente_nome VARCHAR(160) NOT NULL DEFAULT '',
    atendente_email VARCHAR(190) NOT NULL DEFAULT '',
    ultima_mensagem_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    encerrado_em DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_support_user (usuario_id, updated_at),
    KEY idx_support_email (usuario_email, updated_at),
    KEY idx_support_status (status, prioridade, updated_at),
    KEY idx_support_agent (atendente_id, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await database.query(`CREATE TABLE IF NOT EXISTS support_messages (
    id CHAR(24) NOT NULL PRIMARY KEY,
    ticket_id CHAR(24) NOT NULL,
    autor_id CHAR(24) NULL,
    autor_nome VARCHAR(160) NOT NULL DEFAULT '',
    autor_email VARCHAR(190) NOT NULL DEFAULT '',
    autor_cargo VARCHAR(40) NOT NULL DEFAULT 'aluno',
    tipo VARCHAR(20) NOT NULL DEFAULT 'usuario',
    mensagem TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_support_message_ticket (ticket_id, created_at),
    CONSTRAINT fk_support_message_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await database.query(`CREATE TABLE IF NOT EXISTS support_files (
    id CHAR(24) NOT NULL PRIMARY KEY,
    ticket_id CHAR(24) NOT NULL,
    mensagem_id CHAR(24) NULL,
    usuario_id CHAR(24) NULL,
    nome VARCHAR(220) NOT NULL,
    mime VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
    tamanho INT UNSIGNED NOT NULL DEFAULT 0,
    dados LONGBLOB NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_support_file_ticket (ticket_id, created_at),
    CONSTRAINT fk_support_file_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_support_file_message FOREIGN KEY (mensagem_id) REFERENCES support_messages(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await database.query(`CREATE TABLE IF NOT EXISTS support_feedback (
    id CHAR(24) NOT NULL PRIMARY KEY,
    usuario_id CHAR(24) NULL,
    usuario_nome VARCHAR(160) NOT NULL DEFAULT '',
    usuario_email VARCHAR(190) NOT NULL DEFAULT '',
    tipo VARCHAR(30) NOT NULL DEFAULT 'sugestao',
    nota TINYINT UNSIGNED NOT NULL DEFAULT 5,
    mensagem TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'novo',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_support_feedback_status (status, created_at),
    KEY idx_support_feedback_user (usuario_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  structureReady = true;
}

function formatTicket(row) {
  return {
    id: row.id,
    usuarioId: row.usuario_id || "",
    nome: row.usuario_nome || "",
    email: row.usuario_email || "",
    assunto: row.assunto || "",
    categoria: row.categoria || "duvida",
    prioridade: row.prioridade || "normal",
    status: row.status || "aberto",
    atendenteId: row.atendente_id || "",
    atendenteNome: row.atendente_nome || "",
    atendenteEmail: row.atendente_email || "",
    totalMensagens: Number(row.total_mensagens || 0),
    ultimaMensagem: row.ultima_mensagem || "",
    ultimaRespostaEm: sqlDate(row.ultima_mensagem_em),
    encerradoEm: sqlDate(row.encerrado_em),
    createdAt: sqlDate(row.created_at),
    updatedAt: sqlDate(row.updated_at)
  };
}

function formatMessage(row) {
  return {
    id: row.id,
    autorId: row.autor_id || "",
    autorNome: row.autor_nome || "",
    autorEmail: row.autor_email || "",
    autorCargo: row.autor_cargo || "aluno",
    tipo: row.tipo || "usuario",
    mensagem: row.mensagem || "",
    criadoEm: sqlDate(row.created_at)
  };
}

function formatFile(row) {
  return {
    id: row.id,
    nome: row.nome || "arquivo",
    mime: row.mime || "application/octet-stream",
    tamanho: Number(row.tamanho || 0),
    mensagemId: row.mensagem_id || "",
    createdAt: sqlDate(row.created_at),
    url: `/suporte/anexos/${row.id}`
  };
}

async function getTicket(id) {
  const rows = await database.query(`SELECT t.*,
      (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id=t.id) AS total_mensagens,
      (SELECT m.mensagem FROM support_messages m WHERE m.ticket_id=t.id ORDER BY m.created_at DESC LIMIT 1) AS ultima_mensagem
    FROM support_tickets t WHERE t.id=? LIMIT 1`, [id]);
  return rows[0] || null;
}

function canAccess(req, ticket) {
  if (isTeam(req)) return true;
  const uid = userId(req);
  const userEmail = email(req.usuario?.email);
  return (uid && String(ticket.usuario_id || "") === uid) || (userEmail && email(ticket.usuario_email) === userEmail);
}

async function ticketPayload(id) {
  const ticketRow = await getTicket(id);
  if (!ticketRow) return null;
  const [messages, files] = await Promise.all([
    database.query("SELECT * FROM support_messages WHERE ticket_id=? ORDER BY created_at ASC", [id]),
    database.query("SELECT id,ticket_id,mensagem_id,usuario_id,nome,mime,tamanho,created_at FROM support_files WHERE ticket_id=? ORDER BY created_at ASC", [id])
  ]);
  return { ...formatTicket(ticketRow), respostas: messages.map(formatMessage), anexos: files.map(formatFile) };
}

async function addMessage(ticketId, req, message, type) {
  const messageId = id24();
  await database.query(`INSERT INTO support_messages
    (id,ticket_id,autor_id,autor_nome,autor_email,autor_cargo,tipo,mensagem)
    VALUES (?,?,?,?,?,?,?,?)`, [
    messageId, ticketId, userId(req) || null, text(req.usuario?.nome, 160), email(req.usuario?.email), role(req), type, text(message, 5000)
  ]);
  await database.query("UPDATE support_tickets SET ultima_mensagem_em=NOW(), updated_at=NOW() WHERE id=?", [ticketId]);
  return messageId;
}

router.get("/suporte/status", async (_req, res) => {
  try { await ensureStructure(); return res.json({ status: "online", modulo: "suporte", banco: "mysql" }); }
  catch (_) { return res.status(503).json({ status: "indisponivel" }); }
});

router.post("/suporte", auth, async (req, res) => {
  try {
    await ensureStructure();
    const assunto = text(req.body?.assunto, 180);
    const mensagem = text(req.body?.mensagem, 5000);
    if (!assunto || !mensagem) return res.status(400).json({ erro: "Assunto e mensagem são obrigatórios." });

    const id = id24();
    await database.query(`INSERT INTO support_tickets
      (id,usuario_id,usuario_nome,usuario_email,assunto,categoria,prioridade,status)
      VALUES (?,?,?,?,?,?,?,'aberto')`, [
      id, userId(req) || null, text(req.usuario?.nome, 160), email(req.usuario?.email), assunto,
      valid(req.body?.categoria, VALID_CATEGORIES, "duvida"), valid(req.body?.prioridade, VALID_PRIORITIES, "normal")
    ]);
    await addMessage(id, req, mensagem, "usuario");
    return res.status(201).json({ sucesso: true, mensagem: "Chamado aberto com sucesso.", chamado: await ticketPayload(id) });
  } catch (error) {
    console.error("Erro MySQL ao abrir chamado:", error);
    return res.status(500).json({ erro: "Erro interno ao abrir chamado." });
  }
});

router.get("/meus-chamados", auth, async (req, res) => {
  try {
    await ensureStructure();
    const rows = await database.query(`SELECT t.*,
        (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id=t.id) AS total_mensagens,
        (SELECT m.mensagem FROM support_messages m WHERE m.ticket_id=t.id ORDER BY m.created_at DESC LIMIT 1) AS ultima_mensagem
      FROM support_tickets t
      WHERE (t.usuario_id=? OR t.usuario_email=?)
      ORDER BY t.ultima_mensagem_em DESC LIMIT 150`, [userId(req), email(req.usuario?.email)]);
    return res.json({ sucesso: true, total: rows.length, chamados: rows.map(formatTicket) });
  } catch (error) {
    console.error("Erro ao listar chamados MySQL:", error);
    return res.status(500).json({ erro: "Erro interno ao listar chamados." });
  }
});

router.post("/suporte/feedback", auth, async (req, res) => {
  try {
    await ensureStructure();
    const mensagem = text(req.body?.mensagem, 5000);
    if (!mensagem) return res.status(400).json({ erro: "Escreva seu feedback." });
    const id = id24();
    const rating = Math.max(1, Math.min(5, Number(req.body?.nota || 5)));
    await database.query(`INSERT INTO support_feedback
      (id,usuario_id,usuario_nome,usuario_email,tipo,nota,mensagem)
      VALUES (?,?,?,?,?,?,?)`, [id, userId(req) || null, text(req.usuario?.nome, 160), email(req.usuario?.email), valid(req.body?.tipo, VALID_FEEDBACK_TYPES, "sugestao"), rating, mensagem]);
    return res.status(201).json({ sucesso: true, mensagem: "Feedback enviado. Obrigado por ajudar a melhorar a plataforma!", id });
  } catch (error) {
    console.error("Erro ao enviar feedback:", error);
    return res.status(500).json({ erro: "Erro interno ao enviar feedback." });
  }
});

router.get("/suporte/anexos/:id", auth, async (req, res) => {
  try {
    await ensureStructure();
    const rows = await database.query(`SELECT f.*,t.usuario_id,t.usuario_email FROM support_files f
      INNER JOIN support_tickets t ON t.id=f.ticket_id WHERE f.id=? LIMIT 1`, [req.params.id]);
    const file = rows[0];
    if (!file) return res.status(404).json({ erro: "Arquivo não encontrado." });
    if (!canAccess(req, file)) return res.status(403).json({ erro: "Acesso negado ao arquivo." });
    res.setHeader("Content-Type", file.mime || "application/octet-stream");
    res.setHeader("Content-Length", Number(file.tamanho || 0));
    res.setHeader("Content-Disposition", `${/^image\//.test(file.mime) || file.mime === "application/pdf" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.nome)}`);
    return res.send(file.dados);
  } catch (error) {
    console.error("Erro ao baixar anexo:", error);
    return res.status(500).json({ erro: "Erro ao abrir arquivo." });
  }
});

router.post("/suporte/:id/anexos", auth, async (req, res) => {
  try {
    await ensureStructure();
    const ticket = await getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ erro: "Chamado não encontrado." });
    if (!canAccess(req, ticket)) return res.status(403).json({ erro: "Você não pode anexar neste chamado." });

    const name = text(req.body?.nome, 220) || "arquivo";
    const mime = text(req.body?.mime, 120) || "application/octet-stream";
    const raw = String(req.body?.base64 || "").replace(/^data:[^;]+;base64,/, "");
    if (!raw) return res.status(400).json({ erro: "Arquivo inválido." });
    const buffer = Buffer.from(raw, "base64");
    if (!buffer.length || buffer.length > MAX_FILE_SIZE) return res.status(400).json({ erro: "O arquivo deve ter no máximo 4 MB." });

    const id = id24();
    await database.query(`INSERT INTO support_files
      (id,ticket_id,mensagem_id,usuario_id,nome,mime,tamanho,dados)
      VALUES (?,?,?,?,?,?,?,?)`, [id, ticket.id, req.body?.mensagemId || null, userId(req) || null, name, mime, buffer.length, buffer]);
    return res.status(201).json({ sucesso: true, arquivo: { id, nome: name, mime, tamanho: buffer.length, url: `/suporte/anexos/${id}` } });
  } catch (error) {
    console.error("Erro ao anexar arquivo:", error);
    return res.status(500).json({ erro: "Erro interno ao anexar arquivo." });
  }
});

router.get("/suporte/:id", auth, async (req, res) => {
  try {
    await ensureStructure();
    const ticket = await getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ erro: "Chamado não encontrado." });
    if (!canAccess(req, ticket)) return res.status(403).json({ erro: "Você não pode visualizar este chamado." });
    return res.json({ sucesso: true, chamado: await ticketPayload(ticket.id) });
  } catch (error) {
    console.error("Erro ao buscar chamado:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar chamado." });
  }
});

router.post("/suporte/:id/responder", auth, async (req, res) => {
  try {
    await ensureStructure();
    const ticket = await getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ erro: "Chamado não encontrado." });
    if (!canAccess(req, ticket) || isTeam(req)) return res.status(403).json({ erro: "Você não pode responder como aluno neste chamado." });
    const mensagem = text(req.body?.mensagem, 5000);
    if (!mensagem) return res.status(400).json({ erro: "Digite uma mensagem." });
    const messageId = await addMessage(ticket.id, req, mensagem, "usuario");
    const nextStatus = ["resolvido", "fechado", "respondido"].includes(ticket.status) ? "aberto" : ticket.status;
    await database.query("UPDATE support_tickets SET status=?,ultima_mensagem_em=NOW(),updated_at=NOW(),encerrado_em=NULL WHERE id=?", [nextStatus, ticket.id]);
    return res.json({ sucesso: true, mensagem: "Mensagem enviada.", mensagemId: messageId, chamado: await ticketPayload(ticket.id) });
  } catch (error) {
    console.error("Erro ao responder chamado:", error);
    return res.status(500).json({ erro: "Erro interno ao responder chamado." });
  }
});

router.get("/admin/suporte/resumo", auth, requirePermission("suporte"), async (_req, res) => {
  try {
    await ensureStructure();
    const rows = await database.query(`SELECT
      COUNT(*) AS total,
      SUM(status='aberto') AS abertos,
      SUM(status='em_atendimento') AS atendimento,
      SUM(status='respondido') AS respondidos,
      SUM(status IN ('resolvido','fechado')) AS resolvidos,
      SUM(prioridade='urgente' AND status NOT IN ('resolvido','fechado')) AS urgentes
      FROM support_tickets`);
    const summary = rows[0] || {};
    return res.json({ sucesso: true, resumo: {
      total: Number(summary.total || 0), abertos: Number(summary.abertos || 0), atendimento: Number(summary.atendimento || 0),
      respondidos: Number(summary.respondidos || 0), resolvidos: Number(summary.resolvidos || 0), urgentes: Number(summary.urgentes || 0)
    }});
  } catch (error) {
    console.error("Erro no resumo de suporte:", error);
    return res.status(500).json({ erro: "Erro interno ao gerar resumo de suporte." });
  }
});

router.get("/admin/suporte/feedback", auth, requirePermission("suporte"), async (req, res) => {
  try {
    await ensureStructure();
    const status = text(req.query?.status, 30);
    const params = [];
    let where = "";
    if (status) { where = "WHERE status=?"; params.push(status); }
    const rows = await database.query(`SELECT * FROM support_feedback ${where} ORDER BY created_at DESC LIMIT 300`, params);
    return res.json({ sucesso: true, feedbacks: rows.map((row) => ({
      id: row.id, nome: row.usuario_nome, email: row.usuario_email, tipo: row.tipo, nota: Number(row.nota || 0), mensagem: row.mensagem, status: row.status, createdAt: row.created_at
    })) });
  } catch (error) {
    return res.status(500).json({ erro: "Erro ao carregar feedbacks." });
  }
});

router.post("/admin/suporte/feedback/:id/status", auth, requirePermission("suporte"), async (req, res) => {
  try {
    await ensureStructure();
    const status = ["novo", "lido", "planejado", "concluido", "arquivado"].includes(req.body?.status) ? req.body.status : "lido";
    const result = await database.query("UPDATE support_feedback SET status=?,updated_at=NOW() WHERE id=?", [status, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ erro: "Feedback não encontrado." });
    return res.json({ sucesso: true, mensagem: "Feedback atualizado." });
  } catch (_) { return res.status(500).json({ erro: "Erro ao atualizar feedback." }); }
});

router.get("/admin/suporte", auth, requirePermission("suporte"), async (req, res) => {
  try {
    await ensureStructure();
    const conditions = [];
    const params = [];
    const search = text(req.query?.busca, 180);
    const status = text(req.query?.status, 30);
    const priority = text(req.query?.prioridade, 20);
    const category = text(req.query?.categoria, 30);
    if (search) { conditions.push("(t.usuario_nome LIKE ? OR t.usuario_email LIKE ? OR t.assunto LIKE ?)"); const like=`%${search}%`; params.push(like,like,like); }
    if (VALID_STATUS.includes(status)) { conditions.push("t.status=?"); params.push(status); }
    if (VALID_PRIORITIES.includes(priority)) { conditions.push("t.prioridade=?"); params.push(priority); }
    if (VALID_CATEGORIES.includes(category)) { conditions.push("t.categoria=?"); params.push(category); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(Math.max(Number(req.query?.limite || 200), 1), 500);
    const rows = await database.query(`SELECT t.*,
        (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id=t.id) AS total_mensagens,
        (SELECT m.mensagem FROM support_messages m WHERE m.ticket_id=t.id ORDER BY m.created_at DESC LIMIT 1) AS ultima_mensagem
      FROM support_tickets t ${where}
      ORDER BY FIELD(t.prioridade,'urgente','alta','normal','baixa'), t.ultima_mensagem_em DESC LIMIT ${limit}`, params);
    return res.json({ sucesso: true, total: rows.length, chamados: rows.map(formatTicket) });
  } catch (error) {
    console.error("Erro ao listar chamados admin:", error);
    return res.status(500).json({ erro: "Erro interno ao listar chamados." });
  }
});

router.get("/admin/suporte/:id", auth, requirePermission("suporte"), async (req, res) => {
  try {
    await ensureStructure();
    const payload = await ticketPayload(req.params.id);
    if (!payload) return res.status(404).json({ erro: "Chamado não encontrado." });
    return res.json({ sucesso: true, chamado: payload });
  } catch (_) { return res.status(500).json({ erro: "Erro interno ao buscar chamado." }); }
});

router.post("/admin/suporte/:id/assumir", auth, requirePermission("suporte"), async (req, res) => {
  try {
    await ensureStructure();
    const ticket = await getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ erro: "Chamado não encontrado." });
    await database.query(`UPDATE support_tickets SET atendente_id=?,atendente_nome=?,atendente_email=?,status='em_atendimento',updated_at=NOW() WHERE id=?`, [
      userId(req) || null, text(req.usuario?.nome,160)||"Equipe", email(req.usuario?.email), ticket.id
    ]);
    await addMessage(ticket.id, req, `${text(req.usuario?.nome,160)||"Equipe"} iniciou o atendimento.`, "sistema");
    return res.json({ sucesso: true, mensagem: "Atendimento assumido.", chamado: await ticketPayload(ticket.id) });
  } catch (_) { return res.status(500).json({ erro: "Erro ao assumir atendimento." }); }
});

router.post("/admin/suporte/:id/responder", auth, requirePermission("suporte"), async (req, res) => {
  try {
    await ensureStructure();
    const ticket = await getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ erro: "Chamado não encontrado." });
    const mensagem = text(req.body?.mensagem, 5000);
    if (!mensagem) return res.status(400).json({ erro: "Digite uma resposta." });
    const messageId = await addMessage(ticket.id, req, mensagem, "equipe");
    const newStatus = valid(req.body?.status, VALID_STATUS, "respondido");
    await database.query(`UPDATE support_tickets SET status=?,atendente_id=COALESCE(atendente_id,?),atendente_nome=IF(atendente_nome='',?,atendente_nome),atendente_email=IF(atendente_email='',?,atendente_email),encerrado_em=?,updated_at=NOW() WHERE id=?`, [
      newStatus, userId(req) || null, text(req.usuario?.nome,160)||"Equipe", email(req.usuario?.email), ["resolvido","fechado"].includes(newStatus) ? new Date() : null, ticket.id
    ]);
    return res.json({ sucesso: true, mensagem: "Resposta enviada ao usuário.", mensagemId: messageId, chamado: await ticketPayload(ticket.id) });
  } catch (error) {
    console.error("Erro ao responder chamado admin:", error);
    return res.status(500).json({ erro: "Erro interno ao responder chamado." });
  }
});

router.post("/admin/suporte/:id/status", auth, requirePermission("suporte"), async (req, res) => {
  try {
    await ensureStructure();
    const ticket = await getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ erro: "Chamado não encontrado." });
    const status = valid(req.body?.status, VALID_STATUS, "aberto");
    await database.query("UPDATE support_tickets SET status=?,encerrado_em=?,updated_at=NOW() WHERE id=?", [status, ["resolvido","fechado"].includes(status) ? new Date() : null, ticket.id]);
    return res.json({ sucesso: true, mensagem: "Status atualizado.", chamado: await ticketPayload(ticket.id) });
  } catch (_) { return res.status(500).json({ erro: "Erro interno ao alterar status." }); }
});

module.exports = router;
