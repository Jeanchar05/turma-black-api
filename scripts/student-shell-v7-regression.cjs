"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const navigation = read("public/page-navigation.js");
const shell = read("public/student-shell-v7.js");
const floating = read("public/floating-controls-v7.js");
const supportRoutes = read("routes/support-admin-v7.js");
const supportCompat = read("routes/notificacoes-compat.js");
const adminSupport = read("public/admin-support-v7.js");

assert.ok(navigation.includes("/student-shell-v7.css"), "CSS do shell V7 precisa ser carregado");
assert.ok(navigation.includes("/student-shell-v7.js"), "JS do shell V7 precisa ser carregado");
assert.ok(navigation.includes("/floating-controls-v7.js"), "Controle de flutuantes precisa ser carregado");
assert.ok(navigation.includes("/admin-support-v7.js"), "Aprimoramento do suporte admin precisa ser carregado");

for (const route of ["/notas", "/perfil", "/provas", "/gestao", "/roleta", "/suporte"]) {
  assert.ok(navigation.includes(`\"${route}\"`), `Rota ${route} precisa participar do shell unificado`);
  assert.ok(shell.includes(`\"${route}\"`), `Shell V7 precisa reconhecer ${route}`);
}

assert.ok(floating.includes('button.id = "supportFloatDiscard"'), "Chat flutuante precisa ter lixeira");
assert.ok(floating.includes("turma:support-ticket-open"), "Chat precisa registrar abertura de ticket");
assert.ok(floating.includes("turma_support_float_v7_enabled"), "Chat precisa persistir o estado de exibição");
assert.ok(floating.includes('button.id = "focusDiscard"'), "Timer precisa ter lixeira");
assert.ok(floating.includes("turma_focus_float_v7_dismissed"), "Timer precisa saber quando foi descartado");
assert.ok(floating.includes('sync.focus("reset"'), "Descartar timer deve encerrar/resetar a sessão");

assert.ok(supportRoutes.includes("ADMIN_REPLY_ROLES"), "Backend precisa limitar respostas a administradores");
assert.ok(supportRoutes.includes('router.delete("/admin/suporte/:id"'), "DEV precisa ter endpoint para apagar tickets");
assert.ok(supportRoutes.includes("Apenas DEV pode apagar chamados"), "Exclusividade DEV precisa estar explícita");
assert.ok(supportCompat.includes('require("./support-admin-v7")'), "Guardas V7 precisam carregar antes do suporte legado");
assert.ok(adminSupport.includes("data-v7-close-ticket"), "Painel precisa oferecer fechar ticket");
assert.ok(adminSupport.includes("data-v7-delete-ticket"), "Painel DEV precisa oferecer apagar ticket");

assert.ok(shell.includes("25 questões"), "Desafio do Primo deve mostrar 25 questões");
assert.ok(shell.includes("10 questões"), "Prova diária deve mostrar 10 questões");
assert.ok(shell.includes("20 questões"), "Prova semanal deve mostrar 20 questões");
assert.ok(shell.includes("Segunda a sexta"), "Prova diária deve indicar segunda a sexta");

console.log("Student Shell V7 regression: OK");
