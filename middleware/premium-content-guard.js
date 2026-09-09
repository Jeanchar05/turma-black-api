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
  "/roleta-reel", "/roleta-reel.html",
  "/estudo-gemeos", "/estudo-gemeos.html",
  "/estudo-espelhos", "/estudo-espelhos.html",
  "/estudo-fibonacci", "/estudo-fibonacci.html",
  "/estudo-magneto", "/estudo-magneto.html",
  "/estudo-camaleoes", "/estudo-camaleoes.html",
  "/estudo-triangulacao", "/estudo-triangulacao.html",
  "/estudo-cavalos", "/estudo-cavalos.html",
  "/estudo-eclipse-zero", "/estudo-eclipse-zero.html"
]);

const PREMIUM_ASSET_PREFIXES = [
  "/assets/study/",
  "/assets/roulette/",
  "/assets/minigames/",
  "/assets/gestao/",
  "/assets/exams/",
  "/assets/modules-v16/",
  "/assets/elite-v19/modules/"
];

const PREMIUM_SCRIPT_PREFIXES = [
  "/estudo-",
  "/study-",
  "/module-lab-",
  "/modules-v16",
  "/modules-elite-",
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
  "/study-race-"
];

function isPremiumResource(req) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const pathname = String(req.path || "").toLowerCase();
  if (PREMIUM_PAGES.has(pathname)) return true;
  if (PREMIUM_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (pathname.endsWith(".js") && PREMIUM_SCRIPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return false;
}

function premiumContentGuard(req, res, next) {
  if (!isPremiumResource(req)) return next();
  return authPagina(req, res, () => requirePremiumPagina(req, res, next));
}

module.exports = {
  premiumContentGuard,
  isPremiumResource,
  PREMIUM_PAGES
};
