"use strict";
(()=>{
  if(window.__TURMA_NOTIFICATIONS_FINAL__)return;window.__TURMA_NOTIFICATIONS_FINAL__=true;
  const $=(s,r=document)=>r.querySelector(s);
  const token=()=>{for(const storage of[sessionStorage,localStorage])for(const key of["token","adminToken","authToken","accessToken","jwt"]){try{const value=storage.getItem(key);if(value)return value}catch{}}return""};
  const iconFor=type=>({geral:"i-bell",atualizacao:"i-activity",manutencao:"i-support",premium:"i-crown",seguranca:"i-exam",venda:"i-star",plano:"i-layers",agenda:"i-clock",prova:"i-exam",suporte:"i-support"}[type]||"i-bell");
  let items=[];
  function render(){const list=$("#notificationList"),badge=$("#notificationBadge");if(!list)return;const unread=items.filter(n=>!n.lida).length;if(badge){badge.textContent=String(unread);badge.hidden=!unread}list.innerHTML=items.length?items.map(n=>`<article class="dash-notification-item ${n.lida?"":"unread"}" data-notification-id="${n.id}" data-link="${n.link||""}"><span><svg><use href="/assets/dashboard-icons.svg#${iconFor(n.tipo)}"></use></svg></span><div><strong>${String(n.titulo||"Notificação")}</strong><small>${String(n.mensagem||"")}</small></div></article>`).join(""):`<div class="dash-notification-empty">Nenhuma notificação no momento.</div>`}
  async function load(){const t=token();if(!t)return;const c=new AbortController(),timer=setTimeout(()=>c.abort(),4500);try{const r=await fetch("/minhas-notificacoes",{headers:{Authorization:`Bearer ${t}`,Accept:"application/json"},cache:"no-store",signal:c.signal}),d=await r.json().catch(()=>({}));if(r.ok&&Array.isArray(d.notificacoes)){items=d.notificacoes;render()}}catch{}finally{clearTimeout(timer)}}
  async function mark(id){const t=token();if(!t)return;try{await fetch(`/notificacoes/${encodeURIComponent(id)}/lida`,{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"}});const item=items.find(n=>n.id===id);if(item)item.lida=true;render()}catch{}}
  async function markAll(){const t=token();if(!t)return;try{await fetch("/notificacoes/marcar-todas-lidas",{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"}});items.forEach(n=>n.lida=true);render()}catch{}}
  function bind(){$("#markNotificationsRead")?.addEventListener("click",e=>{e.preventDefault();markAll()});$("#notificationList")?.addEventListener("click",e=>{const card=e.target.closest("[data-notification-id]");if(!card)return;mark(card.dataset.notificationId);if(card.dataset.link)location.href=card.dataset.link})}
  function init(){bind();load();setInterval(load,60000)}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();