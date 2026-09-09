"use strict";

const fs = require("fs");
const path = require("path");
const { isPremiumPath } = require("../middleware/premium-content-guard");

let state = {
  initialized: false,
  publicDir: "",
  vaultDir: "",
  moved: 0,
  degraded: false,
  error: ""
};

function inside(root, target) {
  const base = `${path.resolve(root)}${path.sep}`;
  const resolved = path.resolve(target);
  return resolved.startsWith(base);
}

function walkFiles(dir, root, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walkFiles(full, root, output);
    else if (entry.isFile()) output.push({ full, relative: path.relative(root, full) });
  }
  return output;
}

function secureRemoveSource(source) {
  try {
    fs.unlinkSync(source);
    return;
  } catch (unlinkError) {
    try {
      fs.writeFileSync(source, "", { flag: "w" });
      fs.unlinkSync(source);
      return;
    } catch (_) {
      throw unlinkError;
    }
  }
}

function initializePremiumVault(publicDir, vaultDir) {
  const publicRoot = path.resolve(publicDir);
  const privateRoot = path.resolve(vaultDir);
  let moved = 0;

  try {
    if (publicRoot === privateRoot || inside(publicRoot, privateRoot)) {
      throw new Error("O cofre Premium precisa ficar fora do diretório público.");
    }

    fs.mkdirSync(privateRoot, { recursive: true });

    for (const item of walkFiles(publicRoot, publicRoot)) {
      const urlPath = `/${item.relative.split(path.sep).join("/")}`;
      if (!isPremiumPath(urlPath)) continue;

      const destination = path.resolve(privateRoot, item.relative);
      if (!inside(privateRoot, destination)) {
        throw new Error("Caminho Premium inválido durante preparação do cofre.");
      }

      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(item.full, destination);
      secureRemoveSource(item.full);
      moved += 1;
    }

    state = {
      initialized: true,
      publicDir: publicRoot,
      vaultDir: privateRoot,
      moved,
      degraded: false,
      error: ""
    };

    console.log(`[SECURITY] Cofre Premium preparado fora do document root (${moved} arquivos protegidos).`);
    return { ...state };
  } catch (error) {
    // Importante: uma limitação de escrita da hospedagem não pode derrubar
    // todo o site com 503. O conteúdo Premium continua fail-closed porque
    // resolvePremiumFile() retorna null enquanto initialized=false, e o guard
    // de autenticação permanece montado antes do express.static.
    state = {
      initialized: false,
      publicDir: publicRoot,
      vaultDir: privateRoot,
      moved,
      degraded: true,
      error: String(error?.message || "Falha ao preparar cofre Premium.").slice(0, 300)
    };
    console.error("[SECURITY] Cofre Premium indisponível; servidor continuará online com Premium bloqueado:", state.error);
    return { ...state };
  }
}

function resolvePremiumFile(requestPath) {
  if (!state.initialized || !isPremiumPath(requestPath)) return null;
  let pathname = String(requestPath || "").split("?")[0];
  try { pathname = decodeURIComponent(pathname); } catch (_) {}
  const relative = pathname.replace(/^\/+/, "").split("/").filter(Boolean).join(path.sep);
  if (!relative || relative.includes(`..${path.sep}`) || relative === "..") return null;

  const candidates = [relative];
  if (!path.extname(relative)) candidates.push(`${relative}.html`);

  for (const candidate of candidates) {
    const full = path.resolve(state.vaultDir, candidate);
    if (!inside(state.vaultDir, full)) continue;
    try {
      const stat = fs.statSync(full);
      if (stat.isFile()) return full;
    } catch (_) {}
  }
  return null;
}

function getPremiumVaultState() {
  return { ...state };
}

module.exports = {
  initializePremiumVault,
  resolvePremiumFile,
  getPremiumVaultState
};
