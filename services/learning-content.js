"use strict";
const database = require("../config/database");
const {withTransaction} = require("./db-transaction");
const C = require("../public/study-curriculum");
const Media = require("../public/study-media");
let structure;
const error = (message,status=400) => Object.assign(new Error(message),{status});
function validId(id) { return C.modules.some(m=>m.id===id) || /^ig-[a-f0-9-]{36}$/.test(id); }
async function ensureStructure() {
  if (!structure) structure = database.query(`CREATE TABLE IF NOT EXISTS aulas_conteudo (
    id VARCHAR(64) NOT NULL PRIMARY KEY, documento LONGTEXT NOT NULL,
    revisao INT UNSIGNED NOT NULL DEFAULT 0, updated_by CHAR(24) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).catch(e=>{structure=null;throw e;});
  return structure;
}
function validate(id, body) {
  if (!validId(id)) throw error("Conteúdo inválido.");
  const type = id.startsWith("ig-") ? "instagram" : "module";
  if (!body || !Number.isInteger(body.revision) || body.revision < 0 || typeof body.published !== "boolean") throw error("Versão ou publicação inválida.");
  for (const [key,max] of [["title",120],["description",600],["url",2000],["summary",16000],["duration",30]])
    if (typeof body[key] !== "string" || body[key].length > max) throw error(`Campo ${key} inválido.`);
  if (type === "instagram" && !body.title.trim()) throw error("Dê um título ao vídeo.");
  const media = Media.parse(body.url.trim(),type);
  if ((body.url.trim() || body.published) && !media) throw error(type === "instagram" ? "Use o link de uma publicação ou Reel público do Instagram." : "Use um link do YouTube ou de um arquivo HTTPS .mp4 ou .webm.");
  const moduleId = type === "module" ? id : body.moduleId || "";
  if (moduleId && !C.modules.some(m=>m.id===moduleId)) throw error("Módulo relacionado inválido.");
  return {id,type,title:body.title.trim(),description:body.description.trim(),url:media?.url || "",summary:body.summary.trim(),duration:body.duration.trim(),published:body.published,moduleId};
}
async function list(manage=false) {
  await ensureStructure();
  const rows=await database.query("SELECT id, documento, revisao, updated_at FROM aulas_conteudo ORDER BY updated_at DESC");
  const stored=rows.map(r=>({...JSON.parse(r.documento),revision:Number(r.revisao),updatedAt:r.updated_at}));
  const modules=C.modules.map(m=>{
    const content=stored.find(v=>v.id===m.id);
    return {id:m.id,type:"module",title:m.name,description:m.summary,route:m.route,art:m.art,url:"",summary:"",duration:"",published:false,revision:0,...(content && (manage || content.published) ? content : {})};
  });
  return {modules,instagram:stored.filter(v=>v.type==="instagram" && (manage || v.published))};
}
async function save(id, body, userId) {
  const content = validate(id,body);
  await ensureStructure();
  return withTransaction(async tx=>{
    // A row is inserted before locking so two first-time publishers serialize too.
    await tx.query("INSERT IGNORE INTO aulas_conteudo (id, documento, revisao, updated_by) VALUES (?, ?, 0, ?)",[id,JSON.stringify({...content,published:false}),userId]);
    const rows=await tx.query("SELECT revisao FROM aulas_conteudo WHERE id = ? FOR UPDATE",[id]);
    if (Number(rows[0].revisao)!==body.revision) throw error("Outra pessoa atualizou este conteúdo. Reabra o editor para carregar a versão atual.",409);
    await tx.query("UPDATE aulas_conteudo SET documento = ?, revisao = revisao + 1, updated_by = ? WHERE id = ?",[JSON.stringify(content),userId,id]);
    return {...content,revision:body.revision+1};
  });
}
module.exports={list,save,validate,validId,ensureStructure};
