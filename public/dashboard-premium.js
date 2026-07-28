"use strict";
import("./dashboard-neo/app.js?v=20260728-neo-2").catch((error)=>{
  console.error("Falha ao iniciar o dashboard:",error);
  const loading=document.getElementById("dashLoading");
  if(loading)loading.innerHTML="<div><strong>Não foi possível abrir o painel</strong><span>Atualize a página e tente novamente.</span></div>";
});
