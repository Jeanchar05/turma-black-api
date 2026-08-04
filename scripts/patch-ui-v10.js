"use strict";

const fs = require("fs");
const path = require("path");

const serverPath = path.join(__dirname, "..", "server.js");
const UI_VERSION = "20260803-stability-v17-root-1";
const UI_LABEL = "stability-v17-root-1";

if (!fs.existsSync(serverPath)) {
  console.error("[UI V17] server.js não encontrado.");
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
  const ehModuloInterno = /<body[^>]*class=["'][^"']*(?:\\bstudy-page\\b|\\bstrategy-page\\b)/i.test(resultado) && !ehEstudoHome;

  // Remove exclusivamente camadas dinâmicas que causavam versões sobrepostas.
  resultado = resultado
    .replace(/<link[^>]+(?:data-ui-v(?:10|11|12|13|14|15|16|17)|data-global-responsive)[^>]*>\\s*/gi, "")
    .replace(/<script[^>]+(?:data-ui-v(?:10|11|12|13|14|15|16|17))[^>]*><\\/script>\\s*/gi, "")
    .replace(/<script[^>]+src=["'][^"']*(?:theme-global-v2|platform-final|navigation-final|platform-upgrade-v6|turma-overhaul-v8|site-stabilization-v9|turma-premium-v10|turma-unified-v12|turma-obsidian-v13|turma-imperial-v14|turma-reference-v15|modules-v16|modules-v16-polish|modules-page-v16-fix|study-assets-v17|site-stability-v17)\\.js[^>]*><\\/script>\\s*/gi, "")
    .replace(/<link[^>]+href=["'][^"']*responsive-global\\.css[^>]*>\\s*/gi, "");

  if (ehModuloInterno) {
    // As oito aulas usam um runtime próprio e isolado. Todo o CSS/JS antigo da aula é removido.
    resultado = resultado
      .replace(/<link[^>]+rel=["']stylesheet["'][^>]*>\\s*/gi, "")
      .replace(/<script[^>]+src=["'][^"']*(?:estudo|study-race|race-shared)[^"']*\\.js[^>]*><\\/script>\\s*/gi, "");

    const camadaModulo = \`
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700;800;900&family=Sora:wght@600;700;800;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/modules-v16.css?v=${UI_VERSION}" data-ui-v17="modules-css" />
    <link rel="stylesheet" href="/modules-v16-polish.css?v=${UI_VERSION}" data-ui-v17="modules-polish-css" />
    <link rel="stylesheet" href="/site-stability-v17.css?v=${UI_VERSION}" data-ui-v17="stability-css" />
    <script defer src="/protected-estudo.js?v=${UI_VERSION}" data-ui-v17="protected"></script>
    <script defer src="/modules-v16.js?v=${UI_VERSION}" data-ui-v17="modules-js"></script>
    <script defer src="/modules-v16-polish.js?v=${UI_VERSION}" data-ui-v17="modules-polish-js"></script>\`;
    resultado = resultado.replace("</head>", camadaModulo + "\\n</head>");
    return resultado;
  }

  // Páginas comuns preservam seus próprios CSS e JS. Recebem apenas a camada de segurança.
  const extrasEstudo = (ehEstudoHome || ehPaginaModulos)
    ? \`<script defer src="/study-assets-v17.js?v=${UI_VERSION}" data-ui-v17="study-assets"></script>\`
    : "";
  const camadaEstavel = \`
  <link rel="stylesheet" href="/responsive-global.css?v=${UI_VERSION}" data-global-responsive />
  <link rel="stylesheet" href="/site-stability-v17.css?v=${UI_VERSION}" data-ui-v17="stability-css" />
  <script defer src="/site-stability-v17.js?v=${UI_VERSION}" data-ui-v17="stability-js"></script>
  \${extrasEstudo}\`;
  resultado = resultado.replace("</head>", camadaEstavel + "\\n</head>");
  return resultado;
}`;

  source = source.slice(0, start) + replacement + source.slice(end + 2);
} else {
  console.error("[UI V17] Não foi possível localizar aplicarCamadaResponsiva em server.js.");
  process.exit(1);
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
  console.log(`[UI V17] server.js estabilizado em ${UI_VERSION}.`);
} else {
  console.log(`[UI V17] servidor já estava estabilizado em ${UI_VERSION}.`);
}
