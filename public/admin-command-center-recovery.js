"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const fmtNumber = (value) => new Intl.NumberFormat("pt-BR").format(Number(value || 0));
  const fmtMoney = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

  function currentName() {
    const top = document.querySelector(".admin-top-user [data-user-name]")?.textContent?.trim();
    const side = document.querySelector(".admin-sidebar-profile [data-user-name]")?.textContent?.trim();
    return top || side || "Admin";
  }

  function refreshGreeting() {
    const title = document.querySelector(".cc-hero-copy h2");
    if (!title) return;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
    title.innerHTML = `${greeting}, <span>${esc(currentName())}</span> 👋`;
  }

  async function readJson(endpoint, retries = 2) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        const type = String(response.headers.get("content-type") || "").toLowerCase();
        if (response.redirected || !type.includes("application/json")) {
          throw new Error("Sessão administrativa precisa ser renovada.");
        }
        const data = await response.json();
        if (!response.ok || data?.erro) {
          const error = new Error(data?.erro || `Erro ${response.status}.`);
          error.status = response.status;
          throw error;
        }
        return data;
      } catch (error) {
        lastError = error;
        if (attempt < retries && (!error.status || error.status >= 500)) {
          await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
          continue;
        }
        break;
      }
    }
    throw lastError || new Error("Falha ao carregar dados.");
  }

  function renderServices(services) {
    const holder = $("ccServiceStrip");
    if (!holder) return;
    holder.innerHTML = Object.values(services || {}).map((service) => {
      const status = String(service.status || "indisponivel");
      const text = status === "online" ? "online" : status === "configurada" ? "configurada" : "indisponível";
      return `<span class="cc-service ${esc(status)}"><i></i>${esc(service.label)} ${text}</span>`;
    }).join("");
  }

  function renderOverview(data) {
    const m = data?.indicadores || {};
    const operation = data?.operacao || {};
    if ($("ccTotalUsers")) $("ccTotalUsers").textContent = fmtNumber(m.totalUsuarios);
    if ($("ccPremiumUsers")) $("ccPremiumUsers").textContent = fmtNumber(m.premiumAtivos);
    if ($("ccFreeUsers")) $("ccFreeUsers").textContent = fmtNumber(m.freeAtivos);
    if ($("ccRevenue")) $("ccRevenue").textContent = fmtMoney(m.faturamentoMes);
    if ($("ccConversion")) $("ccConversion").textContent = `${Number(m.conversao || 0).toFixed(1).replace(".", ",")}%`;
    if ($("ccUsersGrowth")) $("ccUsersGrowth").innerHTML = `<em class="${Number(m.crescimentoUsuarios || 0) >= 0 ? "positive" : "negative"}">${Number(m.crescimentoUsuarios || 0) >= 0 ? "+" : ""}${Number(m.crescimentoUsuarios || 0).toFixed(1).replace(".", ",")}% vs. mês anterior</em>`;
    if ($("ccRevenueGrowth")) $("ccRevenueGrowth").innerHTML = `<em class="${Number(m.crescimentoFaturamento || 0) >= 0 ? "positive" : "negative"}">${Number(m.crescimentoFaturamento || 0) >= 0 ? "+" : ""}${Number(m.crescimentoFaturamento || 0).toFixed(1).replace(".", ",")}% vs. mês anterior</em>`;

    const op = $("ccOperation");
    if (op) {
      const items = [
        ["approvals", "Aprovações pendentes", "Acessos aguardando análise", operation.aprovacoesPendentes || 0],
        ["support", "Chamados urgentes", "Precisam de atendimento imediato", operation.chamadosUrgentes || 0],
        ["exams", "Provas em análise", "Resultados aguardando revisão", operation.provasEmAnalise || 0],
        ["students", "Premium próximos do vencimento", "Acessos nos próximos 7 dias", operation.premiumExpirando || 0]
      ];
      op.innerHTML = items.map(([section, title, description, count]) => `<button type="button" data-cc-open="${section}"><span class="ico">•</span><span><strong>${esc(title)}</strong><small>${esc(description)}</small></span><span class="cc-count">${fmtNumber(count)}</span><span>›</span></button>`).join("");
    }

    const activities = $("ccActivities");
    if (activities && Array.isArray(data.atividades)) {
      activities.innerHTML = data.atividades.length ? data.atividades.slice(0, 8).map((item) => `<div class="cc-activity ${esc(item.type || "user")}"><span class="cc-activity-icon">•</span><div><strong>${esc(item.title || "Atividade")}</strong><small>${esc(item.description || "")}</small></div><time>${formatRelative(item.createdAt)}</time></div>`).join("") : '<div class="admin-empty-state">Nenhuma atividade recente.</div>';
    }

    const students = $("ccStudents");
    if (students && Array.isArray(data.alunosRecentes)) {
      students.innerHTML = data.alunosRecentes.length ? data.alunosRecentes.slice(0, 6).map((item) => `<div class="cc-preview-row"><span class="cc-avatar">${esc((item.nome || "A").charAt(0).toUpperCase())}</span><div><strong>${esc(item.nome || "Aluno")}</strong><small>${esc(item.email || "")}</small></div><span class="cc-plan ${String(item.plano || "free") === "free" ? "free" : ""}">${esc(planName(item.plano))}</span><span class="cc-status ${esc(item.status || "ativo")}">${esc(item.status || "ativo")}</span></div>`).join("") : '<div class="admin-empty-state">Nenhum aluno cadastrado.</div>';
    }

    drawFallbackChart(data.serie || []);
  }

  function formatRelative(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "";
    const minutes = Math.floor(Math.max(0, Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    return `há ${Math.floor(hours / 24)} d`;
  }

  function planName(value) {
    return ({ free: "Free", black30: "30 dias", black90: "90 dias", black180: "6 meses", black360: "1 ano", admin: "Admin" })[String(value || "free").toLowerCase()] || String(value || "Free");
  }

  function drawFallbackChart(series) {
    const canvas = $("ccChart");
    if (!canvas || !series.length) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    const width = rect.width;
    const height = rect.height;
    const padding = { left: 30, right: 12, top: 18, bottom: 28 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const values = series.map((item) => Number(item.usuarios || 0));
    const max = Math.max(...values, 1);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(255,255,255,.055)";
    ctx.fillStyle = "#596273";
    ctx.font = "8px Inter, sans-serif";
    for (let i = 0; i <= 4; i += 1) {
      const y = padding.top + chartHeight * (i / 4);
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
    }
    const step = series.length > 1 ? chartWidth / (series.length - 1) : chartWidth;
    const points = series.map((item, index) => ({ x: padding.left + index * step, y: padding.top + chartHeight - (Number(item.usuarios || 0) / max) * chartHeight }));
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, "rgba(139,92,246,.22)");
    gradient.addColorStop(1, "rgba(139,92,246,0)");
    ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.lineTo(points.at(-1).x, height - padding.bottom); ctx.lineTo(points[0].x, height - padding.bottom); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
    ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.strokeStyle = "#9b5cff"; ctx.lineWidth = 2; ctx.stroke();
    points.forEach((point) => { ctx.beginPath(); ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = "#9b5cff"; ctx.fill(); });
    series.forEach((item, index) => {
      if (index % Math.max(1, Math.ceil(series.length / 7)) && index !== series.length - 1) return;
      ctx.fillStyle = "#596273"; ctx.textAlign = "center"; ctx.fillText(item.rotulo || "", padding.left + index * step, height - 8);
    });
  }

  function normalizeNavOrder() {
    const nav = $("adminNav");
    if (!nav) return;
    const section = (name) => nav.querySelector(`[data-section="${name}"]`);
    const dashboard = nav.querySelector('a[href="/dashboard.html"],a[href="dashboard.html"]');
    const sales = nav.querySelector('a[href="/painel-vendas.html"],a[href="painel-vendas.html"]');
    $$(".admin-nav-label", nav).forEach((item) => item.remove());
    const groups = [
      ["OPERAÇÃO", [section("overview"), section("students"), section("approvals"), section("support")]],
      ["NEGÓCIO", [section("finance"), section("reports")]],
      ["PLATAFORMA", [section("notifications"), section("exams"), section("team")]],
      ["SISTEMA", [section("logs"), section("settings")]],
      ["DEV", [section("dev")]],
      ["ATALHOS", [dashboard, sales]]
    ];
    groups.forEach(([label, items]) => {
      const valid = items.filter(Boolean);
      if (!valid.length) return;
      const title = document.createElement("span");
      title.className = "admin-nav-label";
      title.textContent = label;
      nav.appendChild(title);
      valid.forEach((item) => nav.appendChild(item));
    });
  }

  async function recover() {
    refreshGreeting();
    normalizeNavOrder();
    try {
      const [overviewResult, statusResult] = await Promise.allSettled([
        readJson("/admin/command-center/overview?dias=7", 3),
        readJson("/admin/command-center/status", 2)
      ]);
      if (overviewResult.status === "fulfilled") renderOverview(overviewResult.value);
      else {
        const holder = $("ccOperation");
        if (holder) holder.innerHTML = '<div class="admin-empty-state">Dados temporariamente indisponíveis. Tentando novamente automaticamente…</div>';
      }
      if (statusResult.status === "fulfilled") renderServices(statusResult.value.services || {});
      else if ($("ccServiceStrip")) $("ccServiceStrip").innerHTML = '<span class="cc-service indisponivel"><i></i>Status em atualização</span>';
    } catch (_) {}
  }

  function init() {
    setTimeout(recover, 900);
    setTimeout(() => { refreshGreeting(); normalizeNavOrder(); }, 2200);
    window.addEventListener("focus", () => recover());
    setInterval(() => recover(), 60000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
