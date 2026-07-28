"use strict";
const ROUTES={inicio:"/dashboard",notas:"/notas",minigames:"/minigames",estudo:"/estudo",modulos:"/modulos",suporte:"/suporte",perfil:"/perfil",roleta:"/roleta",provas:"/provas",favoritos:"/favoritos",atividades:"/atividades",notificacoes:"/notificacoes"};
const PATH_TARGET={"/":"inicio","/dashboard":"inicio","/dashboard.html":"inicio","/minigames":"minigames","/estudo":"estudo","/modulos":"modulos","/suporte":"suporte","/perfil":"perfil","/roleta":"roleta","/provas":"provas","/favoritos":"favoritos","/atividades":"atividades","/notificacoes":"notificacoes"};
function currentTarget(){return PATH_TARGET[location.pathname]||"inicio";}
function showCurrentSection(){
  const target=currentTarget();
  document.querySelectorAll(".dash-section").forEach(section=>section.classList.toggle("active",section.id===`section-${target}`));
  document.querySelectorAll("[data-nav]").forEach(item=>item.classList.toggle("active",item.dataset.nav===target));
  const section=document.getElementById(`section-${target}`)||document.getElementById("section-inicio");
  if(section)document.title=`${section.dataset.title||"Dashboard"} | Turma do Primo`;
  if(location.hash)history.replaceState(null,"",location.pathname+location.search);
  if(location.pathname.endsWith(".html"))history.replaceState(null,"",ROUTES[target]||"/dashboard");
}
document.addEventListener("click",event=>{
  const item=event.target.closest("[data-nav]");
  if(!item)return;
  const destination=ROUTES[item.dataset.nav];
  if(!destination)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(location.pathname!==destination)location.assign(destination);
  else showCurrentSection();
},true);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(showCurrentSection,120),{once:true});else setTimeout(showCurrentSection,120);
window.addEventListener("pageshow",()=>setTimeout(showCurrentSection,80));
