"use strict";

const fs = require("fs");
const path = require("path");

const serverPath = path.join(__dirname, "..", "server.js");
const UI_VERSION = "20260803-elite-v19-root-2";
const UI_LABEL = "elite-v19-root-2";

if (!fs.existsSync(serverPath)) {
  console.error("[UI V19] server.js não encontrado.");
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
  const ehDashboard = /dashboard-reference/i.test(resultado);
  const ehDashboardFree = /free-dashboard-page/i.test(resultado);
  const ehAluno = /student-dashboard/i.test(resultado);
  const ehModuloInterno = /<body[^>]*class=["'][^"']*(?:\\bstudy-page\\b|\\bstrategy-page\\b)/i.test(resultado) && !ehEstudoHome;

  // Remove somente camadas globais e runtimes visuais antigos.
  // CSS e JS funcionais específicos de cada página permanecem intactos.
  resultado = resultado
    .replace(/<link[^>]+(?:data-ui-v(?:10|11|12|13|14|15|16|17|18|19)|data-global-responsive)[^>]*>\\s*/gi, "")
    .replace(/<script[^>]+(?:data-ui-v(?:10|11|12|13|14|15|16|17|18|19))[^>]*><\\/script>\\s*/gi, "")
    .replace(/<link[^>]+href=["'][^"']*(?:theme-global-v2|platform-upgrade-v6|turma-approved-v11|turma-overhaul-v8|site-stabilization-v9|turma-premium-v10|turma-unified-v12|turma-obsidian-v13|turma-imperial-v14|turma-reference-v15|responsive-global|site-stability-v17|site-final-v18|elite-v19-core|elite-v19-pages-a|elite-v19-pages-b|elite-v19-pages-c|elite-v19-responsive|elite-v19-fixes|modules-elite-v19)\\.css[^>]*>\\s*/gi, "")
    .replace(/<script[^>]+src=["'][^"']*(?:theme-global-v2|platform-final|navigation-final|platform-upgrade-v6|turma-overhaul-v8|site-stabilization-v9|turma-premium-v10|turma-unified-v12|turma-obsidian-v13|turma-imperial-v14|turma-reference-v15|modules-v16|modules-v16-polish|modules-page-v16-fix|study-assets-v17|site-stability-v17|site-final-v18|elite-v19|elite-v19-addons|study-assets-v19|modules-elite-v19)\\.js[^>]*><\\/script>\\s*/gi, "");

  if (ehModuloInterno) {
    // As oito aulas recebem um runtime isolado. Nada das páginas comuns entra aqui.
    resultado = resultado
      .replace(/<link[^>]+rel=["']stylesheet["'][^>]*>\\s*/gi, "")
      .replace(/<script[^>]+src=["'][^"']*(?:estudo|study-race|race-shared)[^"']*\\.js[^>]*><\\/script>\\s*/gi, "");

    const camadaModulo = \`
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700;800;900&family=Sora:wght@600;700;800;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/modules-v16.css?v=${UI_VERSION}" data-ui-v19="modules-base" />
    <link rel="stylesheet" href="/modules-v16-polish.css?v=${UI_VERSION}" data-ui-v19="modules-polish" />
    <link rel="stylesheet" href="/modules-elite-v19.css?v=${UI_VERSION}" data-ui-v19="modules-elite" />
    <script defer src="/protected-estudo.js?v=${UI_VERSION}" data-ui-v19="protected"></script>
    <script defer src="/modules-v16.js?v=${UI_VERSION}" data-ui-v19="modules-runtime"></script>
    <script defer src="/modules-v16-polish.js?v=${UI_VERSION}" data-ui-v19="modules-polish-js"></script>
    <script defer src="/modules-elite-v19.js?v=${UI_VERSION}" data-ui-v19="modules-elite-js"></script>\`;
    resultado = resultado.replace("</head>", camadaModulo + "\\n</head>");
    return resultado;
  }

  const baseDashboard = ehAluno && !/dashboard-premium\\.css/i.test(resultado)
    ? \`<link rel="stylesheet" href="/dashboard-premium.css?v=${UI_VERSION}" data-ui-v19="dashboard-base" />\`
    : "";
  const assetsEstudo = (ehDashboard || ehDashboardFree || ehEstudoHome || ehPaginaModulos)
    ? \`<script defer src="/study-assets-v19.js?v=${UI_VERSION}" data-ui-v19="study-assets"></script>\`
    : "";

  const camadaElite = \`
  \${baseDashboard}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700;800;900&family=Sora:wght@600;700;800;900&display=swap" rel="stylesheet" data-ui-v19="fonts" />
  <link rel="stylesheet" href="/elite-v19-core.css?v=${UI_VERSION}" data-ui-v19="core" />
  <link rel="stylesheet" href="/elite-v19-pages-a.css?v=${UI_VERSION}" data-ui-v19="pages-a" />
  <link rel="stylesheet" href="/elite-v19-pages-b.css?v=${UI_VERSION}" data-ui-v19="pages-b" />
  <link rel="stylesheet" href="/elite-v19-pages-c.css?v=${UI_VERSION}" data-ui-v19="pages-c" />
  <link rel="stylesheet" href="/elite-v19-responsive.css?v=${UI_VERSION}" data-ui-v19="responsive" />
  <link rel="stylesheet" href="/elite-v19-fixes.css?v=${UI_VERSION}" data-ui-v19="fixes" />
  <script defer src="/elite-v19.js?v=${UI_VERSION}" data-ui-v19="runtime"></script>
  <script defer src="/elite-v19-addons.js?v=${UI_VERSION}" data-ui-v19="addons"></script>
  \${assetsEstudo}\`;
  resultado = resultado.replace("</head>", camadaElite + "\\n</head>");
  return resultado;
}`;

  source = source.slice(0, start) + replacement + source.slice(end + 2);
} else {
  console.error("[UI V19] Não foi possível localizar aplicarCamadaResponsiva em server.js.");
  process.exit(1);
}

// Garante que páginas críticas nunca escapem pela entrega estática sem tratamento.
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
  console.log(`[UI V19] server.js atualizado para ${UI_VERSION}.`);
} else {
  console.log(`[UI V19] servidor já estava em ${UI_VERSION}.`);
}
