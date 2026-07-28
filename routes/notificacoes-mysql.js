"use strict";

const express = require("express");
const crypto = require("crypto");
const database = require("../config/database");
const { auth } = require("../middleware/auth");
const { requirePermission, getCargo } = require("../middleware/permissions");

const router = express.Router();
let estruturaGarantida = false;

function id24() {
  return crypto.randomBytes(12).toString("hex");
}

function texto(value, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function email(value) {
  return texto(value, 190).toLowerCase();
}

function booleano(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function normalizarTipo(value) {
  const permitido = [
    "geral", "atualizacao", "manutencao", "premium", "seguranca",
    "venda", "plano", "agenda", "prova", "suporte"
  ];
  const atual = texto(value, 32).toLowerCase();
  return permitido.includes(atual) ? atual : "geral";
}

function normalizarDestino(value) {
  const permitido = [
    "todos", "premium", "free", "admin", "vendedores", "suporte",
    "moderadores", "superadmin", "especifico"
  ];
  const atual = texto(value, 32).toLowerCase();
  return permitido.includes(atual) ? atual : "todos";
}

function normalizarPrioridade(value) {
  const permitido = ["baixa", "normal", "alta", "urgente"];
  const atual = texto(value, 20).toLowerCase();
  return permitido.includes(atual) ? atual : "normal";
}

function usuarioId(req) {
  return texto(req.usuario?.id || req.usuario?._id || req.usuarioDoc?._id, 24);
}

function destinosDoUsuario(usuario) {
  const destinos = new Set(["todos"]);
  const plano = texto(usuario?.plano, 32).toLowerCase();
  const cargo = getCargo(usuario);

  destinos.add(plano === "free" ? "free" : "premium");

  if (["dev", "dono", "superadmin", "admin", "financeiro", "moderador", "suporte"].includes(cargo)) {
    destinos.add("admin");
  }
  if (["dev", "dono", "superadmin"].includes(cargo)) destinos.add("superadmin");
  if (cargo === "moderador") destinos.add("moderadores");
  if (cargo === "suporte") destinos.add("suporte");
  if (usuario?.vendedor || ["vendedor", "financeiro", "admin", "dono", "dev"].includes(cargo)) {
    destinos.add("vendedores");
  }

  return Array.from(destinos);
}

function dataMysql(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

async function garantirEstrutura() {
  if (estruturaGarantida) return;

  await database.query(`
    CREATE TABLE IF NOT EXISTS notificacoes (
      id CHAR(24) NOT NULL PRIMARY KEY,
      titulo VARCHAR(180) NOT NULL,
      mensagem TEXT NOT NULL,
      tipo VARCHAR(32) NOT NULL DEFAULT 'geral',
      destino VARCHAR(32) NOT NULL DEFAULT 'todos',
      email VARCHAR(190) NOT NULL DEFAULT '',
      usuario_id CHAR(24) NULL,
      prioridade VARCHAR(20) NOT NULL DEFAULT 'normal',
      link VARCHAR(1000) NOT NULL DEFAULT '',
      icone VARCHAR(40) NOT NULL DEFAULT '🔔',
      ativa TINYINT(1) NOT NULL DEFAULT 1,
      fixada TINYINT(1) NOT NULL DEFAULT 0,
      expira_em DATETIME NULL,
      enviada_por VARCHAR(190) NOT NULL DEFAULT '',
      criado_por VARCHAR(190) NOT NULL DEFAULT '',
      atualizado_por VARCHAR(190) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_notificacoes_destino (destino, ativa),
      KEY idx_notificacoes_usuario (usuario_id, ativa),
      KEY idx_notificacoes_email (email, ativa),
      KEY idx_notificacoes_prioridade (prioridade),
      KEY idx_notificacoes_data (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await database.query(`
    CREATE TABLE IF NOT EXISTS notificacoes_lidas (
      notificacao_id CHAR(24) NOT NULL,
      usuario_id CHAR(24) NOT NULL,
      email VARCHAR(190) NOT NULL DEFAULT '',
      lida_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (notificacao_id, usuario_id),
      KEY idx_notificacoes_lidas_usuario (usuario_id, lida_em),
      CONSTRAINT fk_notificacao_lida FOREIGN KEY (notificacao_id)
        REFERENCES notificacoes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  estruturaGarantida = true;
}

function formatar(row) {
  return {
    id: row.id,
    _id: row.id,
    titulo: row.titulo || "",
    mensagem: row.mensagem || "",
    tipo: row.tipo || "geral",
    destino: row.destino || "todos",
    email: row.email || "",
    usuarioId: row.usuario_id || null,
    prioridade: row.prioridade || "normal",
    link: row.link || "",
    icone: row.icone || "🔔",
    ativa: Boolean(row.ativa),
    fixada: Boolean(row.fixada),
    expiraEm: row.expira_em || "",
    lida: Boolean(row.lida),
    totalLidas: Number(row.total_lidas || 0),
    enviadaPor: row.enviada_por || "",
    criadoPor: row.criado_por || "",
    atualizadoPor: row.atualizado_por || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

async function buscarPorId(id) {
  const rows = await database.query(`
    SELECT n.*,
      (SELECT COUNT(*) FROM notificacoes_lidas nl WHERE nl.notificacao_id = n.id) AS total_lidas
    FROM notificacoes n
    WHERE n.id = ?
    LIMIT 1
  `, [texto(id, 24)]);
  return rows[0] || null;
}

async function listarDoUsuario(req, res) {
  try {
    await garantirEstrutura();
    const userId = usuarioId(req);
    const userEmail = email(req.usuario?.email);
    const destinos = destinosDoUsuario(req.usuario);
    const placeholders = destinos.map(() => "?").join(",");

    const rows = await database.query(`
      SELECT n.*,
        EXISTS(
          SELECT 1 FROM notificacoes_lidas nl
          WHERE nl.notificacao_id = n.id AND nl.usuario_id = ?
        ) AS lida,
        (SELECT COUNT(*) FROM notificacoes_lidas nl2 WHERE nl2.notificacao_id = n.id) AS total_lidas
      FROM notificacoes n
      WHERE n.ativa = 1
        AND (n.expira_em IS NULL OR n.expira_em >= NOW())
        AND (
          n.destino IN (${placeholders})
          OR (
            n.destino = 'especifico'
            AND (LOWER(n.email) = ? OR n.usuario_id = ?)
          )
        )
      ORDER BY n.fixada DESC, n.created_at DESC
      LIMIT 60
    `, [userId, ...destinos, userEmail, userId]);

    const notificacoes = rows.map(formatar);
    return res.json({
      sucesso: true,
      origem: "mysql-hostinger",
      total: notificacoes.length,
      naoLidas: notificacoes.filter((item) => !item.lida).length,
      notificacoes
    });
  } catch (error) {
    console.error("Erro ao buscar notificações MySQL:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar notificações." });
  }
}

router.get("/minhas-notificacoes", auth, listarDoUsuario);
router.get("/notificacoes/minhas", auth, listarDoUsuario);

async function marcarLida(req, res) {
  try {
    await garantirEstrutura();
    const notificacao = await buscarPorId(req.params.id);
    if (!notificacao) return res.status(404).json({ erro: "Notificação não encontrada." });
    if (!notificacao.ativa) return res.status(400).json({ erro: "Esta notificação está desativada." });
    if (notificacao.expira_em && new Date(notificacao.expira_em).getTime() < Date.now()) {
      return res.status(400).json({ erro: "Esta notificação expirou." });
    }

    await database.query(`
      INSERT INTO notificacoes_lidas (notificacao_id, usuario_id, email)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE email = VALUES(email), lida_em = CURRENT_TIMESTAMP
    `, [notificacao.id, usuarioId(req), email(req.usuario?.email)]);

    notificacao.lida = 1;
    return res.json({ sucesso: true, mensagem: "Notificação marcada como lida.", notificacao: formatar(notificacao) });
  } catch (error) {
    console.error("Erro ao marcar notificação como lida:", error);
    return res.status(500).json({ erro: "Erro interno ao marcar notificação como lida." });
  }
}

router.post("/notificacoes/:id/lida", auth, marcarLida);
router.post("/minhas-notificacoes/:id/lida", auth, marcarLida);

router.post("/notificacoes/marcar-todas-lidas", auth, async (req, res) => {
  try {
    await garantirEstrutura();
    const userId = usuarioId(req);
    const userEmail = email(req.usuario?.email);
    const destinos = destinosDoUsuario(req.usuario);
    const placeholders = destinos.map(() => "?").join(",");

    const result = await database.query(`
      INSERT IGNORE INTO notificacoes_lidas (notificacao_id, usuario_id, email)
      SELECT n.id, ?, ?
      FROM notificacoes n
      WHERE n.ativa = 1
        AND (n.expira_em IS NULL OR n.expira_em >= NOW())
        AND (
          n.destino IN (${placeholders})
          OR (n.destino = 'especifico' AND (LOWER(n.email) = ? OR n.usuario_id = ?))
        )
    `, [userId, userEmail, ...destinos, userEmail, userId]);

    return res.json({
      sucesso: true,
      mensagem: "Todas as notificações foram marcadas como lidas.",
      total: Number(result.affectedRows || 0)
    });
  } catch (error) {
    console.error("Erro ao marcar todas as notificações:", error);
    return res.status(500).json({ erro: "Erro interno ao marcar notificações como lidas." });
  }
});

router.get("/admin/notificacoes/resumo", auth, requirePermission("notificacoes"), async (_req, res) => {
  try {
    await garantirEstrutura();
    const rows = await database.query(`
      SELECT
        COUNT(*) AS total,
        SUM(ativa = 1) AS ativas,
        SUM(ativa = 0) AS inativas,
        SUM(fixada = 1) AS fixadas,
        SUM(expira_em IS NOT NULL AND expira_em < NOW()) AS expiradas,
        SUM(destino = 'todos') AS gerais,
        SUM(destino = 'especifico') AS especificas,
        SUM(prioridade = 'urgente' AND ativa = 1) AS urgentes
      FROM notificacoes
    `);
    const row = rows[0] || {};
    return res.json({
      sucesso: true,
      origem: "mysql-hostinger",
      resumo: {
        total: Number(row.total || 0),
        ativas: Number(row.ativas || 0),
        inativas: Number(row.inativas || 0),
        fixadas: Number(row.fixadas || 0),
        expiradas: Number(row.expiradas || 0),
        gerais: Number(row.gerais || 0),
        especificas: Number(row.especificas || 0),
        urgentes: Number(row.urgentes || 0)
      }
    });
  } catch (error) {
    console.error("Erro no resumo de notificações MySQL:", error);
    return res.status(500).json({ erro: "Erro interno ao gerar resumo de notificações." });
  }
});

router.get("/admin/notificacoes", auth, requirePermission("notificacoes"), async (req, res) => {
  try {
    await garantirEstrutura();
    const conditions = ["1 = 1"];
    const params = [];
    const busca = texto(req.query.busca, 180);
    const tipo = texto(req.query.tipo, 32);
    const destino = texto(req.query.destino, 32);
    const prioridade = texto(req.query.prioridade, 20);
    const ativa = texto(req.query.ativa, 10);
    const fixada = texto(req.query.fixada, 10);
    const limite = Math.max(1, Math.min(300, Number(req.query.limite || 150)));

    if (busca) {
      conditions.push("(n.titulo LIKE ? OR n.mensagem LIKE ? OR n.email LIKE ? OR n.enviada_por LIKE ?)");
      const termo = `%${busca}%`;
      params.push(termo, termo, termo, termo);
    }
    if (tipo) { conditions.push("n.tipo = ?"); params.push(normalizarTipo(tipo)); }
    if (destino) { conditions.push("n.destino = ?"); params.push(normalizarDestino(destino)); }
    if (prioridade) { conditions.push("n.prioridade = ?"); params.push(normalizarPrioridade(prioridade)); }
    if (ativa === "true" || ativa === "false") { conditions.push("n.ativa = ?"); params.push(ativa === "true" ? 1 : 0); }
    if (fixada === "true" || fixada === "false") { conditions.push("n.fixada = ?"); params.push(fixada === "true" ? 1 : 0); }

    const rows = await database.query(`
      SELECT n.*,
        (SELECT COUNT(*) FROM notificacoes_lidas nl WHERE nl.notificacao_id = n.id) AS total_lidas
      FROM notificacoes n
      WHERE ${conditions.join(" AND ")}
      ORDER BY n.fixada DESC, n.created_at DESC
      LIMIT ${limite}
    `, params);

    return res.json({ sucesso: true, origem: "mysql-hostinger", total: rows.length, notificacoes: rows.map(formatar) });
  } catch (error) {
    console.error("Erro ao listar notificações MySQL:", error);
    return res.status(500).json({ erro: "Erro interno ao listar notificações." });
  }
});

router.get("/admin/notificacoes/:id", auth, requirePermission("notificacoes"), async (req, res) => {
  try {
    await garantirEstrutura();
    const row = await buscarPorId(req.params.id);
    if (!row) return res.status(404).json({ erro: "Notificação não encontrada." });
    return res.json({ sucesso: true, notificacao: formatar(row) });
  } catch (error) {
    return res.status(500).json({ erro: "Erro interno ao buscar notificação." });
  }
});

router.post("/admin/notificacoes", auth, requirePermission("notificacoes"), async (req, res) => {
  try {
    await garantirEstrutura();
    const titulo = texto(req.body?.titulo, 180);
    const mensagem = texto(req.body?.mensagem, 10000);
    if (!titulo || !mensagem) return res.status(400).json({ erro: "Título e mensagem são obrigatórios." });

    const destino = normalizarDestino(req.body?.destino);
    const emailDestino = email(req.body?.email);
    const usuarioDestino = texto(req.body?.usuarioId, 24) || null;
    if (destino === "especifico" && !emailDestino && !usuarioDestino) {
      return res.status(400).json({ erro: "Para notificação específica, informe o e-mail ou ID do usuário." });
    }

    const id = id24();
    const autor = email(req.usuario?.email);
    await database.query(`
      INSERT INTO notificacoes (
        id, titulo, mensagem, tipo, destino, email, usuario_id, prioridade,
        link, icone, ativa, fixada, expira_em, enviada_por, criado_por, atualizado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `, [
      id, titulo, mensagem, normalizarTipo(req.body?.tipo), destino, emailDestino,
      usuarioDestino, normalizarPrioridade(req.body?.prioridade), texto(req.body?.link, 1000),
      texto(req.body?.icone, 40) || "🔔", booleano(req.body?.fixada) ? 1 : 0,
      dataMysql(req.body?.expiraEm), autor, autor, autor
    ]);

    const row = await buscarPorId(id);
    return res.status(201).json({ sucesso: true, mensagem: "Notificação criada com sucesso.", notificacao: formatar(row) });
  } catch (error) {
    console.error("Erro ao criar notificação MySQL:", error);
    return res.status(500).json({ erro: "Erro interno ao criar notificação." });
  }
});

router.put("/admin/notificacoes/:id", auth, requirePermission("notificacoes"), async (req, res) => {
  try {
    await garantirEstrutura();
    const original = await buscarPorId(req.params.id);
    if (!original) return res.status(404).json({ erro: "Notificação não encontrada." });

    const campos = {
      titulo: req.body?.titulo !== undefined ? texto(req.body.titulo, 180) : original.titulo,
      mensagem: req.body?.mensagem !== undefined ? texto(req.body.mensagem, 10000) : original.mensagem,
      tipo: req.body?.tipo !== undefined ? normalizarTipo(req.body.tipo) : original.tipo,
      destino: req.body?.destino !== undefined ? normalizarDestino(req.body.destino) : original.destino,
      email: req.body?.email !== undefined ? email(req.body.email) : original.email,
      usuarioId: req.body?.usuarioId !== undefined ? (texto(req.body.usuarioId, 24) || null) : original.usuario_id,
      prioridade: req.body?.prioridade !== undefined ? normalizarPrioridade(req.body.prioridade) : original.prioridade,
      link: req.body?.link !== undefined ? texto(req.body.link, 1000) : original.link,
      icone: req.body?.icone !== undefined ? (texto(req.body.icone, 40) || "🔔") : original.icone,
      ativa: req.body?.ativa !== undefined ? (booleano(req.body.ativa) ? 1 : 0) : Number(original.ativa),
      fixada: req.body?.fixada !== undefined ? (booleano(req.body.fixada) ? 1 : 0) : Number(original.fixada),
      expiraEm: req.body?.expiraEm !== undefined ? dataMysql(req.body.expiraEm) : original.expira_em
    };

    await database.query(`
      UPDATE notificacoes SET titulo = ?, mensagem = ?, tipo = ?, destino = ?, email = ?,
        usuario_id = ?, prioridade = ?, link = ?, icone = ?, ativa = ?, fixada = ?,
        expira_em = ?, atualizado_por = ?
      WHERE id = ?
    `, [campos.titulo, campos.mensagem, campos.tipo, campos.destino, campos.email,
      campos.usuarioId, campos.prioridade, campos.link, campos.icone, campos.ativa,
      campos.fixada, campos.expiraEm, email(req.usuario?.email), original.id]);

    const row = await buscarPorId(original.id);
    return res.json({ sucesso: true, mensagem: "Notificação atualizada com sucesso.", notificacao: formatar(row) });
  } catch (error) {
    console.error("Erro ao atualizar notificação MySQL:", error);
    return res.status(500).json({ erro: "Erro interno ao atualizar notificação." });
  }
});

async function alterarFlags(req, res, changes, mensagem) {
  try {
    await garantirEstrutura();
    const row = await buscarPorId(req.params.id);
    if (!row) return res.status(404).json({ erro: "Notificação não encontrada." });

    const sets = [];
    const params = [];
    for (const [column, value] of Object.entries(changes)) {
      sets.push(`${column} = ?`);
      params.push(value);
    }
    sets.push("atualizado_por = ?");
    params.push(email(req.usuario?.email), row.id);
    await database.query(`UPDATE notificacoes SET ${sets.join(", ")} WHERE id = ?`, params);

    const updated = await buscarPorId(row.id);
    return res.json({ sucesso: true, mensagem, notificacao: formatar(updated) });
  } catch (error) {
    console.error("Erro ao alterar notificação MySQL:", error);
    return res.status(500).json({ erro: "Erro interno ao alterar notificação." });
  }
}

router.post("/admin/notificacoes/:id/status", auth, requirePermission("notificacoes"), (req, res) =>
  alterarFlags(req, res, { ativa: booleano(req.body?.ativa) ? 1 : 0 }, "Status da notificação atualizado."));
router.post("/admin/notificacoes/:id/desativar", auth, requirePermission("notificacoes"), (req, res) =>
  alterarFlags(req, res, { ativa: 0 }, "Notificação desativada com sucesso."));
router.post("/admin/notificacoes/:id/fixar", auth, requirePermission("notificacoes"), (req, res) =>
  alterarFlags(req, res, { fixada: 1 }, "Notificação fixada com sucesso."));
router.post("/admin/notificacoes/:id/desfixar", auth, requirePermission("notificacoes"), (req, res) =>
  alterarFlags(req, res, { fixada: 0 }, "Notificação desfixada com sucesso."));

router.post("/admin/notificacoes/:id/reenviar", auth, requirePermission("notificacoes"), async (req, res) => {
  try {
    await garantirEstrutura();
    const original = await buscarPorId(req.params.id);
    if (!original) return res.status(404).json({ erro: "Notificação não encontrada." });

    const novoId = id24();
    const autor = email(req.usuario?.email);
    await database.query(`
      INSERT INTO notificacoes (
        id, titulo, mensagem, tipo, destino, email, usuario_id, prioridade,
        link, icone, ativa, fixada, expira_em, enviada_por, criado_por, atualizado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `, [novoId, original.titulo, original.mensagem, original.tipo, original.destino,
      original.email, original.usuario_id, original.prioridade, original.link,
      original.icone, Number(original.fixada), original.expira_em, autor, autor, autor]);

    const nova = await buscarPorId(novoId);
    return res.status(201).json({ sucesso: true, mensagem: "Notificação reenviada com sucesso.", notificacao: formatar(nova) });
  } catch (error) {
    console.error("Erro ao reenviar notificação MySQL:", error);
    return res.status(500).json({ erro: "Erro interno ao reenviar notificação." });
  }
});

router.delete("/admin/notificacoes/:id", auth, requirePermission("notificacoes"), async (req, res) => {
  try {
    await garantirEstrutura();
    const result = await database.query("DELETE FROM notificacoes WHERE id = ?", [texto(req.params.id, 24)]);
    if (!Number(result.affectedRows || 0)) return res.status(404).json({ erro: "Notificação não encontrada." });
    return res.json({ sucesso: true, mensagem: "Notificação removida com sucesso." });
  } catch (error) {
    console.error("Erro ao remover notificação MySQL:", error);
    return res.status(500).json({ erro: "Erro interno ao remover notificação." });
  }
});

router.get("/notificacoes/status", (_req, res) => {
  res.json({
    status: "online",
    modulo: "notificacoes",
    origem: "mysql-hostinger",
    render: false,
    pushExterno: false
  });
});

module.exports = router;
