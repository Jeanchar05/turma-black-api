"use strict";

const fs = require("fs");
const path = require("path");

const serverPath = path.join(__dirname, "..", "server.js");
const UI_VERSION = "20260803-reference-v15-final-1";
const UI_LABEL = "reference-v15-final-1";

if (!fs.existsSync(serverPath)) {
  console.error("[UI V15] server.js não encontrado.");
  process.exit(1);
}

let source = fs.readFileSync(serverPath, "utf8");
const original = source;

source = source.replace(
  /const CACHE_VERSION = "[^"]+";/,
  `const CACHE_VERSION = "${UI_VERSION}";`
);

const startMarker = "function aplicarCamadaResponsiva(html) {";
const endMarker = "\n}\n\nfunction aplicarExtrasAdmin";
const start = source.indexOf(startMarker);
const end = start >= 0 ? source.indexOf(endMarker, start) : -1;

if (start >= 0 && end >= 0) {
  const replacement = `function aplicarCamadaResponsiva(html) {
  let resultado = String(html);

  const folhasLegadas = [
    "theme-global-v2", "platform-final", "platform-upgrade-v6", "turma-overhaul-v8",
    "turma-overhaul-v8-addons", "site-stabilization-v9", "site-stabilization-v9b",
    "turma-premium-v10", "turma-premium-v10-free", "turma-approved-v11",
    "turma-unified-v12", "turma-obsidian-v13", "turma-reference-v15",
    "dashboard-premium", "dashboard-premium-v3", "dashboard-refine-v4", "dashboard-final"
  ].join("|");
  const scriptsLegados = [
    "theme-global-v2", "platform-final", "navigation-final", "platform-upgrade-v6",
    "turma-overhaul-v8", "site-stabilization-v9", "turma-premium-v10",
    "turma-unified-v12", "turma-obsidian-v13", "turma-reference-v15", "dashboard-final"
  ].join("|");

  resultado = resultado
    .replace(new RegExp('<link[^>]+href=["\\'][^"\\']*(?:' + folhasLegadas + ')\\.css[^>]*>\\s*', 'gi'), "")
    .replace(new RegExp('<script[^>]+src=["\\'][^"\\']*(?:' + scriptsLegados + ')\\.js[^>]*><\\/script>\\s*', 'gi'), "")
    .replace(/<link[^>]+data-ui-v(?:10|11|12|13|14|15)[^>]*>\\s*/gi, "")
    .replace(/<script[^>]+data-ui-v(?:10|11|12|13|14|15)[^>]*><\\/script>\\s*/gi, "");

  const camadaV15 = \`
  <link rel="stylesheet" href="/responsive-global.css?v=${UI_VERSION}" data-global-responsive />
  <link rel="stylesheet" href="/turma-imperial-v14.css?v=${UI_VERSION}" data-ui-v15="base" />
  <link rel="stylesheet" href="/turma-reference-v15.css?v=${UI_VERSION}" data-ui-v15="reference" />
  <script defer src="/turma-imperial-v14.js?v=${UI_VERSION}" data-ui-v15="base-js"></script>
  <script defer src="/turma-reference-v15.js?v=${UI_VERSION}" data-ui-v15="reference-js"></script>\`;

  resultado = resultado.replace("</head>", camadaV15 + "\\n</head>");
  return resultado;
}`;

  source = source.slice(0, start) + replacement + source.slice(end + 2);
} else {
  console.error("[UI V15] Não foi possível localizar aplicarCamadaResponsiva em server.js.");
  process.exit(1);
}

source = source.replace(
  /res\.setHeader\("X-UI-Version", "[^"]+"\);/g,
  `res.setHeader("X-UI-Version", "${UI_LABEL}");`
);
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
  console.log(`[UI V15] server.js atualizado para ${UI_VERSION}.`);
} else {
  console.log(`[UI V15] servidor já estava atualizado para ${UI_VERSION}.`);
}
