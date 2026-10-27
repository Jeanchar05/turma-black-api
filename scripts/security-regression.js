"use strict";

const assert = require("assert");
const crypto = require("crypto");
const os = require("os");
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

function testMissingJwtSecretDoesNotUseKnownFallback() {
  const { spawnSync } = require("child_process");
  const code = [
    'const jwt = require("jsonwebtoken");',
    'const { gerarToken } = require("./middleware/auth");',
    'const token = gerarToken({ _id: "0123456789abcdef01234567", email: "student@example.invalid", nome: "Student", cargo: "aluno", tipo: "aluno", plano: "free" });',
    'try { jwt.verify(token, "turma_black_secret_dev", { algorithms: ["HS256"] }); process.exit(4); }',
    'catch (error) { if (error.message !== "invalid signature") throw error; }'
  ].join("\n");
  const result = spawnSync(process.execPath, ["-e", code], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, NODE_ENV: "test", JWT_SECRET: "" },
    encoding: "utf8"
  });
  assert.strictEqual(result.status, 0, "JWT sem segredo configurado nao pode ser assinado pela chave publica de desenvolvimento: " + result.stderr);
}

function testPrivilegedAccountProtection() {
  const { isProtectedAccount } = require("../middleware/permissions");
  assert.strictEqual(typeof isProtectedAccount, "function", "politica de conta protegida deve existir");
  assert.strictEqual(isProtectedAccount({ cargo: "dono" }), true);
  assert.strictEqual(isProtectedAccount({ cargo: "superadmin" }), true);
  assert.strictEqual(isProtectedAccount({ cargo: "dev" }), true);
  assert.strictEqual(isProtectedAccount({ contaDev: true, cargo: "aluno" }), true);
  assert.strictEqual(isProtectedAccount({ cargo: "aluno" }), false);
  assert.strictEqual(isProtectedAccount({ cargo: "admin" }), false);
  const source = fs.readFileSync(path.join(__dirname, "..", "routes", "usuarios.js"), "utf8");
  const updateRoute = source.split('router.put("/usuario/:identificador"')[1]?.split('router.post("/usuario/cargo"')[0] || "";
  assert.ok(updateRoute.includes("isProtectedAccount(usuario)"), "edicao generica deve barrar contas protegidas");
}

function testCompatLoginDoesNotApprovePendingFreeAccount() {
  const vm = require("vm");
  const source = fs.readFileSync(path.join(__dirname, "..", "routes", "login-compat.js"), "utf8");
  const start = source.indexOf("function montarCompatibilidade(usuario) {");
  const end = source.indexOf("\nasync function respostaUsuario(", start);
  assert.ok(start >= 0 && end > start, "normalizacao de login compativel deve existir");
  const functionCode = source.slice(start, end);
  const student = vm.runInNewContext(
    functionCode + '\nmontarCompatibilidade({ aprovado: false, cargo: "aluno", tipo: "aluno", plano: "free" })',
    { normalizarCargo: () => "aluno", normalizarPlano: () => "free", isDevAccount: () => false }
  );
  assert.strictEqual(student.aprovado, false, "aluno nao aprovado nao pode receber token de uma conta aparentemente aprovada");
}

async function testMalformedExamSubmission() {
  const router = require("../routes/provas");
  const route = router.stack.find((layer) =>
    layer.route?.path === "/provas/:id/responder" && layer.route.methods?.post
  );
  assert.ok(route, "rota de envio de prova deve estar registrada");
  const handler = route.route.stack.at(-1).handle;
  for (const body of [undefined, {}, { respostas: "texto" }, { respostas: [null] }]) {
    const result = { statusCode: 200, data: null };
    const res = {
      status(code) { result.statusCode = code; return this; },
      json(data) { result.data = data; return this; }
    };
    const promise = Promise.resolve(handler({ body, params: { id: "invalido" } }, res));
    await Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Entrada invalida nao foi rejeitada antes de acessar o banco.")), 500))
    ]);
    assert.strictEqual(result.statusCode, 400, "entrada vazia/malformada deve retornar HTTP 400");
    assert.ok(result.data?.erro, "cliente deve receber mensagem legivel");
  }
}

function testPremiumGuard() {
  const { isPremiumPath } = require("../middleware/premium-content-guard");
  const protectedPaths = [
    "/estudo-gemeos.html",
    "/estudo-gemeos",
    "/estudo-futuro-modulo.html",
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

function testPremiumVault() {
  const { initializePremiumVault, resolvePremiumFile } = require("../services/premium-vault");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tp-vault-test-"));
  const publicDir = path.join(root, "public");
  const vaultDir = path.join(root, "private-vault");
  fs.mkdirSync(path.join(publicDir, "assets", "study"), { recursive: true });
  fs.writeFileSync(path.join(publicDir, "dashboard.html"), "<html>premium</html>");
  fs.writeFileSync(path.join(publicDir, "estudo-futuro-modulo.html"), "<html>study</html>");
  fs.writeFileSync(path.join(publicDir, "assets", "study", "segredo.js"), "window.__premium=1;");
  fs.writeFileSync(path.join(publicDir, "index.html"), "<html>publico</html>");

  const state = initializePremiumVault(publicDir, vaultDir);
  assert.strictEqual(state.initialized, true);
  assert.strictEqual(state.mode, "authenticated-public", "resolver deve usar modo compatível com hospedagem gerenciada");
  assert.strictEqual(fs.existsSync(path.join(publicDir, "dashboard.html")), true, "boot não deve mover arquivos do pacote");
  assert.strictEqual(fs.existsSync(path.join(publicDir, "estudo-futuro-modulo.html")), true, "boot não deve mutar o document root");
  assert.strictEqual(fs.existsSync(path.join(publicDir, "assets", "study", "segredo.js")), true, "asset deve permanecer estável durante o boot");
  assert.strictEqual(fs.existsSync(path.join(publicDir, "index.html")), true, "conteúdo público deve permanecer em public/");
  assert.ok(resolvePremiumFile("/dashboard"), "rota sem extensão deve resolver HTML Premium autenticado");
  assert.ok(resolvePremiumFile("/assets/study/segredo.js"), "asset Premium deve ser resolvido pelo handler autenticado");
  assert.strictEqual(resolvePremiumFile("/../server.js"), null, "resolver deve bloquear traversal");

  fs.rmSync(root, { recursive: true, force: true });
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

  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );
  const sanitized = await sanitizeUpload(onePixelPng, { name: "pixel.png", informedMime: "image/png" });
  assert.strictEqual(sanitized.mime, "image/png");
  assert.ok(sanitized.buffer.length > 20);
}

function testSalesCommandCenter() {
  const root = path.resolve(__dirname, "..");
  const router = fs.readFileSync(path.join(root, "routes", "vendas.js"), "utf8");
  const preflight = fs.readFileSync(path.join(root, "routes", "vendas-command-preflight.js"), "utf8");
  const security = fs.readFileSync(path.join(root, "routes", "vendas-security-overrides.js"), "utf8");
  const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

  const preflightIndex = router.indexOf('require("./vendas-command-preflight")');
  const securityIndex = router.indexOf('require("./vendas-security-overrides")');
  const legacyIndex = router.indexOf('require("./vendas-mysql")');
  assert.ok(preflightIndex >= 0 && securityIndex > preflightIndex && legacyIndex > securityIndex, "preflight e segurança comercial devem preceder o router legado");

  assert.ok(preflight.includes('preco: 99.99'), "Mensal deve usar R$ 99,99");
  assert.ok(preflight.includes('preco: 249.99'), "6 meses deve usar R$ 249,99");
  assert.ok(preflight.includes('preco: 397.00'), "Anual deve usar R$ 397,00");
  assert.ok(preflight.includes("bestfy_transactions"), "painel deve reconciliar o ledger Bestfy verificado");
  assert.ok(preflight.includes('origem,criado_por,atualizado_por'), "sincronização deve persistir a origem da venda");
  assert.ok(preflight.includes('Checkout Bestfy'), "origem Bestfy deve ser identificável no painel");

  assert.ok(security.includes('status: "pendente"'), "nova venda manual deve nascer pendente");
  assert.ok(security.includes('Vendas da Bestfy são somente leitura'), "transações Bestfy devem ser somente leitura");
  assert.ok(security.includes('Boolean(user.suspenso)'), "concessão manual deve preservar suspensão");
  assert.ok(security.includes('bestfyTransactionId'), "venda manual não pode sobrescrever entitlement Bestfy");
  assert.ok(security.includes('venda-manual:'), "entitlement manual deve registrar sua origem");

  assert.ok(server.includes('painel-vendas-command-v5.css'), "bundle visual do Sales Command Center deve estar ativo");
  assert.ok(server.includes('painel-vendas-command-v5.js'), "bundle UX do Sales Command Center deve estar ativo");
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
  assert.ok(server.includes("initializePremiumVault"), "servidor deve inicializar o resolver Premium antes de servir conteúdo protegido");
  assert.ok(server.includes("resolvePremiumFile"), "entrega Premium deve passar pelo resolver autenticado");
  assert.ok(server.includes("/__premium"), "servidor deve possuir entrega Premium interna autenticada");
  assert.ok(rootHtaccess.includes("/__premium/") && publicHtaccess.includes("/__premium/"), "camada estática deve reescrever Premium");
  assert.ok(rootHtaccess.includes(".premium-vault"), "document root raiz deve negar acesso a eventual diretório privado residual");
  assert.ok(rootHtaccess.includes("X-Security-Policy-Version"), "edge deve publicar marcador da política CSP");
}

(async () => {
  await testPasswords();
  testDevIdentity();
  testMissingJwtSecretDoesNotUseKnownFallback();
  testPrivilegedAccountProtection();
  testCompatLoginDoesNotApprovePendingFreeAccount();
  await testMalformedExamSubmission();
  testPremiumGuard();
  testPremiumVault();
  await testUploads();
  testSalesCommandCenter();
  testWiring();
  console.log("Security regression suite: OK");
})().catch((error) => {
  console.error("Security regression suite: FALHOU");
  console.error(error?.stack || error);
  process.exit(1);
});
