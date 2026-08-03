"use strict";

const fs = require("fs");
const path = require("path");

const serverPath = path.join(__dirname, "..", "server.js");
const UI_VERSION = "20260803-obsidian-v13-final-1";

if (!fs.existsSync(serverPath)) {
  console.error("[UI V13] server.js não encontrado.");
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

  const camadasLegadas = [
    /<link[^>]+href=["'][^"']*(?:theme-global-v2|platform-final|platform-upgrade-v6|turma-overhaul-v8|turma-overhaul-v8-addons|site-stabilization-v9|site-stabilization-v9b|turma-premium-v10|turma-premium-v10-free|turma-approved-v11|turma-unified-v12)\\.css[^>]*>\\s*/gi,
    /<script[^>]+src=["'][^"']*(?:theme-global-v2|platform-final|navigation-final|platform-upgrade-v6|turma-overhaul-v8|site-stabilization-v9|turma-premium-v10|turma-unified-v12)\\.js[^>]*><\\/script>\\s*/gi
  ];
  camadasLegadas.forEach((padrao) => { resultado = resultado.replace(padrao, ""); });

  const camadaV13 = \`
  <link rel="stylesheet" href="/responsive-global.css" data-global-responsive />
  <link rel="stylesheet" href="/turma-obsidian-v13.css" data-ui-v13="css" />
  <script defer src="/turma-obsidian-v13.js" data-ui-v13="js"></script>\`;

  if (!resultado.includes('data-ui-v13="css"')) {
    resultado = resultado.replace("</head>", camadaV13 + "\\n</head>");
  }
  return resultado;
}`;

  source = source.slice(0, start) + replacement + source.slice(end + 2);
} else {
  console.error("[UI V13] Não foi possível localizar aplicarCamadaResponsiva em server.js.");
  process.exit(1);
}

source = source.replace(
  /res\.setHeader\("X-UI-Version", "[^"]+"\);/,
  'res.setHeader("X-UI-Version", "obsidian-v13-final-1");'
);
if (!source.includes('X-UI-Version')) {
  source = source.replace(
    'res.setHeader("X-Cache-Version", CACHE_VERSION);',
    'res.setHeader("X-Cache-Version", CACHE_VERSION);\n    res.setHeader("X-UI-Version", "obsidian-v13-final-1");'
  );
}

source = source.replace(
  /release: "[^"]+",(?:\n\s*uiVersion: "[^"]+",)?/,
  'release: "obsidian-v13-final-1",\n    uiVersion: "obsidian-v13-final-1",'
);

if (source !== original) {
  fs.writeFileSync(serverPath, source, "utf8");
  console.log(`[UI V13] server.js atualizado para ${UI_VERSION}.`);
} else {
  console.log(`[UI V13] servidor já estava atualizado para ${UI_VERSION}.`);
}
