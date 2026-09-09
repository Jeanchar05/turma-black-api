"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const EXTRA_VIEWS = ["goals", "funnel", "products", "finance"];
  const ICONS = {
    dashboard: "i-dashboard",
    sales: "i-sales",
    clients: "i-clients",
    sellers: "i-sellers",
    commissions: "i-commission",
    goals: "i-goal",
    funnel: "i-funnel",
    products: "i-products",
    finance: "i-finance",
    reports: "i-report",
    dev: "i-dev"
  };

  const command = {
    days: 30,
    data: null,
    metas: [],
    sellers: [],
    products: [],
    loading: false,
    timers: {}
  };

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

  async function api(endpoint, options = {}) {
    const token = currentToken();
    const response = await fetch(endpoint, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {})
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearLocalSession();
      window.location.replace("/");
      throw new Error("Sessão expirada.");
    }
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}`);
    return data;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function money(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  }

  function integer(value) {
    return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
  }

  function percent(value) {
    return `${Number(value || 0).toFixed(1).replace(".", ",")}%`;
  }

  function dateTime(value) {
    if (!value) return "Ainda sem sincronização";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function currentCompetence() {
    return new Date().toISOString().slice(0, 7);
  }

  function svgIcon(id) {
    return `<svg class="sales-command-icon" aria-hidden="true"><use href="/assets/sales-command-icons.svg#${id}"></use></svg>`;
  }

  function toast(message, type = "success") {
    const stack = document.getElementById("salesToastStack");
    if (!stack) return;
    const item = document.createElement("div");
    item.className = `sales-toast ${type}`;
    item.textContent = message;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => {
      item.classList.remove("show");
      setTimeout(() => item.remove(), 240);
    }, 3600);
  }

  function setHTML(id, html) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = html;
  }

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function enhanceNavigation() {
    const nav = document.getElementById("salesNav");
    if (!nav) return;

    const reports = nav.querySelector('[data-view="reports"]');
    const items = [
      ["goals", "Metas"],
      ["funnel", "Funil de Vendas"],
      ["products", "Produtos / Planos"],
      ["finance", "Financeiro"]
    ];

    items.forEach(([view, label]) => {
      if (nav.querySelector(`[data-view="${view}"]`)) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sales-nav-item sales-command-added-nav";
      button.dataset.view = view;
      button.innerHTML = `${svgIcon(ICONS[view])}<span>${label}</span>`;
      reports?.before(button);
    });

    nav.querySelectorAll(".sales-nav-item[data-view]").forEach((item) => {
      const iconId = ICONS[item.dataset.view];
      if (!iconId || item.querySelector(".sales-command-icon")) return;
      const old = item.querySelector("i");
      if (old) old.insertAdjacentHTML("afterend", svgIcon(iconId));
      else item.insertAdjacentHTML("afterbegin", svgIcon(iconId));
    });

    nav.querySelectorAll(".sales-nav-item[href]").forEach((item) => {
      if (item.querySelector(".sales-command-icon")) return;
      const iconId = /admin/i.test(item.getAttribute("href") || "") ? "i-admin" : "i-study";
      const old = item.querySelector("i");
      if (old) old.insertAdjacentHTML("afterend", svgIcon(iconId));
      else item.insertAdjacentHTML("afterbegin", svgIcon(iconId));
    });
  }

  function injectViews() {
    const content = document.querySelector(".sales-content");
    const dev = document.getElementById("view-dev");
    if (!content || !dev || document.getElementById("view-goals")) return;

    const html = `
      <section class="sales-view" id="view-goals" data-title="Metas">
        <div class="sales-page-head">
          <div><span class="sales-kicker">PLANEJAMENTO COMERCIAL</span><h1>Metas</h1><p>Defina objetivos mensais e acompanhe o realizado sem números simulados.</p></div>
          <div class="sales-head-actions"><input class="sales-command-month" id="goalCompetence" type="month" /><button class="sales-primary-btn" type="button" id="openGoalModal" hidden>＋ Definir meta</button></div>
        </div>
        <div class="sales-command-goal-hero" id="goalHero"><div class="sales-empty">Carregando meta do mês…</div></div>
        <div class="sales-card"><div class="sales-card-head"><div><span>OBJETIVOS</span><h2>Metas cadastradas</h2></div><button class="sales-mini-refresh" id="refreshGoals" type="button">Atualizar</button></div><div class="sales-command-goal-list" id="goalList"><div class="sales-empty">Carregando…</div></div></div>
      </section>

      <section class="sales-view" id="view-funnel" data-title="Funil de Vendas">
        <div class="sales-page-head"><div><span class="sales-kicker">PIPELINE REAL</span><h1>Funil de Vendas</h1><p>Distribuição das vendas registradas por situação financeira no período.</p></div><div class="sales-head-actions"><span class="sales-command-period-label" id="funnelPeriodLabel">Últimos 30 dias</span></div></div>
        <div class="sales-command-funnel-layout">
          <article class="sales-card sales-command-funnel-card"><div class="sales-card-head"><div><span>PIPELINE</span><h2>Conversão por status</h2></div></div><div id="commandFunnel" class="sales-command-funnel"><div class="sales-empty">Carregando…</div></div></article>
          <article class="sales-card"><div class="sales-card-head"><div><span>ORIGENS</span><h2>De onde vêm as vendas</h2></div></div><div id="commandSources" class="sales-command-source-list"><div class="sales-empty">Carregando…</div></div></article>
        </div>
      </section>

      <section class="sales-view" id="view-products" data-title="Produtos e Planos">
        <div class="sales-page-head"><div><span class="sales-kicker">CATÁLOGO COMERCIAL</span><h1>Produtos / Planos</h1><p>Confira valores, duração e disponibilidade dos planos usados pelo checkout e pelo time comercial.</p></div><div class="sales-head-actions"><button class="sales-secondary-btn" type="button" id="productsRefresh">↻ Atualizar</button><button class="sales-primary-btn" type="button" data-view="dev" id="productsDevButton" hidden>Gerenciar no Dev →</button></div></div>
        <div class="sales-command-products" id="commandProducts"><div class="sales-empty">Carregando produtos…</div></div>
      </section>

      <section class="sales-view" id="view-finance" data-title="Financeiro">
        <div class="sales-page-head"><div><span class="sales-kicker">VISÃO FINANCEIRA</span><h1>Financeiro Comercial</h1><p>Receita confirmada, comissões, estornos e composição do faturamento. Não inclui impostos ou taxas não cadastradas.</p></div><button class="sales-secondary-btn" type="button" id="financeRefresh">↻ Atualizar</button></div>
        <div class="sales-command-finance-kpis" id="financeKpis"><div class="sales-empty">Carregando indicadores…</div></div>
        <div class="sales-command-finance-grid">
          <article class="sales-card"><div class="sales-card-head"><div><span>PLANOS</span><h2>Receita por produto</h2></div></div><div id="financePlans" class="sales-command-bars"><div class="sales-empty">Carregando…</div></div></article>
          <article class="sales-card"><div class="sales-card-head"><div><span>PAGAMENTOS</span><h2>Receita por meio de pagamento</h2></div></div><div id="financePayments" class="sales-command-bars"><div class="sales-empty">Carregando…</div></div></article>
          <article class="sales-card"><div class="sales-card-head"><div><span>AUDITORIA</span><h2>Atividade comercial recente</h2></div></div><div id="financeAudit" class="sales-command-audit"><div class="sales-empty">Disponível para a gestão.</div></div></article>
        </div>
      </section>
    `;

    dev.insertAdjacentHTML("beforebegin", html);
    injectGoalModal();
  }

  function injectGoalModal() {
    if (document.getElementById("goalModal")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="sales-modal" id="goalModal" hidden>
        <div class="sales-modal-card">
          <div class="sales-modal-head"><div><span>PLANEJAMENTO COMERCIAL</span><h2>Definir meta</h2></div><button type="button" data-command-close-modal>×</button></div>
          <form id="goalForm" class="sales-form">
            <label><span>Competência</span><input id="goalModalCompetence" type="month" required /></label>
            <label><span>Responsável</span><select id="goalSeller"><option value="">Meta geral da equipe</option></select></label>
            <label><span>Meta de faturamento</span><input id="goalRevenue" type="number" min="0" step="0.01" required /></label>
            <label><span>Meta de vendas</span><input id="goalSales" type="number" min="0" step="1" required /></label>
            <div class="sales-modal-actions"><button class="sales-secondary-btn" type="button" data-command-close-modal>Cancelar</button><button class="sales-primary-btn" type="submit">Salvar meta</button></div>
          </form>
        </div>
      </div>
    `);
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
    if (description) description.textContent = "Acompanhe a operação comercial com dados reais do MySQL e transações verificadas da Bestfy.";

    if (!dashboard.querySelector(".sales-command-strip")) {
      const strip = document.createElement("div");
      strip.className = "sales-command-strip";
      strip.innerHTML = [
        '<span><i></i><b>Operação comercial</b> ativa</span>',
        '<span>Fonte: <b>MySQL</b></span>',
        '<span>Checkout: <b>Bestfy verificada</b></span>',
        '<span id="commandBestfySync">Sincronização: carregando…</span>',
        '<span class="sales-command-spacer">Sem métricas simuladas</span>'
      ].join("");
      head.insertAdjacentElement("afterend", strip);
    }

    const grid = dashboard.querySelector(".sales-kpi-grid");
    if (grid && !document.getElementById("kpiGoal")) {
      grid.insertAdjacentHTML("beforeend", `<article class="sales-kpi gold sales-command-goal-kpi"><div><small>Meta do mês</small><strong id="kpiGoal">Sem meta</strong><em id="kpiGoalDetail">Defina uma meta comercial</em></div><span>${svgIcon("i-goal")}</span></article>`);
    }

    const version = document.querySelector(".sales-version");
    if (version) version.textContent = "v5.2.0";
  }

  function addOperationalDetails() {
    const topRefresh = document.getElementById("salesRefreshTop");
    if (topRefresh && !topRefresh.querySelector("svg")) {
      topRefresh.innerHTML = svgIcon("i-refresh");
      topRefresh.setAttribute("aria-label", "Atualizar dados");
    }
    const globalSearch = document.querySelector(".sales-global-search input");
    if (globalSearch) globalSearch.placeholder = "Buscar cliente, venda, vendedor ou plano…";
    const month = document.getElementById("goalCompetence");
    if (month && !month.value) month.value = currentCompetence();
  }

  function isFullRole() {
    return Boolean(command.data?.acesso?.podeGerenciar);
  }

  function lockSaleStatusField() {
    const status = document.getElementById("saleStatus");
    if (!status) return;
    status.disabled = true;
    const label = status.closest("label");
    if (label && !label.querySelector(".sales-status-policy")) {
      const note = document.createElement("small");
      note.className = "sales-status-policy";
      note.textContent = "Nova venda nasce pendente. Confirme o pagamento pela ação financeira da tabela.";
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

  async function loadCommandCenter() {
    if (command.loading) return;
    command.loading = true;
    try {
      const comp = document.getElementById("goalCompetence")?.value || currentCompetence();
      command.data = await api(`/vendas/command-center?dias=${command.days}&competencia=${encodeURIComponent(comp)}`);
      renderCommandCenter();
    } catch (error) {
      console.warn("Falha ao carregar Sales Command Center:", error.message);
      toast(error.message || "Não foi possível carregar o painel comercial.", "error");
    } finally {
      command.loading = false;
    }
  }

  async function loadGoals() {
    const comp = document.getElementById("goalCompetence")?.value || currentCompetence();
    try {
      const result = await api(`/vendas/metas?competencia=${encodeURIComponent(comp)}`);
      command.metas = result.metas || [];
      renderGoalsList(result.podeGerenciar);
    } catch (error) {
      setHTML("goalList", `<div class="sales-empty">${escapeHTML(error.message)}</div>`);
    }
  }

  async function loadProducts() {
    try {
      const result = await api("/vendas/produtos");
      command.products = result.produtos || [];
      renderProducts();
    } catch (error) {
      setHTML("commandProducts", `<div class="sales-empty">${escapeHTML(error.message)}</div>`);
    }
  }

  async function loadSellers() {
    try {
      const result = await api("/vendas/vendedores");
      command.sellers = result.vendedores || [];
      const select = document.getElementById("goalSeller");
      if (select) {
        select.innerHTML = `<option value="">Meta geral da equipe</option>${command.sellers.map((seller) => `<option value="${escapeHTML(seller.id)}">${escapeHTML(seller.nome)} — ${escapeHTML(seller.cargo || "vendedor")}</option>`).join("")}`;
      }
    } catch (_) {}
  }

  function renderCommandCenter() {
    const data = command.data || {};
    renderDashboardMeta(data.meta || {});
    renderGoalHero(data.meta || {});
    renderFunnel(data.pipeline || []);
    renderSources(data.origens || []);
    renderFinance(data);
    applyAccess(data.acesso || {});

    const sync = document.getElementById("commandBestfySync");
    if (sync) sync.textContent = `Bestfy: ${dateTime(data.bestfy?.ultimaSincronizacao)}`;
    const sidebarStatus = document.querySelector(".sales-sidebar-system span");
    if (sidebarStatus) sidebarStatus.textContent = data.bestfy?.ultimaSincronizacao ? `Bestfy sincronizada • ${dateTime(data.bestfy.ultimaSincronizacao)}` : "MySQL ativo • aguardando Bestfy";
  }

  function renderDashboardMeta(meta) {
    if (!document.getElementById("kpiGoal")) return;
    if (Number(meta.faturamento || 0) <= 0) {
      setText("kpiGoal", "Sem meta");
      setText("kpiGoalDetail", "Defina uma meta comercial");
      return;
    }
    setText("kpiGoal", percent(meta.progressoFaturamento));
    setText("kpiGoalDetail", `${money(meta.realizadoFaturamento)} de ${money(meta.faturamento)}`);
  }

  function renderGoalHero(meta) {
    const hasGoal = Number(meta.faturamento || 0) > 0 || Number(meta.vendas || 0) > 0;
    if (!hasGoal) {
      setHTML("goalHero", `<article class="sales-command-goal-empty"><div>${svgIcon("i-goal")}</div><section><span>META ${escapeHTML(meta.competencia || currentCompetence())}</span><h2>Nenhuma meta cadastrada</h2><p>A gestão pode definir uma meta geral da equipe ou metas individuais por vendedor.</p></section></article>`);
      return;
    }

    const revenueProgress = Math.min(100, Number(meta.progressoFaturamento || 0));
    const salesProgress = Math.min(100, Number(meta.progressoVendas || 0));
    setHTML("goalHero", `
      <article class="sales-command-goal-card">
        <div class="sales-command-goal-copy"><span>META • ${escapeHTML(meta.competencia)}</span><h2>${money(meta.realizadoFaturamento)} <small>de ${money(meta.faturamento)}</small></h2><p>${percent(meta.progressoFaturamento)} do faturamento mensal alcançado.</p></div>
        <div class="sales-command-goal-progress"><div><span>Faturamento</span><b>${percent(meta.progressoFaturamento)}</b></div><div class="sales-command-progress"><i style="width:${revenueProgress}%"></i></div><div><span>Vendas</span><b>${integer(meta.realizadoVendas)} / ${integer(meta.vendas)}</b></div><div class="sales-command-progress green"><i style="width:${salesProgress}%"></i></div></div>
      </article>`);
  }

  function renderGoalsList(canManage) {
    const open = document.getElementById("openGoalModal");
    if (open) open.hidden = !canManage;
    const items = command.metas || [];
    if (!items.length) {
      setHTML("goalList", '<div class="sales-empty">Nenhuma meta cadastrada para esta competência.</div>');
      return;
    }
    setHTML("goalList", items.map((item) => `
      <article class="sales-command-goal-row">
        <div class="sales-command-goal-owner"><span class="sales-command-goal-avatar">${escapeHTML((item.vendedorNome || "E").slice(0, 1).toUpperCase())}</span><div><strong>${escapeHTML(item.vendedorNome)}</strong><small>${escapeHTML(item.vendedorEmail || item.competencia)}</small></div></div>
        <div><small>Faturamento</small><strong>${money(item.metaFaturamento)}</strong></div>
        <div><small>Vendas</small><strong>${integer(item.metaVendas)}</strong></div>
        <div><small>Atualizada</small><strong>${escapeHTML(dateTime(item.updatedAt))}</strong></div>
        ${canManage ? `<button class="sales-action-btn" type="button" data-edit-goal="${escapeHTML(item.vendedorId)}" data-goal-revenue="${Number(item.metaFaturamento || 0)}" data-goal-sales="${Number(item.metaVendas || 0)}" title="Editar meta">✎</button>` : ""}
      </article>`).join(""));
  }

  function renderFunnel(items) {
    const total = Math.max(Number(items[0]?.total || 0), 1);
    const colors = ["#8b42ff", "#ffb332", "#27dc8b", "#ff5575"];
    setText("funnelPeriodLabel", `Últimos ${command.days} dias`);
    setHTML("commandFunnel", items.map((item, index) => {
      const value = Number(item.total || 0);
      const ratio = value / total * 100;
      const width = Math.max(value ? 20 : 5, Math.min(100, ratio));
      return `<div class="sales-command-funnel-step"><div class="sales-command-funnel-label"><span>${escapeHTML(item.label)}</span><b>${integer(value)}</b></div><div class="sales-command-funnel-track"><i style="width:${width}%;--step:${colors[index] || "#8b42ff"}"></i></div><small>${percent(ratio)} das registradas</small></div>`;
    }).join("") || '<div class="sales-empty">Nenhuma venda registrada no período.</div>');
  }

  function renderSources(items) {
    const totalRevenue = items.reduce((sum, item) => sum + Number(item.faturamento || 0), 0);
    setHTML("commandSources", items.map((item) => {
      const share = totalRevenue ? (Number(item.faturamento || 0) / totalRevenue) * 100 : 0;
      const label = item.codigo === "bestfy" ? "Checkout Bestfy" : item.codigo === "painel-vendas" ? "Venda manual" : item.codigo || "Outra origem";
      return `<div class="sales-command-source-row"><span class="sales-command-source-icon ${item.codigo === "bestfy" ? "bestfy" : "manual"}">${item.codigo === "bestfy" ? "B" : "M"}</span><div><strong>${escapeHTML(label)}</strong><small>${integer(item.pagas)} confirmada(s) de ${integer(item.total)}</small><div class="sales-command-progress small"><i style="width:${Math.min(100, share)}%"></i></div></div><b>${money(item.faturamento)}</b></div>`;
    }).join("") || '<div class="sales-empty">Sem origens no período.</div>');
  }

  function renderFinance(data) {
    const metrics = data.indicadores || {};
    setHTML("financeKpis", [
      ["Receita confirmada", money(metrics.faturamento), "i-money", "purple"],
      ["Após comissões", money(metrics.receitaAposComissoes), "i-finance", "green"],
      ["Comissões", money(metrics.comissoes), "i-commission", "gold"],
      ["Estornos", money(metrics.estornosValor), "i-refresh", "red"],
      ["Ticket médio", money(metrics.ticketMedio), "i-ticket", "blue"]
    ].map(([label, value, icon, color]) => `<article class="sales-command-finance-kpi ${color}"><span>${svgIcon(icon)}</span><div><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong></div></article>`).join(""));

    renderBars("financePlans", data.planos || [], "nome", "faturamento", "vendas");
    renderBars("financePayments", data.pagamentos || [], "codigo", "faturamento", "total", (code) => code === "bestfy" ? "Checkout Bestfy" : String(code || "").replaceAll("_", " "));

    const audit = data.auditoria || [];
    setHTML("financeAudit", audit.map((item) => `<div class="sales-command-audit-row"><span></span><div><strong>${escapeHTML(String(item.acao || "ação").replaceAll("_", " "))}</strong><small>${escapeHTML(item.usuarioEmail || "Sistema")} • ${escapeHTML(dateTime(item.createdAt))}</small></div></div>`).join("") || '<div class="sales-empty">A auditoria detalhada aparece para perfis de gestão.</div>');
  }

  function renderBars(id, items, labelKey, valueKey, countKey, labelFormatter = (value) => value) {
    const max = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1);
    setHTML(id, items.map((item) => {
      const value = Number(item[valueKey] || 0);
      const width = Math.max(value ? 6 : 0, value / max * 100);
      return `<div class="sales-command-bar-row"><div><span>${escapeHTML(labelFormatter(item[labelKey]))}</span><b>${money(value)}</b></div><div class="sales-command-bar"><i style="width:${width}%"></i></div><small>${integer(item[countKey] || 0)} venda(s)</small></div>`;
    }).join("") || '<div class="sales-empty">Sem dados confirmados no período.</div>');
  }

  function renderProducts() {
    const items = command.products || [];
    const officialOrder = ["black30", "black180", "black360"];
    const sorted = [...items].sort((a, b) => {
      const ai = officialOrder.indexOf(a.codigo);
      const bi = officialOrder.indexOf(b.codigo);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return Number(a.ordem || 0) - Number(b.ordem || 0);
    });

    setHTML("commandProducts", sorted.map((item) => `
      <article class="sales-command-product ${item.ativo ? "active" : "inactive"}">
        <div class="sales-command-product-top"><span>${svgIcon("i-products")}</span><em>${item.ativo ? "ATIVO" : "HISTÓRICO"}</em></div>
        <div><small>${escapeHTML(item.codigo)}</small><h2>${escapeHTML(item.nome)}</h2><p>${escapeHTML(item.descricao || "Plano comercial da Turma do Primo")}</p></div>
        <strong>${money(item.preco)}</strong>
        <footer><span>${integer(item.duracaoDias)} dias de acesso</span><span>${item.ativo ? "Disponível para novas vendas" : "Não disponível para novas vendas"}</span></footer>
      </article>`).join("") || '<div class="sales-empty">Nenhum produto cadastrado.</div>');
  }

  function applyAccess(access) {
    const canManage = Boolean(access.podeGerenciar);
    const goalButton = document.getElementById("openGoalModal");
    if (goalButton) goalButton.hidden = !Boolean(access.podeGerenciarMetas);
    const devProducts = document.getElementById("productsDevButton");
    if (devProducts) devProducts.hidden = access.cargo !== "dev";
    protectRenderedRows();
  }

  function openGoalModal(goal = null) {
    if (!command.data?.acesso?.podeGerenciarMetas) return;
    const modal = document.getElementById("goalModal");
    if (!modal) return;
    document.getElementById("goalModalCompetence").value = document.getElementById("goalCompetence")?.value || currentCompetence();
    document.getElementById("goalSeller").value = goal?.sellerId || "";
    document.getElementById("goalRevenue").value = goal?.revenue ?? "";
    document.getElementById("goalSales").value = goal?.sales ?? "";
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeCommandModals() {
    const modal = document.getElementById("goalModal");
    if (modal) modal.hidden = true;
    document.body.style.overflow = "";
  }

  async function submitGoal(event) {
    event.preventDefault();
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      await api("/vendas/metas", {
        method: "PUT",
        body: {
          competencia: document.getElementById("goalModalCompetence").value,
          vendedorId: document.getElementById("goalSeller").value,
          metaFaturamento: Number(document.getElementById("goalRevenue").value || 0),
          metaVendas: Number(document.getElementById("goalSales").value || 0)
        }
      });
      closeCommandModals();
      toast("Meta comercial salva.");
      await Promise.all([loadGoals(), loadCommandCenter()]);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      if (button) button.disabled = false;
    }
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
          await fetch("/logout", { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
        }
      } catch (_) {
      } finally {
        clearLocalSession();
        window.location.replace("/");
      }
    }, true);
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

  function registerCommandEvents() {
    document.addEventListener("click", (event) => {
      const view = event.target.closest("[data-view]")?.dataset.view;
      if (view) {
        try { history.replaceState(null, "", `#${view}`); } catch (_) {}
        if (EXTRA_VIEWS.includes(view)) {
          if (view === "goals") Promise.all([loadGoals(), loadCommandCenter()]);
          if (view === "funnel" || view === "finance") loadCommandCenter();
          if (view === "products") loadProducts();
        }
      }

      if (event.target.closest("#openGoalModal")) openGoalModal();
      const editGoal = event.target.closest("[data-edit-goal]");
      if (editGoal) openGoalModal({ sellerId: editGoal.dataset.editGoal, revenue: Number(editGoal.dataset.goalRevenue || 0), sales: Number(editGoal.dataset.goalSales || 0) });
      if (event.target.closest("[data-command-close-modal]")) closeCommandModals();
      if (event.target.closest("#refreshGoals")) Promise.all([loadGoals(), loadCommandCenter()]);
      if (event.target.closest("#productsRefresh")) loadProducts();
      if (event.target.closest("#financeRefresh")) loadCommandCenter();
      const period = event.target.closest("[data-days]");
      if (period) {
        command.days = Number(period.dataset.days || 30);
        debounce("command-period", loadCommandCenter, 160);
      }
    });

    document.getElementById("goalForm")?.addEventListener("submit", submitGoal);
    document.getElementById("goalCompetence")?.addEventListener("change", () => Promise.all([loadGoals(), loadCommandCenter()]));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCommandModals();
    });
  }

  function debounce(key, fn, delay) {
    clearTimeout(command.timers[key]);
    command.timers[key] = setTimeout(fn, delay);
  }

  function observeDynamicUI() {
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        lockSaleStatusField();
        protectRenderedRows();
      });
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  function openInitialHash() {
    const hash = String(location.hash || "").replace(/^#/, "");
    if (!hash) return;
    const button = document.querySelector(`[data-view="${CSS.escape(hash)}"]`);
    if (button) setTimeout(() => button.click(), 120);
  }

  async function start() {
    enhanceNavigation();
    injectViews();
    enhanceHeader();
    addOperationalDetails();
    lockSaleStatusField();
    protectBestfyActionsAtCapture();
    secureLogoutAtCapture();
    registerCommandEvents();
    observeDynamicUI();
    await Promise.allSettled([loadCommandCenter(), loadGoals(), loadProducts(), loadSellers()]);
    protectRenderedRows();
    openInitialHash();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
