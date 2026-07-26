"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = {
    permissions: {},
    overview: null,
    notifications: [],
    tickets: [],
    exams: [],
    chartPoints: [],
    initialized: false,
    timers: {}
  };

  document.addEventListener("DOMContentLoaded", init, { once: true });

  function getToken() {
    for (const key of TOKEN_KEYS) {
      try {
        const value = sessionStorage.getItem(key);
        if (value) return value;
      } catch (_) {}
    }
    return "";
  }

  async function api(endpoint, options = {}) {
    const token = getToken();
    if (!token) throw new Error("Sessão expirada.");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 22000);
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    };

    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    try {
      const response = await fetch(`${window.location.origin}${endpoint}`, {
        method: options.method || "GET",
        headers,
        signal: controller.signal,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
      });

      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; }
      catch (_) { data = { erro: text || "Resposta inválida do servidor." }; }

      if (!response.ok || data.erro) {
        const error = new Error(data.erro || data.mensagem || `Erro ${response.status}.`);
        error.status = response.status;
        throw error;
      }

      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("O servidor demorou para responder.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(Number(value || 0));
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
  }

  function formatDate(value, withTime = true) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("pt-BR", withTime
      ? { dateStyle: "short", timeStyle: "short" }
      : { dateStyle: "short" }
    ).format(date);
  }

  function relativeTime(value) {
    if (!value) return "";
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    const minutes = Math.max(0, Math.floor(diff / 60000));
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    const days = Math.floor(hours / 24);
    return `há ${days} dia${days === 1 ? "" : "s"}`;
  }

  function planLabel(plan) {
    const map = {
      free: "Free",
      black30: "Black 30 dias",
      black90: "Black 90 dias",
      black180: "Black 180 dias",
      black360: "Black 360 dias",
      particular: "Mentoria Particular",
      admin: "Administrativo"
    };
    return map[plan] || plan || "Não informado";
  }

  function statusChip(status, label = "") {
    const value = String(status || "normal").toLowerCase();
    return `<span class="admin-chip ${escapeHTML(value)}">${escapeHTML(label || value.replaceAll("_", " "))}</span>`;
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = String(value ?? "—");
  }

  function debounce(key, callback, delay = 350) {
    clearTimeout(state.timers[key]);
    state.timers[key] = setTimeout(callback, delay);
  }

  function toast(message, type = "success") {
    const stack = $("adminToastStack");
    if (!stack) return;
    const item = document.createElement("div");
    item.className = `admin-toast ${type}`;
    item.innerHTML = `<b>${type === "error" ? "!" : "✓"}</b><span>${escapeHTML(message)}</span>`;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => {
      item.classList.remove("show");
      setTimeout(() => item.remove(), 220);
    }, 4200);
  }

  function hasPermission(permission) {
    return Boolean(state.permissions?.[permission]);
  }

  async function init() {
    registerEvents();
    try {
      const context = await api("/admin/painel/contexto");
      state.permissions = context.permissoes || {};
      state.initialized = true;
      await loadOverview();
      if (hasPermission("notificacoes")) loadNotificationSummary().catch(() => {});
      if (hasPermission("suporte")) loadSupportSummary().catch(() => {});
    } catch (error) {
      if (![401, 403].includes(error.status)) toast(error.message, "error");
    }
  }

  function registerEvents() {
    $$('[data-section]').forEach((button) => {
      button.addEventListener("click", () => {
        const section = button.dataset.section;
        setTimeout(() => loadSection(section), 20);
      });
    });

    $$('[data-section-trigger]').forEach((button) => {
      button.addEventListener("click", () => {
        const section = button.dataset.sectionTrigger;
        setTimeout(() => loadSection(section), 20);
      });
    });

    $("refreshOverview")?.addEventListener("click", () => loadOverview(true));
    $("overviewChartPeriod")?.addEventListener("change", () => loadOverview(true));
    window.addEventListener("resize", () => debounce("chart-resize", drawOverviewChart, 160));

    $("financePeriod")?.addEventListener("change", loadFinance);

    $("newNotificationButton")?.addEventListener("click", () => toggleNotificationComposer(true));
    $("closeNotificationComposer")?.addEventListener("click", () => toggleNotificationComposer(false));
    $("notificationDestination")?.addEventListener("change", updateNotificationDestination);
    $("notificationForm")?.addEventListener("submit", submitNotification);
    $("refreshNotifications")?.addEventListener("click", loadNotifications);
    $("notificationSearch")?.addEventListener("input", () => debounce("notification-search", loadNotifications));
    $("notificationFilterDestination")?.addEventListener("change", loadNotifications);
    $("notificationFilterStatus")?.addEventListener("change", loadNotifications);

    $("refreshSupport")?.addEventListener("click", loadSupport);
    $("supportSearch")?.addEventListener("input", () => debounce("support-search", loadSupport));
    $("supportStatus")?.addEventListener("change", loadSupport);
    $("supportPriority")?.addEventListener("change", loadSupport);
    $("closeSupportModal")?.addEventListener("click", closeSupportModal);
    $("supportReplyForm")?.addEventListener("submit", submitSupportReply);

    $("newExamButton")?.addEventListener("click", () => openExamModal());
    $("closeExamModal")?.addEventListener("click", closeExamModal);
    $("cancelExamModal")?.addEventListener("click", closeExamModal);
    $("examForm")?.addEventListener("submit", submitExam);
    $("refreshExams")?.addEventListener("click", loadExams);
    $("examSearch")?.addEventListener("input", () => debounce("exam-search", loadExams));
    $("examStatus")?.addEventListener("change", loadExams);

    $("settingsForm")?.addEventListener("submit", saveSettings);
    $("refreshLogs")?.addEventListener("click", loadLogs);

    $("adminGlobalSearch")?.addEventListener("input", filterNavigation);
    $("adminGlobalSearch")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const first = $$(".admin-nav-item").find((item) => !item.hidden && item.style.display !== "none");
        first?.click();
      }
    });

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        $("adminGlobalSearch")?.focus();
      }
      if (event.key === "Escape") {
        closeSupportModal();
        closeExamModal();
        toggleNotificationComposer(false);
      }
    });

    document.addEventListener("click", handleDelegatedClick);
  }

  async function loadSection(section) {
    if (!state.initialized) return;
    try {
      if (section === "overview") await loadOverview();
      if (section === "finance" && hasPermission("financas")) await loadFinance();
      if (section === "notifications" && hasPermission("notificacoes")) await loadNotifications();
      if (section === "support" && hasPermission("suporte")) await loadSupport();
      if (section === "exams" && hasPermission("provas")) await loadExams();
      if (section === "settings" && hasPermission("configuracoes")) await loadSettings();
      if (section === "logs" && hasPermission("seguranca")) await loadLogs();
    } catch (error) {
      toast(error.message || "Não foi possível carregar esta área.", "error");
    }
  }

  function triggerSection(section) {
    const button = document.querySelector(`[data-section="${section}"]`);
    if (button && !button.hidden) button.click();
  }

  async function loadOverview(force = false) {
    const days = Number($("overviewChartPeriod")?.value || 7);
    if (!force && state.overview?.periodo?.dias === days) {
      drawOverviewChart();
      return;
    }

    const data = await api(`/admin/dashboard/visao-geral?dias=${days}`);
    state.overview = data;
    renderOverview(data);
  }

  function setGrowth(id, value, suffix) {
    const element = $(id);
    if (!element) return;
    const number = Number(value || 0);
    element.textContent = `${number >= 0 ? "+" : ""}${number.toFixed(1)}% ${suffix}`;
    element.classList.toggle("admin-growth-positive", number >= 0);
    element.classList.toggle("admin-growth-negative", number < 0);
  }

  function renderOverview(data) {
    const metrics = data.indicadores || {};
    setText("statTotalUsers", formatNumber(metrics.totalUsuarios));
    setText("statSalesMonth", formatNumber(metrics.vendasMes));
    setText("statRevenueMonth", formatMoney(metrics.faturamentoMes));
    setText("statConversion", `${Number(metrics.conversao || 0).toFixed(2).replace(".", ",")}%`);
    setText("statPendingCodes", formatNumber(metrics.codigosPendentes));
    setText("statOpenTickets", formatNumber(metrics.chamadosAbertos));
    setGrowth("statUsersGrowth", metrics.crescimentoUsuarios, "este mês");
    setGrowth("statSalesGrowth", metrics.crescimentoVendas, "este mês");
    setGrowth("statRevenueGrowth", metrics.crescimentoFaturamento, "este mês");

    setText("reportUsers", formatNumber(metrics.totalUsuarios));
    setText("reportSales", formatNumber(metrics.vendasMes));
    setText("reportPending", formatNumber(metrics.codigosPendentes));

    const approvalBadge = $("approvalMenuBadge");
    if (approvalBadge) {
      approvalBadge.textContent = String(metrics.codigosPendentes || 0);
      approvalBadge.hidden = !Number(metrics.codigosPendentes);
    }

    state.chartPoints = Array.isArray(data.serieVendas) ? data.serieVendas : [];
    drawOverviewChart();
    renderActivities(data.atividades || []);
    renderAlerts(data.alertas || []);
    renderTopPlans(data.topPlanos || []);
    renderFunnel(data.funil || []);
  }

  function renderActivities(items) {
    const list = $("overviewActivityList");
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="admin-empty-state">Nenhuma atividade registrada.</div>';
      return;
    }

    list.innerHTML = items.map((item) => `
      <div class="admin-activity-item">
        <span class="admin-activity-icon">${escapeHTML(item.icone || "•")}</span>
        <div><strong>${escapeHTML(item.titulo)}</strong><small>${escapeHTML(item.descricao)}</small></div>
        <span class="admin-activity-time">${escapeHTML(relativeTime(item.createdAt))}</span>
      </div>
    `).join("");
  }

  function renderAlerts(items) {
    const list = $("overviewAlertsList");
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="admin-empty-state">Tudo certo. Nenhum alerta importante.</div>';
      return;
    }

    list.innerHTML = items.map((item) => `
      <button class="admin-alert-item ${escapeHTML(item.tipo || "info")}" type="button" data-alert-section="${escapeHTML(item.destino || "overview")}">
        <strong>${escapeHTML(item.titulo)}</strong>
        <small>${escapeHTML(item.descricao)}</small>
      </button>
    `).join("");
  }

  function renderTopPlans(items) {
    const list = $("overviewTopPlans");
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="admin-empty-state">Ainda não há vendas confirmadas.</div>';
      return;
    }

    list.innerHTML = items.map((item) => `
      <div class="admin-ranking-row">
        <span class="admin-ranking-position">${item.posicao}</span>
        <div><strong>${escapeHTML(planLabel(item.plano))}</strong><small>${formatNumber(item.vendas)} venda(s)</small></div>
        <span class="admin-ranking-value">${formatMoney(item.faturamento)}</span>
      </div>
    `).join("");
  }

  function renderFunnel(items) {
    const list = $("overviewFunnel");
    if (!list) return;
    const max = Math.max(...items.map((item) => Number(item.total || 0)), 1);
    list.innerHTML = items.map((item) => {
      const width = Math.max(2, (Number(item.total || 0) / max) * 100);
      return `
        <div class="admin-funnel-row">
          <div class="admin-funnel-head"><span>${escapeHTML(item.etapa)}</span><strong>${formatNumber(item.total)}</strong></div>
          <div class="admin-funnel-bar"><span style="width:${width}%"></span></div>
        </div>
      `;
    }).join("");
  }

  function drawOverviewChart() {
    const canvas = $("overviewSalesChart");
    if (!canvas || !state.chartPoints.length) return;

    const box = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(320, box.width * ratio);
    canvas.height = Math.max(250, box.height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const width = box.width;
    const height = box.height;
    const padding = { top: 24, right: 22, bottom: 38, left: 58 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const points = state.chartPoints;
    const maxRevenue = Math.max(...points.map((item) => Number(item.faturamento || 0)), 1);
    const maxSales = Math.max(...points.map((item) => Number(item.vendas || 0)), 1);

    ctx.clearRect(0, 0, width, height);
    ctx.font = "10px Inter";
    ctx.strokeStyle = "rgba(255,255,255,.055)";
    ctx.fillStyle = "#807789";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      const value = maxRevenue - (maxRevenue / 4) * i;
      ctx.fillText(formatCompactMoney(value), 4, y + 4);
    }

    const step = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth;
    const revenueCoordinates = points.map((item, index) => ({
      x: padding.left + step * index,
      y: padding.top + chartHeight - (Number(item.faturamento || 0) / maxRevenue) * chartHeight,
      item
    }));

    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, "rgba(180,92,255,.38)");
    gradient.addColorStop(1, "rgba(180,92,255,0)");

    ctx.beginPath();
    revenueCoordinates.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(revenueCoordinates.at(-1).x, height - padding.bottom);
    ctx.lineTo(revenueCoordinates[0].x, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    revenueCoordinates.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = "#b45cff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(180,92,255,.55)";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    revenueCoordinates.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#c270ff";
      ctx.fill();

      if (points.length <= 14 || index % Math.ceil(points.length / 8) === 0 || index === points.length - 1) {
        ctx.fillStyle = "#7f7689";
        ctx.textAlign = "center";
        ctx.fillText(point.item.rotulo, point.x, height - 12);
      }
    });

    ctx.beginPath();
    points.forEach((item, index) => {
      const x = padding.left + step * index;
      const y = padding.top + chartHeight - (Number(item.vendas || 0) / maxSales) * chartHeight;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#3fd879";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    canvas.onmousemove = (event) => showChartTooltip(event, revenueCoordinates, canvas);
    canvas.onmouseleave = () => { const tooltip = $("overviewChartTooltip"); if (tooltip) tooltip.hidden = true; };
  }

  function formatCompactMoney(value) {
    const number = Number(value || 0);
    if (number >= 1000000) return `R$ ${(number / 1000000).toFixed(1)} mi`;
    if (number >= 1000) return `R$ ${(number / 1000).toFixed(1)}k`;
    return `R$ ${Math.round(number)}`;
  }

  function showChartTooltip(event, coordinates, canvas) {
    const tooltip = $("overviewChartTooltip");
    if (!tooltip) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const nearest = coordinates.reduce((best, point) => Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best, coordinates[0]);
    tooltip.innerHTML = `<strong>${escapeHTML(nearest.item.rotulo)}</strong><br>${formatMoney(nearest.item.faturamento)}<br>${formatNumber(nearest.item.vendas)} venda(s)`;
    tooltip.style.left = `${Math.min(rect.width - 165, Math.max(8, nearest.x + 10))}px`;
    tooltip.style.top = `${Math.max(8, nearest.y - 55)}px`;
    tooltip.hidden = false;
  }

  async function loadFinance() {
    const days = Number($("financePeriod")?.value || 30);
    const data = await api(`/admin/financeiro/resumo?dias=${days}`);
    const summary = data.resumo || {};
    setText("financeRevenue", formatMoney(summary.faturamento));
    setText("financePaid", formatNumber(summary.pagas));
    setText("financePending", formatNumber(summary.pendentes));
    setText("financeTicket", formatMoney(summary.ticketMedio));

    const ranking = $("financeRanking");
    if (ranking) {
      ranking.innerHTML = (data.ranking || []).length
        ? data.ranking.map((item) => `<div class="admin-ranking-row"><span class="admin-ranking-position">${item.posicao}</span><div><strong>${escapeHTML(item.nome)}</strong><small>${formatNumber(item.vendas)} venda(s) • comissão ${formatMoney(item.comissao)}</small></div><span class="admin-ranking-value">${formatMoney(item.faturamento)}</span></div>`).join("")
        : '<div class="admin-empty-state">Nenhuma venda paga no período.</div>';
    }

    const salesList = $("financeSalesList");
    if (salesList) {
      salesList.innerHTML = (data.ultimasVendas || []).length
        ? data.ultimasVendas.slice(0, 12).map((item) => `<div class="admin-activity-item"><span class="admin-activity-icon">$</span><div><strong>${escapeHTML(item.alunoNome || "Aluno")}</strong><small>${escapeHTML(planLabel(item.plano))} • ${escapeHTML(item.vendedorNome || "Sem vendedor")}</small></div><span class="admin-ranking-value">${formatMoney(item.valor)}</span></div>`).join("")
        : '<div class="admin-empty-state">Nenhuma venda registrada.</div>';
    }
  }

  async function loadNotificationSummary() {
    const data = await api("/admin/notificacoes/resumo");
    const summary = data.resumo || {};
    const badge = $("notificationMenuBadge");
    if (badge) {
      badge.textContent = String(summary.ativas || 0);
      badge.hidden = !Number(summary.ativas);
    }
    const top = $("adminTopBadge");
    if (top) {
      top.textContent = String(summary.urgentes || summary.ativas || 0);
      top.hidden = !Number(summary.urgentes || summary.ativas);
    }
    setText("notificationTotal", summary.total || 0);
    setText("notificationActive", summary.ativas || 0);
    setText("notificationPinned", summary.fixadas || 0);
    setText("notificationUrgent", summary.urgentes || 0);
  }

  async function loadNotifications() {
    await loadNotificationSummary();
    const search = encodeURIComponent($("notificationSearch")?.value.trim() || "");
    const destination = encodeURIComponent($("notificationFilterDestination")?.value || "");
    const active = encodeURIComponent($("notificationFilterStatus")?.value || "");
    const data = await api(`/admin/notificacoes?busca=${search}&destino=${destination}&ativa=${active}&limite=150`);
    state.notifications = data.notificacoes || [];
    renderNotifications();
  }

  function renderNotifications() {
    const list = $("notificationList");
    if (!list) return;
    if (!state.notifications.length) {
      list.innerHTML = '<div class="admin-empty-state">Nenhuma notificação encontrada.</div>';
      return;
    }

    list.innerHTML = state.notifications.map((item) => `
      <article class="admin-notification-item ${item.fixada ? "pinned" : ""}">
        <span class="admin-notification-icon">${escapeHTML(item.icone || "◉")}</span>
        <div>
          <strong>${escapeHTML(item.titulo)}</strong>
          <small>${escapeHTML(item.mensagem)}</small>
          <div class="admin-notification-meta">${statusChip(item.ativa ? "ativa" : "inativa")}${statusChip(item.prioridade)}${statusChip(item.destino)}${item.fixada ? statusChip("active", "fixada") : ""}<span class="admin-chip">${formatDate(item.createdAt)}</span></div>
        </div>
        <div class="admin-item-actions">
          <button class="admin-small-action" type="button" data-notification-action="toggle" data-id="${item.id}" data-active="${item.ativa}">${item.ativa ? "Desativar" : "Ativar"}</button>
          <button class="admin-small-action" type="button" data-notification-action="pin" data-id="${item.id}" data-pinned="${item.fixada}">${item.fixada ? "Desfixar" : "Fixar"}</button>
          <button class="admin-small-action" type="button" data-notification-action="resend" data-id="${item.id}">Reenviar</button>
        </div>
      </article>
    `).join("");
  }

  function toggleNotificationComposer(show) {
    const composer = $("notificationComposer");
    if (!composer) return;
    composer.hidden = !show;
    if (show) $("notificationTitle")?.focus();
  }

  function updateNotificationDestination() {
    const specific = $("notificationDestination")?.value === "especifico";
    const field = $("notificationEmailField");
    if (field) field.hidden = !specific;
    if ($("notificationEmail")) $("notificationEmail").required = specific;
  }

  async function submitNotification(event) {
    event.preventDefault();
    const expires = $("notificationExpires")?.value;
    const body = {
      titulo: $("notificationTitle")?.value.trim(),
      mensagem: $("notificationMessage")?.value.trim(),
      destino: $("notificationDestination")?.value,
      tipo: $("notificationType")?.value,
      prioridade: $("notificationPriority")?.value,
      email: $("notificationEmail")?.value.trim(),
      expiraEm: expires ? new Date(expires).toISOString() : "",
      fixada: Boolean($("notificationPinnedInput")?.checked),
      link: $("notificationLink")?.value.trim(),
      icone: "🔔"
    };

    const button = $("notificationSubmit");
    if (button) button.disabled = true;
    try {
      await api("/admin/notificacoes", { method: "POST", body });
      event.currentTarget.reset();
      updateNotificationDestination();
      toggleNotificationComposer(false);
      toast("Notificação enviada com sucesso.");
      await loadNotifications();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function notificationAction(action, id, button) {
    button.disabled = true;
    try {
      const item = state.notifications.find((notification) => notification.id === id);
      if (!item) return;
      if (action === "toggle") {
        await api(`/admin/notificacoes/${id}/status`, { method: "POST", body: { ativa: !item.ativa } });
      }
      if (action === "pin") {
        await api(`/admin/notificacoes/${id}/${item.fixada ? "desfixar" : "fixar"}`, { method: "POST", body: {} });
      }
      if (action === "resend") {
        await api(`/admin/notificacoes/${id}/reenviar`, { method: "POST", body: {} });
      }
      toast("Notificação atualizada.");
      await loadNotifications();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function loadSupportSummary() {
    const data = await api("/admin/suporte/resumo");
    const summary = data.resumo || {};
    setText("supportOpen", summary.abertos || 0);
    setText("supportInProgress", summary.atendimento || 0);
    setText("supportAnswered", summary.respondidos || 0);
    setText("supportUrgent", summary.urgentes || 0);
    const badge = $("supportMenuBadge");
    if (badge) {
      badge.textContent = String(summary.abertos || 0);
      badge.hidden = !Number(summary.abertos);
    }
  }

  async function loadSupport() {
    await loadSupportSummary();
    const search = encodeURIComponent($("supportSearch")?.value.trim() || "");
    const status = encodeURIComponent($("supportStatus")?.value || "");
    const priority = encodeURIComponent($("supportPriority")?.value || "");
    const data = await api(`/admin/suporte?busca=${search}&status=${status}&prioridade=${priority}&limite=200`);
    state.tickets = data.chamados || [];
    renderSupport();
  }

  function renderSupport() {
    const list = $("supportList");
    if (!list) return;
    if (!state.tickets.length) {
      list.innerHTML = '<div class="admin-empty-state">Nenhum chamado encontrado.</div>';
      return;
    }

    list.innerHTML = state.tickets.map((item) => `
      <article class="admin-ticket-item" data-ticket-id="${item.id}">
        <span class="admin-ticket-icon">☏</span>
        <div><strong>${escapeHTML(item.assunto)}</strong><small>${escapeHTML(item.nome || item.email)} • ${escapeHTML(item.mensagem)}</small><div class="admin-ticket-meta">${statusChip(item.status)}${statusChip(item.prioridade)}${statusChip(item.categoria)}<span class="admin-chip">${relativeTime(item.updatedAt || item.createdAt)}</span></div></div>
        <div class="admin-item-actions"><button class="admin-small-action" type="button" data-open-ticket="${item.id}">Abrir chamado</button></div>
      </article>
    `).join("");
  }

  async function openSupportTicket(id) {
    const data = await api(`/admin/suporte/${id}`);
    const ticket = data.chamado;
    $("supportTicketId").value = ticket.id;
    setText("supportModalTitle", ticket.assunto || "Chamado");
    const thread = $("supportThread");
    const messages = [
      { tipo: "usuario", autorNome: ticket.nome || ticket.email, mensagem: ticket.mensagem, criadoEm: ticket.createdAt },
      ...(ticket.respostas || [])
    ];
    thread.innerHTML = messages.map((item) => `<div class="admin-thread-message ${item.tipo === "equipe" ? "equipe" : ""}"><strong>${escapeHTML(item.autorNome || item.autorEmail || "Usuário")}</strong>${escapeHTML(item.mensagem)}<small>${formatDate(item.criadoEm)}</small></div>`).join("");
    $("supportReplyStatus").value = ["respondido", "em_atendimento", "resolvido", "fechado"].includes(ticket.status) ? ticket.status : "respondido";
    const modal = $("supportModal");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => modal.classList.add("active"));
    document.body.classList.add("admin-modal-open");
  }

  function closeSupportModal() {
    const modal = $("supportModal");
    if (!modal || modal.hidden) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    setTimeout(() => { modal.hidden = true; }, 180);
    document.body.classList.remove("admin-modal-open");
    $("supportReplyForm")?.reset();
  }

  async function submitSupportReply(event) {
    event.preventDefault();
    const id = $("supportTicketId")?.value;
    const message = $("supportReplyMessage")?.value.trim();
    const status = $("supportReplyStatus")?.value;
    if (!id || !message) return;
    try {
      await api(`/admin/suporte/${id}/responder`, { method: "POST", body: { mensagem: message } });
      await api(`/admin/suporte/${id}/status`, { method: "POST", body: { status } });
      toast("Resposta enviada ao usuário.");
      $("supportReplyMessage").value = "";
      await openSupportTicket(id);
      await loadSupport();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function loadExams() {
    const search = encodeURIComponent($("examSearch")?.value.trim() || "");
    const status = encodeURIComponent($("examStatus")?.value || "");
    const [summaryData, listData] = await Promise.all([
      api("/admin/provas/resumo"),
      api(`/admin/provas?busca=${search}&status=${status}&limite=200`)
    ]);
    const summary = summaryData.resumo || {};
    setText("examTotal", summary.totalProvas || 0);
    setText("examActive", summary.ativas || 0);
    setText("examDraft", summary.rascunhos || 0);
    setText("examReview", summary.emAnalise || 0);
    state.exams = listData.provas || [];
    renderExams();
  }

  function renderExams() {
    const grid = $("examGrid");
    if (!grid) return;
    if (!state.exams.length) {
      grid.innerHTML = '<div class="admin-empty-state">Nenhuma prova encontrada.</div>';
      return;
    }

    grid.innerHTML = state.exams.map((item) => `
      <article class="admin-exam-card">
        <div class="admin-notification-meta">${statusChip(item.status)}${statusChip(item.publico)}${statusChip(item.dificuldade)}</div>
        <h3>${escapeHTML(item.titulo)}</h3>
        <p>${escapeHTML(item.descricao || "Sem descrição.")}</p>
        <div class="admin-notification-meta"><span class="admin-chip">${formatNumber(item.totalPerguntas)} pergunta(s)</span><span class="admin-chip">nota mínima ${formatNumber(item.notaMinima)}%</span></div>
        <div class="admin-item-actions"><button class="admin-small-action" type="button" data-exam-action="edit" data-id="${item.id}">Editar</button><button class="admin-small-action" type="button" data-exam-action="status" data-id="${item.id}" data-status="${item.status}">${item.status === "ativa" ? "Desativar" : "Publicar"}</button><button class="admin-small-action danger" type="button" data-exam-action="delete" data-id="${item.id}">Excluir</button></div>
      </article>
    `).join("");
  }

  function openExamModal(exam = null) {
    $("examForm")?.reset();
    $("examId").value = exam?.id || "";
    setText("examModalTitle", exam ? "Editar prova" : "Nova prova");
    if (exam) {
      $("examTitle").value = exam.titulo || "";
      $("examModule").value = exam.modulo || "";
      $("examCategory").value = exam.categoria || "geral";
      $("examDifficulty").value = exam.dificuldade || "media";
      $("examAudience").value = exam.publico || "premium";
      $("examFormStatus").value = exam.status || "rascunho";
      $("examMinimum").value = Number(exam.notaMinima || 70);
      $("examAttempts").value = Number(exam.tentativasPermitidas || 3);
      $("examDescription").value = exam.descricao || "";
    }
    const modal = $("examModal");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => modal.classList.add("active"));
    document.body.classList.add("admin-modal-open");
  }

  function closeExamModal() {
    const modal = $("examModal");
    if (!modal || modal.hidden) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    setTimeout(() => { modal.hidden = true; }, 180);
    document.body.classList.remove("admin-modal-open");
  }

  async function submitExam(event) {
    event.preventDefault();
    const id = $("examId")?.value;
    const body = {
      titulo: $("examTitle")?.value.trim(),
      modulo: $("examModule")?.value.trim(),
      categoria: $("examCategory")?.value,
      dificuldade: $("examDifficulty")?.value,
      publico: $("examAudience")?.value,
      status: $("examFormStatus")?.value,
      notaMinima: Number($("examMinimum")?.value || 70),
      tentativasPermitidas: Number($("examAttempts")?.value || 3),
      descricao: $("examDescription")?.value.trim()
    };
    try {
      await api(id ? `/admin/provas/${id}` : "/admin/provas", { method: id ? "PUT" : "POST", body });
      toast(id ? "Prova atualizada." : "Prova criada.");
      closeExamModal();
      await loadExams();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function examAction(action, id, button) {
    const exam = state.exams.find((item) => item.id === id);
    if (!exam) return;
    if (action === "edit") {
      openExamModal(exam);
      return;
    }
    if (action === "delete" && !window.confirm(`Excluir a prova “${exam.titulo}”?`)) return;
    button.disabled = true;
    try {
      if (action === "status") {
        await api(`/admin/provas/${id}/status`, { method: "POST", body: { status: exam.status === "ativa" ? "inativa" : "ativa" } });
      }
      if (action === "delete") {
        await api(`/admin/provas/${id}`, { method: "DELETE" });
      }
      toast(action === "delete" ? "Prova excluída." : "Status da prova atualizado.");
      await loadExams();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function loadSettings() {
    const data = await api("/admin/configuracoes-painel");
    const config = data.configuracoes || {};
    $("settingsSystemName").value = config.nomeSistema || "";
    $("settingsPremiumName").value = config.nomePremium || "";
    $("settingsCommission").value = Number(config.comissaoPadrao || 20);
    $("settingsTheme").value = config.temaPadrao || "dark";
    $("settingsMaintenance").checked = Boolean(config.modoManutencao);
    $("settingsMaintenanceTitle").value = config.manutencaoTitulo || "";
    $("settingsMaintenanceMessage").value = config.manutencaoMensagem || "";
    $("settingsWhatsappSupport").value = config.links?.whatsappSuporte || "";
    $("settingsWhatsappSales").value = config.links?.whatsappVendas || "";
    $("settingsInstagram").value = config.links?.instagram || "";
  }

  async function saveSettings(event) {
    event.preventDefault();
    const body = {
      nomeSistema: $("settingsSystemName")?.value.trim(),
      nomePremium: $("settingsPremiumName")?.value.trim(),
      comissaoPadrao: Number($("settingsCommission")?.value || 20),
      temaPadrao: $("settingsTheme")?.value,
      modoManutencao: Boolean($("settingsMaintenance")?.checked),
      manutencaoTitulo: $("settingsMaintenanceTitle")?.value.trim(),
      manutencaoMensagem: $("settingsMaintenanceMessage")?.value.trim(),
      links: {
        whatsappSuporte: $("settingsWhatsappSupport")?.value.trim(),
        whatsappVendas: $("settingsWhatsappSales")?.value.trim(),
        instagram: $("settingsInstagram")?.value.trim()
      }
    };
    try {
      const data = await api("/admin/configuracoes-painel", { method: "PUT", body });
      toast(data.mensagem || "Configurações salvas.");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function loadLogs() {
    const data = await api("/admin/sistema/logs");
    const list = $("systemLogList");
    const logs = data.logs || [];
    if (!list) return;
    list.innerHTML = logs.length
      ? logs.map((item) => `<div class="admin-log-item"><span class="admin-log-icon">${escapeHTML(item.icone || "•")}</span><div><strong>${escapeHTML(item.titulo)}</strong><small>${escapeHTML(item.descricao)}</small></div><span class="admin-activity-time">${formatDate(item.createdAt)}</span></div>`).join("")
      : '<div class="admin-empty-state">Nenhuma atividade registrada.</div>';
  }

  function filterNavigation() {
    const query = String($("adminGlobalSearch")?.value || "").trim().toLowerCase();
    $$(".admin-nav-item").forEach((item) => {
      if (!query) {
        item.style.display = "";
        return;
      }
      item.style.display = item.textContent.toLowerCase().includes(query) ? "" : "none";
    });
  }

  function handleDelegatedClick(event) {
    const alert = event.target.closest("[data-alert-section]");
    if (alert) triggerSection(alert.dataset.alertSection);

    const notificationButton = event.target.closest("[data-notification-action]");
    if (notificationButton) notificationAction(notificationButton.dataset.notificationAction, notificationButton.dataset.id, notificationButton);

    const ticketButton = event.target.closest("[data-open-ticket]");
    if (ticketButton) openSupportTicket(ticketButton.dataset.openTicket).catch((error) => toast(error.message, "error"));

    const ticketItem = event.target.closest("[data-ticket-id]");
    if (ticketItem && !event.target.closest("button")) openSupportTicket(ticketItem.dataset.ticketId).catch((error) => toast(error.message, "error"));

    const examButton = event.target.closest("[data-exam-action]");
    if (examButton) examAction(examButton.dataset.examAction, examButton.dataset.id, examButton);
  }
})();
