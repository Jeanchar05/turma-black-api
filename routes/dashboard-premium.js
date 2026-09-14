"use strict";

const express = require("express");
const crypto = require("crypto");
const database = require("../config/database");
const { auth, montarUsuarioSeguro } = require("../middleware/auth");

const studyService = require("../services/study-state");
const studyModel = require("../public/study-state-model");
const router = express.Router();
let estruturaGarantida = false;

function id24() { return crypto.randomBytes(12).toString("hex"); }
function usuarioId(req) { return String(req.usuario?.id || req.usuario?._id || req.usuarioDoc?._id || ""); }
function clampText(value, max) { return String(value || "").trim().slice(0, max); }
function toBoolean(value) { return value === true || value === 1 || value === "1" || value === "true"; }
async function tableExists(name) {
  const rows = await database.query("SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?", [name]);
  return Number(rows[0]?.total || 0) > 0;
}

async function columnExists(tableName, columnName) {
  const rows = await database.query("SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?", [tableName, columnName]);
  return Number(rows[0]?.total || 0) > 0;
}

async function ensureColumn(tableName, columnName, definition) {
  if (!(await columnExists(tableName, columnName))) {
    await database.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  }
}

async function ensureStructure() {
  if (estruturaGarantida) return;

  await database.query(`CREATE TABLE IF NOT EXISTS dashboard_preferencias (
    usuario_id CHAR(24) NOT NULL PRIMARY KEY,
    tema VARCHAR(20) NOT NULL DEFAULT 'dark',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_dash_pref_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await database.query(`CREATE TABLE IF NOT EXISTS dashboard_notas (
    id CHAR(24) NOT NULL PRIMARY KEY,
    usuario_id CHAR(24) NOT NULL,
    titulo VARCHAR(160) NOT NULL,
    conteudo LONGTEXT NOT NULL,
    favorita TINYINT(1) NOT NULL DEFAULT 0,
    categoria VARCHAR(80) NOT NULL DEFAULT 'Geral',
    tags LONGTEXT NULL,
    fixada TINYINT(1) NOT NULL DEFAULT 0,
    arquivada TINYINT(1) NOT NULL DEFAULT 0,
    excluida TINYINT(1) NOT NULL DEFAULT 0,
    cor VARCHAR(20) NOT NULL DEFAULT 'purple',
    checklist LONGTEXT NULL,
    anexos LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dash_notas_usuario (usuario_id),
    KEY idx_dash_notas_favorita (usuario_id, favorita),
    KEY idx_dash_notas_status (usuario_id, excluida, arquivada),
    CONSTRAINT fk_dash_notas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await ensureColumn("dashboard_notas", "categoria", "VARCHAR(80) NOT NULL DEFAULT 'Geral'");
  await ensureColumn("dashboard_notas", "tags", "LONGTEXT NULL");
  await ensureColumn("dashboard_notas", "fixada", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("dashboard_notas", "arquivada", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("dashboard_notas", "excluida", "TINYINT(1) NOT NULL DEFAULT 0");
  await ensureColumn("dashboard_notas", "cor", "VARCHAR(20) NOT NULL DEFAULT 'purple'");
  await ensureColumn("dashboard_notas", "checklist", "LONGTEXT NULL");
  await ensureColumn("dashboard_notas", "anexos", "LONGTEXT NULL");

  await database.query(`CREATE TABLE IF NOT EXISTS dashboard_favoritos (
    id CHAR(24) NOT NULL PRIMARY KEY,
    usuario_id CHAR(24) NOT NULL,
    tipo VARCHAR(40) NOT NULL DEFAULT 'conteudo',
    chave VARCHAR(190) NOT NULL,
    titulo VARCHAR(190) NOT NULL,
    descricao VARCHAR(500) NOT NULL DEFAULT '',
    destino VARCHAR(80) NOT NULL DEFAULT 'estudo',
    icone VARCHAR(20) NOT NULL DEFAULT '★',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dash_favorito (usuario_id, tipo, chave),
    KEY idx_dash_favoritos_usuario (usuario_id),
    CONSTRAINT fk_dash_favoritos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await database.query(`CREATE TABLE IF NOT EXISTS dashboard_atividades (
    id CHAR(24) NOT NULL PRIMARY KEY,
    usuario_id CHAR(24) NOT NULL,
    tipo VARCHAR(40) NOT NULL DEFAULT 'geral',
    titulo VARCHAR(190) NOT NULL,
    descricao VARCHAR(600) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_dash_atividades_usuario (usuario_id, created_at),
    CONSTRAINT fk_dash_atividades_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await database.query(`CREATE TABLE IF NOT EXISTS dashboard_chamados (
    id CHAR(24) NOT NULL PRIMARY KEY,
    usuario_id CHAR(24) NOT NULL,
    usuario_nome VARCHAR(160) NOT NULL DEFAULT '',
    usuario_email VARCHAR(190) NOT NULL DEFAULT '',
    assunto VARCHAR(180) NOT NULL,
    mensagem TEXT NOT NULL,
    prioridade VARCHAR(20) NOT NULL DEFAULT 'normal',
    status VARCHAR(30) NOT NULL DEFAULT 'aberto',
    resposta TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dash_chamados_usuario (usuario_id, created_at),
    KEY idx_dash_chamados_status (status),
    CONSTRAINT fk_dash_chamados_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  estruturaGarantida = true;
}

function formatTicket(row) { return { id: row.id, assunto: row.assunto || "", mensagem: row.mensagem || "", prioridade: row.prioridade || "normal", status: row.status || "aberto", resposta: row.resposta || "", createdAt: row.created_at || "", updatedAt: row.updated_at || "" }; }
function formatActivity(row) { return { id: row.id, tipo: row.tipo || "geral", titulo: row.titulo || "Atividade", descricao: row.descricao || "", createdAt: row.created_at || "" }; }

function planInfo(user) {
  const plan = String(user?.plano || "free").toLowerCase();
  const map = { free: { nome: "Acesso Free", rotulo: "Free" }, black30: { nome: "Turma do Primo 30", rotulo: "Aluno" }, black90: { nome: "Turma do Primo 90", rotulo: "Aluno" }, black180: { nome: "Turma do Primo 180", rotulo: "Aluno" }, black360: { nome: "Turma do Primo Anual", rotulo: "Aluno" }, admin: { nome: "Acesso Administrativo", rotulo: "Equipe" } };
  const info = map[plan] || { nome: "Turma do Primo", rotulo: "Aluno" };
  const expiration = user?.dataExpiracao ? new Date(user.dataExpiracao) : null;
  let validadeTexto = "Acesso ativo";
  let percentualValidade = plan === "free" ? 12 : 100;
  if (expiration && !Number.isNaN(expiration.getTime())) {
    const days = Math.ceil((expiration.getTime() - Date.now()) / 86400000);
    validadeTexto = days >= 0 ? `Acesso por mais ${days} dia(s)` : "Plano expirado";
    percentualValidade = Math.max(3, Math.min(100, (days / 365) * 100));
  }
  return { ...info, validadeTexto, percentualValidade };
}

async function getTheme(userId) {
  const rows = await database.query("SELECT tema FROM dashboard_preferencias WHERE usuario_id = ? LIMIT 1", [userId]);
  return rows[0]?.tema || "dark";
}
async function getExamStats(userId) {
  if (!(await tableExists("provas_resultados"))) return { media: 0, total: 0 };
  const rows = await database.query("SELECT COALESCE(AVG(nota), 0) AS media, COUNT(*) AS total FROM provas_resultados WHERE usuario_id = ?", [userId]);
  return { media: Number(rows[0]?.media || 0), total: Number(rows[0]?.total || 0) };
}

router.get("/home", auth, async (req, res) => {
  try {
    await ensureStructure();
    const userId = usuarioId(req);
    const [theme, noteRows, favoriteRows, activityRows, study, exams] = await Promise.all([
      getTheme(userId),
      database.query("SELECT COUNT(*) AS total FROM dashboard_notas WHERE usuario_id = ? AND excluida = 0", [userId]),
      database.query("SELECT * FROM dashboard_favoritos WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 50", [userId]),
      database.query("SELECT * FROM dashboard_atividades WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 30", [userId]),
      studyService.update(userId), getExamStats(userId)
    ]);
    const studyStats = studyModel.summary(study.state);
    return res.json({ sucesso: true, origem: "mysql", usuario: montarUsuarioSeguro(req.usuarioDoc || req.usuario), preferencias: { tema: theme }, plano: planInfo(req.usuarioDoc || req.usuario), estatisticas: { mediaGeral: Number((exams.media / 10).toFixed(1)), totalAvaliacoes: exams.total, ...studyStats, totalNotas: Number(noteRows[0]?.total || 0), grafico: [] }, favoritos: favoriteRows.map((row) => ({ id: row.id, type: row.tipo, key: row.chave, title: row.titulo, description: row.descricao, target: row.destino, icon: row.icone })), atividades: activityRows.map(formatActivity), notificacoes: [], notificacoesNaoLidas: 0 });
  } catch (error) {
    console.error("Erro no dashboard premium:", error);
    return res.status(500).json({ erro: "Erro interno ao carregar o dashboard." });
  }
});

router.get("/preferencias", auth, async (req, res) => {
  try { await ensureStructure(); return res.json({ sucesso: true, preferencias: { tema: await getTheme(usuarioId(req)) } }); }
  catch (_) { return res.status(500).json({ erro: "Erro ao carregar preferências." }); }
});

router.put("/preferencias", auth, async (req, res) => {
  try {
    await ensureStructure();
    const tema = ["dark", "light", "system"].includes(req.body?.tema) ? req.body.tema : "dark";
    await database.query("INSERT INTO dashboard_preferencias (usuario_id, tema) VALUES (?, ?) ON DUPLICATE KEY UPDATE tema = VALUES(tema), updated_at = CURRENT_TIMESTAMP", [usuarioId(req), tema]);
    return res.json({ sucesso: true, preferencias: { tema } });
  } catch (_) { return res.status(500).json({ erro: "Erro ao salvar preferências." }); }
});

router.use("/notas", require("./notes"));

router.get("/suporte", auth, async (req, res) => {
  try {
    await ensureStructure();
    const rows = await database.query("SELECT * FROM dashboard_chamados WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 100", [usuarioId(req)]);
    return res.json({ sucesso: true, chamados: rows.map(formatTicket) });
  } catch (_) { return res.status(500).json({ erro: "Erro ao carregar chamados." }); }
});

router.post("/suporte", auth, async (req, res) => {
  try {
    await ensureStructure();
    const assunto = clampText(req.body?.assunto, 180);
    const mensagem = clampText(req.body?.mensagem, 4000);
    const prioridade = ["baixa", "normal", "alta", "urgente"].includes(req.body?.prioridade) ? req.body.prioridade : "normal";
    if (!assunto || !mensagem) return res.status(400).json({ erro: "Assunto e mensagem são obrigatórios." });
    const id = id24();
    await database.query("INSERT INTO dashboard_chamados (id, usuario_id, usuario_nome, usuario_email, assunto, mensagem, prioridade) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, usuarioId(req), req.usuario?.nome || "", req.usuario?.email || "", assunto, mensagem, prioridade]);
    await database.query("INSERT INTO dashboard_atividades (id, usuario_id, tipo, titulo, descricao) VALUES (?, ?, 'suporte', ?, ?)", [id24(), usuarioId(req), `Chamado aberto: ${assunto}`, "Solicitação enviada para a equipe."]);
    const rows = await database.query("SELECT * FROM dashboard_chamados WHERE id = ?", [id]);
    return res.status(201).json({ sucesso: true, chamado: formatTicket(rows[0]) });
  } catch (_) { return res.status(500).json({ erro: "Erro ao abrir chamado." }); }
});

router.put("/perfil", auth, async (req, res) => {
  try {
    const nome = clampText(req.body?.nome, 160);
    const telefone = clampText(req.body?.telefone, 30);
    const foto = clampText(req.body?.foto, 1000);
    if (!nome) return res.status(400).json({ erro: "Nome é obrigatório." });
    const user = req.usuarioDoc;
    user.nome = nome; user.telefone = telefone; user.foto = foto; user.atualizadoPor = req.usuario?.email || "dashboard";
    await user.save();
    await ensureStructure();
    await database.query("INSERT INTO dashboard_atividades (id, usuario_id, tipo, titulo, descricao) VALUES (?, ?, 'perfil', 'Perfil atualizado', 'Dados pessoais atualizados no dashboard.')", [id24(), usuarioId(req)]);
    return res.json({ sucesso: true, usuario: montarUsuarioSeguro(user) });
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return res.status(500).json({ erro: "Erro ao atualizar perfil." });
  }
});

router.post("/atividades", auth, async (req, res) => {
  try {
    await ensureStructure();
    const tipo = clampText(req.body?.tipo, 40) || "geral";
    const titulo = clampText(req.body?.titulo, 190) || "Atividade";
    const descricao = clampText(req.body?.descricao, 600);
    await database.query("INSERT INTO dashboard_atividades (id, usuario_id, tipo, titulo, descricao) VALUES (?, ?, ?, ?, ?)", [id24(), usuarioId(req), tipo, titulo, descricao]);
    return res.status(201).json({ sucesso: true });
  } catch (_) { return res.status(500).json({ erro: "Erro ao registrar atividade." }); }
});

module.exports = router;
