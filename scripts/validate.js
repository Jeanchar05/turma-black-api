const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIRECTORIES = [
  "config",
  "middleware",
  "models",
  "routes",
  "services",
  "public"
];

const IGNORE_DIRECTORIES = new Set(["node_modules", ".git"]);
const failures = [];
let checked = 0;

function walk(directory) {
  if (!fs.existsSync(directory)) return;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (IGNORE_DIRECTORIES.has(entry.name)) continue;

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;

    const result = spawnSync(process.execPath, ["--check", fullPath], {
      cwd: ROOT,
      encoding: "utf8"
    });

    checked += 1;

    if (result.status !== 0) {
      failures.push({
        file: path.relative(ROOT, fullPath),
        output: String(result.stderr || result.stdout || "Erro de sintaxe.").trim()
      });
    }
  }
}

for (const directory of DIRECTORIES) {
  walk(path.join(ROOT, directory));
}

const serverResult = spawnSync(process.execPath, ["--check", path.join(ROOT, "server.js")], {
  cwd: ROOT,
  encoding: "utf8"
});
checked += 1;

if (serverResult.status !== 0) {
  failures.push({
    file: "server.js",
    output: String(serverResult.stderr || serverResult.stdout || "Erro de sintaxe.").trim()
  });
}

if (failures.length) {
  console.error(`Falha: ${failures.length} arquivo(s) com erro entre ${checked} verificados.`);
  failures.forEach(({ file, output }) => {
    console.error(`\n[${file}]\n${output}`);
  });
  process.exit(1);
}

console.log(`Validação concluída: ${checked} arquivos JavaScript sem erros de sintaxe.`);
