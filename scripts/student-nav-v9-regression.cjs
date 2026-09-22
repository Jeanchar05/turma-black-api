"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const navData = read("public/roleta-reel-nav-data.js");
const navigation = read("public/page-navigation.js");
const favorites = read("public/favoritos.html");
const exams = read("public/provas.html");

const canonical = [
  ["Meu espaço", "dashboard"],
  ["Estudo", "estudo"],
  ["Módulos", "modulos"],
  ["Anotações", "notas"],
  ["Gestão", "gestao"],
  ["Roleta Operacional", "roleta"],
  ["Provas", "provas"],
  ["Favoritos", "favoritos"],
  ["Perfil", "perfil"],
  ["Roleta Real", "roleta-real"],
];

let previous = -1;
for (const [label, route] of canonical) {
  const needle = `[\"${label}\",\"${route}\"`;
  const index = navData.indexOf(needle);
  assert.ok(index > previous, `Menu canônico precisa manter ${label} na ordem do Dashboard`);
  previous = index;
}

assert.ok(navigation.includes("/student-nav-standard-v9.js"), "Navegação global precisa carregar o menu canônico V9");
assert.ok(favorites.includes('class="learn-sidebar"'), "Favoritos precisa usar sidebar nativa");
assert.ok(favorites.includes('class="learn-topbar"'), "Favoritos precisa usar topbar nativa");
assert.equal(favorites.includes('class="dash-sidebar'), false, "Favoritos não pode voltar ao shell antigo");
assert.equal(favorites.includes('data-favorite-filter="minigame"'), false, "Minigames não devem existir como categoria separada");
assert.ok(favorites.includes("favorites-v9.css"), "Favoritos precisa carregar o redesign V9");

for (const type of ["daily", "weekly", "primo"]) {
  assert.ok(exams.includes(`data-exam-locked=\"${type}\"`), `Provas precisa preservar o motor ${type}`);
}
assert.ok(exams.includes("provas-v9.css"), "Provas precisa carregar o redesign V9");
assert.ok(exams.includes("exam-v9-overview"), "Provas precisa ter o novo resumo visual V9");

console.log("Student Nav/Favorites/Exams V9 regression: OK");
