"use strict";
// Mesma preferência de tema do dashboard, aplicada antes da primeira pintura.
(() => {
  let theme = "dark";
  try {
    theme = localStorage.getItem("turma.workspace.theme") || "dark";
  } catch {}
  document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
})();
