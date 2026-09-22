"use strict";

const assert = require("node:assert/strict");
const BankrollDays = require("../services/bankroll-days-v6");

const raw = Array.from({ length: 740 }, (_, index) => ({
  date: `2026-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`,
  initialBankroll: index === 0 ? -50 : 1000.129,
  entries: -2,
  greens: 3.8,
  reds: 2.2,
  result: index % 2 ? -45.559 : 82.337,
  finalBankroll: 1100.999,
  notes: "x".repeat(900),
}));

const days = BankrollDays.sanitizeDays(raw);
assert.equal(days.length, 730);
assert.equal(days[0].initialBankroll >= 0, true);
assert.equal(days[0].entries, 0);
assert.equal(days[0].greens, 3);
assert.equal(days[0].reds, 2);
assert.equal(days[0].notes.length, 500);
assert.match(days[0].date, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(Number.isFinite(days[0].result), true);
assert.equal(days[0].finalBankroll, 1101);

const invalid = BankrollDays.sanitizeDays([
  { date: "not-a-date", result: 50 },
  { date: "2026-09-21", entries: 5, greens: 3, reds: 2, result: 20, finalBankroll: 1020 },
]);
assert.equal(invalid.length, 1);
assert.equal(invalid[0].date, "2026-09-21");

const target = { sanitizeBankrollState: (input) => ({ ...input, days: [] }) };
BankrollDays.patch(target);
const patched = target.sanitizeBankrollState({ current: 1200, days: invalid });
assert.equal(patched.days.length, 1);
assert.equal(patched.days[0].result, 20);

console.log("Management V6 regression: OK");
