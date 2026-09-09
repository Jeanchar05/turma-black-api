"use strict";

const DEFAULT_ORIGINS = new Set([
  "https://turmablack.com.br",
  "https://www.turmablack.com.br",
  "https://pay.turmablack.com.br"
]);

function configuredOrigins() {
  const origins = new Set(DEFAULT_ORIGINS);
  const raw = String(process.env.ALLOWED_ORIGINS || process.env.APP_ORIGIN || "");
  for (const item of raw.split(",")) {
    const value = item.trim().replace(/\/$/, "");
    if (/^https:\/\//i.test(value) || (/^http:\/\/localhost(?::\d+)?$/i.test(value) && process.env.NODE_ENV !== "production")) {
      origins.add(value);
    }
  }
  return origins;
}

function corsOptions(req, callback) {
  const origin = String(req.header("Origin") || "").replace(/\/$/, "");
  if (!origin || configuredOrigins().has(origin)) {
    return callback(null, { origin: origin || false, credentials: false, methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] });
  }
  return callback(null, { origin: false });
}

function securityHeaders(req, res, next) {
  const production = String(process.env.NODE_ENV || "").toLowerCase() === "production";

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), usb=(), serial=(), bluetooth=(), payment=(self \"https://pay.turmablack.com.br\")");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Origin-Agent-Cluster", "?1");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  if (/^\/(?:admin(?:\/|$)|auth(?:\/|$)|me$|validar-token$|logout$|usuarios?(?:\/|$)|usuario(?:\/|$)|webhooks\/bestfy(?:\/|$)|setup(?:\/|$))/i.test(req.path || "")) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
  }

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://pay.turmablack.com.br",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // O frontend legado ainda possui scripts inline; conectividade e framing foram fechados
    // enquanto a migração gradual desses handlers ocorre sem quebrar a plataforma.
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "media-src 'self' blob: https:",
    "manifest-src 'self'"
  ];
  if (production) csp.push("upgrade-insecure-requests");
  res.setHeader("Content-Security-Policy", csp.join("; "));

  if (production && req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  return next();
}

module.exports = { corsOptions, securityHeaders };
