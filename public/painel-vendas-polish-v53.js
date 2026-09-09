"use strict";

(() => {
  const ICONS = {
    openSale: "i-plus",
    export: "i-download",
    refresh: "i-refresh",
    edit: "i-edit",
    delete: "i-trash",
    paid: "i-check",
    cancel: "i-alert",
    logout: "i-logout",
    search: "i-search"
  };

  function icon(id, className = "sales-ui-icon") {
    return `<svg class="${className}" aria-hidden="true"><use href="/assets/sales-command-icons.svg#${id}"></use></svg>`;
  }

  function replaceButtonContent(button, iconId, label) {
    if (!button || button.dataset.iconPolished === "true") return;
    button.dataset.iconPolished = "true";
    const text = label || String(button.textContent || "").replace(/[＋⇩↻✎⌫✓×]/g, "").trim();
    button.innerHTML = `${icon(iconId)}${text ? `<span>${text}</span>` : ""}`;
    if (!button.getAttribute("aria-label") && text) button.setAttribute("aria-label", text);
  }

  function polishStaticControls() {
    document.querySelectorAll("[data-open-sale]").forEach((el) => replaceButtonContent(el, ICONS.openSale, "Registrar venda"));
    document.querySelectorAll("[data-export-sales]").forEach((el) => replaceButtonContent(el, ICONS.export, /CSV/i.test(el.textContent || "") ? "Exportar CSV" : "Exportar relatório"));
    document.querySelectorAll("[data-export-commissions]").forEach((el) => replaceButtonContent(el, ICONS.export, "Exportar"));
    document.querySelectorAll("[data-refresh-current],#refreshClients,#productsRefresh,#financeRefresh,#refreshGoals").forEach((el) => replaceButtonContent(el, ICONS.refresh, "Atualizar"));

    const topRefresh = document.getElementById("salesRefreshTop");
    if (topRefresh) replaceButtonContent(topRefresh, ICONS.refresh, "");

    document.querySelectorAll("[data-logout]").forEach((el) => replaceButtonContent(el, ICONS.logout, ""));

    document.querySelectorAll(".sales-search>span,.sales-global-search>span").forEach((el) => {
      if (el.dataset.iconPolished === "true") return;
      el.dataset.iconPolished = "true";
      el.innerHTML = icon(ICONS.search);
    });

    const kpis = document.querySelectorAll("#view-dashboard .sales-kpi");
    const kpiIcons = ["i-money", "i-check", "i-clock", "i-ticket", "i-commission"];
    [...kpis].slice(0, 5).forEach((card, index) => {
      const slot = card.querySelector(":scope > span");
      if (!slot || slot.querySelector("svg")) return;
      slot.innerHTML = icon(kpiIcons[index], "sales-kpi-svg");
    });

    document.querySelectorAll("#view-dev .sales-system-grid article").forEach((item, index) => {
      const marker = item.querySelector("i");
      if (!marker || marker.querySelector("svg")) return;
      marker.innerHTML = icon(["i-database", "i-server", "i-products", "i-shield"][index] || "i-check");
    });
  }

  function polishDynamicActions() {
    document.querySelectorAll("[data-edit-sale],[data-edit-product],[data-edit-payment],[data-edit-coupon],[data-edit-goal]").forEach((el) => replaceButtonContent(el, ICONS.edit, ""));
    document.querySelectorAll("[data-delete-sale],[data-delete-product],[data-delete-payment],[data-delete-coupon]").forEach((el) => replaceButtonContent(el, ICONS.delete, ""));
    document.querySelectorAll('[data-sale-status="pago"],[data-pay-commission]').forEach((el) => replaceButtonContent(el, ICONS.paid, ""));
    document.querySelectorAll('[data-sale-status="cancelado"],[data-sale-status="estornado"]').forEach((el) => replaceButtonContent(el, ICONS.cancel, ""));
  }

  function ensureUpdatedBadge() {
    const actions = document.querySelector(".sales-topbar-actions");
    if (!actions || document.getElementById("salesLastUpdated")) return;
    const badge = document.createElement("span");
    badge.id = "salesLastUpdated";
    badge.className = "sales-last-updated";
    badge.textContent = "Atualização —";
    const version = actions.querySelector(".sales-version");
    if (version) version.insertAdjacentElement("afterend", badge);
    else actions.prepend(badge);
  }

  function markUpdated() {
    const el = document.getElementById("salesLastUpdated");
    if (!el) return;
    const now = new Date();
    el.textContent = `Atualizado ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function setHealthState({ api = false, database = false, sales = false } = {}) {
    const online = api && database && sales;
    const top = document.querySelector(".sales-online");
    if (top) {
      top.classList.toggle("is-warning", !online);
      top.innerHTML = `<i></i>${online ? "Sistema operacional" : "Verificando serviços"}`;
    }

    const system = document.querySelector(".sales-sidebar-system");
    if (system) {
      system.classList.toggle("is-warning", !online);
      const title = system.querySelector("strong");
      if (title) title.textContent = online ? "Operação saudável" : "Atenção operacional";
      const detail = system.querySelector("span");
      if (detail && !/Bestfy/i.test(detail.textContent || "")) {
        detail.textContent = online ? "API + MySQL + Vendas online" : "Algum serviço ainda está verificando";
      }
    }
  }

  async function checkHealth() {
    try {
      const [apiResponse, salesResponse] = await Promise.all([
        fetch("/api/status", { cache: "no-store", headers: { Accept: "application/json" } }),
        fetch("/vendas/status", { cache: "no-store", headers: { Accept: "application/json" } })
      ]);
      const apiData = await apiResponse.json().catch(() => ({}));
      const salesData = await salesResponse.json().catch(() => ({}));
      setHealthState({
        api: apiResponse.ok && apiData.status === "online",
        database: apiData.banco === "conectado",
        sales: salesResponse.ok && salesData.status === "online"
      });
      markUpdated();
    } catch (_) {
      setHealthState({ api: false, database: false, sales: false });
    }
  }

  function addKeyboardAndA11y() {
    document.querySelectorAll(".sales-action-btn").forEach((button) => {
      if (!button.type) button.type = "button";
    });
    document.querySelectorAll(".sales-card").forEach((card) => {
      if (!card.getAttribute("role")) card.setAttribute("role", "region");
    });
  }

  function animateRefresh() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("#salesRefreshTop,[data-refresh-current],#refreshClients,#productsRefresh,#financeRefresh,#refreshGoals");
      if (!button) return;
      button.classList.add("is-refreshing");
      setTimeout(() => button.classList.remove("is-refreshing"), 700);
      setTimeout(checkHealth, 350);
    });
  }

  function observe() {
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        polishStaticControls();
        polishDynamicActions();
        addKeyboardAndA11y();
      });
    });
    observer.observe(document.body, { subtree: true, childList: true });
  }

  function start() {
    document.documentElement.classList.add("sales-command-v53");
    polishStaticControls();
    polishDynamicActions();
    addKeyboardAndA11y();
    ensureUpdatedBadge();
    animateRefresh();
    observe();
    checkHealth();
    setInterval(checkHealth, 60000);
    const version = document.querySelector(".sales-version");
    if (version) version.textContent = "v5.3.0";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
