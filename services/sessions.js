"use strict";

const database = require("../config/database");

let structureReady = false;
let lastCleanupAt = 0;

async function ensureStructure() {
  if (structureReady) return;

  await database.query(`CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti VARCHAR(96) NOT NULL PRIMARY KEY,
    user_id CHAR(24) NOT NULL DEFAULT '',
    expires_at DATETIME NOT NULL,
    reason VARCHAR(120) NOT NULL DEFAULT 'logout',
    revoked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_revoked_user (user_id, revoked_at),
    KEY idx_revoked_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await database.query(`CREATE TABLE IF NOT EXISTS user_session_state (
    user_id CHAR(24) NOT NULL PRIMARY KEY,
    invalid_before DATETIME NULL,
    reason VARCHAR(120) NOT NULL DEFAULT '',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  structureReady = true;
}

async function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanupAt < 60 * 60 * 1000) return;
  lastCleanupAt = now;
  try {
    await ensureStructure();
    await database.query("DELETE FROM revoked_tokens WHERE expires_at < (CURRENT_TIMESTAMP - INTERVAL 1 DAY)");
  } catch (_) {}
}

function expToMysql(expSeconds) {
  const value = Number(expSeconds || 0);
  const date = Number.isFinite(value) && value > 0
    ? new Date(value * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function revokeToken({ jti, userId = "", exp = 0, reason = "logout" } = {}) {
  const tokenId = String(jti || "").trim();
  if (!tokenId) return false;
  await ensureStructure();
  await database.query(
    `INSERT INTO revoked_tokens (jti,user_id,expires_at,reason)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),expires_at=VALUES(expires_at),reason=VALUES(reason)`,
    [tokenId, String(userId || "").slice(0, 24), expToMysql(exp), String(reason || "logout").slice(0, 120)]
  );
  cleanupExpired().catch(() => {});
  return true;
}

async function revokeAllUserSessions(userId, reason = "security-change") {
  const id = String(userId || "").trim();
  if (!id) return false;
  await ensureStructure();
  await database.query(
    `INSERT INTO user_session_state (user_id,invalid_before,reason)
     VALUES (?,CURRENT_TIMESTAMP,?)
     ON DUPLICATE KEY UPDATE invalid_before=CURRENT_TIMESTAMP,reason=VALUES(reason),updated_at=CURRENT_TIMESTAMP`,
    [id, String(reason || "security-change").slice(0, 120)]
  );
  return true;
}

async function sessionIsValid({ jti, userId = "", iat = 0 } = {}) {
  const tokenId = String(jti || "").trim();
  const id = String(userId || "").trim();
  if (!tokenId) return false;

  try {
    await ensureStructure();
    const revoked = await database.query("SELECT jti FROM revoked_tokens WHERE jti=? LIMIT 1", [tokenId]);
    if (revoked.length) return false;

    if (id) {
      const states = await database.query("SELECT invalid_before FROM user_session_state WHERE user_id=? LIMIT 1", [id]);
      const invalidBefore = states[0]?.invalid_before ? new Date(states[0].invalid_before).getTime() : 0;
      const issuedAt = Number(iat || 0) * 1000;
      if (invalidBefore && (!issuedAt || issuedAt <= invalidBefore)) return false;
    }

    cleanupExpired().catch(() => {});
    return true;
  } catch (error) {
    console.error("Erro ao validar revogação de sessão:", error.message);
    return false;
  }
}

module.exports = {
  ensureStructure,
  revokeToken,
  revokeAllUserSessions,
  sessionIsValid
};
