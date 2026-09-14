"use strict";
const fs=require("node:fs"),path=require("node:path"),{gunzipSync}=require("node:zlib");
const fonts=Object.fromEntries(["regular","bold"].map(w=>[w,gunzipSync(Buffer.from(fs.readFileSync(path.join(__dirname,"pdf-assets",`liberation-sans-${w}.gz.base64`),"utf8"),"base64"))]));
module.exports=doc=>{doc.registerFont("Primo",fonts.regular);doc.registerFont("PrimoBold",fonts.bold);return doc;};
