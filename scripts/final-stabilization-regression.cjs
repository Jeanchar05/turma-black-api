"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Bank = require("../public/bankroll-model.js");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

// Gestão: uma única fonte de verdade.
let state = Bank.normalizeState({ initial: 1000, entries: [], days: [] });
state = Bank.upsertDay(state, { date: "2026-09-20", initialBankroll: 1000, finalBankroll: 2000, result: 1000, entries: 5, greens: 4, reds: 1 });
state = Bank.upsertDay(state, { date: "2026-09-21", initialBankroll: 2000, finalBankroll: 2500, result: 500, entries: 5, greens: 2, reds: 0 });
state = Bank.upsertDay(state, { date: "2026-09-22", initialBankroll: 2500, finalBankroll: 2690, result: 190, entries: 5, greens: 3, reds: 1 });
let summary = Bank.summarize(state, "2026-09-22");
assert.equal(summary.current, 2690);
assert.equal(summary.accumulated, 1690);
assert.equal(summary.today, 190);
assert.deepEqual(Bank.series(state).map((p) => p.value), [1000, 2000, 2500, 2690]);
state = Bank.addEntry(state, { date: "2026-09-23", type: "loss", amount: 100 });
summary = Bank.summarize(state, "2026-09-23");
assert.equal(summary.current, 2590);
assert.equal(summary.accumulated, 1590);
assert.equal(summary.today, -100);

// Não voltar a empilhar hotfixes sobre Gestão/Roleta/Provas.
const navigation = read("public/page-navigation.js");
for (const forbidden of ["management-final-v12.js", "final-fixes-v12.js", "roulette-quality-v13.js"]) {
  assert.equal(navigation.includes(forbidden), false, `${forbidden} não deve mais ser injetado`);
}

// Provas usam assets locais com cache-bust novo e motor real.
const exams = read("public/provas.html");
for (const file of ["daily-final-light.svg", "daily-final-dark.svg", "weekly-final-light.svg", "weekly-final-dark.svg", "primo-final-light.svg", "primo-final-dark.svg"]) {
  assert.equal(exists(`public/assets/exams/${file}`), true, `asset ausente: ${file}`);
}
assert.match(read("public/student-evolution-v6.js"), /\/student\/provas\/iniciar/);
assert.match(read("public/student-evolution-v6.js"), /\/student\/provas\/finalizar/);

// Roleta: nomes, ordem e afiliado oficiais; sem imagens remotas.
const roulette = read("public/roleta.html");
for (const label of ["Roullete immersive (Evolution)", "Roleta Brasileira (Playtech)", "Roleta Brasileira (Pragmatic)", "Tukias roullet"]) {
  assert.equal(roulette.includes(label), true, `nome ausente: ${label}`);
}
assert.equal(roulette.includes("https://go.aff.esportiva.bet/bhotuu7q"), true);
assert.equal(/<img[^>]+src="https?:\/\//i.test(roulette), false, "Roleta não deve depender de imagem externa");

// Suporte só lança flutuante com chamado ativo.
const support = read("public/support-float-v6.js");
assert.match(support, /launcher\.hidden\s*=\s*!state\.ticket/);

// Manutenção continua removida.
assert.equal(exists("public/manutencao.html"), false);
assert.equal(exists("services/maintenance-mode.js"), false);

console.log("final-stabilization-regression: ok");
