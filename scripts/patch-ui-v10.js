"use strict";

const fs = require("fs");
const path = require("path");

const serverPath = path.join(__dirname, "..", "server.js");
const UI_VERSION = "20260803-final-v18-root-1";
const UI_LABEL = "final-v18-root-1";

if (!fs.existsSync(serverPath)) {
  console.error("[UI V18] server.js não encontrado.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");
const original = source;
source = source.replace(/const CACHE_VERSION = "[^"]+";/, `const CACHE_VERSION = "${UI_VERSION}";`);

const startMarker = "function aplicarCamadaResponsiva(html) {";
const endMarker = "\n}\n\nfunction aplicarExtrasAdmin";
const start = source.indexOf(startMarker);
const end = start >= 0 ? source.indexOf(endMarker, start) : -1;

if (start >= 0 && end >= 0) {
  const replacement = `function aplicarCamadaResponsiva(html) {
  let resultado = String(html);
  const ehEstudoHome = /study-home-page/i.test(resultado);
  const ehPaginaModulos = /(?:modules-page|modules-content|id=["']modulesList["'])/i.test(resultado);
  const ehDashboardReferencia = /dashboard-reference/i.test(resultado);
  const ehAluno = /student-dashboard/i.test(resultado);
  const ehModuloInterno = /<body[^>]*class=["'][^"']*(?:\\bstudy-page\\b|\\bstrategy-page\\b)/i.test(resultado) && !ehEstudoHome;

  // Retira somente camadas globais antigas; CSS funcional específico da página é preservado.
  resultado = resultado
    .replace(/<link[^>]+(?:data-ui-v(?:10|11|12|13|14|15|16|17|18)|data-global-responsive)[^>]*>\\s*/gi, "")
    .replace(/<script[^>]+(?:data-ui-v(?:10|11|12|13|14|15|16|17|18))[^>]*><\\/script>\\s*/gi, "")
    .replace(/<link[^>]+href=["'][^"']*(?:theme-global-v2|platform-upgrade-v6|turma-approved-v11|turma-overhaul-v8|site-stabilization-v9|turma-premium-v10|turma-unified-v12|turma-obsidian-v13|turma-imperial-v14|responsive-global|site-stability-v17|site-final-v18)\\.css[^>]*>\\s*/gi, "")
    .replace(/<script[^>]+src=["'][^"']*(?:theme-global-v2|platform-final|navigation-final|platform-upgrade-v6|turma-overhaul-v8|site-stabilization-v9|turma-premium-v10|turma-unified-v12|turma-obsidian-v13|turma-imperial-v14|turma-reference-v15|modules-v16|modules-v16-polish|modules-page-v16-fix|study-assets-v17|site-stability-v17|site-final-v18)\\.js[^>]*><\\/script>\\s*/gi, "");

  if (ehModuloInterno) {
    // As oito aulas permanecem em runtime próprio e isolado.
    resultado = resultado
      .replace(/<link[^>]+rel=["']stylesheet["'][^>]*>\\s*/gi, "")
      .replace(/<script[^>]+src=["'][^"']*(?:estudo|study-race|race-shared)[^"']*\\.js[^>]*><\\/script>\\s*/gi, "");

    const camadaModulo = \`
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700;800;900&family=Sora:wght@600;700;800;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/modules-v16.css?v=${UI_VERSION}" data-ui-v18="modules-css" />
    <link rel="stylesheet" href="/modules-v16-polish.css?v=${UI_VERSION}" data-ui-v18="modules-polish-css" />
    <script defer src="/protected-estudo.js?v=${UI_VERSION}" data-ui-v18="protected"></script>
    <script defer src="/modules-v16.js?v=${UI_VERSION}" data-ui-v18="modules-js"></script>
    <script defer src="/modules-v16-polish.js?v=${UI_VERSION}" data-ui-v18="modules-polish-js"></script>\`;
    resultado = resultado.replace("</head>", camadaModulo + "\\n</head>");
    return resultado;
  }

  const baseDashboard = ehAluno && !/dashboard-premium\\.css/i.test(resultado)
    ? \`<link rel="stylesheet" href="/dashboard-premium.css?v=${UI_VERSION}" data-ui-v18="dashboard-base" />\`
    : "";
  const dashboardReferencia = ehDashboardReferencia
    ? \`<link rel="stylesheet" href="/turma-reference-v15.css?v=${UI_VERSION}" data-ui-v18="dashboard-reference" />\`
    : "";
  const assetsEstudo = (ehEstudoHome || ehPaginaModulos)
    ? \`<script defer src="/study-assets-v17.js?v=${UI_VERSION}" data-ui-v18="study-assets"></script>\`
    : "";

  const camadaFinal = \`
  \${baseDashboard}
  \${dashboardReferencia}
  <link rel="stylesheet" href="/site-final-v18.css?v=${UI_VERSION}" data-ui-v18="final-css" />
  <script defer src="/site-final-v18.js?v=${UI_VERSION}" data-ui-v18="final-js"></script>
  \${assetsEstudo}\`;
  resultado = resultado.replace("</head>", camadaFinal + "\\n</head>");
  return resultado;
}`;

  source = source.slice(0, start) + replacement + source.slice(end + 2);
} else {
  console.error("[UI V18] Não foi possível localizar aplicarCamadaResponsiva em server.js.");
  process.exit(1);
}

// Rotas que não podem escapar pelo express.static.
const staticMarker = "if (fs.existsSync(publicDir)) {";
if (!source.includes("STABILITY_V17_ROUTES")) {
  const routeBlock = `// STABILITY_V17_ROUTES\napp.get(["/gestao", "/gestao.html"], servirPagina("gestao.html"));\napp.get(["/roleta-reel", "/roleta-reel.html"], servirPagina("roleta-reel.html"));\napp.get(["/estudo-gemeos", "/estudo-gemeos.html"], servirPagina("estudo-gemeos.html"));\napp.get(["/estudo-espelhos", "/estudo-espelhos.html"], servirPagina("estudo-espelhos.html"));\napp.get(["/estudo-fibonacci", "/estudo-fibonacci.html"], servirPagina("estudo-fibonacci.html"));\napp.get(["/estudo-magneto", "/estudo-magneto.html"], servirPagina("estudo-magneto.html"));\napp.get(["/estudo-camaleoes", "/estudo-camaleoes.html"], servirPagina("estudo-camaleoes.html"));\napp.get(["/estudo-triangulacao", "/estudo-triangulacao.html", "/estudo-pitagoras", "/estudo-pitagoras.html"], servirPagina("estudo-triangulacao.html"));\napp.get(["/estudo-cavalos", "/estudo-cavalos.html", "/estudo-cavalo", "/estudo-cavalo.html"], servirPagina("estudo-cavalos.html"));\napp.get(["/estudo-eclipse-zero", "/estudo-eclipse-zero.html"], servirPagina("estudo-eclipse-zero.html"));\n\n`;
  source = source.replace(staticMarker, routeBlock + staticMarker);
}

source = source.replace(/res\.setHeader\("X-UI-Version", "[^"]+"\);/g, `res.setHeader("X-UI-Version", "${UI_LABEL}");`);
if (!source.includes("X-UI-Version")) {
  source = source.replace(
    'res.setHeader("X-Cache-Version", CACHE_VERSION);',
    `res.setHeader("X-Cache-Version", CACHE_VERSION);\n    res.setHeader("X-UI-Version", "${UI_LABEL}");`
  );
}
source = source.replace(
  /release: "[^"]+",(?:\n\s*uiVersion: "[^"]+",)?/,
  `release: "${UI_LABEL}",\n    uiVersion: "${UI_LABEL}",`
);

if (source !== original) {
  fs.writeFileSync(serverPath, source, "utf8");
  console.log(`[UI V18] server.js atualizado para ${UI_VERSION}.`);
} else {
  console.log(`[UI V18] servidor já estava em ${UI_VERSION}.`);
}
