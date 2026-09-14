"use strict";
const database = require("../config/database"),
  { withTransaction } = require("./db-transaction"),
  { normalize, format, error } = require("./note-content");
let structure;
async function ensureStructure() {
  if (!structure)
    structure = (async () => {
      await database.query(`CREATE TABLE IF NOT EXISTS dashboard_notas (
 id CHAR(24) NOT NULL PRIMARY KEY, usuario_id CHAR(24) NOT NULL, titulo VARCHAR(160) NOT NULL, conteudo LONGTEXT NOT NULL,
 favorita TINYINT(1) NOT NULL DEFAULT 0, categoria VARCHAR(80) NOT NULL DEFAULT 'Geral',tags LONGTEXT NULL,fixada TINYINT(1) NOT NULL DEFAULT 0,arquivada TINYINT(1) NOT NULL DEFAULT 0,excluida TINYINT(1) NOT NULL DEFAULT 0,cor VARCHAR(20) NOT NULL DEFAULT 'purple',checklist LONGTEXT NULL,anexos LONGTEXT NULL,revisao INT UNSIGNED NOT NULL DEFAULT 1,ultima_mutacao VARCHAR(36) NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,KEY idx_dash_notas_usuario (usuario_id),KEY idx_dash_notas_status (usuario_id,excluida,arquivada),CONSTRAINT fk_dash_notas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      const additions = {
        categoria: "VARCHAR(80) NOT NULL DEFAULT 'Geral'",
        tags: "LONGTEXT NULL",
        fixada: "TINYINT(1) NOT NULL DEFAULT 0",
        arquivada: "TINYINT(1) NOT NULL DEFAULT 0",
        excluida: "TINYINT(1) NOT NULL DEFAULT 0",
        cor: "VARCHAR(20) NOT NULL DEFAULT 'purple'",
        checklist: "LONGTEXT NULL",
        anexos: "LONGTEXT NULL",
        revisao: "INT UNSIGNED NOT NULL DEFAULT 1",
        ultima_mutacao: "VARCHAR(36) NULL",
      };
      const cols = await database.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?",
          ["dashboard_notas"],
        ),
        present = new Set(
          cols.map((c) => String(c.column_name || c.COLUMN_NAME).toLowerCase()),
        );
      for (const [n, d] of Object.entries(additions))
        if (!present.has(n)) {
          try {
            await database.query(
              `ALTER TABLE dashboard_notas ADD COLUMN \`${n}\` ${d}`,
            );
          } catch (e) {
            if (e.code !== "ER_DUP_FIELDNAME") throw e;
          }
        }
    })().catch((e) => {
      structure = null;
      throw e;
    });
  return structure;
}
function validId(id) {
  if (!/^[a-f0-9]{24}$/.test(id)) throw error("Nota não encontrada.", 404);
}
async function list(user) {
  await ensureStructure();
  return (
    await database.query(
      "SELECT * FROM dashboard_notas WHERE usuario_id = ? ORDER BY fixada DESC, favorita DESC, updated_at DESC",
      [user],
    )
  ).map(format);
}
async function get(user, id) {
  validId(id);
  await ensureStructure();
  const rows = await database.query(
    "SELECT * FROM dashboard_notas WHERE id = ? AND usuario_id = ?",
    [id, user],
  );
  if (!rows[0]) throw error("Nota não encontrada.", 404);
  return format(rows[0]);
}
function fields(n) {
  return [
    n.titulo,
    n.conteudo,
    +n.favorita,
    n.categoria,
    JSON.stringify(n.tags),
    +n.fixada,
    +n.arquivada,
    +n.excluida,
    n.cor,
    JSON.stringify(n.checklist),
    JSON.stringify(n.anexos),
  ];
}
async function save(user, id, body) {
  validId(id);
  if (
    !Number.isSafeInteger(body?.revision) ||
    body.revision < 0 ||
    !/^[a-f0-9-]{36}$/.test(body?.mutationId || "")
  )
    throw error("Versão inválida. Reabra a nota.");
  const n = normalize(body);
  await ensureStructure();
  return withTransaction(async (tx) => {
    if (body.revision === 0)
      await tx.query(
        "INSERT IGNORE INTO dashboard_notas (id, usuario_id, titulo, conteudo, favorita, categoria, tags, fixada, arquivada, excluida, cor, checklist, anexos, revisao, ultima_mutacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
        [id, user, ...fields(n), body.mutationId],
      );
    const rows = await tx.query(
        "SELECT * FROM dashboard_notas WHERE id = ? AND usuario_id = ? FOR UPDATE",
        [id, user],
      ),
      r = rows[0];
    if (!r)
      throw error(
        "Esta nota foi excluída ou não está disponível nesta conta.",
        404,
      );
    if (r.ultima_mutacao === body.mutationId) return format(r);
    if (Number(r.revisao) !== body.revision)
      throw error(
        "A nota mudou em outro dispositivo. Sua edição foi preservada neste dispositivo.",
        409,
        { nota: format(r) },
      );
    await tx.query(
      "UPDATE dashboard_notas SET titulo = ?, conteudo = ?, favorita = ?, categoria = ?, tags = ?, fixada = ?, arquivada = ?, excluida = ?, cor = ?, checklist = ?, anexos = ?, revisao = revisao + 1, ultima_mutacao = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND usuario_id = ?",
      [...fields(n), body.mutationId, id, user],
    );
    return format(
      (
        await tx.query(
          "SELECT * FROM dashboard_notas WHERE id = ? AND usuario_id = ?",
          [id, user],
        )
      )[0],
    );
  });
}
async function remove(user, id, revision) {
  validId(id);
  if (!Number.isSafeInteger(revision) || revision < 1)
    throw error("Versão inválida.");
  await ensureStructure();
  return withTransaction(async (tx) => {
    const rows = await tx.query(
      "SELECT * FROM dashboard_notas WHERE id = ? AND usuario_id = ? FOR UPDATE",
      [id, user],
    );
    if (!rows[0]) throw error("Nota não encontrada.", 404);
    if (Number(rows[0].revisao) !== revision)
      throw error("A nota mudou. Atualize a lixeira antes de excluir.", 409);
    if (!rows[0].excluida)
      throw error(
        "Mova a nota para a lixeira antes de excluir definitivamente.",
      );
    await tx.query(
      "DELETE FROM dashboard_notas WHERE id = ? AND usuario_id = ?",
      [id, user],
    );
  });
}
module.exports = { list, get, save, remove, ensureStructure };
