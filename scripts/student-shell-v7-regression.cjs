"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const navigation = read("public/page-navigation.js");
const floating = read("public/floating-controls-v7.js");
const supportRoutes = read("routes/support-admin-v7.js");
const supportCompat = read("routes/notificacoes-compat.js");
const adminSupport = read("public/admin-support-v7.js");

assert.ok(navigation.includes("/floating-controls-v7.js"), "Controle de flutuantes V7 precisa continuar carregado");
assert.ok(navigation.includes("/admin-support-v7.js"), "Aprimoramento do suporte admin precisa continuar carregado");

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

console.log("Support controls V7 regression: OK");