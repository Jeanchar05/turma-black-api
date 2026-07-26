"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = {
    contexto: null,
    usuario: null,
    permissoes: {},
    cargo: "aluno",
    centralDev: false,
    activeSection: "overview",
    loaded: new Set(),
    approvals: [],
    students: [],
    team: [],
    dev: null,
    devRole: "dono",
    confirmResolver: null,
    timers: {}
  };

  const permissionLabels = {
    dashboard: "Dashboard de aulas",
    painelAdmin: "Painel administrativo",
    painelVendas: "Painel de vendas",
    financas: "Finanças",
    usuarios: "Usuários",
    aprovacoes: "Aprovação de códigos",
    controleAlunos: "Controle de alunos",
    relatorios: "Relatórios",
    vendedores: "Vendedores",
    equipe: "Equipe e cargos",
    agendaPrimo: "Agenda do Primo",
    notificacoes: "Notificações",
    controleAdmin: "Controle administrativo",
    seguranca: "Segurança",
    planos: "Planos",
    provas: "Provas",
    suporte: "Suporte",
    configuracoes: "Configurações",
    permissoesSistema: "Central Dev"
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
    TOKEN_KEYS.forEach((key) => {
      try { sessionStorage.removeItem(key); } catch (_) {}
    });
  }

  async function api(endpoint, options = {}) {
    const token = getToken();
    if (!token) throw new Error("Sua sessão expirou. Faça login novamente.");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 20000);
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
      catch (_) { data = { mensagem: text || "Resposta inválida do servidor." }; }

      if (!response.ok || data.erro) {
        const error = new Error(data.erro || data.mensagem || `Erro ${response.status}.`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("O servidor demorou para responder.");
      throw error;
    } finally {
      clearTimeout(timeout);
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

  function formatDate(value, withTime = false) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("pt-BR", withTime
      ? { dateStyle: "short", timeStyle: "short" }
      : { dateStyle: "short" }
    ).format(date);
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(Number(value || 0));
  }

  function cargoLabel(cargo) {
    const map = {
      dev: "Dev",
      dono: "Dono",
      superadmin: "Dono",
      admin: "Admin",
      financeiro: "Financeiro",
      vendedor: "Vendedor",
      moderador: "Moderador",
      suporte: "Suporte",
      aluno: "Aluno"
    };
    return map[String(cargo || "").toLowerCase()] || "Usuário";
  }

  function planLabel(plan) {
    const map = {
      free: "Free",
      black30: "Black 30",
      black90: "Black 90",
      black180: "Black 180",
      black360: "Black 360",
      admin: "Administrativo"
    };
    return map[plan] || plan || "Free";
  }

  function statusBadge(status) {
    const value = String(status || "pendente").toLowerCase();
    return `<span class="admin-status-badge ${escapeHTML(value)}">${escapeHTML(value)}</span>`;
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = String(value ?? "—");
  }

  function debounce(key, fn, delay = 350) {
    clearTimeout(state.timers[key]);
    state.timers[key] = setTimeout(fn, delay);
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

  async function init() {
    registerEvents();

    if (!getToken()) {
      window.location.replace("index.html");
      return;
    }

    try {
      setText("adminLoadingText", "Carregando permissões e indicadores…");
      const context = await api("/admin/painel/contexto");
      state.contexto = context;
      state.usuario = context.usuario;
      state.permissoes = context.permissoes || {};
      state.cargo = context.cargo || "aluno";
      state.centralDev = Boolean(context.centralDev);

      applyIdentity();
      applyPermissions();
      renderOverview(context);
      hideLoading();
    } catch (error) {
      if ([401, 403].includes(error.status)) {
        clearSession();
        window.location.replace("index.html");
        return;
      }

      setText("adminLoadingText", error.message || "Não foi possível carregar o painel.");
      toast(error.message || "Erro ao abrir o painel.", "error");
    }
  }

  function applyIdentity() {
    const name = String(state.usuario?.nome || "Dev").trim();
    const first = name.split(/\s+/)[0] || "Dev";
    const initial = first.charAt(0).toUpperCase();
    const role = cargoLabel(state.cargo);

    $$('[data-user-name]').forEach((el) => { el.textContent = first; });
    $$('[data-user-role]').forEach((el) => { el.textContent = role; });
    $$('[data-user-initial]').forEach((el) => { el.textContent = initial; });
  }

  function applyPermissions() {
    $$('[data-permission]').forEach((element) => {
      const permission = element.dataset.permission;
      const allowed = Boolean(state.permissoes[permission]);
      element.hidden = !allowed;
    });

    $$('[data-dev-only]').forEach((element) => {
      element.hidden = !state.centralDev;
    });

    const roleSelect = $("teamRole");
    if (roleSelect && !["dev", "dono", "superadmin"].includes(state.cargo)) {
      const ownerOption = roleSelect.querySelector('option[value="dono"]');
      if (ownerOption) ownerOption.remove();
    }
  }

  function renderOverview(context) {
    const summary = context.resumo || {};
    setText("statTotalUsers", summary.totalUsuarios || 0);
    setText("statActiveStudents", summary.alunosAtivos || 0);
    setText("statPendingCodes", summary.codigosPendentes || 0);
    setText("statActiveTeam", summary.equipeAtiva || 0);

    setText("reportUsers", summary.totalUsuarios || 0);
    setText("reportSales", summary.totalVendas || 0);
    setText("reportPending", summary.codigosPendentes || 0);
    setText("reportTeam", summary.equipeAtiva || 0);

    updateApprovalBadges(summary.codigosPendentes || 0);

    const list = $("overviewUsersList");
    if (!list) return;

    const users = Array.isArray(context.ultimosUsuarios) ? context.ultimosUsuarios : [];
    if (!users.length) {
      list.innerHTML = '<div class="admin-empty-state">Nenhum usuário cadastrado ainda.</div>';
      return;
    }

    list.innerHTML = users.map((user) => {
      const name = user.nome || user.email || "Usuário";
      const initial = name.charAt(0).toUpperCase();
      return `
        <div class="admin-list-row">
          <span class="admin-row-avatar">${escapeHTML(initial)}</span>
          <div><strong>${escapeHTML(name)}</strong><small>${escapeHTML(user.email || "")}</small></div>
          <span>${planLabel(user.plano)}</span>
          ${statusBadge(user.status)}
        </div>
      `;
    }).join("");
  }

  function updateApprovalBadges(count) {
    [$("approvalMenuBadge"), $("adminTopBadge")].forEach((badge) => {
      if (!badge) return;
      badge.textContent = String(count || 0);
      badge.hidden = !Number(count);
    });
  }

  function hideLoading() {
    const loading = $("adminAppLoading");
    if (!loading) return;
    loading.classList.add("hide");
    setTimeout(() => loading.remove(), 300);
    document.body.classList.add("admin-ready");
  }

  function openSidebar() {
    $("adminSidebar")?.classList.add("open");
    const overlay = $("adminMobileOverlay");
    if (overlay) {
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add("active"));
    }
    document.body.classList.add("admin-menu-open");
  }

  function closeSidebar() {
    $("adminSidebar")?.classList.remove("open");
    const overlay = $("adminMobileOverlay");
    if (overlay) {
      overlay.classList.remove("active");
      setTimeout(() => { overlay.hidden = true; }, 180);
    }
    document.body.classList.remove("admin-menu-open");
  }

  async function openSection(sectionName) {
    const section = $(`section-${sectionName}`);
    if (!section || section.hidden) return;

    state.activeSection = sectionName;
    $$(".admin-section").forEach((item) => item.classList.toggle("active", item === section));
    $$('[data-section]').forEach((item) => item.classList.toggle("active", item.dataset.section === sectionName));
    setText("adminPageTitle", section.dataset.title || "Painel Administrativo");
    closeSidebar();

    try {
      if (sectionName === "approvals") await loadApprovals();
      if (sectionName === "students") await loadStudents();
      if (sectionName === "team") await loadTeam();
      if (sectionName === "dev") await loadDev();
    } catch (error) {
      toast(error.message || "Erro ao carregar esta área.", "error");
    }
  }

  async function loadApprovals() {
    const search = encodeURIComponent($("approvalSearch")?.value.trim() || "");
    const status = encodeURIComponent($("approvalStatus")?.value || "");
    const body = $("approvalTableBody");
    if (body) body.innerHTML = '<tr><td colspan="6"><div class="admin-empty-state">Carregando solicitações…</div></td></tr>';

    const [summaryResponse, listResponse] = await Promise.all([
      api("/admin/liberacoes/resumo"),
      api(`/admin/liberacoes?status=${status}&busca=${search}`)
    ]);

    const summary = summaryResponse.resumo || {};
    setText("approvalPending", summary.pendentes || 0);
    setText("approvalApproved", summary.aprovadas || 0);
    setText("approvalRejected", summary.recusadas || 0);
    setText("approvalTotal", summary.total || 0);
    updateApprovalBadges(summary.pendentes || 0);

    state.approvals = listResponse.solicitacoes || [];
    renderApprovals();
  }

  function renderApprovals() {
    const body = $("approvalTableBody");
    if (!body) return;

    if (!state.approvals.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="admin-empty-state">Nenhuma solicitação encontrada.</div></td></tr>';
      return;
    }

    body.innerHTML = state.approvals.map((item) => {
      const pending = item.status === "pendente";
      return `
        <tr>
          <td><strong class="admin-code">${escapeHTML(item.codigo)}</strong><small>${formatDate(item.createdAt, true)}</small></td>
          <td><strong>${escapeHTML(item.nome || "Aluno")}</strong><small>${escapeHTML(item.email || "")}</small></td>
          <td>${escapeHTML(planLabel(item.plano))}</td>
          <td>${formatMoney(item.valor)}</td>
          <td>${statusBadge(item.status)}</td>
          <td>
            <div class="admin-table-actions">
              ${pending ? `<button class="approve" type="button" data-action="approve-code" data-id="${item._id}">Aprovar</button><button class="reject" type="button" data-action="reject-code" data-id="${item._id}">Recusar</button>` : '<span class="admin-muted-action">Analisado</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  async function approveCode(id) {
    const item = state.approvals.find((entry) => entry._id === id);
    const accepted = await confirmAction(
      "Aprovar código Premium",
      `Liberar ${planLabel(item?.plano)} para ${item?.nome || "este aluno"}?`,
      "Aprovar e liberar"
    );
    if (!accepted) return;

    const response = await api(`/admin/liberacoes/${id}/aprovar`, { method: "POST", body: {} });
    toast(response.mensagem || "Código aprovado.");
    await loadApprovals();
    await refreshContextSummary();
  }

  async function rejectCode(id) {
    const item = state.approvals.find((entry) => entry._id === id);
    const accepted = await confirmAction(
      "Recusar solicitação",
      `Recusar o código ${item?.codigo || "selecionado"}?`,
      "Recusar"
    );
    if (!accepted) return;

    const response = await api(`/admin/liberacoes/${id}/recusar`, {
      method: "POST",
      body: { motivo: "Pagamento não confirmado pela equipe." }
    });
    toast(response.mensagem || "Solicitação recusada.");
    await loadApprovals();
    await refreshContextSummary();
  }

  async function loadStudents() {
    const search = encodeURIComponent($("studentSearch")?.value.trim() || "");
    const status = encodeURIComponent($("studentStatus")?.value || "");
    const plan = encodeURIComponent($("studentPlan")?.value || "");
    const body = $("studentsTableBody");
    if (body) body.innerHTML = '<tr><td colspan="6"><div class="admin-empty-state">Carregando alunos…</div></td></tr>';

    const [summaryResponse, listResponse] = await Promise.all([
      api("/usuarios/resumo"),
      api(`/usuarios?cargo=aluno&status=${status}&plano=${plan}&busca=${search}&limite=300`)
    ]);

    const summary = summaryResponse.resumo || {};
    setText("studentTotal", summary.total || 0);
    setText("studentApproved", summary.aprovados || 0);
    setText("studentPending", summary.pendentes || 0);
    setText("studentSuspended", summary.suspensos || 0);

    state.students = listResponse.usuarios || [];
    renderStudents();
  }

  function renderStudents() {
    const body = $("studentsTableBody");
    if (!body) return;

    if (!state.students.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="admin-empty-state">Nenhum aluno encontrado.</div></td></tr>';
      return;
    }

    body.innerHTML = state.students.map((user) => {
      const active = user.status === "ativo" && !user.suspenso;
      const pending = user.status === "pendente" || user.aprovado === false;
      return `
        <tr>
          <td><strong>${escapeHTML(user.nome || "Aluno")}</strong><small>${escapeHTML(user.email || "")}</small></td>
          <td><span class="admin-code">${escapeHTML(user.codigo || "—")}</span></td>
          <td>${escapeHTML(planLabel(user.plano))}</td>
          <td>${statusBadge(user.status)}</td>
          <td>${formatDate(user.dataExpiracao)}</td>
          <td>
            <div class="admin-table-actions">
              ${pending ? `<button class="approve" type="button" data-action="approve-student" data-id="${user.id || user._id}">Aprovar</button>` : ""}
              ${active ? `<button type="button" data-action="suspend-student" data-id="${user.id || user._id}">Suspender</button>` : `<button class="approve" type="button" data-action="reactivate-student" data-id="${user.id || user._id}">Reativar</button>`}
              <button class="reject" type="button" data-action="block-student" data-id="${user.id || user._id}">Bloquear</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  async function studentAction(action, id) {
    const user = state.students.find((item) => String(item.id || item._id) === String(id));
    const labels = {
      approve: ["Aprovar aluno", "Ativar esta conta no plano Free?", "Aprovar"],
      suspend: ["Suspender aluno", `Suspender o acesso de ${user?.nome || "este aluno"}?`, "Suspender"],
      reactivate: ["Reativar aluno", `Reativar o acesso de ${user?.nome || "este aluno"}?`, "Reativar"],
      block: ["Bloquear aluno", `Bloquear a conta de ${user?.nome || "este aluno"}?`, "Bloquear"]
    };

    const [title, text, confirmLabel] = labels[action];
    if (!await confirmAction(title, text, confirmLabel)) return;

    const endpointMap = {
      approve: ["/aprovar", { id, plano: "free", dias: 0 }],
      suspend: ["/suspender", { id, motivo: "Suspensão administrativa" }],
      reactivate: ["/reativar", { id }],
      block: ["/usuario/bloquear", { id }]
    };

    const [endpoint, payload] = endpointMap[action];
    const response = await api(endpoint, { method: "POST", body: payload });
    toast(response.mensagem || "Conta atualizada.");
    await loadStudents();
    await refreshContextSummary();
  }

  async function loadTeam() {
    const response = await api("/admin/equipe");
    state.team = response.equipe || [];
    renderTeam();
  }

  function renderTeam() {
    const grid = $("teamGrid");
    if (!grid) return;

    const query = String($("teamSearch")?.value || "").trim().toLowerCase();
    const filtered = state.team.filter((user) => {
      return !query || `${user.nome} ${user.email} ${user.cargo}`.toLowerCase().includes(query);
    });

    if (!filtered.length) {
      grid.innerHTML = '<div class="admin-empty-state">Nenhum membro encontrado.</div>';
      return;
    }

    grid.innerHTML = filtered.map((user) => {
      const id = user.id || user._id;
      const initial = String(user.nome || user.email || "U").charAt(0).toUpperCase();
      return `
        <article class="admin-team-card">
          <div class="admin-team-head"><span>${escapeHTML(initial)}</span>${statusBadge(user.status)}</div>
          <h3>${escapeHTML(user.nome || "Membro")}</h3>
          <p>${escapeHTML(user.email || "")}</p>
          <div class="admin-team-meta"><span>${escapeHTML(cargoLabel(user.cargo))}</span><span>${Number(user.comissao || 0)}% comissão</span></div>
          <div class="admin-team-actions"><button type="button" data-action="edit-team" data-id="${id}">Editar</button>${user.status === "ativo" ? `<button class="reject" type="button" data-action="suspend-team" data-id="${id}">Suspender</button>` : `<button class="approve" type="button" data-action="activate-team" data-id="${id}">Ativar</button>`}</div>
        </article>
      `;
    }).join("");
  }

  function openTeamModal(user = null) {
    const modal = $("teamModal");
    if (!modal) return;

    $("teamForm")?.reset();
    $("teamId").value = user?.id || user?._id || "";
    $("teamName").value = user?.nome || "";
    $("teamEmail").value = user?.email || "";
    $("teamEmail").disabled = Boolean(user);
    $("teamPhone").value = user?.telefone || "";
    $("teamRole").value = user?.cargo || "vendedor";
    $("teamPassword").value = "";
    $("teamPassword").required = !user;
    $("teamCommission").value = Number(user?.comissao ?? 20);
    setText("teamModalTitle", user ? "Editar membro" : "Criar novo membro");

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => modal.classList.add("active"));
    document.body.classList.add("admin-modal-open");
  }

  function closeTeamModal() {
    const modal = $("teamModal");
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("admin-modal-open");
    setTimeout(() => { modal.hidden = true; }, 180);
  }

  async function saveTeam(event) {
    event.preventDefault();
    const id = $("teamId").value;
    const button = $("teamSubmit");
    const payload = {
      nome: $("teamName").value.trim(),
      email: $("teamEmail").value.trim().toLowerCase(),
      telefone: $("teamPhone").value.trim(),
      cargo: $("teamRole").value,
      senha: $("teamPassword").value,
      comissao: Number($("teamCommission").value || 20)
    };

    if (!id && payload.senha.length < 6) {
      toast("A senha precisa ter pelo menos 6 caracteres.", "error");
      return;
    }

    button.disabled = true;
    try {
      const response = await api(id ? `/admin/equipe/${id}` : "/admin/equipe", {
        method: id ? "PATCH" : "POST",
        body: payload
      });
      toast(response.mensagem || "Membro salvo.");
      closeTeamModal();
      await loadTeam();
      await refreshContextSummary();
    } catch (error) {
      toast(error.message || "Erro ao salvar membro.", "error");
    } finally {
      button.disabled = false;
    }
  }

  async function updateTeamStatus(id, status) {
    const user = state.team.find((item) => String(item.id || item._id) === String(id));
    const accepted = await confirmAction(
      status === "ativo" ? "Ativar membro" : "Suspender membro",
      `${status === "ativo" ? "Ativar" : "Suspender"} ${user?.nome || "esta conta"}?`,
      status === "ativo" ? "Ativar" : "Suspender"
    );
    if (!accepted) return;

    const response = await api(`/admin/equipe/${id}`, {
      method: "PATCH",
      body: { status }
    });
    toast(response.mensagem || "Conta atualizada.");
    await loadTeam();
    await refreshContextSummary();
  }

  async function loadDev(force = false) {
    if (state.dev && !force) {
      renderDevRole();
      return;
    }

    const response = await api("/admin/dev/permissoes");
    state.dev = response;
    populateDevUsers();
    renderDevRole();
  }

  function renderPermissionGrid(containerId, permissions = {}, namePrefix = "permission") {
    const grid = $(containerId);
    if (!grid) return;

    const keys = state.dev?.chaves || Object.keys(permissionLabels);
    grid.innerHTML = keys.map((key) => `
      <label class="admin-permission-item">
        <span><strong>${escapeHTML(permissionLabels[key] || key)}</strong><small>${escapeHTML(key)}</small></span>
        <input type="checkbox" name="${escapeHTML(namePrefix)}" value="${escapeHTML(key)}" ${permissions[key] ? "checked" : ""} />
        <i></i>
      </label>
    `).join("");
  }

  function renderDevRole() {
    if (!state.dev) return;
    $$('[data-dev-role]').forEach((button) => button.classList.toggle("active", button.dataset.devRole === state.devRole));
    renderPermissionGrid("devPermissionGrid", state.dev.matriz?.[state.devRole] || {}, "dev-role-permission");
  }

  function populateDevUsers() {
    const select = $("devUserSelect");
    if (!select || !state.dev) return;

    select.innerHTML = '<option value="">Selecione uma conta</option>' + (state.dev.contas || []).map((user) => `
      <option value="${user._id}">${escapeHTML(user.nome || user.email)} — ${escapeHTML(cargoLabel(user.cargo))}</option>
    `).join("");
  }

  function renderDevUser(userId) {
    const button = $("saveDevUserPermissions");
    if (!userId || !state.dev) {
      $("devUserPermissionGrid").innerHTML = '<div class="admin-empty-state">Selecione uma conta para personalizar.</div>';
      if (button) button.disabled = true;
      return;
    }

    const user = state.dev.contas.find((item) => String(item._id) === String(userId));
    const roleMatrix = state.dev.matriz?.[user?.cargo] || {};
    const effective = { ...roleMatrix, ...(user?.permissoesPersonalizadas || {}) };
    renderPermissionGrid("devUserPermissionGrid", effective, "dev-user-permission");
    if (button) button.disabled = false;
  }

  function collectPermissions(name) {
    const result = {};
    $$(`input[name="${name}"]`).forEach((input) => {
      result[input.value] = input.checked;
    });
    return result;
  }

  async function saveDevRole() {
    const permissions = collectPermissions("dev-role-permission");
    const response = await api(`/admin/dev/permissoes/${state.devRole}`, {
      method: "PUT",
      body: { permissoes: permissions }
    });
    state.dev.matriz[state.devRole] = response.permissoes || permissions;
    toast(response.mensagem || "Permissões atualizadas.");
    renderDevRole();
  }

  async function saveDevUser() {
    const userId = $("devUserSelect")?.value;
    if (!userId) return;

    const permissions = collectPermissions("dev-user-permission");
    const response = await api(`/admin/dev/usuarios/${userId}/permissoes`, {
      method: "PUT",
      body: { permissoes: permissions }
    });

    const user = state.dev.contas.find((item) => String(item._id) === String(userId));
    if (user) user.permissoesPersonalizadas = permissions;
    toast(response.mensagem || "Permissões individuais atualizadas.");
  }

  async function refreshContextSummary() {
    const context = await api("/admin/painel/contexto");
    state.contexto = context;
    renderOverview(context);
  }

  function confirmAction(title, text, acceptLabel = "Confirmar") {
    const modal = $("adminConfirm");
    if (!modal) return Promise.resolve(window.confirm(text));

    setText("confirmTitle", title);
    setText("confirmText", text);
    setText("confirmAccept", acceptLabel);
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => modal.classList.add("active"));
    document.body.classList.add("admin-modal-open");

    return new Promise((resolve) => {
      state.confirmResolver = resolve;
    });
  }

  function closeConfirm(result = false) {
    const modal = $("adminConfirm");
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("admin-modal-open");
    setTimeout(() => { modal.hidden = true; }, 180);

    if (state.confirmResolver) {
      state.confirmResolver(Boolean(result));
      state.confirmResolver = null;
    }
  }

  function logout() {
    clearSession();
    window.location.replace("index.html");
  }

  function registerEvents() {
    $("adminMenuToggle")?.addEventListener("click", openSidebar);
    $("adminSidebarClose")?.addEventListener("click", closeSidebar);
    $("adminMobileOverlay")?.addEventListener("click", closeSidebar);
    $("teamForm")?.addEventListener("submit", saveTeam);
    $("confirmCancel")?.addEventListener("click", () => closeConfirm(false));
    $("confirmAccept")?.addEventListener("click", () => closeConfirm(true));

    $("refreshApprovals")?.addEventListener("click", () => loadApprovals().catch((e) => toast(e.message, "error")));
    $("refreshStudents")?.addEventListener("click", () => loadStudents().catch((e) => toast(e.message, "error")));
    $("refreshTeam")?.addEventListener("click", () => loadTeam().catch((e) => toast(e.message, "error")));
    $("refreshDev")?.addEventListener("click", () => loadDev(true).catch((e) => toast(e.message, "error")));
    $("saveDevRolePermissions")?.addEventListener("click", () => saveDevRole().catch((e) => toast(e.message, "error")));
    $("saveDevUserPermissions")?.addEventListener("click", () => saveDevUser().catch((e) => toast(e.message, "error")));

    $("approvalSearch")?.addEventListener("input", () => debounce("approval-search", () => loadApprovals().catch((e) => toast(e.message, "error"))));
    $("approvalStatus")?.addEventListener("change", () => loadApprovals().catch((e) => toast(e.message, "error")));
    $("studentSearch")?.addEventListener("input", () => debounce("student-search", () => loadStudents().catch((e) => toast(e.message, "error"))));
    $("studentStatus")?.addEventListener("change", () => loadStudents().catch((e) => toast(e.message, "error")));
    $("studentPlan")?.addEventListener("change", () => loadStudents().catch((e) => toast(e.message, "error")));
    $("teamSearch")?.addEventListener("input", renderTeam);
    $("devUserSelect")?.addEventListener("change", (event) => renderDevUser(event.target.value));

    document.addEventListener("click", async (event) => {
      const sectionButton = event.target.closest("[data-section]");
      if (sectionButton) {
        event.preventDefault();
        await openSection(sectionButton.dataset.section);
        return;
      }

      const trigger = event.target.closest("[data-section-trigger]");
      if (trigger) {
        event.preventDefault();
        await openSection(trigger.dataset.sectionTrigger);
        return;
      }

      const devRole = event.target.closest("[data-dev-role]");
      if (devRole) {
        state.devRole = devRole.dataset.devRole;
        renderDevRole();
        return;
      }

      if (event.target.closest("[data-logout]")) {
        logout();
        return;
      }

      if (event.target.closest('[data-open-modal="team"]')) {
        openTeamModal();
        return;
      }

      if (event.target.closest('[data-close-modal="team"]')) {
        closeTeamModal();
        return;
      }

      const action = event.target.closest("[data-action]");
      if (!action) return;

      const id = action.dataset.id;
      try {
        if (action.dataset.action === "approve-code") await approveCode(id);
        if (action.dataset.action === "reject-code") await rejectCode(id);
        if (action.dataset.action === "approve-student") await studentAction("approve", id);
        if (action.dataset.action === "suspend-student") await studentAction("suspend", id);
        if (action.dataset.action === "reactivate-student") await studentAction("reactivate", id);
        if (action.dataset.action === "block-student") await studentAction("block", id);
        if (action.dataset.action === "edit-team") {
          const user = state.team.find((item) => String(item.id || item._id) === String(id));
          openTeamModal(user);
        }
        if (action.dataset.action === "suspend-team") await updateTeamStatus(id, "suspenso");
        if (action.dataset.action === "activate-team") await updateTeamStatus(id, "ativo");
      } catch (error) {
        toast(error.message || "Não foi possível concluir a ação.", "error");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeSidebar();
      closeTeamModal();
      if (state.confirmResolver) closeConfirm(false);
    });
  }
})();
