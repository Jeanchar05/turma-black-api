"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const root = path.join(__dirname, "../public");
let html = fs.readFileSync(path.join(root, "estudo.html"), "utf8");
html = html
  .replace("<title>Estudo |", "<title>Módulos |")
  .replace(
    'class="learn-page" data-study-route=""',
    'class="learn-page library-page" data-required-access="dashboard"',
  );
html = html
  .replace(
    /<script defer src="\/study-(?:workspace|game-ui|board)\.js[^>]*><\/script>\s*/g,
    "",
  )
  .replace(/<link rel="stylesheet" href="\/study-board\.css[^>]*>\s*/g, "");
html = html.replace(
  "</head>",
  '<link rel="stylesheet" href="/modulos.css?v=20260914-1"><script defer src="/study-media.js?v=20260914-1"></script><script defer src="/modulos.js?v=20260914-1"></script></head>',
);
html = html
  .replace(
    'href="/estudo" class="is-active" aria-current="page"',
    'href="/estudo"',
  )
  .replace(
    'href="/modulos"><svg',
    'href="/modulos" class="is-active" aria-current="page"><svg',
  );
html = html
  .replace('<a href="/estudo">Estudo</a>', "<strong>Módulos</strong>")
  .replace('id="studyApp"', 'id="modulesApp"');
html = html
  .replace("Preparando seus estudos", "Preparando suas aulas")
  .replace("Central de estudos", "Central de aulas");
html = html
  .replace('href="/estudo" aria-current="page"', 'href="/estudo"')
  .replace(
    '<a href="/minigames"><svg aria-hidden="true"><use href="/assets/dashboard-icons.svg#i-game"></use></svg><span>Minigames</span></a>',
    '<a href="/modulos" aria-current="page"><svg aria-hidden="true"><use href="/assets/dashboard-icons.svg#i-layers"></use></svg><span>Módulos</span></a>',
  );
html = html.replace(
  /(<nav class="learn-dock"[\s\S]*?)(<a href="\/modulos")/,
  '$1$2 aria-current="page"',
);
html = html.replace(
  "</body>",
  '<dialog class="lib-dialog" id="libraryDialog" aria-labelledby="libraryDialogTitle"></dialog></body>',
);
fs.writeFileSync(path.join(root, "modulos.html"), html);
console.log("Central de aulas atualizada.");
