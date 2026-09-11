"use strict";
(() => {
  const root = document.documentElement;
  let preferred = "dark";
  try { preferred = localStorage.getItem("turma.workspace.theme") || "dark"; } catch {}
  root.dataset.theme = preferred === "light" ? "light" : "dark";
  try { root.classList.toggle("sidebar-compact", localStorage.getItem("turma.workspace.compact") === "true"); } catch {}
  document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);
    function applyTheme() {
      const light = root.dataset.theme === "light";
      $("themeToggle").setAttribute("aria-label", light ? "Ativar tema escuro" : "Ativar tema claro");
      $("themeToggle").setAttribute("aria-pressed", String(light));
      $("themeToggle").firstElementChild.textContent = light ? "☾" : "☀";
      $("themeToggle").lastElementChild.textContent = light ? "Tema escuro" : "Tema claro";

      $("heroArtwork").src = light ? "/assets/primo-portrait-light-v5.webp" : "/assets/primo-cartoon-login.webp";
      document.querySelector('meta[name="theme-color"]').content = light ? "#f1eff5" : "#09090e";
      window.dispatchEvent(new Event("turma:theme"));
    }
    $("themeToggle").addEventListener("click", () => {
      root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
      try { localStorage.setItem("turma.workspace.theme", root.dataset.theme); } catch {}
      applyTheme();
    });
    function updateCollapse() {
      const compact = root.classList.contains("sidebar-compact");
      $("sidebarCollapse").textContent = compact ? "»" : "«";
      $("sidebarCollapse").setAttribute("aria-expanded", String(!compact));
      $("sidebarCollapse").setAttribute("aria-label", compact ? "Expandir menu lateral" : "Recolher menu lateral");
    }
    $("sidebarCollapse").addEventListener("click", () => {
      root.classList.toggle("sidebar-compact");
      try { localStorage.setItem("turma.workspace.compact", String(root.classList.contains("sidebar-compact"))); } catch {}
      updateCollapse();
    });
    updateCollapse(); applyTheme();
    let remaining = 25 * 60, deadline = 0, running = false, interval;
    function renderTimer() {
      $("focusTimer").textContent = `${String(Math.floor(remaining / 60)).padStart(2,"0")}:${String(remaining % 60).padStart(2,"0")}`;
      $("focusStart").textContent = running ? "Pausar" : remaining === 0 ? "Nova sessão" : "Iniciar foco";
      $("focusDuration").disabled = running;
      $("focusProgress").max = Number($("focusDuration").value) * 60;
      $("focusProgress").value = $("focusProgress").max - remaining;
      document.querySelector(".focus-section").classList.toggle("is-running", running);
    }
    function tick() {
      if (!running) return;
      remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (remaining === 0) {
        running = false; clearInterval(interval);
        $("focusStatus").textContent = "Sessão concluída. Faça uma pausa antes de continuar.";
      }
      renderTimer();
    }
    $("focusStart").addEventListener("click", () => {
      if (running) { tick(); running = false; clearInterval(interval); $("focusStatus").textContent = "Sessão pausada. Continue quando quiser."; }
      else {
        if (!remaining) remaining = Number($("focusDuration").value) * 60;
        running = true; deadline = Date.now() + remaining * 1000;
        interval = setInterval(tick, 250);
        $("focusStatus").textContent = "Seu tempo de estudo começou. Uma coisa de cada vez.";
      }
      renderTimer();
    });
    function resetTimer() {
      clearInterval(interval); running = false; remaining = Number($("focusDuration").value) * 60;
      $("focusStatus").textContent = "O temporizador funciona enquanto esta página estiver aberta.";
      renderTimer();
    }
    $("focusReset").addEventListener("click",resetTimer);
    $("focusDuration").addEventListener("change",resetTimer);
    document.addEventListener("visibilitychange",tick);
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add("revealed"); observer.unobserve(entry.target); }
      }), {threshold:0.06});
      document.querySelectorAll(".module-card,.tool-card,.focus-section,.activity-section").forEach((el,i) => {
        el.classList.add("reveal"); el.style.setProperty("--reveal-delay",`${i % 4 * 45}ms`); observer.observe(el);
      });
    }
  });
})();
