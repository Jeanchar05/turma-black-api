"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const navigation = read("public/page-navigation.js");
const support = read("public/support-float-v6.js");
const profile = read("public/profile-v6.js");
const profileGuard = read("public/profile-save-guard-v6.js");
const favorites = read("public/favorites-v6.js");
const management = read("public/management-v6.js");
const activity = read("public/activity-v6.js");
const evolution = read("public/student-evolution-v6.js");
const compat = read("routes/notificacoes-compat.js");

for (const asset of [
  "/student-evolution-v6.js",
  "/support-float-v6.js",
  "/profile-v6.js",
  "/profile-save-guard-v6.js",
  "/favorites-v6.js",
  "/activity-v6.js",
  "/management-v6.js",
]) assert.ok(navigation.includes(asset), `Asset V6 ausente da navegação: ${asset}`);

assert.ok(support.includes('data-support-action="suspend"'));
assert.ok(support.includes('data-support-action="minimize"'));
assert.ok(support.includes('data-support-action="close"'));
assert.ok(support.includes('/suporte/${encodeURIComponent(state.ticket.id)}/responder'));

assert.ok(profile.includes("/dashboard-premium/seguranca/senha"));
assert.ok(profile.includes("/dashboard-premium/perfil/telefone/solicitar"));
assert.ok(profile.includes("/dashboard-premium/perfil/relatorio.pdf"));
assert.ok(profile.includes('type="file"'));
assert.ok(profileGuard.includes("/profile-v6/perfil"));
assert.equal(profileGuard.includes("telefone:"), false);

assert.ok(favorites.includes("/study/state"));
assert.ok(favorites.includes("favorite: false"));
assert.equal(favorites.includes('href="/minigames"'), false);

assert.ok(management.includes("bankDayEntriesV6"));
assert.ok(management.includes("bankDayGreensV6"));
assert.ok(management.includes("bankDayRedsV6"));
assert.ok(management.includes("shareMonth"));
assert.ok(management.includes("turma:bankroll-days-updated"));
assert.ok(activity.includes("/student/atividades"));

assert.ok(evolution.includes('type === "weekly"'));
assert.ok(evolution.includes("Desafio do Primo"));
assert.ok(evolution.includes("/student/provas/iniciar"));
assert.ok(evolution.includes("/student/gestao"));

assert.ok(compat.includes('require("./student-evolution")'));
assert.ok(compat.includes('require("./profile-v6")'));
assert.ok(compat.includes("bankroll-days-v6"));
assert.ok(compat.includes("journey-elite-v6"));

console.log("Evolution UI regression: OK");
