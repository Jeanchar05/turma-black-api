"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Evolution = require("../services/student-evolution");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// Gestão: o diário precisa alimentar o estado principal para gráfico e banca atual.
const gestao = read("public/gestao-banca.js");
const management = read("public/management-v6.js");
assert(gestao.includes("turma:bankroll-days-updated"), "Gestão deve reidratar quando o diário mudar.");
assert(management.includes("bankDayOutcomeV6"), "Registro diário deve permitir escolher resultado positivo/negativo.");
assert(management.includes("journal:"), "Registro diário deve sincronizar uma movimentação com a curva da banca.");

const sanitized = Evolution.sanitizeBankrollState({
  initial: 1000,
  current: 950,
  days: [{ date: "2026-09-22", initialBankroll: 1000, finalBankroll: 950, result: -50, entries: 2, greens: 0, reds: 2, notes: "Stop respeitado" }],
});
assert.equal(sanitized.days.length, 1, "Sincronização em nuvem não pode apagar o diário da Gestão.");
assert.equal(sanitized.days[0].result, -50, "Resultado negativo do diário deve ser preservado.");

// Prova diária: terça-feira deve estar online com 10 questões.
const daily = Evolution.examConfig("daily", new Date("2026-09-22T15:00:00-03:00"));
assert.equal(daily.available, true, "Prova diária deve ficar disponível de segunda a sexta.");
assert.equal(daily.questions, 10, "Prova diária deve ter 10 questões.");
const provasHtml = read("public/provas.html");
assert(provasHtml.includes("/student-evolution-v6.js"), "Página de Provas deve carregar o motor de avaliação diretamente.");

// Perfil: mudanças precisam refletir no shell do site sem depender de nova sessão.
const perfil = read("public/perfil.js");
const workspace = read("public/protected-workspace-v8.js");
assert(perfil.includes("turma:profile-updated"), "Perfil deve anunciar alterações para o restante do site.");
assert(workspace.includes("turma:profile-updated"), "Workspace deve reagir às alterações do Perfil.");

// Anotações: o PDF deve usar a nova identidade visual.
const notesPdf = read("services/notes-pdf.js");
assert(notesPdf.includes("CADERNO PESSOAL"), "PDF de Anotações deve usar o novo cabeçalho elegante.");
assert(notesPdf.includes("Documento de estudo"), "PDF de Anotações deve ter rodapé editorial.");

// Roleta: assets de alta qualidade e variação de tema devem ser locais.
const cardArt = read("public/roulette-card-art-v11.js");
assert(cardArt.includes(".png?v=20260922-v12"), "Cards da roleta devem usar PNGs locais de alta qualidade.");
const navigation = read("public/page-navigation.js");
assert(navigation.includes("roulette-polish-v12.css"), "Roleta deve carregar a correção final de tema claro/escuro.");

// Manutenção foi encerrada: não deve haver interceptação de navegação nem página dedicada.
const siteNavigation = read("middleware/site-navigation.js");
assert(!siteNavigation.includes("maintenance-mode"), "Navegação não deve carregar modo manutenção.");
assert(!siteNavigation.includes("/manutencao"), "Rota de manutenção deve ser removida.");
assert(!siteNavigation.includes("/sair"), "Bypass de manutenção deve ser removido.");
assert(!fs.existsSync(path.join(root, "services/maintenance-mode.js")), "Serviço de manutenção deve ser removido.");
assert(!fs.existsSync(path.join(root, "public/manutencao.html")), "Página de manutenção deve ser removida.");

console.log("Student polish regression: OK");
