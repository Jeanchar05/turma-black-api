"use strict";
function installNotesStore() {
  const base = require("./study-memory-store.cjs").installStore(),
    db = require("../../config/database"),
    original = db.query;
  let notes = new Map();
  const fields = (a) =>
      Object.fromEntries(
        [
          "titulo",
          "conteudo",
          "favorita",
          "categoria",
          "tags",
          "fixada",
          "arquivada",
          "excluida",
          "cor",
          "checklist",
          "anexos",
        ].map((k, i) => [k, a[i]]),
      ),
    read = (map, sql, a) =>
      [...map.values()]
        .filter((n) =>
          sql.includes("WHERE id = ?")
            ? n.id === a[0] && n.usuario_id === a[1]
            : n.usuario_id === a[0],
        )
        .map((n) => ({ ...n }));
  db.query = async (sql, args = []) => {
    if (
      sql.startsWith("CREATE TABLE IF NOT EXISTS dashboard_notas") ||
      sql.startsWith("ALTER TABLE dashboard_notas")
    )
      return [];
    if (sql.startsWith("SELECT column_name FROM information_schema.columns"))
      return [];
    if (sql.startsWith("SELECT * FROM dashboard_notas"))
      return read(notes, sql, args);
    return original(sql, args);
  };
  const transaction = require("../../services/db-transaction").withTransaction;
  require.cache[
    require.resolve("../../services/db-transaction")
  ].exports.withTransaction = (callback) =>
    transaction(async (baseTx) => {
      const draft = new Map([...notes].map(([id, n]) => [id, { ...n }])),
        tx = {
          query: async (sql, a) => {
            if (sql.startsWith("INSERT IGNORE INTO dashboard_notas")) {
              if (!draft.has(a[0]))
                draft.set(a[0], {
                  id: a[0],
                  usuario_id: a[1],
                  ...fields(a.slice(2, 13)),
                  revisao: 1,
                  ultima_mutacao: a[13],
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
              return { affectedRows: 1 };
            }
            if (sql.startsWith("SELECT * FROM dashboard_notas"))
              return read(draft, sql, a);
            if (sql.startsWith("UPDATE dashboard_notas SET titulo")) {
              const row = draft.get(a[12]);
              if (row?.usuario_id !== a[13]) return { affectedRows: 0 };
              Object.assign(row, fields(a), {
                revisao: row.revisao + 1,
                ultima_mutacao: a[11],
                updated_at: new Date().toISOString(),
              });
              return { affectedRows: 1 };
            }
            if (sql.startsWith("DELETE FROM dashboard_notas")) {
              if (draft.get(a[0])?.usuario_id === a[1]) draft.delete(a[0]);
              return { affectedRows: 1 };
            }
            return baseTx.query(sql, a);
          },
        };
      const result = await callback(tx);
      notes = draft;
      return result;
    });
  return { ...base, seedNote: (r) => notes.set(r.id, r) };
}
module.exports = { installNotesStore };
