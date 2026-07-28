"use strict";
const liberarDashboard=()=>setTimeout(()=>document.body?.classList.add("neo-ready"),80);
import("./dashboard-neo/app.js?v=20260728-neo-3")
  .then(()=>document.readyState==="loading"?document.addEventListener("DOMContentLoaded",liberarDashboard,{once:true}):liberarDashboard())
  .catch((error)=>{
    console.error("Falha ao iniciar o dashboard:",error);
    document.body?.classList.add("neo-ready");
    const loading=document.getElementById("dashLoading");
    if(loading)loading.innerHTML="<div><strong>Não foi possível abrir o painel</strong><span>Atualize a página e tente novamente.</span></div>";
  });
