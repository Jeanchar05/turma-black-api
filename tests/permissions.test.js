const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getPermissoes,
  temPermissao
} = require("../middleware/permissions");

function usuario(cargo) {
  return { cargo, tipo: cargo === "aluno" ? "aluno" : "admin" };
}

test("superadmin mantém acesso total", () => {
  const permissoes = getPermissoes(usuario("superadmin"));

  for (const [nome, permitido] of Object.entries(permissoes)) {
    assert.equal(permitido, true, `permissão ${nome}`);
  }
});

test("admin não recebe áreas reservadas ao superadmin", () => {
  const admin = usuario("admin");

  assert.equal(temPermissao(admin, "painelAdmin"), true);
  assert.equal(temPermissao(admin, "usuarios"), true);
  assert.equal(temPermissao(admin, "relatorios"), false);
  assert.equal(temPermissao(admin, "agendaPrimo"), false);
  assert.equal(temPermissao(admin, "controleAdmin"), false);
  assert.equal(temPermissao(admin, "seguranca"), false);
});

test("moderador pode listar/aprovar usuários e acessar provas", () => {
  const moderador = usuario("moderador");

  assert.equal(temPermissao(moderador, "painelAdmin"), true);
  assert.equal(temPermissao(moderador, "usuarios"), true);
  assert.equal(temPermissao(moderador, "aprovacoes"), true);
  assert.equal(temPermissao(moderador, "provas"), true);
  assert.equal(temPermissao(moderador, "planos"), false);
  assert.equal(temPermissao(moderador, "controleAlunos"), false);
});

test("suporte entra no painel somente pelas áreas permitidas", () => {
  const suporte = usuario("suporte");

  assert.equal(temPermissao(suporte, "dashboard"), true);
  assert.equal(temPermissao(suporte, "painelAdmin"), true);
  assert.equal(temPermissao(suporte, "painelVendas"), true);
  assert.equal(temPermissao(suporte, "suporte"), true);
  assert.equal(temPermissao(suporte, "usuarios"), false);
  assert.equal(temPermissao(suporte, "controleAdmin"), false);
  assert.equal(temPermissao(suporte, "seguranca"), false);
});

test("aluno não recebe acesso administrativo", () => {
  const aluno = usuario("aluno");

  assert.equal(temPermissao(aluno, "dashboard"), true);
  assert.equal(temPermissao(aluno, "painelAdmin"), false);
  assert.equal(temPermissao(aluno, "painelVendas"), false);
});
