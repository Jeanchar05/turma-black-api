"use strict";

const crypto = require("crypto");

const buckets = new Map();
let lastSweep = 0;

function keyPart(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || "unknown").slice(0, 120);
}

function sweep(now) {
  if (now - lastSweep < 5 * 60 * 1000) return;
  lastSweep = now;
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}

function limiter({ name, windowMs, max, key }) {
  return function rateLimit(req, res, next) {
    const now = Date.now();
    sweep(now);
    const bucketKey = `${name}:${keyPart(key(req))}`;
    let bucket = buckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, bucket);
    }

    bucket.count += 1;
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        erro: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        codigo: "RATE_LIMIT_EXCEEDED"
      });
    }

    return next();
  };
}

const loginRateLimit = limiter({
  name: "login-account",
  windowMs: 10 * 60 * 1000,
  max: 12,
  key: (req) => `${clientIp(req)}|${String(req.body?.email || "").trim().toLowerCase()}`
});

const loginIpRateLimit = limiter({
  name: "login-ip",
  windowMs: 10 * 60 * 1000,
  max: 60,
  key: clientIp
});

const signupRateLimit = limiter({
  name: "signup-ip",
  windowMs: 60 * 60 * 1000,
  max: 20,
  key: clientIp
});

const webhookRateLimit = limiter({
  name: "bestfy-webhook",
  windowMs: 60 * 1000,
  max: 180,
  key: clientIp
});

module.exports = {
  loginRateLimit,
  loginIpRateLimit,
  signupRateLimit,
  webhookRateLimit
};
