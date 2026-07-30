"use strict";
(() => {
  const KEYS=["token","adminToken","authToken","accessToken","jwt"];
  function forceVisible(){if(!document.body)return;document.body.style.setProperty("opacity","1","important");document.body.style.setProperty("visibility","visible","important");const loader=document.getElementById("studyLoading");if(loader&&!document.body.classList.contains("protected-ready")){loader.style.setProperty("display","flex","important");loader.style.setProperty("opacity","1","important");loader.style.setProperty("visibility","visible","important")}}
  function getToken(){for(const storage of [sessionStorage,localStorage])for(const key of KEYS){try{const value=storage.getItem(key);if(value)return value}catch(_){}}return""}
  function clearSession(){for(const storage of [sessionStorage,localStorage])for(const key of KEYS){try{storage.removeItem(key)}catch(_){}}}
  function release(user){forceVisible();document.body.classList.add("protected-ready");document.getElementById("studyLoading")?.remove();document.dispatchEvent(new CustomEvent("turma:study-ready",{detail:{user}}))}
  async function start(){forceVisible();const token=getToken();if(!token){location.replace("/");return}try{const response=await fetch(`${location.origin}/me`,{headers:{Accept:"application/json",Authorization:`Bearer ${token}`},cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok||!data?.usuario)throw new Error("Sessão inválida");release(data.usuario)}catch(_){clearSession();location.replace("/")}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();