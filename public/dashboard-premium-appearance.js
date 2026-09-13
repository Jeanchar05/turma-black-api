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
