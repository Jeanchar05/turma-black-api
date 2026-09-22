"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const navigation = read("public/page-navigation.js");
const fixes = read("public/final-fixes-v12.js");
const fixesCss = read("public/final-fixes-v12.css");
const siteNavigation = read("middleware/site-navigation.js");
const notesPdf = read("services/notes-pdf.js");

assert.match(navigation, /final-fixes-v12\.css/);
assert.match(navigation, /final-fixes-v12\.js/);
assert.match(fixes, /https:\/\/go\.aff\.esportiva\.bet\/bhotuu7q/);
assert.match(fixes, /Tukias roullet/);
assert.match(fixes, /bankDayAmountV12/);
assert.match(fixes, /Saiu negativo/);
assert.match(fixes, /\/student\/provas\/agenda/);
assert.match(fixes, /\/student\/provas\/iniciar/);
assert.match(fixesCss, /html\[data-theme="light"\] body\.roulette-page/);
assert.doesNotMatch(siteNavigation, /maintenance-mode|serveMaintenance|\/manutencao/);
assert.match(notesPdf, /CADERNO DO ALUNO/);
assert.match(notesPdf, /CHECKLIST/);

for (const asset of [
  "public/assets/roulette/primo-portrait.svg",
  "public/assets/exams/daily-v12-dark.svg",
  "public/assets/exams/daily-v12-light.svg",
  "public/assets/exams/weekly-v12-dark.svg",
  "public/assets/exams/weekly-v12-light.svg",
  "public/assets/exams/primo-v12-dark.svg",
  "public/assets/exams/primo-v12-light.svg",
  "public/assets/roulette/tools/reel-dark.svg",
  "public/assets/roulette/tools/reel-light.svg",
  "public/assets/roulette/tools/gemeos-dark.svg",
  "public/assets/roulette/tools/gemeos-light.svg",
  "public/assets/roulette/tools/pitagoras-dark.svg",
  "public/assets/roulette/tools/pitagoras-light.svg",
]) assert.equal(fs.existsSync(path.join(root, asset)), true, `${asset} ausente`);

console.log("Final V12 regression: OK");
