"use strict";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function money(value) {
  return Math.max(0, Math.min(100000000, Math.round(finite(value) * 100) / 100));
}

function signedMoney(value) {
  return Math.max(-100000000, Math.min(100000000, Math.round(finite(value) * 100) / 100));
}

function integer(value, max = 10000) {
  return Math.max(0, Math.min(max, Math.floor(finite(value))));
}

function validDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function sanitizeDays(input) {
  const source = Array.isArray(input) ? input.slice(-730) : [];
  const map = new Map();
  source.forEach((day) => {
    const date = String(day?.date || "").trim();
    if (!validDate(date)) return;
    const item = {
      date,
      initialBankroll: money(day?.initialBankroll),
      entries: integer(day?.entries),
      greens: integer(day?.greens),
      reds: integer(day?.reds),
      result: signedMoney(day?.result),
      finalBankroll: money(day?.finalBankroll),
      notes: String(day?.notes || "").trim().slice(0, 500),
      updatedAt: Math.max(0, Math.floor(finite(day?.updatedAt, Date.now()))),
    };
    map.set(date, item);
  });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-730);
}

function patch(target) {
  if (!target || typeof target.sanitizeBankrollState !== "function" || target.__daysV6Patched) return target;
  const original = target.sanitizeBankrollState.bind(target);
  target.sanitizeBankrollState = function sanitizeBankrollStateWithDays(input = {}) {
    const result = original(input);
    result.days = sanitizeDays(input?.days);
    return result;
  };
  Object.defineProperty(target, "__daysV6Patched", { value: true, enumerable: false });
  return target;
}

module.exports = { sanitizeDays, patch };
