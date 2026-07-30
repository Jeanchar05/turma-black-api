"use strict";
(() => {
  const KEYS=["token","adminToken","authToken","accessToken","jwt"];
  const getToken=()=>{for(const s of [sessionStorage,localStorage])for(const k of KEYS){try{const v=s.getItem(k);if(v)return v}catch(_){}}return""};
  const release=(user)=>{document.body?.classList.add("protected-ready");document.getElementById("examsLoading")?.remove();document.dispatchEvent(new CustomEvent("turma:exams-ready",{detail:{user}}));};
  const clear=()=>{for(const s of [sessionStorage,localStorage])for(const k of KEYS){try{s.removeItem(k)}catch(_){}}};
  async function start(){
    const token=getToken();
    if(!token){location.replace("/");return;}
    try{
      const r=await fetch(`${location.origin}/me`,{headers:{Accept:"application/json",Authorization:`Bearer ${token}`},cache:"no-store"});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!d?.usuario)throw new Error("Sessão inválida");
      release(d.usuario);
    }catch(_){clear();location.replace("/");}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();