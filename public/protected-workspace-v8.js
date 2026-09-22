"use strict";
(() => {
  if (window.__TURMA_PROTECTED_WORKSPACE_V8__) return;
  window.__TURMA_PROTECTED_WORKSPACE_V8__ = true;
  const TOKEN_KEYS=["token","adminToken","authToken","accessToken","jwt"];
  const $$=selector=>Array.from(document.querySelectorAll(selector));
  function token(){for(const storage of[sessionStorage,localStorage])for(const key of TOKEN_KEYS){try{const value=storage.getItem(key);if(value)return value}catch(_){}}return""}
  function clear(){for(const storage of[sessionStorage,localStorage])for(const key of TOKEN_KEYS)try{storage.removeItem(key)}catch(_){}}
  function role(user){return String(user?.cargo||user?.tipo||"aluno").trim().toLowerCase().replaceAll("_","-")}
  function allowed(user,required){if(!required||required==="dashboard")return user?.acessoPremium===true||["dev","dono","superadmin","admin","financeiro","moderador","suporte","vendedor"].includes(role(user));const p=user?.permissoes||user?.acessosRapidos||{};return Boolean(p[required])}
  function fill(user){const full=String(user?.nome||"Aluno"),first=full.trim().split(/\s+/)[0]||"Aluno",initial=first.charAt(0).toUpperCase();$$('[data-workspace-name],[data-user-name]').forEach(el=>el.textContent=first);$$('[data-user-fullname]').forEach(el=>el.textContent=full);$$('[data-workspace-avatar]').forEach(el=>{el.textContent=user?.foto?"":initial;el.style.backgroundImage=user?.foto?`url("${String(user.foto).replaceAll('"','%22')}")`:""});}
  async function start(){const jwt=token();if(!jwt){location.replace("/");return}document.body?.classList.add("protected-booting");try{const response=await fetch("/me",{headers:{Accept:"application/json",Authorization:`Bearer ${jwt}`},cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok||!data.usuario)throw new Error("Sessão inválida");if(!allowed(data.usuario,document.body?.dataset.requiredAccess||"dashboard")){location.replace(data.usuario?.acessoPremium===true?"/dashboard":"/dashboard-free?motivo=premium");return}fill(data.usuario);document.body?.classList.remove("protected-booting");document.body?.classList.add("protected-ready");document.dispatchEvent(new CustomEvent("turma:protected-ready",{detail:{user:data.usuario}}));const loader=document.querySelector("[data-workspace-loading]");if(loader){loader.style.opacity="0";loader.style.pointerEvents="none";setTimeout(()=>loader.remove(),180)}}catch(_){clear();location.replace("/")}}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();
