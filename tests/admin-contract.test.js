const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

function ler(caminho) {
  return fs.readFileSync(path.join(ROOT, caminho), "utf8");
}

test("admin referencia somente assets locais existentes", () => {
  const html = ler("public/admin.html");
  const referencias = [...html.matchAll(/(?:href|src)="([^"?#]+\.(?:css|js))/g)]
    .map((match) => match[1])
    .filter((referencia) => !/^https?:/i.test(referencia));

  assert.ok(referencias.length >= 3);

  for (const referencia of referencias) {
    assert.equal(
      fs.existsSync(path.join(PUBLIC, referencia)),
      true,
      `asset ausente: ${referencia}`
    );
  }
});

test("admin não possui IDs duplicados", () => {
  const html = ler("public/admin.html");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);

  assert.equal(new Set(ids).size, ids.length);
});

test("scripts críticos possuem sintaxe válida e não persistem autenticação no localStorage", () => {
  for (const arquivo of ["public/admin.js", "public/suporte.js", "public/bloqueio.js"]) {
    const codigo = ler(arquivo);
    assert.doesNotThrow(() => new vm.Script(codigo, { filename: arquivo }));
    assert.equal(/localStorage\s*\./.test(codigo), false, arquivo);
  }
});

test("CSS isolado torna modal ativo visível e preserva a rolagem do admin", () => {
  const css = ler("public/css/admin.css");

  assert.match(css, /body\.admin-premium-body\s*\{[^}]*overflow-y:\s*auto\s*!important/s);
  assert.match(css, /\.modal-overlay\.active[\s\S]*visibility:\s*visible/);
  assert.match(css, /\.modal-overlay\[hidden\][\s\S]*display:\s*none\s*!important/);
});

test("contrato de suporte contém rotas do usuário e do painel admin", () => {
  const suporte = ler("routes/suporte.js");
  const rotas = [
    "/suporte",
    "/meus-chamados",
    "/admin/suporte/resumo",
    "/admin/suporte",
    "/admin/suporte/:id/responder",
    "/admin/suporte/:id/status"
  ];

  for (const rota of rotas) {
    assert.equal(suporte.includes(`"${rota}"`), true, rota);
  }
});

test("frontend está registrado antes do middleware 404", () => {
  const server = ler("server.js");

  assert.ok(server.indexOf("express.static(publicDirectory") > -1);
  assert.ok(server.indexOf("express.static(publicDirectory") < server.indexOf("ROTA 404"));
  assert.match(server, /app\.get\("\/admin"[\s\S]*\/admin\.html/);
});

test("leitura de vendedores exige equipe administrativa e permissão de vendas", () => {
  const admin = ler("routes/admin.js");

  for (const rota of ["/vendedores", "/vendedores/resumo"]) {
    const inicio = admin.indexOf(`\"${rota}\"`);
    const trecho = admin.slice(inicio, inicio + 180);

    assert.ok(inicio > -1, rota);
    assert.match(trecho, /auth,\s*requireAdmin,\s*requirePermission\("painelVendas"\)/s);
  }
});

test("moderador não recebe as rotas de mutação completa de usuários", () => {
  const usuarios = ler("routes/usuarios.js");
  const rotas = [
    'router.post("/suspender"',
    'router.post("/reativar"',
    'router.post("/usuario/bloquear"',
    'router.put("/usuario/:identificador"'
  ];

  for (const rota of rotas) {
    const inicio = usuarios.indexOf(rota);
    const trecho = usuarios.slice(inicio, inicio + 180);

    assert.ok(inicio > -1, rota);
    assert.match(trecho, /requireCargo\("admin"\)/);
  }
});
