"use strict";
const fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const context = { window: {} };
vm.runInNewContext(
  fs.readFileSync(
    path.join(__dirname, "../public/study-curriculum.js"),
    "utf8",
  ),
  context,
);
const C = context.window.TurmaStudy,
  plain = (value) => JSON.parse(JSON.stringify(value));
const same = (actual, expected) =>
  assert.deepEqual(
    plain(actual).sort((a, b) => a - b),
    expected.sort((a, b) => a - b),
  );
assert.equal(new Set(C.wheel).size, 37);
same(C.neighbors(0, 1), [26, 0, 32]);
same(C.pairResults(25, 4), [21, 29]);
same(C.pairResults(35, 9), [26]); // Soma 44 não vira 8 nem 4.
same(C.pairResults(0, 0), [0]);
same(C.digitResults(16), [7, 5]);
same(C.digitResults(11), [2, 0]);
assert.equal(C.mirrors[16], 19);
assert.equal(C.mirrors[26], 29);
same(C.magnets[24], [35, 15, 25]);
assert.equal(C.familyOf(30), -1);
for (const value of ["", " ", "-1", "37", "2.5", "12x", "1 2 3 4"])
  assert.equal(C.parseNumbers(value, 1, 3), null, value);
same(C.parseNumbers("0, 12; 36", 3), [0, 12, 36]);
same(
  C.reading("gemeos", [11], 2).coverage,
  [36, 11, 30, 31, 9, 22, 18, 29, 24, 16, 33, 1, 20],
);
same(
  C.reading("espelhos", [12], 2).coverage,
  [15, 19, 4, 21, 2, 25, 17, 28, 12, 35],
);
same(C.reading("camaleoes", [16, 18, 25], 2).targets, [7, 17, 27, 29, 34]);
same(C.reading("fibonacci", [15, 14, 25, 4], 2).targets, [29, 1, 21]);
same(C.reading("cavalo", [0, 10, 20], 2).targets, []);
same(C.reading("eclipse", [0], 2).targets, [0, 10, 20, 30]);
same(C.reading("eclipse", [0], 2).coverage, [9, 19, 29]);
assert.equal(C.modules.length, 8);
const { isPremiumPath } = require("../middleware/premium-content-guard");
for (const name of [
  "study-workspace.js",
  "study-games.js",
  "study-game-ui.js",
  "study-state-model.js",
  "study-sync.js",
  "study-focus.js",
  "study-focus.css",
  "study-curriculum.js",
  "study-appearance.js",
  "study-workspace.css",
])
  assert.equal(isPremiumPath("/" + name), true);
for (const m of C.modules) {
  assert.equal(isPremiumPath(`/estudo-${m.route}`), true);
  for (const theme of ["dark", "light"])
    assert.ok(
      fs.existsSync(
        path.join(
          __dirname,
          `../public/assets/modules-v4/${m.art}-${theme}.webp`,
        ),
      ),
    );
  for (let i = 0; i < 40; i++) {
    const q = C.challenge(m.id, i);
    assert.ok(q.expected.length > 0);
    assert.equal(q.expected.length, new Set(q.expected).size);
    assert.ok(
      q.expected.every((n) => Number.isInteger(n) && n >= 0 && n <= 36),
    );
  }
}
console.log(
  "Estudo OK: regras originais, valores limítrofes, oito módulos, capas e proteção dos novos recursos.",
);
