"use strict";

(() => {
  const ICONS = {
    dashboard: "i-dashboard",
    sales: "i-sales",
    clients: "i-clients",
    sellers: "i-sellers",
    commissions: "i-commission",
    reports: "i-report",
    dev: "i-dev"
  };
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const FULL_ROLE_LABELS = new Set([
    "desenvolvedor",
    "dono",
    "super admin",
    "administrador",
    "financeiro"
  ]);

  function svgIcon(id) {
    return `<svg class="sales-command-icon" aria-hidden="true"><use href="/assets/sales-command-icons.svg#${id}"></use></svg>`;
  }

  function currentToken() {
    for (const key of TOKEN_KEYS) {
      try {
        const value = sessionStorage.getItem(key);
        if (value) return value;
      } catch (_) {}
    }
    return "";
  }

  function clearLocalSession() {
    for (const key of TOKEN_KEYS) {
      try { sessionStorage.removeItem(key); } catch (_) {}
    }
  }

  function enhanceNavigation() {
    document.querySelectorAll(".sales-nav-item[data-view]").forEach((item) => {
      const iconId = ICONS[item.dataset.view];
      if (!iconId || item.querySelector(".sales-command-icon")) return;
      const old = item.querySelector("i");
      if (old) old.insertAdjacentHTML("afterend", svgIcon(iconId));
      else item.insertAdjacentHTML("afterbegin", svgIcon(iconId));
    });

    document.querySelectorAll(".sales-nav-item[href]").forEach((item) => {
      if (item.querySelector(".sales-command-icon")) return;
      const iconId = /admin/i.test(item.getAttribute("href") || "") ? "i-admin" : "i-study";
      const old = item.querySelector("i");
      if (old) old.insertAdjacentHTML("afterend", svgIcon(iconId));
      else item.insertAdjacentHTML("afterbegin", svgIcon(iconId));
    });
  }

  function enhanceHeader() {
    const dashboard = document.getElementById("view-dashboard");
    const head = dashboard?.querySelector(".sales-page-head");
    if (!head) return;

    const kicker = head.querySelector(".sales-kicker");
    const title = head.querySelector("h1");
    const description = head.querySelector("p");
    if (kicker) kicker.textContent = "SALES COMMAND CENTER";
    if (title) title.textContent = "Dashboard de Vendas";
    if (description) description.textContent = "Acompanhe sua operação comercial com dados reais do MySQL e das transações verificadas da Bestfy.";

    if (!dashboard.querySelector(".sales-command-strip")) {
      const strip = document.createElement("div");
      strip.className = "sales-command-strip";
      strip.innerHTML = [
        '<span><i></i><b>Operação comercial</b> ativa</span>',
        '<span>Fonte: <b>MySQL</b></span>',
        '<span>Checkout: <b>Bestfy verificada</b></span>',
        '<span class="sales-command-spacer">Sem métricas simuladas</span>'
      ].join("");
      head.insertAdjacentElement("afterend", strip);
    }

    const version = document.querySelector(".sales-version");
    if (version) version.textContent = "v5.1.0";
  }

  function isFullRole() {
    const label = String(document.querySelector("[data-user-role]")?.textContent || "")
      .trim()
      .toLowerCase();
    return FULL_ROLE_LABELS.has(label);
  }

  function lockSaleStatusField() {
    const status = document.getElementById("saleStatus");
    if (!status) return;
    status.disabled = true;
    const label = status.closest("label");
    if (label && !label.querySelector(".sales-status-policy")) {
      const note = document.createElement("small");
      note.className = "sales-status-policy";
      note.textContent = "Nova venda nasce pendente. A confirmação é feita pela ação financeira da tabela.";
      label.appendChild(note);
    }
  }

  function protectRenderedRows() {
    const fullRole = isFullRole();
    document.querySelectorAll(".sales-table tbody tr").forEach((row) => {
      const renderedText = String(row.textContent || "");
      const bestfy = /Checkout Bestfy/i.test(renderedText);
      if (bestfy) {
        row.classList.add("sales-source-bestfy");
        const actions = row.querySelector(".sales-actions");
        if (actions) actions.dataset.readonly = "true";
        row.querySelectorAll("[data-edit-sale],[data-sale-status],[data-delete-sale]").forEach((button) => {
          button.disabled = true;
          button.hidden = true;
          button.setAttribute("aria-hidden", "true");
        });
      }

      if (!fullRole) {
        row.querySelectorAll('[data-sale-status="pago"],[data-sale-status="estornado"]').forEach((button) => {
          button.disabled = true;
          button.hidden = true;
        });
      }
    });
  }

  function protectBestfyActionsAtCapture() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-edit-sale],[data-sale-status],[data-delete-sale]");
      if (!button) return;
      const row = button.closest("tr");
      if (row?.classList.contains("sales-source-bestfy")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function secureLogoutAtCapture() {
    document.addEventListener("click", async (event) => {
      const logout = event.target.closest("[data-logout]");
      if (!logout) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      logout.disabled = true;

      const token = currentToken();
      try {
        if (token) {
          await fetch("/logout", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            cache: "no-store"
          });
        }
      } catch (_) {
        // Mesmo com falha de rede, eliminamos a credencial local. O servidor
        // revoga a sessão quando recebe a chamada e também expira o cookie.
      } finally {
        clearLocalSession();
        window.location.replace("/");
      }
    }, true);
  }

  function addOperationalDetails() {
    const topRefresh = document.getElementById("salesRefreshTop");
    if (topRefresh && !topRefresh.querySelector("svg")) {
      topRefresh.innerHTML = svgIcon("i-refresh");
      topRefresh.setAttribute("aria-label", "Atualizar dados");
    }

    const globalSearch = document.querySelector(".sales-global-search input");
    if (globalSearch) globalSearch.placeholder = "Buscar cliente, venda, vendedor ou plano…";
  }

  function observeDynamicUI() {
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        protectRenderedRows();
        lockSaleStatusField();
      });
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  function start() {
    enhanceNavigation();
    enhanceHeader();
    addOperationalDetails();
    lockSaleStatusField();
    protectBestfyActionsAtCapture();
    secureLogoutAtCapture();
    protectRenderedRows();
    observeDynamicUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
