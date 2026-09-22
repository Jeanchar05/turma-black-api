"use strict";

const crypto = require("crypto");

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D+/g, "");
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return "";
  return `+55${digits}`;
}

function generateCode(random = Math.random) {
  const n = Math.floor(Math.max(0, Math.min(0.999999999, Number(random()) || 0)) * 900000) + 100000;
  return String(n).padStart(6, "0");
}

function hashCode({ code, userId, phone, secret }) {
  return crypto
    .createHmac("sha256", String(secret || "profile-verification"))
    .update(`${String(userId || "")}\n${String(phone || "")}\n${String(code || "")}`)
    .digest("hex");
}

function verifyCode({ code, userId, phone, secret, digest }) {
  const expected = Buffer.from(hashCode({ code, userId, phone, secret }), "hex");
  const actual = Buffer.from(String(digest || ""), "hex");
  if (!expected.length || expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function safeDisplayName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

function maskPhone(value) {
  const normalized = normalizePhone(value);
  if (!normalized) return "";
  const local = normalized.slice(3);
  if (local.length === 11) return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
}

module.exports = { normalizePhone, generateCode, hashCode, verifyCode, safeDisplayName, maskPhone };
