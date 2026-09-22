"use strict";

const fs = require("fs");
const path = require("path");
const maintenance = require("../services/maintenance-mode");

const publicDir = path.join(__dirname, "../public");
const maintenanceFile = path.join(publicDir, "manutencao.html");
const pages = new Set(fs.readdirSync(publicDir).filter(name => name.endsWith(".html")).map(name => `/${name.slice(0, -5)}`));
pages.add("/");
pages.add("/painel-admin");
pages.add("/atividades");
pages.add("/notificacoes");

function canonicalPage(raw) {
  let pathname;
  try { pathname = decodeURIComponent(raw); } catch { return null; }
  pathname = pathname.toLowerCase().replace(/\/$/, "").replace(/\.html$/, "") || "/";
  if (pathname === "/index") pathname = "/";
  if (!pages.has(pathname)) return null;
  return pathname;
}

function maintenanceHeaders(res) {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
}

function serveMaintenance(res) {
  maintenanceHeaders(res);
  res.setHeader("Retry-After", "3600");
  return res.status(503).sendFile(maintenanceFile);
}

// Canonicaliza páginas conhecidas e mantém o site público em manutenção.
// /sair cria um bypass privado por 24h para a equipe revisar o site sem
// interromper webhooks, APIs ou health-checks.
function siteNavigation(req, res, next) {
  if (!["GET", "HEAD"].includes(req.method)) return next();

  const production = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";

  if (req.path === "/sair") {
    maintenanceHeaders(res);
    res.append("Set-Cookie", maintenance.bypassCookie({ secure: production }));
    return res.redirect(302, "/");
  }

  if (req.path === "/manutencao") {
    maintenanceHeaders(res);
    res.append("Set-Cookie", maintenance.clearBypassCookie({ secure: production }));
    return serveMaintenance(res);
  }

  const bypass = maintenance.shouldBypass(req.headers?.cookie || "");
  if (!bypass && maintenance.shouldShowMaintenance(req)) return serveMaintenance(res);

  const page = canonicalPage(req.path);
  if (page === null) return next();
  if (req.path !== page) {
    const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    return res.redirect(308, page + query);
  }
  return next();
}

module.exports = { siteNavigation, canonicalPage };
