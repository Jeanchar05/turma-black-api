"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Bank = require("../public/bankroll-model.js");
const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

// Gestão: uma única fonte de verdade para cards, gráfico, calendário e diário.
let state = Bank.normalizeState({ initial: 1000, entries: [], days: [] });
state = Bank.upsertDay(state, { date: "2026-09-20", initialBankroll: 1000, finalBankroll: 2000, result: 1000, entries: 5, greens: 4, reds: 1 });
state = Bank.upsertDay(state, { date: "2026-09-21", initialBankroll: 2000, finalBankroll: 2500, result: 500, entries: 5, greens: 2, reds: 0 });
state = Bank.upsertDay(state, { date: "2026-09-22", initialBankroll: 2500, finalBankroll: 2690, result: 190, entries: 5, greens: 3, reds: 1 });
let summary = Bank.summarize(state, "2026-09-22");
assert.equal(summary.current, 2690); assert.equal(summary.accumulated, 1690); assert.equal(summary.today, 190);
assert.deepEqual(Bank.series(state).map((p) => p.value), [1000, 2000, 2500, 2690]);
state = Bank.addEntry(state, { date: "2026-09-23", type: "loss", amount: 100 });
summary = Bank.summarize(state, "2026-09-23");
assert.equal(summary.current, 2590); assert.equal(summary.accumulated, 1590); assert.equal(summary.today, -100);
const managementHtml = read("public/gestao.html"), managementJs = read("public/gestao-banca.js");
assert.match(managementHtml, /bankroll-model\.js/); assert.doesNotMatch(managementHtml, /management-v6\.js/);
assert.match(managementJs, /data-day-outcome=\"profit\"/); assert.match(managementJs, /data-day-outcome=\"loss\"/);

// Hotfixes antigos permanecem no histórico, mas não podem mais ser carregados.
const navigation = read("public/page-navigation.js");
for (const forbidden of ["management-final-v12.js", "final-fixes-v12.js", "roulette-quality-v13.js", "roulette-esportiva-affiliate-v10.js"]) assert.equal(navigation.includes(forbidden), false, `${forbidden} não deve mais ser injetado`);

// Provas: assets locais novos e motor real no servidor.
for (const file of ["daily-final-light.svg", "daily-final-dark.svg", "weekly-final-light.svg", "weekly-final-dark.svg", "primo-final-light.svg", "primo-final-dark.svg"]) assert.equal(exists(`public/assets/exams/${file}`), true, `asset ausente: ${file}`);
const examsUi = read("public/provas.js"), evolutionUi = read("public/student-evolution-v6.js");
assert.match(examsUi, /daily-final-light\.svg/); assert.match(examsUi, /weekly-final-dark\.svg/); assert.match(examsUi, /primo-final-dark\.svg/);
assert.match(evolutionUi, /\/student\/provas\/iniciar/); assert.match(evolutionUi, /\/student\/provas\/finalizar/);

// Roleta: ordem, nomes, links, assets locais e tema.
const roulette = read("public/roleta.html"), rouletteJs = read("public/roleta.js"), rouletteCss = read("public/roleta-isolated-v2.css");
const labels = ["Roullete immersive (Evolution)", "Roleta Brasileira (Playtech)", "Roleta Brasileira (Pragmatic)", "Tukias roullet"];
let previous = -1; for (const label of labels) { const index = roulette.indexOf(label); assert.ok(index > previous, `ordem incorreta: ${label}`); previous = index; }
assert.equal(roulette.includes("https://go.aff.esportiva.bet/bhotuu7q"), true); assert.equal(/<img[^>]+src="https?:\/\//i.test(roulette), false, "Roleta não deve depender de imagem externa");
assert.equal((roulette.match(/class=\"roulette-tool-card-new\"/g)||[]).length, 3); assert.match(rouletteJs, /data-theme-art/); assert.match(rouletteCss, /html\[data-theme="light"\]/);
for (const asset of ["reel-dark.svg","reel-light.svg","gemeos-dark.svg","gemeos-light.svg","pitagoras-dark.svg","pitagoras-light.svg"]) assert.equal(exists(`public/assets/roulette/tools/${asset}`), true, `asset ausente: ${asset}`);

// Perfil continua ligado às APIs reais da conta.
const profile = read("public/perfil.js"), profileV6 = read("public/profile-v6.js");
assert.match(profile, /\/dashboard-premium\/perfil/); assert.match(profile, /\/dashboard-premium\/preferencias/); assert.match(profileV6, /\/dashboard-premium\/perfil\/foto/); assert.match(profileV6, /\/dashboard-premium\/seguranca\/senha/);

// PDF premium, com seções e paginação; notes:regression gera PDF curto e longo.
const notesPdf = read("services/notes-pdf.js"); assert.match(notesPdf, /MEU CADERNO/); assert.match(notesPdf, /CHECKLIST/); assert.match(notesPdf, /REFERÊNCIAS/); assert.match(notesPdf, /Página \$\{i \+ 1\}/);

// Suporte só aparece com chamado ativo e respeita dock móvel.
const support = read("public/support-float-v6.js"), supportCss = read("public/support-float-v6.css");
assert.match(support, /launcher\.hidden\s*=\s*!state\.ticket/); assert.match(support, /hiddenTicketId/); assert.match(supportCss, /safe-area-inset-bottom/);

// Manutenção continua removida.
assert.equal(exists("public/manutencao.html"), false); assert.equal(exists("services/maintenance-mode.js"), false); assert.doesNotMatch(read("middleware/site-navigation.js"), /maintenance-mode|serveMaintenance|\/manutencao/);
console.log("final-stabilization-regression: ok");
