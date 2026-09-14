"use strict";
const express=require("express"),{auth}=require("../middleware/auth"),{sensitiveWriteRateLimit}=require("../middleware/rate-limit"),service=require("../services/notes"),pdf=require("../services/notes-pdf");const router=express.Router(),account=req=>String(req.usuario?.id||req.usuario?._id||"");
router.use(auth,(req,res,next)=>{res.set("Cache-Control","private, no-store");next();});
function fail(res,e){if(!e.status)console.error("Falha nas anotações:",e.code||e.message);return res.status(e.status||503).json({erro:e.status?e.message:"Não foi possível salvar na conta. Tente novamente.",...(e.nota?{nota:e.nota}:{})});}
function owner(req,res,next){if(req.get("X-Notes-Account")!==account(req))return res.status(401).json({erro:"A conta mudou. Entre novamente antes de salvar ou compartilhar."});next();}
router.get("/",async(req,res)=>{try{res.json({sucesso:true,notas:await service.list(account(req))});}catch(e){fail(res,e);}});
router.put("/:id",owner,sensitiveWriteRateLimit,async(req,res)=>{if(!req.is("application/json"))return res.status(415).json({erro:"Formato inválido."});try{res.json({sucesso:true,nota:await service.save(account(req),req.params.id,req.body)});}catch(e){fail(res,e);}});
router.delete("/:id",owner,sensitiveWriteRateLimit,async(req,res)=>{try{await service.remove(account(req),req.params.id,Number(req.query.revision));res.json({sucesso:true});}catch(e){fail(res,e);}});
router.get("/:id.pdf",owner,async(req,res)=>{try{const n=await service.get(account(req),req.params.id);if(n.excluida)return res.status(400).json({erro:"Restaure a nota antes de exportar."});const doc=pdf.create(n,String(req.usuarioDoc?.nome||req.usuario?.nome||"Aluno"));res.set({"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="minha-nota-${n.id.slice(0,8)}.pdf"`});doc.on("error",()=>res.destroy());doc.pipe(res);doc.end();}catch(e){if(!res.headersSent)fail(res,e);else res.destroy();}});
module.exports=router;
