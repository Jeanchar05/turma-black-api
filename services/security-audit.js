"use strict";

const crypto = require("crypto");
const database = require("../config/database");

let ready = false;
let preparing = null;

function text(value, max = 190) {
  return String(value || "").trim().slice(0, max);
}

function hashIp(req) {
  const ip = text(req?.ip || req?.socket?.remoteAddress || "unknown", 128);
  return crypto.createHash("sha256").update(ip).digest("hex");
}

async function ensureAuditTable() {
  if (ready) return;
  if (preparing) return preparing;

  preparing = database.query(`
    CREATE TABLE IF NOT EXISTS security_audit_log (
      id CHAR(36) NOT NULL PRIMARY KEY,
      event VARCHAR(100) NOT NULL,
      actor_user_id CHAR(24) NULL,
      actor_email VARCHAR(190) NOT NULL DEFAULT '',
      target_user_id CHAR(24) NULL,
      target_email VARCHAR(190) NOT NULL DEFAULT '',
      ip_hash CHAR(64) NOT NULL DEFAULT '',
      metadata LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_security_audit_event (event, created_at),
      KEY idx_security_audit_actor (actor_user_id, created_at),
      KEY idx_security_audit_target (target_user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).then(() => { ready = true; }).finally(() => { preparing = null; });

  return preparing;
}

function safeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};
  const blocked = /password|senha|token|secret|segredo|key|authorization|cookie/i;
  const result = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (blocked.test(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value) || value === null) {
      result[text(key, 80)] = typeof value === "string" ? text(value, 500) : value;
    }
  }
  return result;
}

async function audit(req, event, details = {}) {
  try {
    await ensureAuditTable();
    const actor = req?.usuarioDoc || req?.usuario || {};
    const target = details.target || {};
    await database.query(
      `INSERT INTO security_audit_log
        (id,event,actor_user_id,actor_email,target_user_id,target_email,ip_hash,metadata)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        crypto.randomUUID(),
        text(event, 100),
        text(actor._id || actor.id, 24) || null,
        text(actor.email, 190).toLowerCase(),
        text(target._id || target.id, 24) || null,
        text(target.email, 190).toLowerCase(),
        hashIp(req),
        JSON.stringify(safeMetadata(details.metadata))
      ]
    );
  } catch (error) {
    // Auditoria não deve derrubar a operação principal, mas a falha fica visível no log do servidor.
    console.error("[SECURITY_AUDIT] Falha ao registrar evento:", error.message);
  }
}

module.exports = { audit, ensureAuditTable };
