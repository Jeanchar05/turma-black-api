"use strict";

const express = require("express");
const crypto = require("crypto");
const database = require("../config/database");
const { auth, montarUsuarioSeguro } = require("../middleware/auth");

const router = express.Router();
let estruturaGarantida = false;

function id24() { return crypto.randomBytes(12).toString("hex"); }
function usuarioId(req) { return String(req.usuario?.id || req.usuario?._id || req.usuarioDoc?._id || ""); }
function clampText(value, max) { return String(value || "").trim().slice(0, max); }
function toBoolean(value) { return value === true || value === 1 || value === "1" || value === "true"; }

async function tableExists(name) {
  const rows = await database.query(
    `SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [name]
  );
  return Number(rows[0]?.total || 0) > 0;
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
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_dash_notas_usuario (usuario_id),
    KEY idx_dash_notas_favorita (usuario_id, favorita),
    CONSTRAINT fk_dash_notas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

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

function formatNote(row) {
  return { id: row.id, titulo: row.titulo || "", conteudo: row.conteudo || "", favorita: Boolean(row.favorita), createdAt: row.created_at || "", updatedAt: row.updated_at || "" };
}
function formatTicket(row) {
  return { id: row.id, assunto: row.assunto || "", mensagem: row.mensagem || "", prioridade: row.prioridade || "normal", status: row.status || "aberto", resposta: row.resposta || "", createdAt: row.created_at || "", updatedAt: row.updated_at || "" };
}
function formatActivity(row) {
  return { id: row.id, tipo: row.tipo || "geral", titulo: row.titulo || "Atividade", descricao: row.descricao || "", createdAt: row.created_at || "" };
}

function planInfo(user) {
  const plan = String(user?.plano || "free").toLowerCase();
  const map = {
    free: { nome: "Plano Free", rotulo: "Free" },
    black30: { nome: "Turma Premium 30", rotulo: "Premium" },
    black90: { nome: "Turma Premium 90", rotulo: "Premium" },
    black180: { nome: "Turma Premium 180", rotulo: "Premium" },
    black360: { nome: "Turma Premium Anual", rotulo: "Premium" },
    admin: { nome: "Acesso Administrativo", rotulo: "Equipe" }
  };
  const info = map[plan] || { nome: "Turma Premium", rotulo: "Premium" };
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

async function countDistinctFocusDays(userId) {
  const rows = await database.query(
    `SELECT DISTINCT DATE(created_at) AS dia FROM dashboard_atividades WHERE usuario_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) ORDER BY dia DESC`,
    [userId]
  );
  return rows.length;
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
    const [theme, noteRows, favoriteRows, activityRows, focusDays, exams] = await Promise.all([
      getTheme(userId),
      database.query("SELECT COUNT(*) AS total FROM dashboard_notas WHERE usuario_id = ?", [userId]),
      database.query("SELECT * FROM dashboard_favoritos WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 50", [userId]),
      database.query("SELECT * FROM dashboard_atividades WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 30", [userId]),
      countDistinctFocusDays(userId),
      getExamStats(userId)
    ]);
    const completedModules = Math.min(6, new Set(activityRows.filter((row) => row.tipo === "modulo").map((row) => row.titulo)).size);
    const progress = Math.round((completedModules / 6) * 100);
    return res.json({
      sucesso: true,
      origem: "mysql",
      usuario: montarUsuarioSeguro(req.usuarioDoc || req.usuario),
      preferencias: { tema: theme },
      plano: planInfo(req.usuarioDoc || req.usuario),
      estatisticas: {
        mediaGeral: Number((exams.media / 10).toFixed(1)),
        totalAvaliacoes: exams.total,
        modulosConcluidos: completedModules,
        totalModulos: 6,
        progressoGeral: progress,
        diasFoco: focusDays,
        totalNotas: Number(noteRows[0]?.total || 0),
        grafico: [12, 22, 28, 35, 42, 52, Math.max(12, progress)]
      },
      favoritos: favoriteRows.map((row) => ({ id: row.id, type: row.tipo, key: row.chave, title: row.titulo, description: row.descricao, target: row.destino, icon: row.icone })),
      atividades: activityRows.map(formatActivity),
      notificacoes: [],
      notificacoesNaoLidas: 0
    });
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
    await database.query(`INSERT INTO dashboard_preferencias (usuario_id, tema) VALUES (?, ?) ON DUPLICATE KEY UPDATE tema = VALUES(tema), updated_at = CURRENT_TIMESTAMP`, [usuarioId(req), tema]);
    return res.json({ sucesso: true, preferencias: { tema } });
  } catch (_) { return res.status(500).json({ erro: "Erro ao salvar preferências." }); }
});

router.get("/notas", auth, async (req, res) => {
  try {
    await ensureStructure();
    const rows = await database.query("SELECT * FROM dashboard_notas WHERE usuario_id = ? ORDER BY favorita DESC, updated_at DESC", [usuarioId(req)]);
    return res.json({ sucesso: true, notas: rows.map(formatNote) });
  } catch (_) { return res.status(500).json({ erro: "Erro ao carregar notas." }); }
});

router.post("/notas", auth, async (req, res) => {
  try {
    await ensureStructure();
    const titulo = clampText(req.body?.titulo, 160);
    const conteudo = clampText(req.body?.conteudo, 10000);
    if (!titulo || !conteudo) return res.status(400).json({ erro: "Título e conteúdo são obrigatórios." });
    const id = id24();
    await database.query("INSERT INTO dashboard_notas (id, usuario_id, titulo, conteudo, favorita) VALUES (?, ?, ?, ?, ?)", [id, usuarioId(req), titulo, conteudo, toBoolean(req.body?.favorita) ? 1 : 0]);
    await database.query("INSERT INTO dashboard_atividades (id, usuario_id, tipo, titulo, descricao) VALUES (?, ?, 'nota', ?, ?)", [id24(), usuarioId(req), `Nota criada: ${titulo}`, "Nova anotação salva no dashboard."]);
    const rows = await database.query("SELECT * FROM dashboard_notas WHERE id = ?", [id]);
    return res.status(201).json({ sucesso: true, nota: formatNote(rows[0]) });
  } catch (_) { return res.status(500).json({ erro: "Erro ao criar nota." }); }
});

router.put("/notas/:id", auth, async (req, res) => {
  try {
    await ensureStructure();
    const titulo = clampText(req.body?.titulo, 160);
    const conteudo = clampText(req.body?.conteudo, 10000);
    if (!titulo || !conteudo) return res.status(400).json({ erro: "Título e conteúdo são obrigatórios." });
    const result = await database.query(`UPDATE dashboard_notas SET titulo = ?, conteudo = ?, favorita = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND usuario_id = ?`, [titulo, conteudo, toBoolean(req.body?.favorita) ? 1 : 0, req.params.id, usuarioId(req)]);
    if (!result.affectedRows) return res.status(404).json({ erro: "Nota não encontrada." });
    const rows = await database.query("SELECT * FROM dashboard_notas WHERE id = ? AND usuario_id = ?", [req.params.id, usuarioId(req)]);
    return res.json({ sucesso: true, nota: formatNote(rows[0]) });
  } catch (_) { return res.status(500).json({ erro: "Erro ao atualizar nota." }); }
});

router.delete("/notas/:id", auth, async (req, res) => {
  try {
    await ensureStructure();
    const result = await database.query("DELETE FROM dashboard_notas WHERE id = ? AND usuario_id = ?", [req.params.id, usuarioId(req)]);
    if (!result.affectedRows) return res.status(404).json({ erro: "Nota não encontrada." });
    return res.json({ sucesso: true });
  } catch (_) { return res.status(500).json({ erro: "Erro ao apagar nota." }); }
});

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
    await database.query(`INSERT INTO dashboard_chamados (id, usuario_id, usuario_nome, usuario_email, assunto, mensagem, prioridade) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, usuarioId(req), req.usuario?.nome || "", req.usuario?.email || "", assunto, mensagem, prioridade]);
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
    user.nome = nome;
    user.telefone = telefone;
    user.foto = foto;
    user.atualizadoPor = req.usuario?.email || "dashboard";
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
