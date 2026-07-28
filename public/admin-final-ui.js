"use strict";
(() => {
  function applyPeriodSwitch() {
    const select = document.getElementById("overviewChartPeriod");
    if (!select || select.closest(".admin-period-switch")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "admin-period-switch";
    wrapper.setAttribute("role", "group");
    wrapper.setAttribute("aria-label", "Período do gráfico");
    [["7", "7 dias"], ["14", "14 dias"], ["30", "30 dias"]].forEach(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.overviewDays = value;
      button.textContent = label;
      button.classList.toggle("active", String(select.value || "7") === value);
      wrapper.appendChild(button);
    });
    select.classList.add("admin-period-native");
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
  }

  function registerPeriodEvents() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-overview-days]");
      if (!button) return;
      const select = document.getElementById("overviewChartPeriod");
      if (!select) return;
      select.value = button.dataset.overviewDays;
      document.querySelectorAll("[data-overview-days]").forEach((item) => item.classList.toggle("active", item === button));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  async function init() {
    registerPeriodEvents();
    applyPeriodSwitch();
    setTimeout(applyPeriodSwitch, 250);
    try { await import("./admin-support-center.js?v=20260728-support-1"); }
    catch (error) { console.error("Falha ao carregar a central de suporte:", error); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
