"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const navigation = read("public/page-navigation.js");
const supportFloat = read("public/support-float-v6.js");
const focus = read("public/study-focus.js");
const supportRoutes = read("routes/suporte.js");
const exams = read("public/provas.html");

assert.ok(navigation.includes("/student-shell-v7.css"), "CSS do shell V7 precisa ser carregado");
assert.ok(navigation.includes("/student-shell-v7.js"), "JS do shell V7 precisa ser carregado");
assert.ok(navigation.includes("/admin-support-v7.js"), "Aprimoramento do suporte admin precisa ser carregado");

for (const route of ["/notas", "/perfil", "/provas", "/gestao", "/roleta", "/suporte"]) {
  assert.ok(navigation.includes(`\"${route}\"`), `Rota ${route} precisa participar do shell unificado`);
}

assert.ok(supportFloat.includes('data-support-action="discard"'), "Chat flutuante precisa ter lixeira");
assert.ok(supportFloat.includes("turma:support-ticket-open"), "Chat precisa abrir somente após evento de ticket");
assert.ok(supportFloat.includes("floatingEnabled"), "Chat precisa persistir o estado de exibição");

assert.ok(focus.includes('id="focusDiscard"'), "Timer precisa ter lixeira");
assert.ok(focus.includes("dismissed"), "Timer precisa saber quando foi descartado");
assert.ok(focus.includes('command("reset"'), "Descartar timer deve encerrar/resetar a sessão");

assert.ok(supportRoutes.includes("ADMIN_REPLY_ROLES"), "Backend precisa limitar respostas a administradores");
assert.ok(supportRoutes.includes('router.delete("/admin/suporte/:id"'), "DEV precisa ter endpoint para apagar tickets");
assert.ok(supportRoutes.includes("Apenas DEV pode apagar chamados"), "Exclusividade DEV precisa estar explícita");

assert.ok(exams.includes("25 questões"), "Desafio do Primo deve mostrar 25 questões");
assert.ok(exams.includes("10 questões"), "Prova diária deve mostrar 10 questões");
assert.ok(exams.includes("20 questões"), "Prova semanal deve mostrar 20 questões");
assert.ok(exams.includes("Segunda a sexta"), "Prova diária deve indicar segunda a sexta");

console.log("Student Shell V7 regression: OK");
