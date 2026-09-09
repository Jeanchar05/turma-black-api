"use strict";

const assert = require("assert");
const crypto = require("crypto");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");

const scrypt = promisify(crypto.scrypt);

async function testPasswords() {
  const passwords = require("../services/passwords");
  assert.strictEqual(typeof passwords.ensurePasswordHash, "function", "ensurePasswordHash deve existir");
  assert.strictEqual(passwords.PASSWORD_HASH_POLICY.N, 131072, "scrypt N deve usar política endurecida");
  assert.strictEqual(passwords.PASSWORD_HASH_POLICY.r, 8);
  assert.strictEqual(passwords.PASSWORD_HASH_POLICY.p, 1);

  const plain = "Teste-Regressao-9x!";
  const hashed = await passwords.ensurePasswordHash(plain);
  assert.ok(passwords.isPasswordHash(hashed), "texto puro deve virar hash");
  assert.notStrictEqual(hashed, plain);
  assert.strictEqual(await passwords.ensurePasswordHash(hashed), hashed, "hash válido deve ser preservado");

  const valid = await passwords.verifyPassword(hashed, plain);
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.needsRehash, false);
  assert.strictEqual((await passwords.verifyPassword(hashed, "senha-errada")).valid, false);

  const salt = crypto.randomBytes(16);
  const oldDerived = await scrypt(plain, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const oldHash = ["", "scrypt", "v1", "16384", "8", "1", salt.toString("base64url"), Buffer.from(oldDerived).toString("base64url")].join("$");
  const oldCheck = await passwords.verifyPassword(oldHash, plain);
  assert.strictEqual(oldCheck.valid, true, "hash legado deve continuar validando");
  assert.strictEqual(oldCheck.needsRehash, true, "hash legado deve pedir rehash progressivo");
}

function testDevIdentity() {
  const previous = process.env.DEV_EMAIL;
  process.env.DEV_EMAIL = "dev-security-test@example.invalid";
  const { isDevAccount, getCargo } = require("../middleware/permissions");

  const forged = { contaDev: true, cargo: "dev", email: "outra-conta@example.invalid" };
  assert.strictEqual(isDevAccount(forged), false, "flag isolada não pode conceder Dev");
  assert.strictEqual(getCargo(forged), "aluno", "cargo dev forjado deve cair para aluno");

  const real = { contaDev: true, cargo: "dev", email: "dev-security-test@example.invalid" };
  assert.strictEqual(isDevAccount(real), true, "identidade Dev completa deve ser reconhecida");
  assert.strictEqual(getCargo(real), "dev");

  if (previous === undefined) delete process.env.DEV_EMAIL;
  else process.env.DEV_EMAIL = previous;
}

function testPremiumGuard() {
  const { isPremiumPath } = require("../middleware/premium-content-guard");
  const protectedPaths = [
    "/estudo-gemeos.html",
    "/estudo-gemeos",
    "/estudo.js",
    "/modulos.js",
    "/dashboard.html",
    "/dashboard-premium-safe.js",
    "/assets/study/final-data/exemplo.js",
    "/assets/elite-v19/modules/exemplo.js",
    "/dashboard-neo/app.js"
  ];
  protectedPaths.forEach((value) => assert.strictEqual(isPremiumPath(value), true, `${value} deve ser Premium`));
  assert.strictEqual(isPremiumPath("/dashboard-free.html"), false, "dashboard Free não pode ser classificado como Premium");
  assert.strictEqual(isPremiumPath("/index.html"), false, "login deve continuar público");
}

async function testUploads() {
  const { sanitizeUpload, validatePdf } = require("../services/upload-sanitizer");

  const truncatedGif = Buffer.concat([Buffer.from("GIF89a", "ascii"), Buffer.alloc(32)]);
  await assert.rejects(
    () => sanitizeUpload(truncatedGif, { name: "fake.gif", informedMime: "image/gif" }),
    (error) => String(error?.code || "").startsWith("UPLOAD_"),
    "GIF apenas com assinatura deve ser rejeitado"
  );

  const activePdf = Buffer.from("%PDF-1.4\n1 0 obj << /OpenAction 2 0 R /JavaScript (alert) >> endobj\n%%EOF", "latin1");
  assert.throws(
    () => validatePdf(activePdf),
    (error) => error?.code === "UPLOAD_ACTIVE_PDF",
    "PDF com ação ativa deve ser rejeitado"
  );

  // PNG 1x1 conhecido: precisa ser realmente decodificado e reprocessado.
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );
  const sanitized = await sanitizeUpload(onePixelPng, { name: "pixel.png", informedMime: "image/png" });
  assert.strictEqual(sanitized.mime, "image/png");
  assert.ok(sanitized.buffer.length > 20);
}

function testWiring() {
  const root = path.resolve(__dirname, "..");
  const authRoute = fs.readFileSync(path.join(root, "routes", "auth.js"), "utf8");
  const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
  const rootHtaccess = fs.readFileSync(path.join(root, ".htaccess"), "utf8");
  const publicHtaccess = fs.readFileSync(path.join(root, "public", ".htaccess"), "utf8");

  assert.ok(authRoute.includes("../services/bestfy-hardened"), "webhook deve usar wrapper Bestfy recuperável");
  assert.ok(server.includes("support-upload-secure.js"), "upload sanitizado deve ser montado antes do legado");
  assert.ok(server.indexOf("support-upload-secure.js") < server.indexOf('"suporte.js"'), "rota segura deve preceder rota de suporte legada");
  assert.ok(server.includes("/__premium"), "servidor deve possuir entrega Premium interna autenticada");
  assert.ok(rootHtaccess.includes("/__premium/") && publicHtaccess.includes("/__premium/"), "camada estática deve reescrever Premium");
  assert.ok(rootHtaccess.includes("X-Security-Policy-Version"), "edge deve publicar marcador da política CSP");
}

(async () => {
  await testPasswords();
  testDevIdentity();
  testPremiumGuard();
  await testUploads();
  testWiring();
  console.log("Security regression suite: OK");
})().catch((error) => {
  console.error("Security regression suite: FALHOU");
  console.error(error?.stack || error);
  process.exit(1);
});
