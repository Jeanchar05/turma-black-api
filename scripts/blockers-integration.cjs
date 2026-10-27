"use strict";
// Tests of real Express route handlers; DB operations are replaced only for profile mutation.
// No production users or production database are ever accessed by this script.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const { setTimeout: delay } = require("node:timers/promises");

function handler(router, method, routePath) {
  const layer = router.stack.find(x => x.route?.path === routePath && x.route?.methods?.[method]);
  assert.ok(layer, "Rota inexistente: " + method + " " + routePath);
  return layer.route.stack.at(-1).handle;
}
function response() {
  return {
    statusCode: 200, payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}
async function checkProfilePhoneOtp() {
  const dashboard = require("../routes/dashboard-premium");
  const database = require("../config/database");
  const prevQuery = database.query;
  let saves = 0;
  const account = {
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa", id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    nome: "Aluno A", email: "a@tests.invalid", telefone: "31911111111",
    tipo: "aluno", cargo: "aluno", plano: "free", aprovado: true,
    save: async () => { saves++; }
  };
  database.query = async (sql) => /SELECT|SHOW/i.test(sql) ? [] : { affectedRows: 1 };
  try {
    const req = {
      body: { nome: "Aluno A", telefone: "31999999999", id: "bbbbbbbbbbbbbbbbbbbbbbbb", email: "b@tests.invalid" },
      usuarioDoc: account, usuario: { id: account.id, email: account.email }
    };
    const res = response();
    await handler(dashboard, "put", "/perfil")(req, res);
    assert.equal(res.statusCode, 409, "Alteração de telefone sem código deveria retornar 409");
    assert.equal(account.telefone, "31911111111", "Telefone não pode ser modificado sem OTP");
    assert.equal(saves, 0, "Não gravar perfil com telefone não confirmado");
  } finally { database.query = prevQuery; }
}
async function checkProtectedReactivation() {
  const Usuario = require("../models/Usuario");
  const router = require("../routes/usuarios");
  const original = Usuario.findOne;
  const privileged = {
    _id: "cccccccccccccccccccccccc", email: "owner@tests.invalid",
    nome: "Dono", cargo: "dono", tipo: "admin", plano: "admin",
    suspenso: true, status: "suspenso", aprovado: true,
    save: async () => {}
  };
  Usuario.findOne = async () => privileged;
  try {
    const res = response();
    await handler(router, "post", "/reativar")({
      body: { email: privileged.email }, usuario: { id: "mod", email: "mod@tests.invalid" },
      usuarioDoc: { cargo: "moderador", email: "mod@tests.invalid" }
    }, res);
    assert.equal(res.statusCode, 403, "Moderador não pode reativar Dono");
    assert.equal(privileged.suspenso, true, "Dono deve permanecer suspenso");
  } finally { Usuario.findOne = original; }
}
async function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let body = ""; res.on("data", chunk => body += chunk);
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.setTimeout(1600, () => req.destroy(new Error("timeout")));
  });
}
async function checkReadiness() {
  const port = 46000 + (process.pid % 1000);
  const server = spawn(process.execPath, ["server.js"], {
    cwd: require("node:path").resolve(__dirname, ".."),
    env: { ...process.env, NODE_ENV: "test", PORT: String(port), DB_PASSWORD: "" },
    stdio: "ignore"
  });
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try {
        const result = await get("http://127.0.0.1:" + port + "/api/status");
        if (result.status === 200) { ready = true; break; }
      } catch (_) {}
      if (server.exitCode !== null) break;
      await delay(100);
    }
    assert.ok(ready, "Servidor não iniciou na homologação de teste");
    const live = await get("http://127.0.0.1:" + port + "/health/live");
    const dbReady = await get("http://127.0.0.1:" + port + "/health/ready");
    assert.equal(live.status, 200, "Liveness deve permanecer 200");
    assert.equal(dbReady.status, 503, "Readiness sem MySQL deve retornar 503");
  } finally {
    server.kill("SIGTERM");
  }
}
async function main() {
  let failed = 0;
  for (const [name, test] of [
    ["profile-phone-otp", checkProfilePhoneOtp],
    ["protected-owner-reactivation", checkProtectedReactivation],
    ["health-readiness-without-mysql", checkReadiness]
  ]) {
    try { await test(); console.log("PASS", name); }
    catch (error) { failed++; console.error("FAIL", name, error.message); }
  }
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
