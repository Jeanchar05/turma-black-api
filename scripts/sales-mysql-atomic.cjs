"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const database = require("../config/database");
const { ensureSalesStructure } = require("../services/bestfy-sales-ledger");
const router = require("../routes/vendas-security-overrides");

const id=crypto.randomBytes(12).toString("hex");
const saleId=crypto.randomBytes(12).toString("hex");
const trigger="turma_test_block_entitlement";
const account = { _id:id,id,email:"test-"+id+"@tests.invalid",cargo:"admin",nome:"Test Admin" };

function response(){
  return { code:200, data:null, status(n){this.code=n;return this;}, json(x){this.data=x;return this;} };
}
async function setStatus(status){
  const out=response();
  const layer=router.stack.find(x=>x.route?.path==="/vendas/:id/status" && x.route?.methods?.post);
  assert.ok(layer,"Rota de alteração de venda deve existir");
  await layer.route.stack.at(-1).handle({
    params:{id:saleId},body:{status},usuario:account,usuarioDoc:account
  },out);
  return out;
}
async function state(){
  const sales=await database.query("SELECT status FROM vendas WHERE id=?",[saleId]);
  const users=await database.query("SELECT plano,data_expiracao,extras FROM usuarios WHERE id=?",[id]);
  return {sale:sales[0],user:users[0]};
}
async function main(){
  await database();
  try{
    await ensureSalesStructure();
    await database.query("INSERT INTO usuarios (id,nome,email,senha,cargo,tipo,plano,aprovado,status) VALUES (?, ?, ?,'nonlogin-test','aluno','aluno','free',1,'ativo')",[id,"Cliente Teste",account.email]);
    await database.query("INSERT INTO vendas (id,cliente_id,cliente_email,produto_codigo,status,data_venda) VALUES (?,?,?,?,?,CURRENT_DATE())",[saleId,id,account.email,"black30","pendente"]);

    await database.getPool().query("CREATE TRIGGER "+trigger+" BEFORE UPDATE ON usuarios FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'simulated entitlement failure'");
    let result;
    try { result=await setStatus("pago"); }
    finally { await database.getPool().query("DROP TRIGGER IF EXISTS "+trigger); }
    const afterFailedGrant=await state();
    assert.equal(result.code,500,"Falha de concessão deve ser reportada ao cliente");
    assert.equal(afterFailedGrant.sale.status,"pendente","Venda deve fazer rollback se falhar concessão do acesso");

    const successful=await setStatus("pago");
    assert.equal(successful.code,200, "Pagamento válido precisa ser confirmado: "+JSON.stringify(successful.data));
    const granted=await state();
    assert.equal(granted.sale.status,"pago");
    assert.equal(granted.user.plano,"black30");
    assert.equal(JSON.parse(granted.user.extras||"{}").manualSaleId,saleId);

    const repeated=await setStatus("pago");
    assert.equal(repeated.code,200);
    const afterRepeat=await state();
    assert.equal(afterRepeat.user.data_expiracao,granted.user.data_expiracao,"Repetição não pode estender o plano");

    const refunded=await setStatus("estornado");
    assert.equal(refunded.code,200);
    const afterRefund=await state();
    assert.equal(afterRefund.sale.status,"estornado");
    assert.equal(afterRefund.user.plano,"free");
    console.log("PASS sale-and-entitlement-atomic-rollback, idempotency and reversal");
  } finally {
    await database.getPool().query("DROP TRIGGER IF EXISTS "+trigger).catch(()=>{});
    await database.close();
  }
}
main().catch(e=>{console.error("FAIL sale-and-entitlement-atomic-rollback",e.stack||e);process.exitCode=1;});
