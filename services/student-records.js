"use strict";
const db = require('../config/database');
const {withTransaction} = require('./db-transaction');
let ready;
const error = (message,status=400)=>Object.assign(new Error(message),{status});
async function ensure(){
 if(!ready) ready=(async()=>{
  await db.query(`CREATE TABLE IF NOT EXISTS student_records (usuario_id CHAR(24) NOT NULL, area VARCHAR(30) NOT NULL, documento MEDIUMTEXT NOT NULL, revisao INT UNSIGNED NOT NULL DEFAULT 0, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY(usuario_id,area)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS student_activity (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,usuario_id CHAR(24) NOT NULL,event VARCHAR(300) NOT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY idx_student_activity(usuario_id,id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 })().catch(e=>{ready=null;throw e});return ready;
}
async function get(user,area,fallback){await ensure();const r=await db.query('SELECT documento,revisao FROM student_records WHERE usuario_id=? AND area=?',[user,area]);return r[0]?{data:JSON.parse(r[0].documento),revision:Number(r[0].revisao)}:{data:fallback,revision:0};}
async function change(user,area,fallback,revision,mutate){
 if(!Number.isSafeInteger(revision)||revision<0)throw error('Versão inválida. Atualize a página.');await ensure();
 return withTransaction(async tx=>{
 await tx.query('INSERT IGNORE INTO student_records (usuario_id,area,documento,revisao) VALUES (?,?,?,0)',[user,area,JSON.stringify(fallback)]);
 const [row]=await tx.query('SELECT documento,revisao FROM student_records WHERE usuario_id=? AND area=? FOR UPDATE',[user,area]);
 if(Number(row.revisao)!==revision)throw error('Os dados mudaram em outro dispositivo. Atualize antes de salvar; sua edição continua aberta.',409);
 const data=await mutate(JSON.parse(row.documento));
 await tx.query('UPDATE student_records SET documento=?,revisao=revisao+1 WHERE usuario_id=? AND area=?',[JSON.stringify(data),user,area]);return {data,revision:revision+1};
 });
}
function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')||!Number.isFinite(Date.parse(value))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw error('Data inválida.');return value;}
function cents(v,{signed=false}={}){if(!Number.isSafeInteger(v)||Math.abs(v)>100000000||(!signed&&v<0))throw error('Informe um valor válido, com até duas casas decimais.');return v;}
function ledgerOperation(state,b){
 if(b.action==='settings'){state.initial=cents(b.initial);state.limit=cents(b.limit||0);}
 else if(b.action==='entry'){
 const day=date(b.date);const item={date:day,result:cents(b.result,{signed:true}),deposit:cents(b.deposit||0),withdrawal:cents(b.withdrawal||0),note:String(b.note||'').trim().slice(0,2000)};
 state.entries=state.entries.filter(e=>e.date!==day);state.entries.push(item);state.entries.sort((a,b)=>a.date.localeCompare(b.date));if(state.entries.length>7300)throw error('Limite de registros atingido.');
 }else if(b.action==='remove')state.entries=state.entries.filter(e=>e.date!==date(b.date));else throw error('Operação inválida.');return state;
}
const emptyLedger=()=>({initial:0,limit:0,entries:[]});
module.exports={ensure,get,change,error,date,cents,ledgerOperation,emptyLedger};
