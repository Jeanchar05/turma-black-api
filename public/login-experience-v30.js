"use strict";
(() => {
  const loadStyle = (href, key, media = "") => {
    if (document.querySelector(`link[data-login-runtime="${key}"]`)) return;
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = href; link.dataset.loginRuntime = key;
    if (media) link.media = media;
    document.head.appendChild(link);
  };
  loadStyle("/login-polish-v31.css?v=20260908-desktop-v32", "polish");
  if (window.matchMedia?.("(min-width:981px)")?.matches) loadStyle("/login-desktop-v32.css?v=20260908-desktop-v32", "desktop", "screen and (min-width:981px)");
  loadStyle("/brand-index-v20.css?v=20260924-v20", "brand-v20");
  loadStyle("/admin-choice-v20.css?v=20260924-v20", "admin-choice-v20");

  const setEye = (button, visible) => {
    if (!button) return;
    button.innerHTML = visible
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 8a10.7 10.7 0 0 1-2.1 3.8M6.6 6.7C4.2 8.1 3 10.4 3 12c0 3 3.5 8 9 8 1.4 0 2.7-.3 3.8-.8"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7S18 19 12 19 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  };

  function installHero() {
    const product = document.querySelector(".login-v30-product");
    if (!product || product.dataset.v20Ready === "1") return;
    product.dataset.v20Ready = "1";
    product.innerHTML = `
      <div class="login-v20-hero-copy">
        <small>TURMA DO PRIMO · PREMIUM</small>
        <h3>Estratégia, prática<br><span>e evolução.</span></h3>
        <p>A mesma identidade premium da plataforma, agora desde o primeiro acesso.</p>
        <b>FOCO · DISCIPLINA · RESULTADOS</b>
      </div>
      <span class="login-v20-wheel" aria-hidden="true"></span>
      <img class="login-v20-portrait" src="/assets/hero-jean-transparent.webp?v=20260924-v20" alt="Turma do Primo" fetchpriority="high" />`;
  }

  function installParticles() {
    const canvas = document.getElementById("loginParticleCanvas");
    if (!canvas || window.matchMedia?.("(prefers-reduced-motion:reduce)")?.matches) return;
    const ctx = canvas.getContext("2d", { alpha:true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2); let w=0,h=0,pts=[];
    const resize=()=>{w=innerWidth;h=innerHeight;canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+"px";canvas.style.height=h+"px";ctx.setTransform(dpr,0,0,dpr,0,0);pts=Array.from({length:Math.max(20,Math.min(54,Math.round(w*h/36000)))},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.13,vy:(Math.random()-.5)*.13,r:Math.random()+.35,a:Math.random()*.34+.08}));};
    const draw=()=>{ctx.clearRect(0,0,w,h);for(const p of pts){p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=w;if(p.x>w)p.x=0;if(p.y<0)p.y=h;if(p.y>h)p.y=0;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(205,139,255,${p.a})`;ctx.fill();}requestAnimationFrame(draw);};
    resize();draw();addEventListener("resize",resize,{passive:true});
  }

  function init() {
    installHero(); installParticles();
    document.querySelectorAll(".toggle-password").forEach((button)=>{
      setEye(button,false);
      button.addEventListener("click",()=>setTimeout(()=>setEye(button,document.getElementById(button.dataset.target)?.type==="text"),0));
    });
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once:true }) : init();
})();