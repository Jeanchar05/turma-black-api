"use strict";
(() => {
  const KEYS=["token","adminToken","authToken","accessToken","jwt"];
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const state={home:null,theme:"dark"};
  const getToken=()=>{for(const s of [sessionStorage,localStorage])for(const k of KEYS){try{const v=s.getItem(k);if(v)return v}catch(_){}}return""};
  async function api(path,opts={}){const token=getToken();const r=await fetch(`${location.origin}${path}`,{method:opts.method||"GET",headers:{Accept:"application/json",Authorization:`Bearer ${token}`,...(opts.body?{"Content-Type":"application/json"}:{})},body:opts.body?JSON.stringify(opts.body):undefined,cache:"no-store"});const d=await r.json().catch(()=>({}));if(!r.ok||d.erro)throw new Error(d.erro||d.mensagem||`Erro ${r.status}`);return d}
  const first=(n)=>String(n||"Primo").trim().split(/\s+/)[0]||"Primo";
  const role=(v)=>({dev:"Equipe",dono:"Equipe",superadmin:"Equipe",admin:"Equipe",suporte:"Suporte",moderador:"Moderador",vendedor:"Vendedor",aluno:"Aluno"}[String(v||"").toLowerCase()]||"Aluno");
  function ensureSidebarSync(){if(document.querySelector('link[data-exam-sidebar-sync]'))return;const link=document.createElement("link");link.rel="stylesheet";link.href=`/provas-sidebar-sync.css?v=20260730-sidebar-1&t=${Date.now()}`;link.dataset.examSidebarSync="1";document.head.appendChild(link)}
  function toast(msg){const stack=$("#examToastStack");if(!stack)return;const el=document.createElement("div");el.className="exam-toast";el.textContent=msg;stack.appendChild(el);requestAnimationFrame(()=>el.classList.add("show"));setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),220)},3200)}
  function setAvatar(user){const photo=String(user?.foto||"").trim()||"/assets/default-profile-user.svg";$$('[data-exam-avatar]').forEach(el=>{el.textContent="";el.style.backgroundImage=`url("${photo.replaceAll('"','%22')}")`;el.style.backgroundSize="cover";el.style.backgroundPosition="center"})}
  function applyTheme(value){state.theme=value||"dark";const resolved=state.theme==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):(state.theme==="light"?"light":"dark");document.documentElement.dataset.theme=resolved;const use=$("#examThemeToggle use");if(use)use.setAttribute("href",`assets/dashboard-icons.svg#${resolved==="dark"?"i-moon":"i-sun"}`)}
  async function toggleTheme(){const next=(document.documentElement.dataset.theme||"dark")==="dark"?"light":"dark";applyTheme(next);try{await api("/dashboard-premium/preferencias",{method:"PUT",body:{tema:next}})}catch(_){}}
  function fill(){const home=state.home||{},user=home.usuario||{},plan=home.plano||{};$$('[data-exam-name]').forEach(el=>el.textContent=first(user.nome));$$('[data-exam-role]').forEach(el=>el.textContent=role(user.cargo||user.tipo));setAvatar(user);$("#examPlanName")&&( $("#examPlanName").textContent=plan.nome||"Plano Premium");$("#examPlanLabel")&&( $("#examPlanLabel").textContent=plan.rotulo||"Acesso completo");const unread=Number(home.notificacoesNaoLidas||0),badge=$("#examNotificationBadge");if(badge){badge.hidden=unread<=0;badge.textContent=String(unread)}}
  function openSidebar(){$("#examSidebar")?.classList.add("open");const o=$("#examMobileOverlay");if(o)o.hidden=false;document.body.style.overflow="hidden"}
  function closeSidebar(){$("#examSidebar")?.classList.remove("open");const o=$("#examMobileOverlay");if(o)o.hidden=true;document.body.style.removeProperty("overflow")}
  function register(){
    $("#examMenuToggle")?.addEventListener("click",openSidebar);$("#examMobileOverlay")?.addEventListener("click",closeSidebar);$("#examThemeToggle")?.addEventListener("click",toggleTheme);
    $$("#examSidebar a").forEach(a=>a.addEventListener("click",closeSidebar));
    $$('[data-exam-locked]').forEach(btn=>btn.addEventListener("click",()=>toast("Esta prova está em preparação. Ela será liberada após a integração com os módulos e a IA.")));
    $("#examHistoryBtn")?.addEventListener("click",()=>toast("O histórico será ativado junto com a nova geração de provas."));
    $("#examSearch")?.addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();$$('[data-exam-card]').forEach(card=>{card.hidden=!!q&&!card.dataset.examCard.includes(q)})});
    $("#examLogout")?.addEventListener("click",()=>{for(const s of [sessionStorage,localStorage])for(const k of KEYS){try{s.removeItem(k)}catch(_){}}location.replace("/")});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSidebar()});
  }
  async function init(){ensureSidebarSync();register();try{state.home=await api("/dashboard-premium/home");applyTheme(state.home?.preferencias?.tema||"dark");fill()}catch(_){applyTheme("dark")}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
