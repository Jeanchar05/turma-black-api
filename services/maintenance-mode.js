"use strict";

const COOKIE_NAME = "tp_maintenance_bypass";
const BYPASS_VALUE = "1";
const RETURN_AT = "2026-09-22T20:00:00-03:00";

function parseCookies(header = "") {
  return String(header)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const index = item.indexOf("=");
      if (index <= 0) return acc;
      const key = item.slice(0, index).trim();
      const value = item.slice(index + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

function shouldBypass(cookieHeader = "") {
  return parseCookies(cookieHeader)[COOKIE_NAME] === BYPASS_VALUE;
}

function shouldShowMaintenance(req = {}) {
  const method = String(req.method || "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) return false;

  const path = String(req.path || req.url || "/").split("?")[0];
  if (["/sair", "/manutencao", "/api/status"].includes(path)) return false;
  if (path.startsWith("/assets/") || /\.(?:css|js|svg|png|jpe?g|webp|gif|ico|woff2?|ttf)$/i.test(path)) return false;

  const accept = String(req.headers?.accept || "").toLowerCase();
  return accept.includes("text/html") || accept.includes("application/xhtml+xml") || path === "/";
}

function bypassCookie({ secure = false } = {}) {
  return `${COOKIE_NAME}=${BYPASS_VALUE}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}; Priority=High`;
}

function clearBypassCookie({ secure = false } = {}) {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}; Priority=High`;
}

module.exports = {
  COOKIE_NAME,
  RETURN_AT,
  parseCookies,
  shouldBypass,
  shouldShowMaintenance,
  bypassCookie,
  clearBypassCookie,
};
