"use strict";

const crypto = require("crypto");
const { promisify } = require("util");

const scryptAsync = promisify(crypto.scrypt);
const PREFIX = "$scrypt$v1$";
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_PASSWORD_LENGTH = 256;

function normalizarSenha(value) {
  const password = String(value ?? "");
  if (!password || password.length > MAX_PASSWORD_LENGTH) return "";
  return password;
}

function isPasswordHash(value) {
  return String(value || "").startsWith(PREFIX);
}

async function hashPassword(value) {
  const password = normalizarSenha(value);
  if (!password) {
    const error = new Error("Senha inválida para armazenamento seguro.");
    error.code = "PASSWORD_INVALID";
    throw error;
  }

  if (isPasswordHash(password)) return password;

  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: 64 * 1024 * 1024
  });

  return [
    "$scrypt",
    "v1",
    String(N),
    String(R),
    String(P),
    salt.toString("base64url"),
    Buffer.from(derivedKey).toString("base64url")
  ].join("$");
}

function compararSeguro(a, b) {
  const aa = Buffer.from(String(a ?? ""), "utf8");
  const bb = Buffer.from(String(b ?? ""), "utf8");
  const size = Math.max(aa.length, bb.length, 1);
  const pa = Buffer.alloc(size);
  const pb = Buffer.alloc(size);
  aa.copy(pa);
  bb.copy(pb);
  return aa.length === bb.length && crypto.timingSafeEqual(pa, pb);
}

async function verifyPassword(storedValue, candidateValue) {
  const stored = String(storedValue || "");
  const candidate = normalizarSenha(candidateValue);
  if (!stored || !candidate) return { valid: false, needsRehash: false };

  if (!isPasswordHash(stored)) {
    return {
      valid: compararSeguro(stored, candidate),
      needsRehash: compararSeguro(stored, candidate)
    };
  }

  const parts = stored.split("$");
  if (parts.length !== 8 || parts[1] !== "scrypt" || parts[2] !== "v1") {
    return { valid: false, needsRehash: false };
  }

  const n = Number(parts[3]);
  const r = Number(parts[4]);
  const p = Number(parts[5]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) || n < 2 || r < 1 || p < 1) {
    return { valid: false, needsRehash: false };
  }

  try {
    const salt = Buffer.from(parts[6], "base64url");
    const expected = Buffer.from(parts[7], "base64url");
    if (!salt.length || expected.length !== KEY_LENGTH) return { valid: false, needsRehash: false };

    const actual = Buffer.from(await scryptAsync(candidate, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: 64 * 1024 * 1024
    }));

    const valid = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    return {
      valid,
      needsRehash: valid && (n !== N || r !== R || p !== P || expected.length !== KEY_LENGTH)
    };
  } catch (_) {
    return { valid: false, needsRehash: false };
  }
}

async function ensurePasswordHash(value) {
  return isPasswordHash(value) ? String(value) : hashPassword(value);
}

module.exports = {
  hashPassword,
  verifyPassword,
  ensurePasswordHash,
  isPasswordHash,
  MAX_PASSWORD_LENGTH
};
