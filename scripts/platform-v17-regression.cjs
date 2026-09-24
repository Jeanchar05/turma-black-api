"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
function must(value, message) { if (!value) throw new Error(message); }

const runtime = read("public/platform-fixes-v17.js");
must(runtime.includes("R$ 99,90"), "Plano mensal precisa ser R$ 99,90");
must(runtime.includes("R$ 239,99"), "Plano 6 meses precisa ser R$ 239,99");
must(runtime.includes("R$ 396,99"), "Plano anual precisa ser R$ 396,99");
must(exists("public/assets/login/primo-login-dark-v34.webp"), "Arte dark legada do Login/Roleta ausente");
must(exists("public/assets/login/primo-login-light-v34.webp"), "Arte light legada do Login/Roleta ausente");
must(runtime.includes("daily-final-dark.svg") && runtime.includes("daily-final-light.svg"), "Prova diária precisa alternar a arte por tema");
must(runtime.includes("weekly-final-dark.svg") && runtime.includes("primo-final-light.svg"), "Artes das provas incompletas");
must(runtime.includes("PROVA DIÁRIA") && runtime.includes("PROVA SEMANAL") && runtime.includes("DESAFIO DO PRIMO"), "Nomes oficiais das provas ausentes");

const auth = read("routes/auth.js");
must(auth.includes("usuarioResposta = montarUsuarioSeguro(usuario)"), "Cadastro precisa retornar sucesso mesmo se hidratação de permissões falhar após persistir");
must(auth.includes("Conta criada com sucesso. Faça login"), "Mensagem de cadastro concluído ausente");

const notifications = read("public/dashboard-notifications-live-v18.js");
must(notifications.includes('/minhas-notificacoes'), "Frontend de notificações precisa buscar avisos reais");
must(notifications.includes("30000"), "Notificações precisam atualizar periodicamente");
must(notifications.includes('credentials: "same-origin"'), "Notificações precisam aceitar sessão protegida por cookie");
const nav = read("public/page-navigation.js");
must(nav.includes("platform-fixes-v18.js?v=20260923-v18"), "Runtime V18 precisa carregar no workspace");
must(nav.includes("dashboard-notifications-live-v18.js?v=20260923-v18"), "Notificações V18 precisam carregar no workspace do aluno");

const favorites = read("public/favorites-v6.js");
must(favorites.includes("/assets/modules-v4/gemeos-dark.webp") || favorites.includes('cover("gemeos")'), "Favoritos precisam usar capa real do Gêmeos");
must(favorites.includes("data-cover-dark") && favorites.includes("data-cover-light"), "Favoritos precisam alternar capa por tema");

const roulette = read("public/roleta.html");
for (const name of ["Roullete immersive (Evolution)", "Roleta Brasileira (Playtech)", "Roleta Brasileira (Pragmatic)", "Tukias roullet"]) must(roulette.includes(name), `Roleta ausente: ${name}`);
must(roulette.includes("https://go.aff.esportiva.bet/bhotuu7q"), "Link afiliado da Esportiva incorreto");

console.log("Platform V17 compatibility regression: OK");
