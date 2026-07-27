"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (id) => document.getElementById(id);
  const state = {
    token: "",
    context: null,
    days: 30,
    dashboard: null,
    sales: [],
    clients: [],
    sellers: [],
    products: [],
    payments: [],
    coupons: [],
    commissions: [],
    activeView: "dashboard",
    chartPoints: [],
    timers: {},
    confirmResolver: null
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

  function clearSession() {
    for (const key of TOKEN_KEYS) {
      try { sessionStorage.removeItem(key); } catch (_) {}
    }
  }

  async function api(endpoint, options = {}) {
    const response = await fetch(`${window.location.origin}${endpoint}`, {
      method: options.method || "GET",
      headers: {
        Accept: options.accept || "application/json",
        Authorization: `Bearer ${state.token}`,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {})
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });

    if (options.raw) return response;
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearSession();
      window.location.replace("/index.html");
      throw new Error("Sessão expirada.");
    }
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

  function date(value, withTime = false) {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10).split("-").reverse().join("/");
    return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(parsed);
  }

  function initials(name) {
    const parts = String(name || "D").trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "D";
  }

  function planLabel(code) {
    const product = state.products.find((item) => item.codigo === code || item.id === code);
    if (product) return product.nome;
    const labels = { black30: "Black 30", black90: "Black 90", black180: "Black 180", black360: "Black 360", particular: "VIP Mentoria", free: "Free", admin: "Administrativo" };
    return labels[code] || code || "Sem plano";
  }

  function paymentLabel(code) {
    const payment = state.payments.find((item) => item.codigo === code);
    return payment?.nome || String(code || "").replaceAll("_", " ") || "—";
  }

  function statusLabel(status) {
    const labels = { pago: "Pago", pendente: "Pendente", cancelado: "Cancelado", estornado: "Estornado", ativa: "Ativa", ativo: "Ativo", suspenso: "Suspenso", prevista: "Prevista", disponivel: "Disponível", paga: "Paga" };
    return labels[status] || status || "—";
  }

  function toast(message, type = "success") {
    const stack = $("salesToastStack");
    if (!stack) return;
    const item = document.createElement("div");
    item.className = `sales-toast ${type}`;
    item.textContent = message;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => {
      item.classList.remove("show");
      setTimeout(() => item.remove(), 250);
    }, 3800);
  }

  function setLoading(text) {
    if ($("salesLoadingText")) $("salesLoadingText").textContent = text;
  }

  function hideLoading() {
    $("salesLoading")?.classList.add("hidden");
    setTimeout(() => $("salesLoading")?.remove(), 450);
  }

  async function init() {
    state.token = getToken();
    if (!state.token) {
      window.location.replace("/index.html");
      return;
    }

    registerEvents();
    setLoading("Validando permissões…");

    try {
      const context = await api("/vendas/painel/contexto");
      state.context = context;
      state.products = context.produtos || [];
      state.payments = context.formasPagamento || [];
      applyUserContext();
      fillBaseSelects();

      setLoading("Carregando operação comercial…");
      await Promise.all([loadClients(), loadSellers(), loadDashboard(), loadSales()]);
      renderSellers();
      if (context.dev) await Promise.all([loadCoupons(), loadSettings()]);
      hideLoading();
    } catch (error) {
      setLoading(error.message || "Erro ao carregar painel.");
      toast(error.message || "Erro ao carregar painel.", "error");
    }
  }

  function applyUserContext() {
    const user = state.context?.usuario || {};
    document.querySelectorAll("[data-user-name]").forEach((el) => { el.textContent = user.nome || "Usuário"; });
    document.querySelectorAll("[data-user-role]").forEach((el) => { el.textContent = roleLabel(state.context?.cargo); });
    document.querySelectorAll("[data-user-initial]").forEach((el) => { el.textContent = initials(user.nome); });
    if ($("salesDevMenu")) $("salesDevMenu").hidden = !state.context?.dev;
    document.querySelectorAll("[data-dev-only]").forEach((el) => { el.hidden = !state.context?.dev; });
    if (!state.context?.podeVerTudo) {
      $("salesSellerFilter")?.setAttribute("hidden", "");
      $("saleSeller")?.closest("label")?.setAttribute("hidden", "");
      $("saleManualDiscount")?.closest("label")?.setAttribute("hidden", "");
    }
  }

  function roleLabel(role) {
    const labels = { dev: "Desenvolvedor", dono: "Dono", superadmin: "Super Admin", admin: "Administrador", financeiro: "Financeiro", vendedor: "Vendedor" };
    return labels[role] || role || "Equipe";
  }

  function fillBaseSelects() {
    const productOptions = state.products.filter((p) => p.ativo).map((p) => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.nome)} — ${escapeHTML(money(p.preco))}</option>`).join("");
    if ($("saleProduct")) $("saleProduct").innerHTML = `<option value="">Selecione</option>${productOptions}`;
    const paymentOptions = state.payments.filter((p) => p.ativo).map((p) => `<option value="${escapeHTML(p.codigo)}">${escapeHTML(p.nome)}</option>`).join("");
    if ($("salePayment")) $("salePayment").innerHTML = paymentOptions;
    fillClientSelect();
    fillSellerSelects();
  }

  function fillClientSelect() {
    if (!$("saleClient")) return;
    const current = $("saleClient").value;
    $("saleClient").innerHTML = `<option value="">Selecionar ou preencher abaixo</option>${state.clients.map((client) => `<option value="${escapeHTML(client.id)}">${escapeHTML(client.nome)} — ${escapeHTML(client.email || client.telefone || "sem contato")}</option>`).join("")}`;
    $("saleClient").value = current;
  }

  function fillSellerSelects() {
    const options = state.sellers.map((seller) => `<option value="${escapeHTML(seller.id)}">${escapeHTML(seller.nome)} — ${escapeHTML(roleLabel(seller.cargo))}</option>`).join("");
    if ($("saleSeller")) $("saleSeller").innerHTML = options;
    if ($("salesSellerFilter")) $("salesSellerFilter").innerHTML = `<option value="">Todos os vendedores</option>${options}`;
  }

  async function loadDashboard() {
    const data = await api(`/vendas/dashboard?dias=${state.days}`);
    state.dashboard = data;
    state.chartPoints = data.serie || [];
    renderDashboard();
    renderReports();
  }

  function renderDashboard() {
    const metrics = state.dashboard?.indicadores || {};
    setText("kpiRevenue", money(metrics.faturamento));
    setText("kpiPaid", number(metrics.vendasConfirmadas));
    setText("kpiPending", number(metrics.vendasPendentes));
    setText("kpiTicket", money(metrics.ticketMedio));
    setText("kpiCommissions", money(metrics.comissoes));
    setGrowth("kpiRevenueGrowth", metrics.crescimentoFaturamento);
    setGrowth("kpiPaidGrowth", metrics.crescimentoVendas);
    if ($("salesPendingBadge")) {
      $("salesPendingBadge").textContent = String(metrics.vendasPendentes || 0);
      $("salesPendingBadge").hidden = !Number(metrics.vendasPendentes || 0);
    }
    renderChart();
    renderFunnel();
    renderRanking();
    renderRecentSales();
    renderPaymentsChart();
    renderStudentStatus();
  }

  function setText(id, value) { if ($(id)) $(id).textContent = value; }

  function setGrowth(id, value) {
    const el = $(id);
    if (!el) return;
    const n = Number(value || 0);
    el.textContent = `${n >= 0 ? "↑" : "↓"} ${Math.abs(n).toFixed(1).replace(".", ",")}% vs período anterior`;
    el.style.color = n >= 0 ? "#35e98b" : "#ff5875";
  }

  function renderChart() {
    const canvas = $("salesChart");
    if (!canvas || !state.chartPoints.length) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = rect.width;
    const height = rect.height;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const padding = { top: 30, right: 38, bottom: 34, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const maxRevenue = Math.max(...state.chartPoints.map((p) => Number(p.faturamento || 0)), 1);
    const maxSales = Math.max(...state.chartPoints.map((p) => Number(p.vendas || 0)), 1);
    ctx.font = "8px Inter";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 5; i += 1) {
      const y = padding.top + (chartH / 5) * i;
      ctx.strokeStyle = "rgba(255,255,255,.055)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
      ctx.fillStyle = "#777080";
      ctx.textAlign = "right";
      ctx.fillText(compactMoney(maxRevenue - (maxRevenue / 5) * i), padding.left - 8, y);
      ctx.textAlign = "left";
      ctx.fillText(String(Math.round(maxSales - (maxSales / 5) * i)), width - padding.right + 8, y);
    }
    const step = state.chartPoints.length > 1 ? chartW / (state.chartPoints.length - 1) : chartW;
    const revenuePoints = state.chartPoints.map((p, i) => ({ x: padding.left + step * i, y: padding.top + chartH - (Number(p.faturamento || 0) / maxRevenue) * chartH, item: p }));
    const salesPoints = state.chartPoints.map((p, i) => ({ x: padding.left + step * i, y: padding.top + chartH - (Number(p.vendas || 0) / maxSales) * chartH, item: p }));
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, "rgba(111,39,255,.38)");
    gradient.addColorStop(1, "rgba(111,39,255,0)");
    ctx.beginPath();
    revenuePoints.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.lineTo(revenuePoints.at(-1).x, height - padding.bottom); ctx.lineTo(revenuePoints[0].x, height - padding.bottom); ctx.closePath();
    ctx.fillStyle = gradient; ctx.fill();
    drawLine(ctx, revenuePoints, "#7c31ff", 2.2);
    drawLine(ctx, salesPoints, "#17d77d", 1.8);
    revenuePoints.forEach((p, i) => {
      if (state.chartPoints.length <= 14 || i % Math.ceil(state.chartPoints.length / 8) === 0 || i === state.chartPoints.length - 1) {
        ctx.fillStyle = "#777080"; ctx.textAlign = "center"; ctx.fillText(p.item.rotulo, p.x, height - 13);
      }
    });
    canvas.onmousemove = (event) => {
      const x = event.clientX - canvas.getBoundingClientRect().left;
      const nearest = revenuePoints.reduce((best, p) => Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best, revenuePoints[0]);
      const tooltip = $("salesChartTooltip");
      tooltip.innerHTML = `<strong>${escapeHTML(nearest.item.rotulo)}</strong><br>Faturamento: ${escapeHTML(money(nearest.item.faturamento))}<br>Vendas: ${escapeHTML(number(nearest.item.vendas))}`;
      tooltip.style.left = `${Math.min(width - 160, Math.max(5, nearest.x + 10))}px`;
      tooltip.style.top = `${Math.max(5, nearest.y - 55)}px`;
      tooltip.hidden = false;
    };
    canvas.onmouseleave = () => { $("salesChartTooltip").hidden = true; };
  }

  function drawLine(ctx, points, color, lineWidth) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.shadowColor = color; ctx.shadowBlur = 9; ctx.stroke(); ctx.shadowBlur = 0;
    points.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); });
  }

  function compactMoney(value) {
    const n = Number(value || 0);
    if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1)} mi`;
    if (n >= 1e3) return `R$ ${(n / 1e3).toFixed(1)}k`;
    return `R$ ${Math.round(n)}`;
  }

  function renderFunnel() {
    const items = state.dashboard?.funil || [];
    const colors = [["#783bff", "#4317d2"], ["#298dff", "#1352bc"], ["#14d6ba", "#07887c"], ["#7ce536", "#3c9f14"], ["#ffb119", "#cf6e00"]];
    const max = Math.max(...items.map((item) => Number(item.total || 0)), 1);
    $("salesFunnel").innerHTML = items.map((item, index) => {
      const width = Math.max(35, 100 - index * 12);
      const percent = Number(item.total || 0) / max * 100;
      return `<div class="sales-funnel-row"><div class="sales-funnel-shape" style="width:${width}%;--c1:${colors[index]?.[0] || "#7028ff"};--c2:${colors[index]?.[1] || "#4011aa"};--shadowColor:${colors[index]?.[0] || "#7028ff"}"></div><div><strong>${escapeHTML(item.etapa)}</strong><small>${percent.toFixed(1).replace(".", ",")}%</small></div><b>${number(item.total)}</b></div>`;
    }).join("") || '<div class="sales-empty">Nenhum dado no período.</div>';
  }

  function renderRanking() {
    const items = state.dashboard?.ranking || [];
    $("salesRanking").innerHTML = items.slice(0, 5).map((item) => rankingRow(item)).join("") || '<div class="sales-empty">Nenhuma venda confirmada.</div>';
  }

  function rankingRow(item) {
    return `<div class="sales-ranking-row"><span class="sales-ranking-position">${number(item.posicao)}</span><div><strong>${escapeHTML(item.nome)}</strong><small>${number(item.vendas)} venda(s) • ${escapeHTML(item.email || "")}</small></div><span class="sales-ranking-value">${money(item.faturamento)}<small>${money(item.comissao)} comissão</small></span></div>`;
  }

  function saleRow(item, compact = false) {
    const canDelete = state.context?.dev;
    const actions = `<div class="sales-actions"><button class="sales-action-btn" data-edit-sale="${item.id}" title="Editar">✎</button>${item.status === "pendente" ? `<button class="sales-action-btn" data-sale-status="pago" data-sale-id="${item.id}" title="Confirmar pagamento">✓</button>` : ""}${!compact && item.status === "pago" ? `<button class="sales-action-btn" data-sale-status="cancelado" data-sale-id="${item.id}" title="Cancelar">×</button>` : ""}${canDelete && !compact ? `<button class="sales-action-btn danger" data-delete-sale="${item.id}" title="Apagar">⌫</button>` : ""}</div>`;
    if (compact) return `<tr><td><div class="sales-person"><strong>${escapeHTML(item.clienteNome)}</strong><small>${escapeHTML(item.clienteEmail)}</small></div></td><td>${escapeHTML(item.produtoNome || planLabel(item.produtoCodigo))}</td><td>${escapeHTML(item.vendedorNome)}</td><td><strong>${money(item.valor)}</strong></td><td>${escapeHTML(paymentLabel(item.formaPagamento))}</td><td><span class="sales-status ${escapeHTML(item.status)}">${escapeHTML(statusLabel(item.status))}</span></td><td>${escapeHTML(date(item.dataVenda))}</td><td>${actions}</td></tr>`;
    return `<tr><td><div class="sales-person"><strong>${escapeHTML(item.clienteNome)}</strong><small>${escapeHTML(item.clienteEmail)}</small></div></td><td>${escapeHTML(item.produtoNome || planLabel(item.produtoCodigo))}</td><td>${escapeHTML(item.vendedorNome)}</td><td><strong>${money(item.valor)}</strong>${item.desconto ? `<small class="sales-discount">− ${money(item.desconto)}</small>` : ""}</td><td>${escapeHTML(paymentLabel(item.formaPagamento))}${item.parcelas > 1 ? ` • ${item.parcelas}x` : ""}</td><td>${money(item.comissao)}</td><td><span class="sales-status ${escapeHTML(item.status)}">${escapeHTML(statusLabel(item.status))}</span></td><td>${escapeHTML(date(item.dataVenda))}</td><td>${actions}</td></tr>`;
  }

  function renderRecentSales() {
    const items = state.dashboard?.recentes || [];
    $("recentSalesBody").innerHTML = items.slice(0, 7).map((item) => saleRow(item, true)).join("") || '<tr><td colspan="8"><div class="sales-empty">Nenhuma venda registrada.</div></td></tr>';
  }

  function renderPaymentsChart() {
    const items = state.dashboard?.pagamentos || [];
    const colors = ["#17d77d", "#2497ff", "#ffd22c", "#8e38ff", "#ff6d5c", "#7e879b"];
    const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    setText("paymentTotal", number(total));
    let cursor = 0;
    const segments = items.map((item, index) => {
      const start = cursor;
      cursor += Number(item.percentual || 0);
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    });
    if (segments.length) $("salesPaymentDonut").style.background = `conic-gradient(${segments.join(",")})`;
    $("salesPaymentList").innerHTML = items.map((item, index) => `<div class="sales-payment-line"><i style="--dot:${colors[index % colors.length]}"></i><span>${escapeHTML(paymentLabel(item.codigo))}</span><strong>${Number(item.percentual || 0).toFixed(1).replace(".", ",")}%</strong></div>`).join("") || '<div class="sales-empty">Sem pagamentos confirmados.</div>';
  }

  function renderStudentStatus() {
    const students = state.dashboard?.alunos || {};
    setText("studentActive", number(students.ativos)); setText("studentPending", number(students.pendentes)); setText("studentSuspended", number(students.suspensos)); setText("studentTotal", number(students.total));
  }

  async function loadSales() {
    const query = new URLSearchParams();
    const search = $("salesSearch")?.value.trim();
    const status = $("salesStatusFilter")?.value;
    const seller = $("salesSellerFilter")?.value;
    if (search) query.set("busca", search);
    if (status) query.set("status", status);
    if (seller) query.set("vendedorId", seller);
    query.set("limite", "1500");
    const data = await api(`/vendas?${query}`);
    state.sales = data.vendas || [];
    renderAllSales();
    renderReports();
  }

  function renderAllSales() {
    $("allSalesBody").innerHTML = state.sales.map((item) => saleRow(item)).join("") || '<tr><td colspan="9"><div class="sales-empty">Nenhuma venda encontrada.</div></td></tr>';
  }

  async function loadClients() {
    const search = encodeURIComponent($("clientsSearch")?.value.trim() || "");
    const data = await api(`/vendas/clientes?busca=${search}`);
    state.clients = data.clientes || [];
    fillClientSelect();
    renderClients();
  }

  function renderClients() {
    $("clientsBody").innerHTML = state.clients.map((item) => `<tr><td><div class="sales-person"><strong>${escapeHTML(item.nome)}</strong><small>${escapeHTML(item.email)}</small></div></td><td>${escapeHTML(item.telefone || "—")}</td><td>${escapeHTML(planLabel(item.plano))}</td><td><span class="sales-status ${escapeHTML(item.status)}">${escapeHTML(statusLabel(item.status))}</span></td><td>${escapeHTML(date(item.dataExpiracao))}</td><td>${escapeHTML(date(item.createdAt))}</td><td><button class="sales-action-btn" data-new-sale-client="${item.id}" title="Registrar venda">＋</button></td></tr>`).join("") || '<tr><td colspan="7"><div class="sales-empty">Nenhum cliente encontrado.</div></td></tr>';
  }

  async function loadSellers() {
    const data = await api("/vendas/vendedores");
    state.sellers = data.vendedores || [];
    fillSellerSelects();
    renderSellers();
  }

  function renderSellers() {
    const ranking = state.dashboard?.ranking || [];
    $("sellersGrid").innerHTML = state.sellers.map((seller) => {
      const stats = ranking.find((item) => item.vendedorId === seller.id) || {};
      return `<article class="sales-seller-card"><div class="sales-seller-head"><span class="sales-avatar">${escapeHTML(initials(seller.nome))}</span><div><strong>${escapeHTML(seller.nome)}</strong><span>${escapeHTML(seller.email)} • ${escapeHTML(roleLabel(seller.cargo))}</span></div></div><div class="sales-seller-stats"><div><small>Vendas</small><strong>${number(stats.vendas)}</strong></div><div><small>Faturamento</small><strong>${money(stats.faturamento)}</strong></div><div><small>Comissão</small><strong>${money(stats.comissao)}</strong></div></div></article>`;
    }).join("") || '<div class="sales-empty">Nenhum vendedor cadastrado.</div>';
  }

  async function loadCommissions() {
    const data = await api("/vendas/comissoes");
    state.commissions = data.vendas || [];
    setText("commissionExpected", money(data.resumo?.prevista)); setText("commissionAvailable", money(data.resumo?.disponivel)); setText("commissionPaid", money(data.resumo?.paga));
    $("commissionsBody").innerHTML = state.commissions.map((item) => `<tr><td>${escapeHTML(item.vendedorNome)}</td><td>${escapeHTML(item.clienteNome)}</td><td>${escapeHTML(item.produtoNome)}</td><td>${money(item.valor)}</td><td><strong>${money(item.comissao)}</strong></td><td><span class="sales-status ${escapeHTML(item.comissaoStatus)}">${escapeHTML(statusLabel(item.comissaoStatus))}</span></td><td>${escapeHTML(date(item.pagoEm || item.dataVenda))}</td><td>${item.comissaoStatus !== "paga" && ["dev","dono","admin","financeiro","superadmin"].includes(state.context?.cargo) ? `<button class="sales-action-btn" data-pay-commission="${item.id}" title="Marcar como paga">✓</button>` : "—"}</td></tr>`).join("") || '<tr><td colspan="8"><div class="sales-empty">Nenhuma comissão disponível.</div></td></tr>';
  }

  function renderReports() {
    if (!state.sales.length && !state.dashboard) return;
    const byProduct = new Map();
    state.sales.filter((sale) => sale.status === "pago").forEach((sale) => {
      const key = sale.produtoCodigo || sale.produtoNome;
      const current = byProduct.get(key) || { nome: sale.produtoNome || planLabel(key), vendas: 0, faturamento: 0 };
      current.vendas += 1; current.faturamento += Number(sale.valor || 0); byProduct.set(key, current);
    });
    const products = [...byProduct.values()].sort((a, b) => b.faturamento - a.faturamento);
    $("reportProducts").innerHTML = products.map((item, index) => rankingRow({ posicao: index + 1, nome: item.nome, email: "Produto/Plano", vendas: item.vendas, faturamento: item.faturamento, comissao: 0 })).join("") || '<div class="sales-empty">Sem vendas confirmadas.</div>';
    $("reportSellers").innerHTML = (state.dashboard?.ranking || []).map(rankingRow).join("") || '<div class="sales-empty">Sem ranking.</div>';
    $("reportPayments").innerHTML = (state.dashboard?.pagamentos || []).map((item, index) => `<div class="sales-ranking-row"><span class="sales-ranking-position">${index + 1}</span><div><strong>${escapeHTML(paymentLabel(item.codigo))}</strong><small>${number(item.total)} venda(s)</small></div><span class="sales-ranking-value">${Number(item.percentual || 0).toFixed(1).replace(".", ",")}%</span></div>`).join("") || '<div class="sales-empty">Sem pagamentos.</div>';
  }

  async function loadProducts() {
    const data = await api("/vendas/produtos"); state.products = data.produtos || []; fillBaseSelects(); renderProducts();
  }
  function renderProducts() {
    if (!$("productsBody")) return;
    $("productsBody").innerHTML = state.products.map((item) => `<tr><td><div class="sales-person"><strong>${escapeHTML(item.nome)}</strong><small>${escapeHTML(item.codigo)}</small></div></td><td>${escapeHTML(item.descricao || "—")}</td><td><strong>${money(item.preco)}</strong></td><td>${number(item.duracaoDias)} dias</td><td><span class="sales-status ${item.ativo ? "ativo" : "cancelado"}">${item.ativo ? "Ativo" : "Inativo"}</span></td><td><div class="sales-actions"><button class="sales-action-btn" data-edit-product="${item.id}">✎</button><button class="sales-action-btn danger" data-delete-product="${item.id}">⌫</button></div></td></tr>`).join("") || '<tr><td colspan="6"><div class="sales-empty">Nenhum produto.</div></td></tr>';
  }

  async function loadPayments() {
    const data = await api("/vendas/formas-pagamento"); state.payments = data.formasPagamento || []; fillBaseSelects(); renderPayments();
  }
  function renderPayments() {
    if (!$("paymentsBody")) return;
    $("paymentsBody").innerHTML = state.payments.map((item) => `<tr><td><strong>${escapeHTML(item.nome)}</strong></td><td>${escapeHTML(item.codigo)}</td><td>${Number(item.taxaPercentual || 0).toFixed(3).replace(".", ",")}%</td><td><span class="sales-status ${item.ativo ? "ativo" : "cancelado"}">${item.ativo ? "Ativa" : "Inativa"}</span></td><td><div class="sales-actions"><button class="sales-action-btn" data-edit-payment="${item.id}">✎</button><button class="sales-action-btn danger" data-delete-payment="${item.id}">⌫</button></div></td></tr>`).join("") || '<tr><td colspan="5"><div class="sales-empty">Nenhuma forma.</div></td></tr>';
  }

  async function loadCoupons() {
    const data = await api("/vendas/cupons"); state.coupons = data.cupons || []; renderCoupons();
  }
  function renderCoupons() {
    if (!$("couponsBody")) return;
    $("couponsBody").innerHTML = state.coupons.map((item) => `<tr><td><strong>${escapeHTML(item.codigo)}</strong></td><td>${item.tipo === "fixo" ? "Valor fixo" : "Percentual"}</td><td>${item.tipo === "fixo" ? money(item.valor) : `${Number(item.valor).toFixed(2).replace(".", ",")}%`}</td><td>${number(item.usos)} / ${item.limiteUsos ? number(item.limiteUsos) : "∞"}</td><td>${escapeHTML(date(item.validoAte))}</td><td><span class="sales-status ${item.ativo ? "ativo" : "cancelado"}">${item.ativo ? "Ativo" : "Inativo"}</span></td><td><div class="sales-actions"><button class="sales-action-btn" data-edit-coupon="${item.id}">✎</button><button class="sales-action-btn danger" data-delete-coupon="${item.id}">⌫</button></div></td></tr>`).join("") || '<tr><td colspan="7"><div class="sales-empty">Nenhum cupom.</div></td></tr>';
  }

  async function loadSettings() {
    const data = await api("/vendas/configuracoes");
    if ($("defaultCommission")) $("defaultCommission").value = data.configuracoes?.comissao_padrao || 20;
  }

  function switchView(view) {
    if (view === "dev" && !state.context?.dev) return;
    state.activeView = view;
    document.querySelectorAll(".sales-view").forEach((section) => section.classList.toggle("active", section.id === `view-${view}`));
    document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    closeSidebar();
    if (view === "dashboard") loadDashboard().catch(showError);
    if (view === "sales") loadSales().catch(showError);
    if (view === "clients") loadClients().catch(showError);
    if (view === "sellers") loadDashboard().then(renderSellers).catch(showError);
    if (view === "commissions") loadCommissions().catch(showError);
    if (view === "reports") Promise.all([loadSales(), loadDashboard()]).catch(showError);
    if (view === "dev") Promise.all([loadProducts(), loadPayments(), loadCoupons(), loadSettings()]).catch(showError);
  }

  function showError(error) { toast(error.message || "Erro inesperado.", "error"); }
  function openSidebar() { $("salesSidebar")?.classList.add("open"); if ($("salesMobileOverlay")) $("salesMobileOverlay").hidden = false; }
  function closeSidebar() { $("salesSidebar")?.classList.remove("open"); if ($("salesMobileOverlay")) $("salesMobileOverlay").hidden = true; }
  function openModal(id) { if ($(id)) $(id).hidden = false; document.body.style.overflow = "hidden"; }
  function closeModals() { document.querySelectorAll(".sales-modal").forEach((modal) => { modal.hidden = true; }); document.body.style.overflow = ""; }

  function resetSaleForm() {
    $("saleForm").reset(); $("saleId").value = ""; $("saleModalTitle").textContent = "Registrar venda"; $("saleDate").value = new Date().toISOString().slice(0, 10); $("saleStatus").value = "pendente"; $("saleInstallments").value = "1"; $("saleManualDiscount").value = "0";
    const seller = state.sellers.find((item) => item.id === state.context?.usuario?.id) || state.sellers[0];
    if (seller) $("saleSeller").value = seller.id;
    const product = state.products.find((item) => item.ativo);
    if (product) { $("saleProduct").value = product.id; $("saleGrossValue").value = product.preco; }
    const defaultCommission = Number($("defaultCommission")?.value || seller?.comissao || 20);
    $("saleCommissionPercent").value = defaultCommission;
    updateSalePreview();
  }

  function openSale(clientId = "") {
    resetSaleForm();
    if (clientId) { $("saleClient").value = clientId; applySelectedClient(); }
    openModal("saleModal");
  }

  function applySelectedClient() {
    const client = state.clients.find((item) => item.id === $("saleClient").value);
    if (!client) return;
    $("saleClientName").value = client.nome || ""; $("saleClientEmail").value = client.email || ""; $("saleClientPhone").value = client.telefone || "";
  }

  function applySelectedProduct() {
    const product = state.products.find((item) => item.id === $("saleProduct").value);
    if (product) $("saleGrossValue").value = product.preco;
    updateSalePreview();
  }

  function updateSalePreview() {
    const gross = Number($("saleGrossValue")?.value || 0);
    const discount = Number($("saleManualDiscount")?.value || 0);
    const finalValue = Math.max(0, gross - discount);
    const percent = Number($("saleCommissionPercent")?.value || 0);
    setText("saleFinalPreview", money(finalValue)); setText("saleCommissionPreview", money(finalValue * percent / 100));
  }

  async function submitSale(event) {
    event.preventDefault();
    const button = $("saveSaleButton"); button.disabled = true; button.textContent = "Salvando…";
    const id = $("saleId").value;
    const body = {
      clienteId: $("saleClient").value,
      clienteNome: $("saleClientName").value,
      clienteEmail: $("saleClientEmail").value,
      clienteTelefone: $("saleClientPhone").value,
      vendedorId: $("saleSeller").value,
      produtoId: $("saleProduct").value,
      valorBruto: Number($("saleGrossValue").value || 0),
      cupomCodigo: $("saleCoupon").value,
      descontoManual: Number($("saleManualDiscount").value || 0),
      formaPagamento: $("salePayment").value,
      parcelas: Number($("saleInstallments").value || 1),
      status: $("saleStatus").value,
      porcentagemComissao: Number($("saleCommissionPercent").value || 0),
      dataVenda: $("saleDate").value,
      observacoes: $("saleNotes").value
    };
    try {
      await api(id ? `/vendas/${id}` : "/vendas", { method: id ? "PUT" : "POST", body });
      closeModals(); toast(id ? "Venda atualizada." : "Venda registrada com sucesso.");
      await Promise.all([loadSales(), loadDashboard(), loadClients()]);
    } catch (error) { toast(error.message, "error"); }
    finally { button.disabled = false; button.textContent = "Salvar venda"; }
  }

  function editSale(id) {
    const sale = state.sales.find((item) => item.id === id) || state.dashboard?.recentes?.find((item) => item.id === id);
    if (!sale) return;
    resetSaleForm(); $("saleId").value = sale.id; $("saleModalTitle").textContent = "Editar venda";
    $("saleClient").value = sale.clienteId || ""; $("saleClientName").value = sale.clienteNome || ""; $("saleClientEmail").value = sale.clienteEmail || ""; $("saleClientPhone").value = sale.clienteTelefone || ""; $("saleSeller").value = sale.vendedorId || ""; $("saleProduct").value = sale.produtoId || ""; $("saleGrossValue").value = sale.valorBruto; $("saleCoupon").value = sale.cupomCodigo || ""; $("saleManualDiscount").value = sale.desconto || 0; $("salePayment").value = sale.formaPagamento; $("saleInstallments").value = sale.parcelas || 1; $("saleStatus").value = sale.status; $("saleCommissionPercent").value = sale.porcentagemComissao; $("saleDate").value = String(sale.dataVenda || "").slice(0, 10); $("saleNotes").value = sale.observacoes || ""; updateSalePreview(); openModal("saleModal");
  }

  async function changeSaleStatus(id, status) {
    const ok = await confirmAction("Alterar status", `Deseja marcar esta venda como ${statusLabel(status).toLowerCase()}?`, status === "pago" ? "Confirmar pagamento" : "Confirmar");
    if (!ok) return;
    try { await api(`/vendas/${id}/status`, { method: "POST", body: { status } }); toast("Status atualizado."); await Promise.all([loadSales(), loadDashboard(), loadClients()]); } catch (error) { toast(error.message, "error"); }
  }

  async function deleteSale(id) {
    const ok = await confirmAction("Apagar venda", "Essa ação é exclusiva do Dev e não pode ser desfeita.", "Apagar definitivamente");
    if (!ok) return;
    try { await api(`/vendas/${id}`, { method: "DELETE" }); toast("Venda apagada."); await Promise.all([loadSales(), loadDashboard()]); } catch (error) { toast(error.message, "error"); }
  }

  function confirmAction(title, text, acceptLabel = "Confirmar") {
    $("salesConfirmTitle").textContent = title; $("salesConfirmText").textContent = text; $("salesConfirmAccept").textContent = acceptLabel; $("salesConfirm").hidden = false;
    return new Promise((resolve) => { state.confirmResolver = resolve; });
  }
  function finishConfirm(value) { $("salesConfirm").hidden = true; state.confirmResolver?.(value); state.confirmResolver = null; }

  function openProduct(item = null) {
    $("productForm").reset(); $("productId").value = item?.id || ""; $("productModalTitle").textContent = item ? "Editar produto" : "Novo produto"; $("productName").value = item?.nome || ""; $("productCode").value = item?.codigo || ""; $("productDescription").value = item?.descricao || ""; $("productPrice").value = item?.preco ?? ""; $("productDuration").value = item?.duracaoDias || 30; $("productOrder").value = item?.ordem || 0; $("productActive").checked = item ? item.ativo : true; openModal("productModal");
  }
  async function submitProduct(event) { event.preventDefault(); const id=$("productId").value; const body={nome:$("productName").value,codigo:$("productCode").value,descricao:$("productDescription").value,preco:Number($("productPrice").value),duracaoDias:Number($("productDuration").value),ordem:Number($("productOrder").value),ativo:$("productActive").checked}; try{await api(id?`/vendas/produtos/${id}`:"/vendas/produtos",{method:id?"PUT":"POST",body});closeModals();toast("Produto salvo.");await loadProducts();}catch(error){toast(error.message,"error");} }
  async function deleteProduct(id){if(!await confirmAction("Excluir produto","Produtos com vendas vinculadas serão apenas desativados.","Excluir/Desativar"))return;try{await api(`/vendas/produtos/${id}`,{method:"DELETE"});toast("Produto atualizado.");await loadProducts();}catch(error){toast(error.message,"error");}}

  function openPayment(item=null){$("paymentForm").reset();$("paymentId").value=item?.id||"";$("paymentModalTitle").textContent=item?"Editar forma de pagamento":"Nova forma de pagamento";$("paymentName").value=item?.nome||"";$("paymentCode").value=item?.codigo||"";$("paymentFee").value=item?.taxaPercentual||0;$("paymentActive").checked=item?item.ativo:true;openModal("paymentModal");}
  async function submitPayment(event){event.preventDefault();const id=$("paymentId").value;const body={nome:$("paymentName").value,codigo:$("paymentCode").value,taxaPercentual:Number($("paymentFee").value),ativo:$("paymentActive").checked};try{await api(id?`/vendas/formas-pagamento/${id}`:"/vendas/formas-pagamento",{method:id?"PUT":"POST",body});closeModals();toast("Forma de pagamento salva.");await loadPayments();}catch(error){toast(error.message,"error");}}
  async function deletePayment(id){if(!await confirmAction("Desativar forma","A forma de pagamento deixará de aparecer em novas vendas.","Desativar"))return;try{await api(`/vendas/formas-pagamento/${id}`,{method:"DELETE"});toast("Forma desativada.");await loadPayments();}catch(error){toast(error.message,"error");}}

  function openCoupon(item=null){$("couponForm").reset();$("couponId").value=item?.id||"";$("couponModalTitle").textContent=item?"Editar cupom":"Novo cupom";$("couponCode").value=item?.codigo||"";$("couponType").value=item?.tipo||"percentual";$("couponValue").value=item?.valor??"";$("couponLimit").value=item?.limiteUsos||0;$("couponExpires").value=item?.validoAte?String(item.validoAte).slice(0,16):"";$("couponActive").checked=item?item.ativo:true;openModal("couponModal");}
  async function submitCoupon(event){event.preventDefault();const id=$("couponId").value;const body={codigo:$("couponCode").value,tipo:$("couponType").value,valor:Number($("couponValue").value),limiteUsos:Number($("couponLimit").value),validoAte:$("couponExpires").value||null,ativo:$("couponActive").checked};try{await api(id?`/vendas/cupons/${id}`:"/vendas/cupons",{method:id?"PUT":"POST",body});closeModals();toast("Cupom salvo.");await loadCoupons();}catch(error){toast(error.message,"error");}}
  async function deleteCoupon(id){if(!await confirmAction("Desativar cupom","O cupom não poderá ser usado em novas vendas.","Desativar"))return;try{await api(`/vendas/cupons/${id}`,{method:"DELETE"});toast("Cupom desativado.");await loadCoupons();}catch(error){toast(error.message,"error");}}

  async function payCommission(id){if(!await confirmAction("Pagar comissão","Marcar esta comissão como paga?","Marcar como paga"))return;try{await api(`/vendas/comissoes/${id}/pagar`,{method:"POST",body:{}});toast("Comissão marcada como paga.");await loadCommissions();}catch(error){toast(error.message,"error");}}
  async function saveSettings(){try{await api("/vendas/configuracoes",{method:"PUT",body:{comissao_padrao:$("defaultCommission").value}});toast("Configurações salvas.");}catch(error){toast(error.message,"error");}}

  function exportCSV(items=state.sales,filename="vendas-turma-do-primo.csv"){
    if(!items.length){toast("Não há dados para exportar.","error");return;}
    const headers=["Data","Cliente","E-mail","Produto","Vendedor","Valor bruto","Desconto","Valor final","Pagamento","Parcelas","Status","Comissão"];
    const rows=items.map(item=>[item.dataVenda,item.clienteNome,item.clienteEmail,item.produtoNome,item.vendedorNome,item.valorBruto,item.desconto,item.valor,paymentLabel(item.formaPagamento),item.parcelas,statusLabel(item.status),item.comissao]);
    const csv="\uFEFF"+[headers,...rows].map(row=>row.map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(";")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast("Relatório exportado.");
  }

  function registerEvents() {
    document.addEventListener("click", async (event) => {
      const viewButton = event.target.closest("[data-view]"); if (viewButton) { switchView(viewButton.dataset.view); return; }
      const viewTrigger = event.target.closest("[data-view-trigger]"); if (viewTrigger) { switchView(viewTrigger.dataset.viewTrigger); return; }
      if (event.target.closest("#salesMenuToggle")) openSidebar();
      if (event.target.closest("#salesSidebarClose") || event.target.closest("#salesMobileOverlay")) closeSidebar();
      if (event.target.closest("[data-logout]")) { clearSession(); window.location.replace("/index.html"); }
      if (event.target.closest("[data-open-sale]")) openSale();
      const newClientSale = event.target.closest("[data-new-sale-client]"); if (newClientSale) openSale(newClientSale.dataset.newSaleClient);
      if (event.target.closest("[data-close-modal]")) closeModals();
      const editSaleButton = event.target.closest("[data-edit-sale]"); if (editSaleButton) editSale(editSaleButton.dataset.editSale);
      const statusButton = event.target.closest("[data-sale-status]"); if (statusButton) changeSaleStatus(statusButton.dataset.saleId, statusButton.dataset.saleStatus);
      const deleteSaleButton = event.target.closest("[data-delete-sale]"); if (deleteSaleButton) deleteSale(deleteSaleButton.dataset.deleteSale);
      const periodButton = event.target.closest("[data-days]"); if (periodButton) { state.days = Number(periodButton.dataset.days); document.querySelectorAll("[data-days]").forEach((b) => b.classList.toggle("active", b === periodButton)); loadDashboard().catch(showError); }
      if (event.target.closest("[data-refresh-current]") || event.target.closest("#salesRefreshTop")) refreshCurrent();
      if (event.target.closest("[data-export-sales]")) exportCSV();
      if (event.target.closest("[data-export-commissions]")) exportCSV(state.commissions, "comissoes-turma-do-primo.csv");
      const devTab = event.target.closest("[data-dev-tab]"); if (devTab) switchDevTab(devTab.dataset.devTab);
      if (event.target.closest("[data-open-product]")) openProduct();
      const editProductButton = event.target.closest("[data-edit-product]"); if (editProductButton) openProduct(state.products.find((item) => item.id === editProductButton.dataset.editProduct));
      const deleteProductButton = event.target.closest("[data-delete-product]"); if (deleteProductButton) deleteProduct(deleteProductButton.dataset.deleteProduct);
      if (event.target.closest("[data-open-payment]")) openPayment();
      const editPaymentButton = event.target.closest("[data-edit-payment]"); if (editPaymentButton) openPayment(state.payments.find((item) => item.id === editPaymentButton.dataset.editPayment));
      const deletePaymentButton = event.target.closest("[data-delete-payment]"); if (deletePaymentButton) deletePayment(deletePaymentButton.dataset.deletePayment);
      if (event.target.closest("[data-open-coupon]")) openCoupon();
      const editCouponButton = event.target.closest("[data-edit-coupon]"); if (editCouponButton) openCoupon(state.coupons.find((item) => item.id === editCouponButton.dataset.editCoupon));
      const deleteCouponButton = event.target.closest("[data-delete-coupon]"); if (deleteCouponButton) deleteCoupon(deleteCouponButton.dataset.deleteCoupon);
      const payCommissionButton = event.target.closest("[data-pay-commission]"); if (payCommissionButton) payCommission(payCommissionButton.dataset.payCommission);
      if (event.target.closest("#saveSalesSettings")) saveSettings();
      if (event.target.closest("#salesConfirmCancel")) finishConfirm(false);
      if (event.target.closest("#salesConfirmAccept")) finishConfirm(true);
    });

    $("saleForm")?.addEventListener("submit", submitSale);
    $("productForm")?.addEventListener("submit", submitProduct);
    $("paymentForm")?.addEventListener("submit", submitPayment);
    $("couponForm")?.addEventListener("submit", submitCoupon);
    $("saleClient")?.addEventListener("change", applySelectedClient);
    $("saleProduct")?.addEventListener("change", applySelectedProduct);
    ["saleGrossValue", "saleManualDiscount", "saleCommissionPercent"].forEach((id) => $(id)?.addEventListener("input", updateSalePreview));
    $("refreshClients")?.addEventListener("click", () => loadClients().catch(showError));
    ["salesStatusFilter", "salesSellerFilter"].forEach((id) => $(id)?.addEventListener("change", () => loadSales().catch(showError)));
    $("salesSearch")?.addEventListener("input", () => debounce("sales", () => loadSales().catch(showError), 350));
    $("clientsSearch")?.addEventListener("input", () => debounce("clients", () => loadClients().catch(showError), 350));
    $("salesGlobalSearch")?.addEventListener("input", (event) => { switchView("sales"); $("salesSearch").value = event.target.value; debounce("global", () => loadSales().catch(showError), 300); });
    window.addEventListener("resize", () => debounce("resize", renderChart, 130));
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("salesGlobalSearch")?.focus(); }
      if (event.key === "Escape") { closeModals(); if (!$("salesConfirm").hidden) finishConfirm(false); closeSidebar(); }
    });
  }

  function debounce(key, fn, delay) { clearTimeout(state.timers[key]); state.timers[key] = setTimeout(fn, delay); }

  async function refreshCurrent() {
    try {
      if (state.activeView === "dashboard") await Promise.all([loadDashboard(), loadSales()]);
      if (state.activeView === "sales") await loadSales();
      if (state.activeView === "clients") await loadClients();
      if (state.activeView === "sellers") await Promise.all([loadSellers(), loadDashboard()]);
      if (state.activeView === "commissions") await loadCommissions();
      if (state.activeView === "reports") await Promise.all([loadSales(), loadDashboard()]);
      if (state.activeView === "dev") await Promise.all([loadProducts(), loadPayments(), loadCoupons(), loadSettings()]);
      toast("Dados atualizados.");
    } catch (error) { toast(error.message, "error"); }
  }

  function switchDevTab(tab) {
    document.querySelectorAll("[data-dev-tab]").forEach((button) => button.classList.toggle("active", button.dataset.devTab === tab));
    document.querySelectorAll(".sales-dev-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `dev-${tab}`));
  }
})();
