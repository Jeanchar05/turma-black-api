"use strict";

const { authPagina, requirePremiumPagina } = require("./auth");

const PREMIUM_PAGES = new Set([
  "/dashboard", "/dashboard.html",
  "/atividades", "/atividades.html",
  "/notificacoes", "/notificacoes.html",
  "/estudo", "/estudo.html",
  "/modulos", "/modulos.html",
  "/minigames", "/minigames.html",
  "/gestao", "/gestao.html",
  "/notas", "/notas.html",
  "/favoritos", "/favoritos.html",
  "/provas", "/provas.html",
  "/roleta", "/roleta.html",
  "/roleta-real", "/roleta-real.html",
  "/roleta-reel", "/roleta-reel.html"
]);

const PREMIUM_ASSET_PREFIXES = [
  "/assets/study/",
  "/assets/roulette/",
  "/assets/minigames/",
  "/assets/gestao/",
  "/assets/exams/",
  "/assets/modules-v16/",
  "/assets/elite-v19/modules/",
  "/assets/imperial-v14/modules/"
];

const PREMIUM_SCRIPT_PREFIXES = [
  "/protected-estudo.js",
  "/estudo.js",
  "/estudo-",
  "/study-",
  "/module-lab-",
  "/modules-v16",
  "/modules-elite-",
  "/modules-images-",
  "/modules-page-",
  "/modulos.js",
  "/gestao-",
  "/notas.js",
  "/notas-",
  "/favorites-",
  "/favoritos.js",
  "/provas.js",
  "/provas-",
  "/exams-",
  "/roleta.js",
  "/roleta-reel",
  "/race-tool.js",
  "/study-race-",
  "/dashboard-premium",
  "/dashboard-final.js",
  "/dashboard-lite.js",
  "/dashboard-controls-",
  "/dashboard-notifications-",
  "/dashboard-portrait-",
  "/dashboard-neo/",
  "/elite-v19.js",
  "/elite-v19-addons.js"
];

const PREMIUM_STYLESHEET_PREFIXES = [
  "/estudo.css",
  "/estudo-",
  "/study-",
  "/module-lab-",
  "/modules-v16",
  "/modules-elite-",
  "/modulos.css",
  "/gestao-",
  "/notas",
  "/favorites-",
  "/favoritos.css",
  "/provas",
  "/roleta",
  "/race-",
  "/dashboard-premium",
  "/dashboard-v20",
  "/dashboard-final",
  "/dashboard-refine-",
  "/dashboard-safe-",
  "/dashboard-hero-",
  "/dashboard-live-",
  "/dashboard-character-",
  "/dashboard-neo/",
  "/elite-v19-",
  "/student-shell-",
  "/turma-imperial-",
  "/turma-obsidian-",
  "/turma-reference-",
  "/turma-unified-",
  "/turma-approved-",
  "/turma-premium-v10"
];

function normalizePath(reqOrPath) {
  const raw = typeof reqOrPath === "string" ? reqOrPath : reqOrPath?.path;
  let pathname = String(raw || "").split("?")[0].toLowerCase();
  try { pathname = decodeURIComponent(pathname); } catch (_) {}
  pathname = pathname.replace(/\/+/g, "/");
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  return pathname;
}

function isPremiumPath(reqOrPath) {
  const pathname = normalizePath(reqOrPath);
  if (PREMIUM_PAGES.has(pathname)) return true;
  if (/^\/estudo(?:-[a-z0-9-]+)?(?:\.html)?$/.test(pathname)) return true;
  if (PREMIUM_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;

  if (pathname.endsWith(".js") && PREMIUM_SCRIPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (pathname.endsWith(".css") && PREMIUM_STYLESHEET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  return false;
}

function isPremiumResource(req) {
  if (!req || (req.method !== "GET" && req.method !== "HEAD")) return false;
  return isPremiumPath(req);
}

function premiumContentGuard(req, res, next) {
  if (!isPremiumResource(req)) return next();
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  return authPagina(req, res, () => requirePremiumPagina(req, res, next));
}

module.exports = {
  premiumContentGuard,
  isPremiumResource,
  isPremiumPath,
  PREMIUM_PAGES,
  PREMIUM_ASSET_PREFIXES,
  PREMIUM_SCRIPT_PREFIXES,
  PREMIUM_STYLESHEET_PREFIXES
};
