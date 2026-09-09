"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function expectAll(source, values, label) {
  for (const value of values) {
    assert.ok(source.includes(value), `${label}: ausente ${value}`);
  }
}

function testRouterOrder() {
  const router = read("routes/vendas.js");
  const preflight = router.indexOf('require("./vendas-command-preflight")');
  const security = router.indexOf('require("./vendas-security-overrides")');
  const command = router.indexOf('require("./vendas-command-center")');
  const legacy = router.indexOf('require("./vendas-mysql")');
  assert.ok(preflight >= 0, "preflight comercial precisa estar montado");
  assert.ok(security > preflight, "segurança comercial deve vir após o preflight");
  assert.ok(command > security, "Command Center deve vir após as regras de segurança");
  assert.ok(legacy > command, "rotas específicas do Command Center devem preceder /vendas/:id legado");
}

function testBackendContracts() {
  const legacy = read("routes/vendas-mysql.js");
  const command = read("routes/vendas-command-center.js");
  const security = read("routes/vendas-security-overrides.js");
  const preflight = read("routes/vendas-command-preflight.js");

  expectAll(legacy, [
    'router.get("/vendas/status"',
    'router.get("/vendas/painel/contexto"',
    'router.get("/vendas/dashboard"',
    'router.get("/vendas/clientes"',
    'router.get("/vendas/vendedores"',
    'router.get("/vendas/produtos"',
    'router.post("/vendas/produtos"',
    'router.put("/vendas/produtos/:id"',
    'router.delete("/vendas/produtos/:id"',
    'router.get("/vendas/formas-pagamento"',
    'router.post("/vendas/formas-pagamento"',
    'router.put("/vendas/formas-pagamento/:id"',
    'router.delete("/vendas/formas-pagamento/:id"',
    'router.get("/vendas/cupons"',
    'router.post("/vendas/cupons"',
    'router.put("/vendas/cupons/:id"',
    'router.delete("/vendas/cupons/:id"',
    'router.get("/vendas/configuracoes"',
    'router.put("/vendas/configuracoes"',
    'router.get("/vendas/comissoes"',
    'router.post("/vendas/comissoes/:id/pagar"',
    'router.get("/vendas"',
    'router.get("/vendas/:id"',
    'router.post("/vendas"',
    'router.put("/vendas/:id"',
    'router.post("/vendas/:id/status"',
    'router.delete("/vendas/:id"'
  ], "contrato de rotas comerciais");

  expectAll(command, [
    'router.get("/vendas/command-center"',
    'router.get("/vendas/metas"',
    'router.put("/vendas/metas"',
    'router.delete("/vendas/metas"',
    'router.use(["/vendas/command-center", "/vendas/metas"], prepareCommandCenter)'
  ], "contrato do Command Center");
  assert.ok(!command.includes('router.use("/vendas",'), "tabela auxiliar de metas não pode interceptar o módulo /vendas inteiro");

  expectAll(preflight, [
    'codigo: "black30"', 'preco: 99.99',
    'codigo: "black180"', 'preco: 249.99',
    'codigo: "black360"', 'preco: 397.00',
    "bestfy_transactions",
    '"Checkout Bestfy"'
  ], "reconciliação comercial");

  expectAll(security, [
    'status: "pendente"',
    "Vendas da Bestfy são somente leitura",
    "controlado pela Bestfy",
    "Transações sincronizadas da Bestfy não podem ser apagadas",
    "Venda confirmada não pode ser apagada",
    "Boolean(user.suspenso)",
    "bestfyTransactionId",
    "manualSaleId"
  ], "regras de segurança comercial");
}

function testFrontendContracts() {
  const html = read("public/painel-vendas.html");
  const app = read("public/painel-vendas.js");
  const command = read("public/painel-vendas-command-v5.js");
  const polish = read("public/painel-vendas-polish-v53.js");
  const icons = read("public/assets/sales-command-icons.svg");
  const server = read("server.js");

  expectAll(html, [
    'id="salesNav"', 'id="view-dashboard"', 'id="view-sales"', 'id="view-clients"',
    'id="view-sellers"', 'id="view-commissions"', 'id="view-reports"', 'id="view-dev"',
    'id="saleForm"', 'id="productForm"', 'id="paymentForm"', 'id="couponForm"',
    'id="salesChart"', 'id="allSalesBody"', 'id="clientsBody"', 'id="sellersGrid"', 'id="commissionsBody"'
  ], "estrutura HTML do painel");

  expectAll(app, [
    'api("/vendas/painel/contexto")',
    'api(`/vendas/dashboard?dias=${state.days}`)',
    'api(`/vendas?${query}`)',
    'api(`/vendas/clientes?busca=${search}`)',
    'api("/vendas/vendedores")',
    'api("/vendas/comissoes")',
    'api("/vendas/produtos")',
    'api("/vendas/formas-pagamento")',
    'api("/vendas/cupons")',
    'api("/vendas/configuracoes")',
    'api(`/vendas/${id}/status`',
    'api(`/vendas/${id}`',
    'addEventListener("submit", submitSale)',
    'addEventListener("submit", submitProduct)',
    'addEventListener("submit", submitPayment)',
    'addEventListener("submit", submitCoupon)'
  ], "integrações do frontend principal");

  expectAll(command, [
    'api(`/vendas/command-center?',
    'api(`/vendas/metas?',
    'api("/vendas/metas"',
    'id="view-goals"', 'id="view-funnel"', 'id="view-products"', 'id="view-finance"'
  ], "integrações do frontend Command Center");

  expectAll(polish, [
    'fetch("/api/status"',
    'fetch("/vendas/status"',
    'i-download', 'i-edit', 'i-trash', 'i-logout'
  ], "acabamento e health UX");

  expectAll(icons, [
    'id="i-dashboard"', 'id="i-sales"', 'id="i-clients"', 'id="i-sellers"',
    'id="i-commission"', 'id="i-goal"', 'id="i-funnel"', 'id="i-products"',
    'id="i-finance"', 'id="i-report"', 'id="i-dev"', 'id="i-download"',
    'id="i-edit"', 'id="i-trash"', 'id="i-database"', 'id="i-server"'
  ], "sprite SVG comercial");

  expectAll(server, [
    '"painel-vendas-command-v5.css", "painel-vendas-polish-v53.css"',
    '"painel-vendas.js", "painel-vendas-command-v5.js", "painel-vendas-polish-v53.js"',
    'versao: "5.3.0"'
  ], "bundle de produção do painel");
}

function run() {
  testRouterOrder();
  testBackendContracts();
  testFrontendContracts();
  console.log("Sales Command Center regression suite: OK");
}

run();
