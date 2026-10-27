"use strict";
const assert = require("node:assert/strict");
const database = require("../config/database");
const Evolution = require("../services/student-evolution");
const Bankroll = require("../public/bankroll-model");
const router = require("../routes/student-evolution");

function endpoint(path) {
  const item = router.stack.find(layer => layer.route?.path === path && layer.route.methods?.post || layer.route?.path === path && layer.route.methods?.put);
  assert.ok(item, "Rota inexistente: " + path);
  return item.route.stack.at(-1).handle;
}
function res() {
  return {
    code: 200, value: null,
    status(code) { this.code = code; return this; },
    json(body) { this.value = body; return this; }
  };
}
const id = "d" + "c".repeat(23);
const account = { id, _id: id, nome: "Aluno Integração", email: "integration-student@tests.invalid", cargo: "aluno", plano: "black30", aprovado: true };
async function invoke(path, body) {
  const output = res();
  await endpoint(path)({ usuario: account, usuarioDoc: account, body }, output);
  return output;
}
async function checkBankrollNumbers() {
  let state = Bankroll.normalizeState({ initial: 1000, entries: [] });
  for (const amount of [1000, 500, 190]) {
    state = Bankroll.addEntry(state, { type: "profit", amount, date: "2026-10-27" });
  }
  assert.equal(Bankroll.summarize(state).current, 2690);
  assert.equal(Bankroll.summarize(state).accumulated, 1690);
  state = Bankroll.addEntry(state, { type: "loss", amount: 100, date: "2026-10-27" });
  assert.equal(Bankroll.summarize(state).current, 2590);
  assert.equal(Bankroll.summarize(state).accumulated, 1590);
}
async function checkBankrollOptimisticConcurrency() {
  const base = Evolution.sanitizeBankrollState({ initial: 1000, current: 1000 });
  let initial = await invoke("/student/gestao", { state: base, revision: 0 });
  assert.equal(initial.code, 200, "Primeira configuração deve funcionar: " + JSON.stringify(initial.value));
  assert.equal(initial.value.revision, 1);
  const revision = initial.value.revision;
  const [a,b] = await Promise.all([
    invoke("/student/gestao", { state: { ...base, current: 2000 }, revision }),
    invoke("/student/gestao", { state: { ...base, current: 1500 }, revision })
  ]);
  const codes = [a.code,b.code].sort();
  assert.deepEqual(codes,[200,409], "Somente uma atualização concorrente pode vencer: " + JSON.stringify([a.value,b.value]));
  const rows=await database.query("SELECT state,revision FROM student_bankroll_state WHERE user_id=?", [id]);
  assert.equal(Number(rows[0].revision),2, "Revisão deve avançar somente uma vez");
}
async function checkExamAtomicConcurrency() {
  const type = Evolution.examTypeForDate();
  const config = Evolution.examConfig(type);
  assert.equal(config.available, true);
  const create = () => invoke("/student/provas/iniciar", { type });
  for (let n=0;n<config.attempts-1;n++) {
    const initial = await create();
    assert.equal(initial.code,201, "Prova inicial não foi criada: "+JSON.stringify(initial.value));
  }
  const [a,b] = await Promise.all([create(),create()]);
  assert.deepEqual([a.code,b.code].sort(),[201,403],"Última tentativa aceita duas requisições: "+JSON.stringify([a.value,b.value]));
  const rows=await database.query(
    "SELECT COUNT(*) AS total FROM student_exam_attempts WHERE user_id=? AND exam_type=? AND exam_date=?",
    [id,type,config.date]);
  assert.equal(Number(rows[0].total),config.attempts);
  const accepted = a.code===201?a:b;
  const attemptId=accepted.value.exam.id;
  const [f1,f2]=await Promise.all([
    invoke("/student/provas/finalizar",{attemptId,answers:[]}),
    invoke("/student/provas/finalizar",{attemptId,answers:[]})
  ]);
  assert.deepEqual([f1.code,f2.code].sort(),[200,409],"Finalização concorrente deve persistir só uma nota: "+JSON.stringify([f1.value,f2.value]));
  const events=await database.query("SELECT COUNT(*) AS total FROM student_activity WHERE user_id=? AND type='exam_finished' AND metadata LIKE ?",[id,'%'+attemptId+'%']);
  assert.equal(Number(events[0].total),1,"Histórico não pode registrar resultado duas vezes");
}
async function main(){
  await database();
  try {
    await database.query("INSERT INTO usuarios (id,nome,email,senha,tipo,cargo,plano,aprovado,status) VALUES (?,?,?,'integration-test-hash','aluno','aluno','black30',1,'ativo')",[id,account.nome,account.email]);
    let failures=0;
    for (const [name,check] of [
      ["bankroll-money-math",checkBankrollNumbers],
      ["bankroll-concurrent-CAS",checkBankrollOptimisticConcurrency],
      ["exam-concurrent-last-attempt-and-finalization",checkExamAtomicConcurrency]
    ]) {
      try {await check();console.log("PASS",name);}
      catch(error){failures++; console.error("FAIL",name,error.message);}
    }
    if(failures)process.exitCode=1;
  } finally {await database.close();}
}
main().catch(error=>{console.error("MYSQL INTEGRATION SETUP FAILED",error.stack||error);process.exitCode=1;});
