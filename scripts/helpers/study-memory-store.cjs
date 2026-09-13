"use strict";
// Transactional fixture for exercising the real service/router without production credentials.
// A failed callback rolls back both state and idempotency records.
function installStore() {
  let documents = new Map(),
    events = new Set(),
    queue = Promise.resolve();
  const database = require("../../config/database");
  database.query = async (sql) => {
    if (!sql.startsWith("CREATE TABLE IF NOT EXISTS estudo_"))
      throw Error("Unexpected DDL: " + sql);
    return [];
  };
  const withTransaction = (callback) => {
    const operation = queue.then(async () => {
      const draft = new Map(documents),
        pending = new Set(events);
      const tx = {
        query: async (sql, args) => {
          if (sql.startsWith("INSERT IGNORE INTO estudo_estado")) {
            if (!draft.has(args[0])) draft.set(args[0], args[1]);
            return { affectedRows: 1 };
          }
          if (
            sql.startsWith(
              "SELECT estado FROM estudo_estado WHERE usuario_id = ? FOR UPDATE",
            )
          )
            return draft.has(args[0]) ? [{ estado: draft.get(args[0]) }] : [];
          if (
            sql.startsWith(
              "SELECT operacao_id FROM estudo_operacoes WHERE usuario_id = ? AND operacao_id = ?",
            )
          )
            return pending.has(args[0] + "/" + args[1])
              ? [{ operacao_id: args[1] }]
              : [];
          if (sql.startsWith("INSERT INTO estudo_operacoes")) {
            pending.add(args[0] + "/" + args[1]);
            return { affectedRows: 1 };
          }
          if (
            sql.startsWith(
              "UPDATE estudo_estado SET estado = ? WHERE usuario_id = ?",
            )
          ) {
            draft.set(args[1], args[0]);
            return { affectedRows: 1 };
          }
          throw Error("Unexpected transaction SQL: " + sql);
        },
      };
      const result = await callback(tx);
      documents = draft;
      events = pending;
      return result;
    });
    queue = operation.catch(() => {});
    return operation;
  };
  require.cache[require.resolve("../../services/db-transaction")] = {
    exports: { withTransaction },
  };
  return {
    get(id) {
      return documents.has(id) ? JSON.parse(documents.get(id)) : null;
    },
    set(id, state) {
      documents.set(id, JSON.stringify(state));
    },
    events() {
      return events.size;
    },
  };
}
module.exports = { installStore };
