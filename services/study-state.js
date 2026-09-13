"use strict";
const database = require("../config/database");
const { withTransaction } = require("./db-transaction");
const Model = require("../public/study-state-model");
let structure;
async function ensureStructure() {
  if (!structure)
    structure = (async () => {
      await database.query(`CREATE TABLE IF NOT EXISTS estudo_estado (
      usuario_id CHAR(24) NOT NULL PRIMARY KEY,
      estado LONGTEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_estudo_estado_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await database.query(`CREATE TABLE IF NOT EXISTS estudo_operacoes (
      usuario_id CHAR(24) NOT NULL, operacao_id VARCHAR(100) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (usuario_id, operacao_id),
      CONSTRAINT fk_estudo_operacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    })().catch((error) => {
      structure = null;
      throw error;
    });
  return structure;
}
// The owner comes exclusively from the authenticated request, never from its body.
async function update(userId, operations = []) {
  if (!/^[a-f0-9]{24}$/i.test(userId))
    throw Object.assign(new Error("Conta inválida."), { status: 401 });
  if (!Array.isArray(operations) || operations.length > 40)
    throw Object.assign(new Error("Lote inválido."), { status: 400 });
  operations.forEach(Model.validate);
  await ensureStructure();
  return withTransaction(async (tx) => {
    await tx.query(
      "INSERT IGNORE INTO estudo_estado (usuario_id, estado) VALUES (?, ?)",
      [userId, JSON.stringify(Model.empty())],
    );
    const rows = await tx.query(
      "SELECT estado FROM estudo_estado WHERE usuario_id = ? FOR UPDATE",
      [userId],
    );
    const state = JSON.parse(rows[0].estado),
      now = Date.now();
    Model.settle(state, now);
    const acknowledged = [];
    for (const op of operations) {
      const seen = await tx.query(
        "SELECT operacao_id FROM estudo_operacoes WHERE usuario_id = ? AND operacao_id = ?",
        [userId, op.id],
      );
      if (!seen.length) {
        Model.apply(state, op, now);
        await tx.query(
          "INSERT INTO estudo_operacoes (usuario_id, operacao_id) VALUES (?, ?)",
          [userId, op.id],
        );
      }
      acknowledged.push(op.id);
    }
    const serialized = JSON.stringify(state);
    if (serialized !== rows[0].estado)
      await tx.query(
        "UPDATE estudo_estado SET estado = ? WHERE usuario_id = ?",
        [serialized, userId],
      );
    return { state, acknowledged, serverNow: now };
  });
}
module.exports = { update, ensureStructure };
