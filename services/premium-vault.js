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
  error: "",
  mode: "authenticated-public"
};

function inside(root, target) {
  const base = `${path.resolve(root)}${path.sep}`;
  const resolved = path.resolve(target);
  return resolved.startsWith(base);
}

function initializePremiumVault(publicDir, vaultDir) {
  const publicRoot = path.resolve(publicDir);
  const privateRoot = path.resolve(vaultDir || path.join(path.dirname(publicRoot), ".premium-vault"));

  if (!fs.existsSync(publicRoot)) {
    state = {
      initialized: false,
      publicDir: publicRoot,
      vaultDir: privateRoot,
      moved: 0,
      degraded: true,
      error: "Diretório público não encontrado.",
      mode: "authenticated-public"
    };
    console.error("[SECURITY] Premium resolver indisponível: diretório público não encontrado.");
    return { ...state };
  }

  // Não movemos, copiamos nem apagamos arquivos durante o boot. Em hospedagem
  // gerenciada isso pode atrasar o health-check e provocar 503. A proteção
  // continua em duas camadas: .htaccess reescreve recursos Premium para
  // /__premium e o Express exige sessão + acesso Premium antes de entregar.
  state = {
    initialized: true,
    publicDir: publicRoot,
    vaultDir: privateRoot,
    moved: 0,
    degraded: false,
    error: "",
    mode: "authenticated-public"
  };

  console.log("[SECURITY] Premium resolver pronto sem mutação do filesystem.");
  return { ...state };
}

function normalizeRelative(requestPath) {
  let pathname = String(requestPath || "").split("?")[0];
  try { pathname = decodeURIComponent(pathname); } catch (_) {}
  pathname = pathname.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  const parts = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) return "";
  return parts.join(path.sep);
}

function resolvePremiumFile(requestPath) {
  if (!state.initialized || !isPremiumPath(requestPath)) return null;

  const relative = normalizeRelative(requestPath);
  if (!relative) return null;

  const candidates = [relative];
  if (!path.extname(relative)) candidates.push(`${relative}.html`);

  for (const candidate of candidates) {
    const full = path.resolve(state.publicDir, candidate);
    if (!inside(state.publicDir, full)) continue;
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
