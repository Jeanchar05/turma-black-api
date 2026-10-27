"use strict";
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const crypto = require("node:crypto");
const path = require("node:path");
const database = require("../config/database");
const { hashPassword } = require("../services/passwords");

const suffix = crypto.randomBytes(4).toString("hex");
const pass = "Test-Only-Password-2026!";
const fixture = (role, approved = true, status = "ativo") => ({
  id: crypto.randomBytes(12).toString("hex"),
  role, approved, status, email: role+"-"+suffix+"@tests.invalid",
  name: "Teste "+role
});
const a = fixture("aluno");
const b = fixture("aluno-b");
const admin = fixture("admin");
const moderator = fixture("moderador");
const support = fixture("suporte");
const vendor = fixture("vendedor");
const owner = fixture("dono",true,"suspenso");
const superAdmin = fixture("superadmin",true,"suspenso");
const pending = fixture("pendente",false,"pendente");
const blocked = fixture("bloqueado",true,"bloqueado");

async function request(port, route, { method = "GET", token, body } = {}) {
  const response = await fetch("http://127.0.0.1:"+port+route, {
    method,
    headers: { Accept:"application/json", ...(token?{Authorization:"Bearer "+token}:{}), ...(body!==undefined?{"Content-Type":"application/json"}:{}) },
    body: body===undefined?undefined:JSON.stringify(body),
    redirect:"manual",
    signal:AbortSignal.timeout(6000)
  });
  return {status:response.status,body:await response.json().catch(()=>({}))};
}
async function waitReady(port, child) {
  for(let attempt=0;attempt<90;attempt++){
    if(child.exitCode!==null)throw Error("Servidor encerrou antes de ficar pronto");
    try { if((await request(port,"/health/ready")).status===200)return; } catch(_){}
    await delay(150);
  }
  throw Error("Servidor não atingiu readiness no tempo previsto");
}
async function main() {
  if(process.env.NODE_ENV!=="test")throw Error("Não execute contra produção");
  await database();
  let server;
  try {
    const hashed=await hashPassword(pass);
    for(const item of [a,b,admin,moderator,support,vendor,owner,superAdmin,pending,blocked]){
      const cargo = ["aluno-b","pendente","bloqueado"].includes(item.role)?"aluno":item.role;
      await database.query(
        "INSERT INTO usuarios (id,nome,email,senha,tipo,cargo,plano,aprovado,suspenso,status) VALUES (?,?,?,?,'aluno',?,'free',?,?,?)",
        [item.id,item.name,item.email,hashed,cargo,item.approved?1:0,item.status==="suspenso"||item.status==="bloqueado"?1:0,item.status]
      );
    }
    const port=47000+process.pid%1000;
    server=spawn(process.execPath,["server.js"],{
      cwd:path.resolve(__dirname,".."),stdio:"ignore",
      env:{...process.env,PORT:String(port),NODE_ENV:"test"}
    });
    await waitReady(port,server);
    const login=(email,password=pass)=>request(port,"/login",{method:"POST",body:{email,senha:password}});
    const wrong=await login(a.email,"wrong-password");
    assert.equal(wrong.status,401,"Senha errada deve retornar 401");
    const pendingLogin=await login(pending.email);
    assert.equal(pendingLogin.status,403,"Aluno pendente deve receber 403");
    const blockedLogin=await login(blocked.email);
    assert.equal(blockedLogin.status,403,"Aluno bloqueado deve receber 403");
    const la=await login(a.email);
    const lb=await login(b.email);
    const ladmin=await login(admin.email);
    const lmod=await login(moderator.email);
    const lsupport=await login(support.email);
    const lvendor=await login(vendor.email);
    for(const item of [la,lb,ladmin,lmod,lsupport,lvendor]){
      assert.equal(item.status,200,"Login autorizado deve funcionar: "+JSON.stringify(item.body));
      assert.ok(item.body.token,"Login deve fornecer sessão autenticada");
    }
    console.log("PASS login approved/blocked/pending/wrong and 6 real roles");
    const aToken=la.body.token;
    const deniedWrite=await request(port,"/usuario/"+b.id,{method:"PUT",token:aToken,body:{nome:"Ataque"}});
    assert.equal(deniedWrite.status,403,"Aluno A não pode alterar B pela rota administrativa");
    const deniedRead=await request(port,"/usuario/"+b.id,{token:aToken});
    assert.equal(deniedRead.status,403,"Aluno A não pode consultar B pela rota administrativa");
    const own=await request(port,"/dashboard-premium/perfil",{
      method:"PUT",token:aToken,
      body:{id:b.id,userId:b.id,email:b.email,nome:"Aluno A atualizado"}
    });
    assert.equal(own.status,200,"O próprio perfil deve continuar editável: "+JSON.stringify(own.body));
    const users=await database.query("SELECT id,nome FROM usuarios WHERE id IN (?,?)",[a.id,b.id]);
    assert.equal(users.find(x=>x.id===a.id).nome,"Aluno A atualizado");
    assert.equal(users.find(x=>x.id===b.id).nome,b.name,"Manipular userId não pode afetar B");
    const home=await request(port,"/dashboard-premium/home?userId="+b.id,{token:aToken});
    assert.equal(home.status,200,"Painel do próprio aluno deve abrir");
    assert.equal(home.body.usuario.id,a.id,"Query string não pode trocar a identidade");
    console.log("PASS HTTP IDOR A/B self profile vs admin routes and query/body manipulation");
    for(const actor of [lsupport,lvendor]){
      const no=await request(port,"/usuario/"+b.id,{token:actor.body.token});
      assert.equal(no.status,403,"Suporte/Vendedor não podem consultar diretório admin sem permissão");
    }
    const readAdmin=await request(port,"/usuario/"+b.id,{token:ladmin.body.token});
    assert.equal(readAdmin.status,200,"Admin autorizado deve consultar aluno");
    const updateAdmin=await request(port,"/usuario/"+b.id,{method:"PUT",token:ladmin.body.token,body:{nome:"Aluno B corrigido"}});
    assert.equal(updateAdmin.status,200,"Admin autorizado deve editar aluno comum");
    for(const target of [owner,superAdmin]){
      const no=await request(port,"/reativar",{method:"POST",token:lmod.body.token,body:{email:target.email}});
      assert.equal(no.status,403,"Moderador não pode reativar conta protegida: "+target.role);
    }
    console.log("PASS admin RBAC, protected owner/superadmin, support and seller denial");
    const logout=await request(port,"/logout",{method:"POST",token:aToken});
    assert.equal(logout.status,200);
    const reused=await request(port,"/me",{token:aToken});
    assert.equal(reused.status,401,"Token revogado no logout não pode ser reutilizado");
    console.log("PASS logout session revocation");
  } finally {
    if(server)server.kill("SIGTERM");
    await database.close();
  }
}
main().catch(error=>{console.error("FAIL HTTP AUTH/IDOR TEST",error.stack||error);process.exitCode=1;});
