"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Evolution = require("../services/student-evolution");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// Gestão: diário, resultado atual e gráfico passam a usar o mesmo estado.
const gestaoFix = read("public/gestao-fix-v12.js");
assert(gestaoFix.includes("bankDayOutcomeV6"), "Registro diário deve permitir escolher resultado positivo/negativo.");
assert(gestaoFix.includes("journal:"), "Registro diário deve alimentar as movimentações da curva da banca.");
assert(gestaoFix.includes("todayResultValue"), "Resultado atual deve ser recalculado pelo fix da Gestão.");
assert(gestaoFix.includes("bankrollChart"), "Curva da banca deve ser redesenhada pelo estado sincronizado.");
assert(gestaoFix.includes("DAYS_BACKUP_KEY"), "Diário local deve sobreviver à reidratação do estado remoto.");

// Prova diária: terça-feira deve estar online com 10 questões e a página garante o motor.
const daily = Evolution.examConfig("daily", new Date("2026-09-22T15:00:00-03:00"));
assert.equal(daily.available, true, "Prova diária deve ficar disponível de segunda a sexta.");
assert.equal(daily.questions, 10, "Prova diária deve ter 10 questões.");
const provasJs = read("public/provas.js");
assert(provasJs.includes("student-evolution-v6.js"), "Página de Provas deve garantir o carregamento do motor de avaliação.");
assert(provasJs.includes("ONLINE AGORA"), "Prova diária deve indicar quando está disponível.");

// Perfil: alterações precisam refletir nas outras páginas da conta.
const profileLink = read("public/profile-link-v12.js");
assert(profileLink.includes("turma:profile-updated"), "Perfil deve anunciar alterações para o restante do site.");
assert(profileLink.includes("/me"), "Perfil sincronizado deve revalidar os dados reais da conta.");

// Anotações: somente o PDF muda, usando a nova identidade visual.
const notesPdf = read("services/notes-pdf-v12.js");
const notesRoute = read("routes/notes.js");
assert(notesPdf.includes("CADERNO PESSOAL"), "PDF de Anotações deve usar o novo cabeçalho elegante.");
assert(notesPdf.includes("Documento de estudo"), "PDF de Anotações deve ter rodapé editorial.");
assert(notesRoute.includes("notes-pdf-v12"), "Rota real de Anotações deve usar o PDF novo.");

// Roleta: imagens locais de alta qualidade e variação de tema.
const cardArt = read("public/roulette-card-art-v11.js");
const navigation = read("public/page-navigation.js");
const roulettePolish = read("public/roulette-polish-v12.js");
assert(cardArt.includes(".webp?v=20260922-v12"), "Cards da roleta devem usar WebP local de alta qualidade.");
assert(cardArt.includes("Tukias roullet"), "Nome Tukias roullet deve estar corrigido.");
assert(navigation.includes("roulette-polish-v12.css"), "Roleta deve carregar a correção final de tema claro/escuro.");
assert(roulettePolish.includes("https://go.aff.esportiva.bet/bhotuu7q"), "CTA da Esportiva deve usar o link de afiliado oficial.");
assert(roulettePolish.includes("hero-${theme()}.webp"), "Hero deve alternar entre arte clara e escura.");
assert(roulettePolish.includes("/assets/roulette/tools/${key}-${theme()}.svg"), "Ferramentas rápidas devem trocar arte conforme o tema.");

// Perfil e Gestão precisam ser carregados no workspace compartilhado.
assert(navigation.includes("profile-link-v12.js"), "Workspace deve carregar a sincronização do Perfil.");
assert(navigation.includes("gestao-fix-v12.js"), "Gestão deve carregar a correção de gráfico e resultado.");

// Manutenção foi encerrada: não deve haver interceptação nem página dedicada.
const siteNavigation = read("middleware/site-navigation.js");
assert(!siteNavigation.includes("maintenance-mode"), "Navegação não deve carregar modo manutenção.");
assert(!siteNavigation.includes("/manutencao"), "Rota de manutenção deve ser removida.");
assert(!siteNavigation.includes("/sair"), "Bypass de manutenção deve ser removido.");
assert(!fs.existsSync(path.join(root, "services/maintenance-mode.js")), "Serviço de manutenção deve ser removido.");
assert(!fs.existsSync(path.join(root, "public/manutencao.html")), "Página de manutenção deve ser removida.");

console.log("Student polish regression: OK");
