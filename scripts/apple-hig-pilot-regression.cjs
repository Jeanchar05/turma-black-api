"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

const required = [
  "public/turma-design-system-v1.css",
  "public/turma-hig-login-v1.css",
  "public/turma-hig-dashboard-v1.css",
  "public/turma-hig-dashboard-v1.js",
  "docs/APPLE-HIG-AUDIT.md"
];
required.forEach((file) => assert.ok(exists(file), `${file} deve existir`));

const tokens = read("public/turma-design-system-v1.css");
const loginCss = read("public/turma-hig-login-v1.css");
const dashCss = read("public/turma-hig-dashboard-v1.css");
const dashJs = read("public/turma-hig-dashboard-v1.js");
const loginJs = read("public/login-experience-v30.js");
const dashboardHtml = read("public/dashboard.html");
const navData = read("public/roleta-reel-nav-data.js");

for (const token of [
  "--tp-bg:", "--tp-surface:", "--tp-surface-elevated:", "--tp-border:",
  "--tp-text:", "--tp-text-secondary:", "--tp-accent:", "--tp-gold:",
  "--tp-radius-md:", "--tp-shadow-md:", "--tp-control-min:44px"
]) assert.ok(tokens.includes(token), `token obrigatório ausente: ${token}`);

assert.ok(tokens.includes("prefers-reduced-motion:reduce"), "Design System deve respeitar reduced motion");
assert.ok(tokens.includes("prefers-contrast:more"), "Design System deve considerar contraste aumentado");
assert.ok(tokens.includes("prefers-reduced-transparency:reduce"), "Design System deve considerar transparência reduzida");
assert.ok(tokens.includes("env(safe-area-inset-bottom)"), "Design System deve expor safe area inferior");
assert.ok(tokens.includes(':root[data-theme="light"]'), "Design System deve ter tokens Light próprios");

assert.ok(loginCss.includes("font-size:16px!important"), "Inputs de login mobile devem usar pelo menos 16px");
assert.ok(loginCss.includes("min-height:54px"), "CTA do login deve ter alvo de toque confortável");
assert.ok(loginCss.includes("var(--tp-safe-bottom)"), "Login deve respeitar safe area");
assert.ok(loginCss.includes("prefers-reduced-motion:reduce"), "Login deve respeitar reduced motion");
assert.ok(loginJs.includes("/turma-design-system-v1.css?v=20260927-hig1"), "Login deve carregar Design System");
assert.ok(loginJs.includes("/turma-hig-login-v1.css?v=20260927-hig1"), "Login deve carregar camada HIG");
assert.ok(loginJs.includes("/assets/hero-jean-transparent.webp"), "Arte do Login da Turma deve ser preservada");

assert.ok(dashboardHtml.includes("/turma-design-system-v1.css?v=20260927-hig1"), "Dashboard deve carregar Design System");
assert.ok(dashboardHtml.includes("/turma-hig-dashboard-v1.css?v=20260927-hig1"), "Dashboard deve carregar CSS do piloto");
assert.ok(dashboardHtml.includes("/turma-hig-dashboard-v1.js?v=20260927-hig1"), "Dashboard deve carregar JS do piloto");
assert.ok(dashboardHtml.includes("/dashboard-premium-workspace.js"), "Lógica existente do Dashboard deve permanecer");

assert.ok(dashCss.includes("width:272px"), "Sidebar desktop deve ficar na faixa planejada de 260–280px");
assert.ok(dashCss.includes("min-height:44px"), "Controles principais devem ter alvo confortável");
assert.ok(dashCss.includes("var(--tp-safe-bottom)"), "Dashboard/dock devem respeitar safe area inferior");
for (const width of ["1200px", "980px", "720px", "390px", "340px"])
  assert.ok(dashCss.includes(`max-width:${width}`), `Breakpoint adaptativo esperado: ${width}`);

for (const group of ["PLATAFORMA", "APRENDIZADO", "CONTA"])
  assert.ok(dashJs.includes(group), `Grupo de navegação ausente: ${group}`);
for (const route of ["/dashboard", "/estudo", "/modulos", "/roleta", "/roleta-real", "/provas", "/gestao", "/notas", "/favoritos", "/perfil"])
  assert.ok(dashJs.includes(route), `Rota existente deve permanecer acessível: ${route}`);
assert.ok(!dashJs.includes("/configuracoes"), "Piloto não deve inventar rota de Configurações");
assert.ok(dashJs.includes("TurmaStudySync"), "Resumo deve reutilizar estado real de estudo");
assert.ok(dashJs.includes("TurmaStudyState"), "Resumo deve reutilizar o modelo real de progresso");
assert.ok(dashJs.includes("hig-journey-overview"), "Dashboard deve incluir progressive disclosure da jornada");
assert.ok(dashJs.includes('event') || dashJs.includes("turma:study-change"), "Dashboard deve reagir a mudanças reais de estado");

for (const label of ["Meu espaço", "Estudo", "Módulos", "Anotações", "Gestão", "Roleta Operacional", "Provas", "Favoritos", "Perfil", "Roleta Real"])
  assert.ok(navData.includes(label), `Navegação canônica não pode perder ${label}`);

console.log("Apple HIG pilot regression: OK");
