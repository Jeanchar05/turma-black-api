"use strict";

const fs = require("fs");
const path = require("path");
const publicDir = path.join(__dirname, "../public");
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

// Only canonicalize known pages, never API paths or arbitrary redirect targets.
function siteNavigation(req, res, next) {
  if (!["GET", "HEAD"].includes(req.method)) return next();
  const page = canonicalPage(req.path);
  if (page === null) return next();
  if (req.path !== page) {
    const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    return res.redirect(308, page + query);
  }
  return next();
}

module.exports = { siteNavigation, canonicalPage };
