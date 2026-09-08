"use strict";

(() => {
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

  document.addEventListener("DOMContentLoaded", () => {
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
