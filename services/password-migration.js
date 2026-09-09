"use strict";

const database = require("../config/database");
const { hashPassword, isPasswordHash } = require("./passwords");

let migrationRunning = false;
let migrationCompleted = false;

async function migratePlaintextPasswords() {
  if (migrationCompleted || migrationRunning) {
    return { completed: migrationCompleted, skipped: true };
  }

  migrationRunning = true;
  let migrated = 0;
  let alreadySecure = 0;
  let invalid = 0;

  try {
    const rows = await database.query("SELECT id, senha FROM usuarios WHERE senha IS NOT NULL AND senha <> ''");

    for (const row of rows) {
      const id = String(row.id || "").trim();
      const stored = String(row.senha || "");
      if (!id || !stored) {
        invalid += 1;
        continue;
      }
      if (isPasswordHash(stored)) {
        alreadySecure += 1;
        continue;
      }

      try {
        const hash = await hashPassword(stored);
        const result = await database.query(
          "UPDATE usuarios SET senha=?, atualizado_por='migracao-senha-segura', updated_at=CURRENT_TIMESTAMP WHERE id=? AND senha=?",
          [hash, id, stored]
        );
        if (Number(result?.affectedRows || 0) === 1) migrated += 1;
      } catch (error) {
        invalid += 1;
        console.error(`Falha ao migrar senha da conta ${id}:`, error.message);
      }
    }

    migrationCompleted = invalid === 0;
    console.log(`[SECURITY] Migração de senhas concluída: ${migrated} migrada(s), ${alreadySecure} já segura(s), ${invalid} pendência(s).`);
    return { completed: migrationCompleted, migrated, alreadySecure, invalid };
  } finally {
    migrationRunning = false;
  }
}

module.exports = { migratePlaintextPasswords };
