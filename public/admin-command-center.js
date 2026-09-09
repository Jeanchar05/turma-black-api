"use strict";

(() => {
  const ICONS = "/assets/admin-command-icons.svg";
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const state = { overview: null, security: null, chartMode: "users", chartDays: 7, chartPoints: [], auditFilter: "all" };

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const icon = (name, cls = "cc-svg") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="${ICONS}#i-${name}"></use></svg>`;

  function getToken() {
    for (const key of TOKEN_KEYS) {
      try { const value = sessionStorage.getItem(key); if (value) return value; } catch (_) {}
    }
    return "";
  }

  async function api(endpoint) {
    const token = getToken();
    if (!token) throw new Error("Sessão expirada.");
    const response = await fetch(`${window.location.origin}${endpoint}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}.`);
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

  function number(value) {
    return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
  }

  function relative(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const diff = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    const days = Math.floor(hours / 24);
    return `há ${days} dia${days === 1 ? "" : "s"}`;
  }

  function dateLong() {
    const text = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }

  function planLabel(plan) {
    const map = { free: "Free", black30: "30 dias", black90: "90 dias", black180: "6 meses", black360: "1 ano", admin: "Administrativo" };
    return map[String(plan || "").toLowerCase()] || String(plan || "Free");
  }

  function growthClass(value) { return Number(value || 0) >= 0 ? "positive" : "negative"; }
  function growth(value, label = "vs. mês anterior") {
    const n = Number(value || 0);
    return `<em class="${growthClass(n)}">${n >= 0 ? "+" : ""}${n.toFixed(1).replace(".", ",")}% ${label}</em>`;
  }

  function findNav(section) {
    return document.querySelector(`[data-section="${section}"]`);
  }

  function navItem(section, href) {
    return section ? findNav(section) : document.querySelector(`.admin-nav-item[href="${href}"]`);
  }

  function setNavLabel(section, label) {
    const item = findNav(section);
    const labelNode = item?.querySelector("span:last-of-type");
    if (labelNode) labelNode.textContent = label;
  }

  function rebuildNavigation() {
    const nav = $("adminNav");
    if (!nav || nav.dataset.ccReady) return;
    nav.dataset.ccReady = "1";

    setNavLabel("overview", "Visão Geral");
    setNavLabel("students", "Alunos");
    setNavLabel("approvals", "Aprovações");
    setNavLabel("support", "Suporte");
    setNavLabel("finance", "Financeiro");
    setNavLabel("reports", "Relatórios");
    setNavLabel("notifications", "Notificações");
    setNavLabel("team", "Equipe & Acessos");
    setNavLabel("settings", "Configurações");
    setNavLabel("logs", "Segurança & Auditoria");
    setNavLabel("dev", "Central Dev");
    setNavLabel("exam-results", "Resultados de Provas");
    setNavLabel("exams", "Resultados de Provas");

    const dashboard = document.querySelector('.admin-nav-item[href="dashboard.html"]');
    const sales = document.querySelector('.admin-nav-item[href="painel-vendas.html"]');
    if (dashboard?.querySelector("span:last-of-type")) dashboard.querySelector("span:last-of-type").textContent = "Dashboard Premium";
    if (sales?.querySelector("span:last-of-type")) sales.querySelector("span:last-of-type").textContent = "Painel de Vendas";

    $$(".admin-nav-label", nav).forEach((label) => label.remove());

    const groups = [
      ["OPERAÇÃO", [navItem("overview"), navItem("students"), navItem("approvals"), navItem("support")]],
      ["NEGÓCIO", [navItem("finance"), navItem("reports")]],
      ["PLATAFORMA", [navItem("notifications"), navItem("exam-results") || navItem("exams"), navItem("team")]],
      ["SISTEMA", [navItem("logs"), navItem("settings")]],
      ["DEV", [navItem("dev")]],
      ["ATALHOS", [dashboard, sales]]
    ];

    groups.forEach(([title, items]) => {
      const validItems = items.filter(Boolean);
      if (!validItems.length) return;
      const label = document.createElement("span");
      label.className = "admin-nav-label";
      label.textContent = title;
      nav.appendChild(label);
      validItems.forEach((item) => nav.appendChild(item));
    });

    const iconMap = {
      overview: "home", students: "users", approvals: "check", support: "headset",
      finance: "finance", reports: "report", notifications: "bell", team: "team",
      logs: "shield", settings: "settings", dev: "code", exams: "file", "exam-results": "file"
    };
    $$("[data-section]", nav).forEach((item) => {
      const holder = item.querySelector(".admin-nav-icon");
      if (holder) holder.innerHTML = icon(iconMap[item.dataset.section] || "home");
    });
    if (dashboard?.querySelector(".admin-nav-icon")) dashboard.querySelector(".admin-nav-icon").innerHTML = icon("crown");
    if (sales?.querySelector(".admin-nav-icon")) sales.querySelector(".admin-nav-icon").innerHTML = icon("cart");

    const brandMeta = document.querySelector(".admin-sidebar-brand > div span");
    if (brandMeta) brandMeta.textContent = "ADMIN COMMAND CENTER";
  }

  function decorateTopbar() {
    const searchHolder = document.querySelector(".admin-global-search > span");
    if (searchHolder) searchHolder.innerHTML = icon("search");
    const status = document.querySelector(".admin-status-pill");
    if (status) status.innerHTML = '<i></i> Sistema operacional';
  }

  function overviewMarkup() {
    const firstName = document.querySelector("[data-user-name]")?.textContent?.trim() || "Admin";
    return `
      <div class="cc-overview">
        <section class="cc-hero">
          <div class="cc-hero-copy">
            <small>ADMIN COMMAND CENTER</small>
            <h2>${escapeHTML(greeting())}, <span>${escapeHTML(firstName)}</span> 👋</h2>
            <p>${escapeHTML(dateLong())} • panorama operacional da Turma do Primo</p>
          </div>
          <div class="cc-service-strip" id="ccServiceStrip">
            <span class="cc-service"><i></i> Verificando serviços…</span>
          </div>
        </section>

        <section class="cc-kpis">
          <article class="cc-kpi blue"><span class="cc-kpi-icon">${icon("users")}</span><div><small>Usuários totais</small><strong id="ccTotalUsers">—</strong><span id="ccUsersGrowth"></span></div></article>
          <article class="cc-kpi gold"><span class="cc-kpi-icon">${icon("crown")}</span><div><small>Premium ativos</small><strong id="ccPremiumUsers">—</strong><em>acesso vigente</em></div></article>
          <article class="cc-kpi"><span class="cc-kpi-icon">${icon("users")}</span><div><small>Free ativos</small><strong id="ccFreeUsers">—</strong><em>base gratuita</em></div></article>
          <article class="cc-kpi green"><span class="cc-kpi-icon">${icon("finance")}</span><div><small>Faturamento no mês</small><strong id="ccRevenue">—</strong><span id="ccRevenueGrowth"></span></div></article>
          <article class="cc-kpi"><span class="cc-kpi-icon">${icon("report")}</span><div><small>Conversão Free → Premium</small><strong id="ccConversion">—</strong><em>sobre a base total</em></div></article>
        </section>

        <section class="cc-primary-grid">
          <article class="cc-card">
            <header class="cc-card-head">
              <div class="cc-card-title"><span>${icon("report")}</span><div><strong>Crescimento da plataforma</strong><small>Dados operacionais do backend</small></div></div>
              <div class="cc-chart-tabs" aria-label="Período">
                <button type="button" data-cc-days="7" class="active">7 dias</button>
                <button type="button" data-cc-days="14">14 dias</button>
                <button type="button" data-cc-days="30">30 dias</button>
              </div>
            </header>
            <div class="cc-card-head" style="min-height:40px;padding-top:7px;padding-bottom:7px;border-top:0">
              <div class="cc-chart-tabs" aria-label="Métrica">
                <button type="button" data-cc-mode="users" class="active">Usuários</button>
                <button type="button" data-cc-mode="revenue">Receita</button>
                <button type="button" data-cc-mode="sales">Vendas</button>
              </div>
              <span style="font-size:7px;color:#626c7e" id="ccChartLegend">Novos usuários • Vendas confirmadas</span>
            </div>
            <div class="cc-chart"><canvas id="ccChart"></canvas><div class="cc-chart-tip" id="ccChartTip" hidden></div></div>
          </article>

          <article class="cc-card">
            <header class="cc-card-head"><div class="cc-card-title"><span>${icon("activity")}</span><div><strong>Operação agora</strong><small>O que precisa da sua atenção</small></div></div><button class="cc-card-link" type="button" data-cc-open="overview">Atualizar</button></header>
            <div class="cc-operation" id="ccOperation"><div class="admin-empty-state">Carregando pendências…</div></div>
          </article>
        </section>

        <section class="cc-secondary-grid">
          <article class="cc-card">
            <header class="cc-card-head"><div class="cc-card-title"><span>${icon("activity")}</span><div><strong>Atividades em tempo real</strong><small>Movimentos recentes da operação</small></div></div><button class="cc-card-link" type="button" data-cc-refresh>Atualizar</button></header>
            <div class="cc-activity-list" id="ccActivities"><div class="admin-empty-state">Carregando atividades…</div></div>
          </article>

          <article class="cc-card" id="ccSecurityPreview">
            <header class="cc-card-head"><div class="cc-card-title"><span>${icon("shield")}</span><div><strong>Segurança & Auditoria</strong><small>Eventos reais das últimas 24 horas</small></div></div><button class="cc-card-link" type="button" data-cc-open="logs">Ver tudo →</button></header>
            <div class="cc-security"><div class="admin-empty-state">Carregando segurança…</div></div>
          </article>
        </section>

        <section class="cc-bottom-grid">
          <article class="cc-card">
            <header class="cc-card-head"><div class="cc-card-title"><span>${icon("users")}</span><div><strong>Controle de Alunos</strong><small>Cadastros mais recentes</small></div></div><button class="cc-card-link" type="button" data-cc-open="students">Ver todos →</button></header>
            <div class="cc-preview-list" id="ccStudents"><div class="admin-empty-state">Carregando alunos…</div></div>
          </article>
          <article class="cc-card" id="ccTeamPreview">
            <header class="cc-card-head"><div class="cc-card-title"><span>${icon("team")}</span><div><strong>Equipe & Acessos</strong><small>Contas operacionais</small></div></div><button class="cc-card-link" type="button" data-cc-open="team">Ver todos →</button></header>
            <div class="cc-preview-list" id="ccTeam"><div class="admin-empty-state">Carregando equipe…</div></div>
          </article>
        </section>
      </div>`;
  }

  function renderOverviewShell() {
    const section = $("section-overview");
    if (!section || section.dataset.ccRendered) return;
    section.dataset.ccRendered = "1";
    section.innerHTML = overviewMarkup();
  }

  function serviceMarkup(services) {
    return Object.values(services || {}).map((service) => `<span class="cc-service ${escapeHTML(service.status)}"><i></i>${escapeHTML(service.label)} ${service.status === "configurada" ? "configurada" : service.status === "online" ? "online" : "indisponível"}</span>`).join("");
  }

  function operationMarkup(operation) {
    const items = [
      ["approvals", "file", "Aprovações pendentes", "Acessos aguardando análise", operation.aprovacoesPendentes, false],
      ["support", "headset", "Chamados urgentes", "Precisam de atendimento imediato", operation.chamadosUrgentes, true],
      ["exam-results", "file", "Provas em análise", "Resultados aguardando revisão", operation.provasEmAnalise, false],
      ["students", "crown", "Premium próximos do vencimento", "Acessos nos próximos 7 dias", operation.premiumExpirando, false]
    ];
    return items.map(([section, iconName, title, desc, count, danger]) => `
      <button type="button" data-cc-open="${section}"><span class="ico">${icon(iconName)}</span><span><strong>${escapeHTML(title)}</strong><small>${escapeHTML(desc)}</small></span><span class="cc-count ${danger ? "danger" : ""}">${number(count)}</span>${icon("arrow")}</button>
    `).join("");
  }

  function activityIcon(type) {
    return { payment: "finance", support: "headset", security: "shield", user: "users" }[type] || "activity";
  }

  function renderActivities(items) {
    const holder = $("ccActivities");
    if (!holder) return;
    if (!items?.length) { holder.innerHTML = '<div class="admin-empty-state">Nenhuma atividade recente.</div>'; return; }
    holder.innerHTML = items.map((item) => `
      <div class="cc-activity ${escapeHTML(item.type)}"><span class="cc-activity-icon">${icon(activityIcon(item.type))}</span><div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.description)}</small></div><time>${escapeHTML(relative(item.createdAt))}</time></div>
    `).join("");
  }

  function renderStudents(items) {
    const holder = $("ccStudents");
    if (!holder) return;
    if (!items?.length) { holder.innerHTML = '<div class="admin-empty-state">Nenhum aluno cadastrado.</div>'; return; }
    holder.innerHTML = items.slice(0, 6).map((item) => {
      const plan = planLabel(item.plano);
      const free = String(item.plano || "free") === "free";
      return `<div class="cc-preview-row"><span class="cc-avatar">${escapeHTML((item.nome || "A").charAt(0).toUpperCase())}</span><div><strong>${escapeHTML(item.nome)}</strong><small>${escapeHTML(item.email)}</small></div><span class="cc-plan ${free ? "free" : ""}">${escapeHTML(plan)}</span><span class="cc-status ${escapeHTML(item.status)}">${escapeHTML(item.status)}</span></div>`;
    }).join("");
  }

  async function renderTeam() {
    const holder = $("ccTeam");
    const card = $("ccTeamPreview");
    if (!holder || !card) return;
    const teamNav = findNav("team");
    if (!teamNav || teamNav.hidden) { card.hidden = true; return; }
    try {
      const data = await api("/admin/equipe");
      const team = data.equipe || [];
      if (!team.length) { holder.innerHTML = '<div class="admin-empty-state">Nenhuma conta de equipe.</div>'; return; }
      holder.innerHTML = team.slice(0, 6).map((item) => `<div class="cc-preview-row"><span class="cc-avatar">${escapeHTML((item.nome || "E").charAt(0).toUpperCase())}</span><div><strong>${escapeHTML(item.nome || "Equipe")}</strong><small>${escapeHTML(item.email || "")}</small></div><span class="cc-plan">${escapeHTML(item.cargo || "equipe")}</span><span class="cc-status ${escapeHTML(item.status || "ativo")}">${escapeHTML(item.status || "ativo")}</span></div>`).join("");
    } catch (_) { holder.innerHTML = '<div class="admin-empty-state">Equipe disponível na área dedicada.</div>'; }
  }

  function securitySummaryMarkup(data, compact = true) {
    const s = data?.resumo || {};
    const events = (data?.eventos || []).slice(0, compact ? 4 : 30);
    return `
      <div class="${compact ? "cc-security-kpis" : "cc-security-full-kpis"}">
        <div class="cc-security-kpi"><span>${icon("logout")}</span><div><strong>${number(s.revogacoes24h)}</strong><small>Revogações 24h</small></div></div>
        <div class="cc-security-kpi red"><span>${icon("ban")}</span><div><strong>${number(s.contasSuspensas)}</strong><small>Contas suspensas</small></div></div>
        <div class="cc-security-kpi gold"><span>${icon("lock")}</span><div><strong>${number(s.contasBloqueadas)}</strong><small>Contas bloqueadas</small></div></div>
        <div class="cc-security-kpi purple"><span>${icon("shield")}</span><div><strong>${number(s.eventosCriticos24h)}</strong><small>Eventos críticos 24h</small></div></div>
        ${compact ? "" : `<div class="cc-security-kpi"><span>${icon("activity")}</span><div><strong>${number(s.eventos24h)}</strong><small>Eventos auditados 24h</small></div></div>`}
      </div>
      <div class="cc-security-events">${events.length ? events.map((event) => `<div class="cc-security-event"><code>${escapeHTML(String(event.evento || "EVENT").toUpperCase().replaceAll(".", "_"))}</code><span>${escapeHTML(event.alvo || event.ator || "Sistema")}</span><time>${escapeHTML(relative(event.createdAt))}</time></div>`).join("") : '<div class="admin-empty-state">Nenhum evento recente.</div>'}</div>`;
  }

  async function loadSecurityPreview() {
    const card = $("ccSecurityPreview");
    const nav = findNav("logs");
    if (!card) return;
    if (!nav || nav.hidden) { card.hidden = true; return; }
    try {
      state.security = await api("/admin/command-center/security");
      const body = card.querySelector(".cc-security");
      if (body) body.innerHTML = securitySummaryMarkup(state.security, true);
    } catch (_) {
      const body = card.querySelector(".cc-security");
      if (body) body.innerHTML = '<div class="admin-empty-state">Auditoria disponível na área de Segurança.</div>';
    }
  }

  async function loadOverview(force = false) {
    if (!force && state.overview?.periodo?.dias === state.chartDays) { drawChart(); return; }
    const [overview, status] = await Promise.all([
      api(`/admin/command-center/overview?dias=${state.chartDays}`),
      api("/admin/command-center/status")
    ]);
    state.overview = overview;
    state.chartPoints = overview.serie || [];

    const m = overview.indicadores || {};
    if ($("ccTotalUsers")) $("ccTotalUsers").textContent = number(m.totalUsuarios);
    if ($("ccPremiumUsers")) $("ccPremiumUsers").textContent = number(m.premiumAtivos);
    if ($("ccFreeUsers")) $("ccFreeUsers").textContent = number(m.freeAtivos);
    if ($("ccRevenue")) $("ccRevenue").textContent = money(m.faturamentoMes);
    if ($("ccConversion")) $("ccConversion").textContent = `${Number(m.conversao || 0).toFixed(1).replace(".", ",")}%`;
    if ($("ccUsersGrowth")) $("ccUsersGrowth").innerHTML = growth(m.crescimentoUsuarios);
    if ($("ccRevenueGrowth")) $("ccRevenueGrowth").innerHTML = growth(m.crescimentoFaturamento);
    if ($("ccServiceStrip")) $("ccServiceStrip").innerHTML = serviceMarkup(status.services);
    if ($("ccOperation")) $("ccOperation").innerHTML = operationMarkup(overview.operacao || {});
    renderActivities(overview.atividades || []);
    renderStudents(overview.alunosRecentes || []);
    drawChart();
    loadSecurityPreview();
    renderTeam();
  }

  function chartValues(point) {
    if (state.chartMode === "revenue") return [Number(point.faturamento || 0)];
    if (state.chartMode === "sales") return [Number(point.vendas || 0)];
    return [Number(point.usuarios || 0), Number(point.vendas || 0)];
  }

  function drawChart() {
    const canvas = $("ccChart");
    if (!canvas || !state.chartPoints.length) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    const width = rect.width, height = rect.height;
    const padding = { left: 34, right: 14, top: 16, bottom: 28 };
    const cw = width - padding.left - padding.right;
    const ch = height - padding.top - padding.bottom;
    const all = state.chartPoints.flatMap(chartValues);
    const max = Math.max(...all, 1) * 1.15;

    ctx.clearRect(0, 0, width, height);
    ctx.font = "7px Inter, sans-serif";
    ctx.strokeStyle = "rgba(255,255,255,.055)";
    ctx.fillStyle = "#596273";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = padding.top + (ch / 4) * i;
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
      const value = max - (max / 4) * i;
      ctx.fillText(state.chartMode === "revenue" ? compactMoney(value) : Math.round(value).toString(), 2, y + 3);
    }

    const step = state.chartPoints.length > 1 ? cw / (state.chartPoints.length - 1) : cw;
    const series = state.chartMode === "users"
      ? [{ key: "usuarios", stroke: "#9b5cff", fill: "rgba(139,92,246,.2)" }, { key: "vendas", stroke: "#f2b843", fill: null }]
      : [{ key: state.chartMode === "revenue" ? "faturamento" : "vendas", stroke: state.chartMode === "revenue" ? "#39d67f" : "#9b5cff", fill: state.chartMode === "revenue" ? "rgba(47,210,118,.14)" : "rgba(139,92,246,.16)" }];

    series.forEach((serie, seriesIndex) => {
      const points = state.chartPoints.map((item, index) => ({ x: padding.left + step * index, y: padding.top + ch - (Number(item[serie.key] || 0) / max) * ch, item }));
      if (serie.fill) {
        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        gradient.addColorStop(0, serie.fill); gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.lineTo(points.at(-1).x, height - padding.bottom); ctx.lineTo(points[0].x, height - padding.bottom); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
      }
      ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.strokeStyle = serie.stroke; ctx.lineWidth = seriesIndex ? 1.5 : 2; ctx.shadowColor = serie.stroke; ctx.shadowBlur = seriesIndex ? 0 : 8; ctx.stroke(); ctx.shadowBlur = 0;
      points.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fillStyle = serie.stroke; ctx.fill(); });
    });

    const labelEvery = Math.max(1, Math.ceil(state.chartPoints.length / 8));
    state.chartPoints.forEach((item, index) => {
      if (index % labelEvery && index !== state.chartPoints.length - 1) return;
      ctx.fillStyle = "#596273"; ctx.textAlign = "center"; ctx.fillText(item.rotulo, padding.left + step * index, height - 8);
    });

    canvas.onmousemove = (event) => {
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const index = Math.max(0, Math.min(state.chartPoints.length - 1, Math.round((x - padding.left) / step)));
      const item = state.chartPoints[index];
      const tip = $("ccChartTip"); if (!tip) return;
      tip.innerHTML = `<strong>${escapeHTML(item.rotulo)}</strong><br>${number(item.usuarios)} novo(s) usuário(s)<br>${number(item.vendas)} venda(s)<br>${money(item.faturamento)}`;
      tip.style.left = `${Math.min(width - 142, Math.max(8, padding.left + step * index + 8))}px`;
      tip.style.top = "18px"; tip.hidden = false;
    };
    canvas.onmouseleave = () => { const tip = $("ccChartTip"); if (tip) tip.hidden = true; };
  }

  function compactMoney(value) {
    const n = Number(value || 0);
    if (n >= 1000000) return `R$ ${(n / 1000000).toFixed(1)}m`;
    if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
    return `R$ ${Math.round(n)}`;
  }

  function openSection(section) {
    const target = findNav(section) || (section === "exam-results" ? findNav("exams") : null);
    if (target && !target.hidden) target.click();
  }

  function renderSecuritySection() {
    const section = $("section-logs");
    if (!section || section.hidden) return;
    section.classList.add("cc-security-section");
    section.dataset.title = "Segurança & Auditoria";
    section.innerHTML = `
      <div class="admin-section-head"><div><span class="admin-kicker">SEGURANÇA</span><h2>Segurança & Auditoria</h2><p>Revogações, bloqueios e alterações administrativas registradas pelo backend.</p></div><button class="admin-primary-btn" type="button" id="ccRefreshSecurity">↻ Atualizar</button></div>
      <div id="ccSecurityFull"><div class="admin-empty-state">Carregando auditoria…</div></div>`;
    loadFullSecurity();
  }

  async function loadFullSecurity() {
    const holder = $("ccSecurityFull");
    if (!holder) return;
    try {
      state.security = await api("/admin/command-center/security");
      holder.innerHTML = `${securitySummaryMarkup(state.security, false)}<div class="cc-audit-filters"><button class="active" type="button" data-audit-filter="all">Todos</button><button type="button" data-audit-filter="login">Login</button><button type="button" data-audit-filter="role">Permissões</button><button type="button" data-audit-filter="session">Sessões</button><button type="button" data-audit-filter="account">Contas</button></div><div class="admin-panel-card"><div class="cc-security-events" id="ccAuditEventList"></div></div>`;
      renderAuditEvents();
    } catch (error) { holder.innerHTML = `<div class="admin-empty-state">${escapeHTML(error.message)}</div>`; }
  }

  function renderAuditEvents() {
    const holder = $("ccAuditEventList");
    if (!holder) return;
    const filter = state.auditFilter;
    const items = (state.security?.eventos || []).filter((item) => {
      if (filter === "all") return true;
      const event = String(item.evento || "").toLowerCase();
      if (filter === "login") return event.includes("login") || event.includes("auth");
      if (filter === "role") return event.includes("role") || event.includes("permission") || event.includes("staff");
      if (filter === "session") return event.includes("session") || event.includes("logout") || event.includes("token");
      if (filter === "account") return event.includes("block") || event.includes("suspend") || event.includes("account") || event.includes("premium");
      return true;
    });
    holder.innerHTML = items.length ? items.map((event) => `<div class="cc-security-event"><code>${escapeHTML(String(event.evento || "EVENT").toUpperCase().replaceAll(".", "_"))}</code><span>${escapeHTML(event.alvo || event.ator || "Sistema")}</span><time>${escapeHTML(relative(event.createdAt))}</time></div>`).join("") : '<div class="admin-empty-state">Nenhum evento neste filtro.</div>';
  }

  function polishSections() {
    const map = {
      students: ["BASE DE ALUNOS", "Controle de Alunos", "Pesquise a base, acompanhe plano e validade e execute ações administrativas com segurança."],
      approvals: ["OPERAÇÃO PREMIUM", "Aprovações", "Analise solicitações pendentes antes de liberar qualquer acesso manual."],
      team: ["CONTROLE DE ACESSO", "Equipe & Acessos", "Gerencie cargos, permissões e contas operacionais da Turma do Primo."],
      finance: ["NEGÓCIO", "Financeiro", "Receita, vendas confirmadas, ticket médio e comissões em um único lugar."],
      support: ["ATENDIMENTO", "Central de Suporte", "Priorize chamados, responda usuários e acompanhe atendimentos urgentes."],
      reports: ["ANÁLISE", "Relatórios", "Visão consolidada da operação e acesso às métricas comerciais."],
      settings: ["SISTEMA", "Configurações", "Parâmetros operacionais da plataforma e modo de manutenção."],
      dev: ["ÁREA TÉCNICA", "Central Dev", "Permissões e controles que afetam a autorização real do backend."]
    };
    Object.entries(map).forEach(([sectionName, [kicker, title, desc]]) => {
      const section = $(`section-${sectionName}`); if (!section) return;
      const head = section.querySelector(".admin-section-head"); if (!head) return;
      const kickerEl = head.querySelector(".admin-kicker"); const titleEl = head.querySelector("h2"); const descEl = head.querySelector("p");
      if (kickerEl) kickerEl.textContent = kicker; if (titleEl) titleEl.textContent = title; if (descEl) descEl.textContent = desc;
    });
  }

  function registerEvents() {
    document.addEventListener("click", (event) => {
      const days = event.target.closest("[data-cc-days]");
      if (days) {
        state.chartDays = Number(days.dataset.ccDays || 7);
        $$('[data-cc-days]').forEach((button) => button.classList.toggle("active", button === days));
        loadOverview(true).catch(() => {});
        return;
      }
      const mode = event.target.closest("[data-cc-mode]");
      if (mode) {
        state.chartMode = mode.dataset.ccMode || "users";
        $$('[data-cc-mode]').forEach((button) => button.classList.toggle("active", button === mode));
        if ($("ccChartLegend")) $("ccChartLegend").textContent = state.chartMode === "users" ? "Novos usuários • Vendas confirmadas" : state.chartMode === "revenue" ? "Faturamento confirmado" : "Vendas confirmadas";
        drawChart(); return;
      }
      const open = event.target.closest("[data-cc-open]");
      if (open) {
        if (open.dataset.ccOpen === "overview") loadOverview(true).catch(() => {});
        else openSection(open.dataset.ccOpen);
        return;
      }
      if (event.target.closest("[data-cc-refresh]")) { loadOverview(true).catch(() => {}); return; }
      if (event.target.closest("#ccRefreshSecurity")) { loadFullSecurity(); return; }
      const filter = event.target.closest("[data-audit-filter]");
      if (filter) {
        state.auditFilter = filter.dataset.auditFilter;
        $$('[data-audit-filter]').forEach((button) => button.classList.toggle("active", button === filter));
        renderAuditEvents(); return;
      }
      const nav = event.target.closest('[data-section="logs"]');
      if (nav) setTimeout(renderSecuritySection, 70);
    }, true);
    window.addEventListener("resize", () => { clearTimeout(window.__ccResize); window.__ccResize = setTimeout(drawChart, 120); });
  }

  async function init() {
    rebuildNavigation();
    decorateTopbar();
    polishSections();
    renderOverviewShell();
    registerEvents();
    try { await loadOverview(true); } catch (error) {
      const holder = $("ccOperation"); if (holder) holder.innerHTML = `<div class="admin-empty-state">${escapeHTML(error.message)}</div>`;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 25), { once: true });
  else setTimeout(init, 25);
})();
