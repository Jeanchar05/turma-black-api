"use strict";

const fs = require("fs");
const path = require("path");

const serverPath = path.join(__dirname, "..", "server.js");
const UI_VERSION = "20260803-approved-v11-force-1";

if (!fs.existsSync(serverPath)) {
  console.error("[UI V11] server.js não encontrado.");
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
  const camadaV11 = \`
  <link rel="stylesheet" href="/responsive-global.css" data-global-responsive />
  <link rel="stylesheet" href="/turma-premium-v10.css" data-ui-v10="css" />
  <link rel="stylesheet" href="/turma-premium-v10-free.css" data-ui-v10="free-css" />
  <link rel="stylesheet" href="/turma-approved-v11.css" data-ui-v11="approved-css" />
  <script defer src="/turma-premium-v10.js" data-ui-v10="js"></script>\`;

  if (!resultado.includes('data-ui-v11="approved-css"')) {
    resultado = resultado.replace("</head>", camadaV11 + "\\n</head>");
  }
  return resultado;
}`;

  source = source.slice(0, start) + replacement + source.slice(end + 2);
} else {
  console.error("[UI V11] Não foi possível localizar aplicarCamadaResponsiva em server.js.");
  process.exit(1);
}

source = source.replace(
  /res\.setHeader\("X-UI-Version", "[^"]+"\);/,
  'res.setHeader("X-UI-Version", "approved-v11-force-1");'
);
if (!source.includes('X-UI-Version')) {
  source = source.replace(
    'res.setHeader("X-Cache-Version", CACHE_VERSION);',
    'res.setHeader("X-Cache-Version", CACHE_VERSION);\n    res.setHeader("X-UI-Version", "approved-v11-force-1");'
  );
}

source = source.replace(
  /release: "[^"]+",(?:\n\s*uiVersion: "[^"]+",)?/,
  'release: "approved-v11-force-1",\n    uiVersion: "approved-v11-force-1",'
);

if (source !== original) {
  fs.writeFileSync(serverPath, source, "utf8");
  console.log(`[UI V11] server.js atualizado para ${UI_VERSION}.`);
} else {
  console.log(`[UI V11] servidor já estava atualizado para ${UI_VERSION}.`);
}
