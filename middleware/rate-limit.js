"use strict";

const crypto = require("crypto");

function keyPart(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || "unknown").slice(0, 128);
}

function createRateLimiter({ windowMs, max, keyGenerator, message, skipSuccessfulRequests = false }) {
  const buckets = new Map();
  let lastCleanup = 0;

  return function rateLimit(req, res, next) {
    const now = Date.now();
    if (now - lastCleanup > Math.max(windowMs, 60_000)) {
      lastCleanup = now;
      for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
    }

    const key = keyGenerator(req);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    if (bucket.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        erro: message || "Muitas tentativas. Aguarde e tente novamente.",
        codigo: "RATE_LIMITED",
        retryAfter
      });
    }

    bucket.count += 1;

    if (skipSuccessfulRequests) {
      let handled = false;
      const rollback = () => {
        if (handled) return;
        handled = true;
        if (res.statusCode < 400) {
          const current = buckets.get(key);
          if (current && current.count > 0) current.count -= 1;
        }
      };
      res.once("finish", rollback);
      res.once("close", rollback);
    }

    return next();
  };
}

const loginRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 12,
  keyGenerator: (req) => `login-account:${keyPart(String(req.body?.email || "").trim().toLowerCase())}`,
  message: "Muitas tentativas de login para esta conta. Aguarde alguns minutos e tente novamente.",
  skipSuccessfulRequests: true
});

const loginIpRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => `login-ip:${keyPart(clientIp(req))}`,
  message: "Muitas tentativas de login a partir desta conexão. Aguarde alguns minutos.",
  skipSuccessfulRequests: true
});

const signupRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => `signup:${keyPart(clientIp(req))}`,
  message: "Muitos cadastros foram enviados a partir desta conexão. Tente novamente mais tarde."
});

const webhookRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 180,
  keyGenerator: (req) => `bestfy:${keyPart(clientIp(req))}`,
  message: "Limite temporário de eventos atingido."
});

const setupRateLimit = createRateLimiter({
  windowMs: 30 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `setup:${keyPart(clientIp(req))}`,
  message: "Muitas tentativas de configuração administrativa. Tente novamente mais tarde."
});

const sensitiveWriteRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  keyGenerator: (req) => `sensitive:${keyPart(clientIp(req))}:${keyPart(req.usuario?.id || req.usuario?._id || "anonymous")}`,
  message: "Muitas alterações sensíveis em pouco tempo. Aguarde antes de continuar."
});

const supportWriteRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `support-write:${keyPart(clientIp(req))}:${keyPart(req.usuario?.id || req.usuario?._id || "anonymous")}`,
  message: "Muitas mensagens ou anexos em pouco tempo. Aguarde antes de continuar."
});

module.exports = {
  createRateLimiter,
  loginRateLimit,
  loginIpRateLimit,
  signupRateLimit,
  webhookRateLimit,
  setupRateLimit,
  sensitiveWriteRateLimit,
  supportWriteRateLimit
};
