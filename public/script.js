"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  document.addEventListener("DOMContentLoaded", init, { once: true });

  function init() {
    clearLegacyStorage();
    bindEvents();
    showLogin();
  }

  function clearLegacyStorage() {
    [
      ...TOKEN_KEYS,
      "usuario",
      "usuarioLogado",
      "user",
      "currentUser",
      "perfil",
      "cargo",
      "plano"
    ].forEach((key) => {
      try { localStorage.removeItem(key); } catch (_) {}
    });
  }

  function saveToken(token) {
    TOKEN_KEYS.forEach((key) => {
      try { sessionStorage.removeItem(key); } catch (_) {}
    });
    if (token) sessionStorage.setItem("token", token);
  }

  function getToken() {
    for (const key of TOKEN_KEYS) {
      try {
        const token = sessionStorage.getItem(key);
        if (token) return token;
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 18000);
    const headers = { Accept: "application/json" };

    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.auth) {
      const token = getToken();
      if (!token) throw new Error("Sua sessão não foi encontrada.");
      headers.Authorization = `Bearer ${token}`;
    }

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
        throw new Error(data.erro || data.mensagem || `Erro ${response.status}.`);
      }

      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("O servidor demorou para responder.");
      if (error instanceof TypeError) throw new Error("Não foi possível conectar ao servidor.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function normalizeRole(user) {
    return String(user?.cargo || user?.tipo || "aluno")
      .trim()
      .toLowerCase()
      .replaceAll("_", "-");
  }

  function maskPhone(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    }
    return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  }

  function firstName(user) {
    return String(user?.nome || "Dev").trim().split(/\s+/)[0] || "Dev";
  }

  function hasSpecialAccess(user) {
    const permissions = user?.permissoes || user?.acessosRapidos || {};
    const role = normalizeRole(user);
    return Boolean(
      user?.contaDev ||
      ["dev", "dono", "superadmin", "admin", "financeiro", "vendedor", "moderador", "suporte"].includes(role) ||
      permissions.painelAdmin ||
      permissions.painelVendas
    );
  }

  function hasPremiumAccess(user) {
    const role = normalizeRole(user);
    if (["dev", "dono", "superadmin", "admin", "financeiro", "vendedor", "moderador", "suporte"].includes(role)) return true;
    if (user?.suspenso || ["suspenso", "bloqueado"].includes(user?.status) || user?.aprovado === false) return false;

    const plan = String(user?.plano || "free").toLowerCase();
    if (!["premium", "black", "black30", "black90", "black180", "black360", "admin"].includes(plan)) return false;
    if (!user?.dataExpiracao) return true;

    const expiration = new Date(user.dataExpiracao);
    expiration.setHours(23, 59, 59, 999);
    return Date.now() <= expiration.getTime();
  }

  function configureCards(user) {
    const permissions = user?.permissoes || user?.acessosRapidos || {};
    const role = normalizeRole(user);

    const dashboard = document.querySelector('[data-go="dashboard.html"]');
    const admin = document.querySelector('[data-go="admin.html"]');
    const sales = document.querySelector('[data-go="painel-vendas.html"]');

    if (dashboard) dashboard.hidden = permissions.dashboard === false;
    if (admin) {
      admin.hidden = !(permissions.painelAdmin === true || ["dev", "dono", "superadmin", "admin", "moderador"].includes(role));
    }
    if (sales) {
      sales.hidden = !(permissions.painelVendas === true || ["dev", "dono", "superadmin", "admin", "financeiro", "vendedor"].includes(role));
    }
  }

  function escapeHTML(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function openChoice(user) {
    const overlay = $("adminChoiceOverlay");
    if (!overlay) return;

    configureCards(user);
    const title = $("adminChoiceTitle");
    if (title) title.innerHTML = `Bem-vindo, <span>${escapeHTML(firstName(user))}!</span> 👑`;

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("admin-choice-open");
    requestAnimationFrame(() => overlay.classList.add("active", "open"));
  }

  function closeChoice() {
    const overlay = $("adminChoiceOverlay");
    if (!overlay) return;
    overlay.classList.remove("active", "open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("admin-choice-open");
    setTimeout(() => { if (!overlay.classList.contains("active")) overlay.hidden = true; }, 180);
  }

  function redirectUser(user) {
    if (!user) {
      clearSession();
      hideLoading();
      showMessage("Não foi possível validar sua conta.");
      return;
    }

    if (hasSpecialAccess(user)) {
      hideLoading();
      openChoice(user);
      return;
    }

    window.location.assign(hasPremiumAccess(user) ? "dashboard.html" : "dashboard-free.html");
  }

  function showMessage(message, type = "erro") {
    const box = $("mensagem");
    if (!box) return;
    box.textContent = String(message || "");
    box.className = `auth-message ${type} active`;
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.classList.remove("active"), 5000);
  }

  function showLoading(text = "Preparando seu acesso…") {
    const overlay = $("authLoadingOverlay");
    if (!overlay) return;
    if ($("authLoadingTexto")) $("authLoadingTexto").textContent = text;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => overlay.classList.add("active", "open"));
  }

  function hideLoading() {
    const overlay = $("authLoadingOverlay");
    if (!overlay) return;
    overlay.classList.remove("active", "open");
    overlay.setAttribute("aria-hidden", "true");
    setTimeout(() => { if (!overlay.classList.contains("active")) overlay.hidden = true; }, 180);
  }

  function setButtonLoading(button, active) {
    if (!button) return;
    if (active) {
      button.dataset.original = button.innerHTML;
      button.disabled = true;
      button.innerHTML = "<span>Aguarde…</span><span>◌</span>";
      return;
    }
    button.disabled = false;
    if (button.dataset.original) button.innerHTML = button.dataset.original;
  }

  function showLogin() {
    $("tabLogin")?.classList.add("active");
    $("tabCadastro")?.classList.remove("active");
    $("tabLogin")?.setAttribute("aria-selected", "true");
    $("tabCadastro")?.setAttribute("aria-selected", "false");
    if ($("formLogin")) { $("formLogin").hidden = false; $("formLogin").classList.add("active"); }
    if ($("formCadastro")) { $("formCadastro").hidden = true; $("formCadastro").classList.remove("active"); }
    if ($("authTitulo")) $("authTitulo").textContent = "Bem-vindo(a) de volta!";
    if ($("authDescricao")) $("authDescricao").textContent = "Acesse sua conta e continue sua jornada.";
  }

  function showRegister() {
    $("tabCadastro")?.classList.add("active");
    $("tabLogin")?.classList.remove("active");
    $("tabCadastro")?.setAttribute("aria-selected", "true");
    $("tabLogin")?.setAttribute("aria-selected", "false");
    if ($("formCadastro")) { $("formCadastro").hidden = false; $("formCadastro").classList.add("active"); }
    if ($("formLogin")) { $("formLogin").hidden = true; $("formLogin").classList.remove("active"); }
    if ($("authTitulo")) $("authTitulo").textContent = "Crie sua conta grátis";
    if ($("authDescricao")) $("authDescricao").textContent = "Comece agora no dashboard gratuito da Turma do Primo.";
  }

  function passwordStrength(password) {
    let points = 0;
    if (password.length >= 6) points++;
    if (password.length >= 10) points++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++;
    if (/\d/.test(password)) points++;
    if (/[^A-Za-z0-9]/.test(password)) points++;
    if (points <= 1) return ["fraca", "Fraca"];
    if (points <= 3) return ["media", "Média"];
    return ["forte", "Forte"];
  }

  function updateStrength() {
    const input = $("cadastroSenha");
    const indicator = $("senhaForcaIndicador");
    const text = $("senhaForcaTexto");
    if (!input || !indicator || !text) return;

    indicator.classList.remove("fraca", "media", "forte", "visivel");
    if (!input.value) {
      text.textContent = "Digite uma senha";
      return;
    }

    const [level, label] = passwordStrength(input.value);
    indicator.classList.add("visivel", level);
    text.textContent = label;
  }

  async function login(event) {
    event.preventDefault();
    const email = normalizeEmail($("loginEmail")?.value);
    const password = $("loginSenha")?.value || "";
    const button = event.currentTarget.querySelector(".auth-submit");

    if (!validEmail(email)) return showMessage("Digite um e-mail válido.");
    if (password.length < 4) return showMessage("A senha precisa ter pelo menos 4 caracteres.");

    setButtonLoading(button, true);
    showLoading("Verificando suas credenciais…");

    try {
      const response = await api("/login", { method: "POST", body: { email, senha: password } });
      if (!response?.token) throw new Error("O servidor não retornou um token de acesso.");
      saveToken(response.token);
      if ($("authLoadingTexto")) $("authLoadingTexto").textContent = "Carregando suas permissões…";
      const me = await api("/me", { auth: true });
      if (!me?.usuario) throw new Error("Não foi possível validar sua conta.");
      setTimeout(() => redirectUser(me.usuario), 300);
    } catch (error) {
      clearSession();
      hideLoading();
      showMessage(error.message || "Não foi possível fazer login.");
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function register(event) {
    event.preventDefault();
    const name = String($("cadastroNome")?.value || "").trim();
    const email = normalizeEmail($("cadastroEmail")?.value);
    const phone = String($("cadastroTelefone")?.value || "").trim();
    const password = $("cadastroSenha")?.value || "";
    const button = event.currentTarget.querySelector(".auth-submit");

    if (name.length < 3) return showMessage("Digite seu nome completo.");
    if (!validEmail(email)) return showMessage("Digite um e-mail válido.");
    if (phone.replace(/\D/g, "") && phone.replace(/\D/g, "").length < 10) return showMessage("Digite o WhatsApp corretamente.");
    if (password.length < 6) return showMessage("A senha precisa ter pelo menos 6 caracteres.");

    setButtonLoading(button, true);
    showLoading("Criando sua conta gratuita…");

    try {
      const response = await api("/criar", { method: "POST", body: { nome: name, email, telefone: phone, senha: password } });
      if (!response?.sucesso) throw new Error(response?.mensagem || "Não foi possível criar a conta.");
      hideLoading();
      event.currentTarget.reset();
      updateStrength();
      showLogin();
      if ($("loginEmail")) $("loginEmail").value = email;
      showMessage("Conta criada com sucesso. Agora faça seu login.", "sucesso");
    } catch (error) {
      hideLoading();
      showMessage(error.message || "Não foi possível criar a conta.");
    } finally {
      setButtonLoading(button, false);
    }
  }

  function togglePassword(button) {
    const input = $(button.dataset.target);
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute("aria-pressed", String(show));
    button.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
    button.textContent = show ? "◌" : "◉";
  }

  function bindEvents() {
    $("tabLogin")?.addEventListener("click", showLogin);
    $("tabCadastro")?.addEventListener("click", showRegister);
    $("formLogin")?.addEventListener("submit", login);
    $("formCadastro")?.addEventListener("submit", register);
    $("cadastroSenha")?.addEventListener("input", updateStrength);
    $("cadastroTelefone")?.addEventListener("input", (event) => { event.target.value = maskPhone(event.target.value); });

    $$(".toggle-password").forEach((button) => button.addEventListener("click", () => togglePassword(button)));
    $$('[data-go]').forEach((button) => button.addEventListener("click", () => {
      if (!button.hidden && !button.disabled && getToken()) window.location.assign(button.dataset.go);
    }));

    $("fecharAdminChoice")?.addEventListener("click", closeChoice);
    $("adminChoiceOverlay")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeChoice();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeChoice();
    });
  }
})();
