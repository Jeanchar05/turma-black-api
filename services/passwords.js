"use strict";

const crypto = require("crypto");
const { promisify } = require("util");

const scryptAsync = promisify(crypto.scrypt);
const FORMAT = "$scrypt$v1$";
const DEFAULT_N = 16384;
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_PASSWORD_LENGTH = 256;
const MIN_USER_PASSWORD_LENGTH = 10;
const MIN_STAFF_PASSWORD_LENGTH = 12;

const COMMON_PASSWORDS = new Set([
  "1234567890", "123456789", "12345678", "password", "password1",
  "qwerty123", "qwertyuiop", "admin123", "administrator", "senha123",
  "senha1234", "turmablack", "turmadoprimo", "123456789a", "abcdef1234"
]);

function normalizePassword(value) {
  return String(value ?? "");
}

function isPasswordHash(value) {
  return String(value || "").startsWith(FORMAT);
}

function validatePasswordPolicy(value, options = {}) {
  const password = normalizePassword(value);
  const minimumLength = Number(options.minimumLength || MIN_USER_PASSWORD_LENGTH);
  const email = String(options.email || "").trim().toLowerCase();
  const name = String(options.name || "").trim().toLowerCase();

  if (password.length < minimumLength) {
    return { valid: false, reason: `A senha precisa ter pelo menos ${minimumLength} caracteres.` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, reason: `A senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.` };
  }

  const normalized = password.trim().toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) {
    return { valid: false, reason: "Escolha uma senha menos previsível." };
  }

  if (/^(.)\1{7,}$/.test(password) || /^(?:0123456789|1234567890|9876543210)+$/.test(password)) {
    return { valid: false, reason: "A senha é previsível demais." };
  }

  const emailLocal = email.includes("@") ? email.split("@")[0] : "";
  if (emailLocal.length >= 4 && normalized.includes(emailLocal)) {
    return { valid: false, reason: "A senha não deve conter a parte principal do seu e-mail." };
  }

  const firstName = name.split(/\s+/).filter(Boolean)[0] || "";
  if (firstName.length >= 4 && normalized.includes(firstName)) {
    return { valid: false, reason: "A senha não deve conter seu nome." };
  }

  return { valid: true, reason: "" };
}

async function deriveKey(password, salt, N = DEFAULT_N, r = DEFAULT_R, p = DEFAULT_P) {
  return scryptAsync(password, salt, KEY_LENGTH, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024
  });
}

async function hashPassword(value) {
  const password = normalizePassword(value);
  if (!password || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error("Senha inválida para hash.");
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const derived = await deriveKey(password, salt);

  return [
    "",
    "scrypt",
    "v1",
    String(DEFAULT_N),
    String(DEFAULT_R),
    String(DEFAULT_P),
    salt.toString("base64url"),
    Buffer.from(derived).toString("base64url")
  ].join("$");
}

function safeCompareStrings(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function verifyPassword(storedValue, candidateValue) {
  const stored = String(storedValue || "");
  const candidate = normalizePassword(candidateValue);
  if (!stored || !candidate || candidate.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, needsRehash: false };
  }

  if (!isPasswordHash(stored)) {
    return {
      valid: safeCompareStrings(stored, candidate),
      needsRehash: true
    };
  }

  const parts = stored.split("$");
  if (parts.length !== 8 || parts[1] !== "scrypt" || parts[2] !== "v1") {
    return { valid: false, needsRehash: false };
  }

  const N = Number(parts[3]);
  const r = Number(parts[4]);
  const p = Number(parts[5]);
  const salt = Buffer.from(parts[6], "base64url");
  const expected = Buffer.from(parts[7], "base64url");

  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || !salt.length || !expected.length) {
    return { valid: false, needsRehash: false };
  }

  try {
    const actual = Buffer.from(await deriveKey(candidate, salt, N, r, p));
    if (actual.length !== expected.length) return { valid: false, needsRehash: false };

    const valid = crypto.timingSafeEqual(actual, expected);
    const needsRehash = valid && (N !== DEFAULT_N || r !== DEFAULT_R || p !== DEFAULT_P || expected.length !== KEY_LENGTH);
    return { valid, needsRehash };
  } catch (_) {
    return { valid: false, needsRehash: false };
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  isPasswordHash,
  validatePasswordPolicy,
  MIN_USER_PASSWORD_LENGTH,
  MIN_STAFF_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH
};
