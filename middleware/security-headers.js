"use strict";

const DEFAULT_ORIGINS = new Set([
  "https://turmablack.com.br",
  "https://www.turmablack.com.br",
  "https://pay.turmablack.com.br"
]);

function configuredOrigins() {
  const raw = String(process.env.ALLOWED_ORIGINS || process.env.APP_ORIGIN || "");
  for (const item of raw.split(",")) {
    const value = item.trim().replace(/\/$/, "");
    if (/^https?:\/\//i.test(value)) DEFAULT_ORIGINS.add(value);
  }
  return DEFAULT_ORIGINS;
}

function corsOptions(req, callback) {
  const origin = String(req.header("Origin") || "").replace(/\/$/, "");
  if (!origin || configuredOrigins().has(origin)) {
    return callback(null, { origin: origin || false, credentials: false });
  }
  return callback(null, { origin: false });
}

function securityHeaders(req, res, next) {
  const production = String(process.env.NODE_ENV || "").toLowerCase() === "production";

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self \"https://pay.turmablack.com.br\")");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://pay.turmablack.com.br",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' https:",
    "frame-src https:",
    "media-src 'self' blob: https:"
  ];
  if (production) csp.push("upgrade-insecure-requests");
  res.setHeader("Content-Security-Policy", csp.join("; "));

  if (production && req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
}

module.exports = { corsOptions, securityHeaders };
