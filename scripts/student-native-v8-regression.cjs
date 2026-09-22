"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const targets = ["notas", "perfil", "provas", "gestao", "roleta", "suporte"];

for (const name of targets) {
  const html = read(`public/${name}.html`);
  assert.ok(html.includes('class="learn-sidebar"') || html.includes('class="learn-sidebar '), `${name}: precisa usar sidebar nativo do workspace`);
  assert.ok(html.includes('class="learn-topbar"') || html.includes('class="learn-topbar '), `${name}: precisa usar topbar nativo do workspace`);
  assert.ok(html.includes('class="learn-dock"') || html.includes('class="learn-dock '), `${name}: precisa ter dock mobile nativo`);
  assert.ok(html.includes('/study-workspace.css'), `${name}: precisa usar o design system de Estudo/Módulos`);
  assert.ok(html.includes('/student-workspace-v8.css'), `${name}: precisa usar acabamento V8 compartilhado`);
  assert.ok(html.includes('/student-workspace-v8.js'), `${name}: precisa usar controlador V8 de tema/menu/conta`);
  assert.ok(!html.includes('class="dash-sidebar"'), `${name}: não pode manter sidebar legado`);
  assert.ok(!html.includes('class="roulette-sidebar"'), `${name}: não pode manter sidebar isolado legado`);
  assert.ok(!html.includes('class="support-sidebar"'), `${name}: não pode manter sidebar legado de suporte`);
}

const nav = read("public/page-navigation.js");
assert.ok(!nav.includes('const unified = ["/notas", "/perfil", "/provas", "/gestao", "/roleta", "/suporte"]'), "page-navigation não deve mais aplicar shell visual V7 sobre as páginas V8");

const css = read("public/student-workspace-v8.css");
for (const token of ["--learn-bg", "--learn-panel", "[data-theme=\"light\"]", "@media (max-width: 900px)"]) {
  assert.ok(css.includes(token), `CSS V8 precisa conter ${token}`);
}

const js = read("public/student-workspace-v8.js");
for (const token of ["studySidebar", "studyMenu", "studyTheme", "turma.workspace.theme", "studyDock"]) {
  assert.ok(js.includes(token), `Controlador V8 precisa conter ${token}`);
}

console.log("Student native V8 regression: OK");
