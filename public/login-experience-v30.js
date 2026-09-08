"use strict";

(() => {
  const polishHref = "login-polish-v31.css?v=20260908-desktop-v32";
  if (!document.querySelector('link[href^="login-polish-v31.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = polishHref;
    document.head.appendChild(link);
  }

  if (window.matchMedia?.("(min-width: 981px)")?.matches && !document.querySelector('link[href^="login-desktop-v32.css"]')) {
    const desktopLink = document.createElement("link");
    desktopLink.rel = "stylesheet";
    desktopLink.href = "login-desktop-v32.css?v=20260908-desktop-v32";
    desktopLink.media = "screen and (min-width: 981px)";
    document.head.appendChild(desktopLink);
  }

  const canvas = document.getElementById("loginParticleCanvas");
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext("2d", { alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let points = [];
    let raf = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const total = Math.max(24, Math.min(72, Math.round((width * height) / 30000)));
      points = Array.from({ length: total }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        r: Math.random() * 1.15 + 0.35,
        a: Math.random() * 0.45 + 0.12
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const point of points) {
        point.x += point.vx;
        point.y += point.vy;
        if (point.x < -10) point.x = width + 10;
        if (point.x > width + 10) point.x = -10;
        if (point.y < -10) point.y = height + 10;
        if (point.y > height + 10) point.y = -10;

        ctx.beginPath();
        ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(207, 148, 255, ${point.a})`;
        ctx.fill();
      }

      for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
          const a = points[i];
          const b = points[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 118) continue;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(168, 85, 247, ${0.065 * (1 - distance / 118)})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else draw();
    });
  }

  const stage = document.querySelector(".login-v30-stage");
  const product = document.querySelector(".login-v30-product");
  if (stage && product && !reduceMotion && window.matchMedia("(pointer:fine)").matches) {
    stage.addEventListener("pointermove", (event) => {
      const rect = stage.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      stage.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
      stage.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
      product.style.transform = `perspective(1200px) rotateX(${1.2 - py * 3}deg) rotateY(${-1.8 + px * 4}deg) translate3d(${px * 6}px,${py * 4}px,0)`;
    });
    stage.addEventListener("pointerleave", () => {
      product.style.transform = "perspective(1200px) rotateX(1.2deg) rotateY(-1.8deg)";
    });
  }

  const setEyeIcon = (button, visible) => {
    if (!button) return;
    button.innerHTML = visible
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 8a10.7 10.7 0 0 1-2.1 3.8M6.6 6.7C4.2 8.1 3 10.4 3 12c0 3 3.5 8 9 8 1.4 0 2.7-.3 3.8-.8"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7S18 19 12 19 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  };

  function installV31Enhancements() {
    if (document.getElementById("loginV31EnhancementStyle")) return;

    const style = document.createElement("style");
    style.id = "loginV31EnhancementStyle";
    style.textContent = `
      .login-v30-stage{--spot-x:72%;--spot-y:28%}
      .login-v30-stage .login-v31-spotlight{position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(420px circle at var(--spot-x) var(--spot-y),rgba(207,148,255,.11),transparent 62%);opacity:.95}
      .login-v31-rail{margin-top:22px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;max-width:660px}
      .login-v31-rail article{position:relative;min-height:72px;padding:13px 14px;border:1px solid rgba(255,255,255,.065);border-radius:15px;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.012));backdrop-filter:blur(16px);overflow:hidden}
      .login-v31-rail article::before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,rgba(216,121,255,.42),transparent)}
      .login-v31-rail b{display:flex;align-items:center;gap:7px;color:#f2edf5;font-size:10px;letter-spacing:.02em}
      .login-v31-rail b i{width:6px;height:6px;border-radius:50%;background:#82edbd;box-shadow:0 0 11px rgba(130,237,189,.7)}
      .login-v31-rail span{display:block;margin-top:7px;color:#8f8798;font-size:9px;line-height:1.45}
      .login-v31-auth-trust{margin-top:auto;padding-top:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:7px;border-top:1px solid rgba(255,255,255,.055)}
      .login-v31-auth-trust span{min-height:50px;display:grid;place-items:center;text-align:center;padding:8px;border:1px solid rgba(255,255,255,.055);border-radius:12px;color:#928a9c;background:rgba(255,255,255,.018);font-size:8px;font-weight:800;line-height:1.35;letter-spacing:.035em}
      .login-v31-auth-trust strong{display:block;color:#d8d0de;font-size:9px;margin-bottom:2px}
      .login-v30-auth{overflow:visible}
      .login-v30-auth::after{content:"";position:absolute;inset:-1px;border-radius:34px;padding:1px;background:linear-gradient(145deg,rgba(216,121,255,.38),transparent 32%,transparent 68%,rgba(240,188,77,.16));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;opacity:.75}
      .login-v30-auth .auth-submit{position:relative;overflow:hidden;isolation:isolate}
      .login-v30-auth .auth-submit::after{content:"";position:absolute;inset:-2px auto -2px -35%;width:30%;transform:skewX(-24deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);z-index:-1;transition:transform .55s ease}
      .login-v30-auth .auth-submit:hover::after{transform:translateX(520%) skewX(-24deg)}
      .login-v30-topbar{border-bottom:1px solid transparent}
      .login-v30-brand-copy strong{background:linear-gradient(90deg,#fff,#e1c9f1);-webkit-background-clip:text;background-clip:text;color:transparent}
      .login-v30-brand-copy strong span{color:#d879ff;-webkit-text-fill-color:#d879ff}
      @media(max-width:900px){
        .login-v31-rail{grid-template-columns:1fr;margin-top:18px}
        .login-v31-rail article{min-height:58px}
        .login-v31-auth-trust{grid-template-columns:1fr 1fr 1fr}
      }
      @media(max-width:620px){
        .login-v31-rail{display:none}
        .login-v31-auth-trust{grid-template-columns:1fr 1fr;margin-top:14px}
        .login-v31-auth-trust span:last-child{grid-column:1/-1;min-height:38px}
        .login-v30-auth{border-radius:26px}
      }
    `;
    document.head.appendChild(style);

    const stageEl = document.querySelector(".login-v30-stage");
    if (stageEl && !stageEl.querySelector(".login-v31-spotlight")) {
      const spotlight = document.createElement("div");
      spotlight.className = "login-v31-spotlight";
      spotlight.setAttribute("aria-hidden", "true");
      stageEl.prepend(spotlight);
    }

    const benefits = document.querySelector(".login-v30-benefits");
    if (benefits && !document.querySelector(".login-v31-rail")) {
      benefits.insertAdjacentHTML("afterend", `
        <div class="login-v31-rail" aria-label="Diferenciais do acesso">
          <article><b><i></i> Conta validada</b><span>Sessão e permissões conferidas diretamente no servidor.</span></article>
          <article><b><i></i> Plano sincronizado</b><span>Validade e acesso Premium acompanhados pela plataforma.</span></article>
          <article><b><i></i> Experiência integrada</b><span>Conteúdo, ferramentas e progresso no mesmo ambiente.</span></article>
        </div>
      `);
    }

    const authInner = document.querySelector(".login-v30-auth-inner");
    if (authInner && !authInner.querySelector(".login-v31-auth-trust")) {
      authInner.insertAdjacentHTML("beforeend", `
        <div class="login-v31-auth-trust" aria-label="Proteções do acesso">
          <span><strong>Sessão isolada</strong>token temporário</span>
          <span><strong>Acesso por perfil</strong>permissões validadas</span>
          <span><strong>Validade ativa</strong>checagem no servidor</span>
        </div>
      `);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    installV31Enhancements();

    document.querySelectorAll(".toggle-password").forEach((button) => {
      setEyeIcon(button, false);
      button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target);
        setTimeout(() => setEyeIcon(button, input?.type === "text"), 0);
      });
    });

    document.querySelectorAll(".auth-input-shell input").forEach((input) => {
      input.addEventListener("input", () => {
        input.closest(".auth-input-shell")?.classList.toggle("has-value", Boolean(input.value));
      });
    });
  }, { once: true });
})();