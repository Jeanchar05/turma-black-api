"use strict";

(() => {
  const API_URL = window.location.origin;
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  document.addEventListener("DOMContentLoaded", iniciar, { once: true });

  function iniciar() {
    limparDadosAntigos();
    registrarEventos();
    ativarLogin();
  }

  function limparDadosAntigos() {
    const antigas = [
      ...TOKEN_KEYS,
      "usuario",
      "usuarioLogado",
      "user",
      "currentUser",
      "perfil",
      "cargo",
      "plano"
    ];

    antigas.forEach((chave) => {
      try {
        localStorage.removeItem(chave);
      } catch (_) {}
    });
  }

  function salvarToken(token) {
    TOKEN_KEYS.forEach((chave) => {
      try {
        sessionStorage.removeItem(chave);
      } catch (_) {}
    });

    if (token) {
      sessionStorage.setItem("token", token);
    }
  }

  function pegarToken() {
    for (const chave of TOKEN_KEYS) {
      try {
        const token = sessionStorage.getItem(chave);
        if (token) return token;
      } catch (_) {}
    }

    return "";
  }

  function limparSessao() {
    TOKEN_KEYS.forEach((chave) => {
      try {
        sessionStorage.removeItem(chave);
      } catch (_) {}
    });
  }

  async function api(endpoint, options = {}) {
    const {
      method = "GET",
      body = null,
      auth = false,
      timeout = 18000
    } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const headers = { Accept: "application/json" };

    if (body !== null) {
      headers["Content-Type"] = "application/json";
    }

    if (auth) {
      const token = pegarToken();

      if (!token) {
        throw new Error("Sua sessão não foi encontrada. Faça login novamente.");
      }

      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const resposta = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        signal: controller.signal,
        body: body !== null ? JSON.stringify(body) : undefined
      });

      const texto = await resposta.text();
      let dados = {};

      try {
        dados = texto ? JSON.parse(texto) : {};
      } catch (_) {
        dados = { mensagem: texto || "Resposta inválida do servidor." };
      }

      if (!resposta.ok || dados?.erro) {
        throw new Error(
          dados?.erro ||
          dados?.mensagem ||
          dados?.message ||
          `Erro ${resposta.status}.`
        );
      }

      return dados;
    } catch (erro) {
      if (erro.name === "AbortError") {
        throw new Error("O servidor demorou para responder. Tente novamente.");
      }

      if (erro instanceof TypeError) {
        throw new Error("Não foi possível conectar ao servidor.");
      }

      throw erro;
    } finally {
      clearTimeout(timer);
    }
  }

  function emailNormalizado(email) {
    return String(email || "").trim().toLowerCase();
  }

  function emailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function mascaraTelefone(valor) {
    const numero = String(valor || "").replace(/\D/g, "").slice(0, 11);

    if (numero.length <= 10) {
      return numero
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }

    return numero
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }

  function normalizarCargo(usuario) {
    return String(
      usuario?.cargo ||
      usuario?.tipo ||
      usuario?.role ||
      usuario?.perfil ||
      ""
    )
      .trim()
      .toLowerCase()
      .replaceAll("_", "-")
      .replace(/\s+/g, "-");
  }

  function ehAcessoEspecial(usuario) {
    const cargo = normalizarCargo(usuario);
    const acessos = usuario?.acessosRapidos || {};

    return (
      [
        "admin",
        "superadmin",
        "super-admin",
        "moderador",
        "suporte",
        "vendedor"
      ].includes(cargo) ||
      usuario?.vendedor === true ||
      acessos.painelAdmin === true ||
      acessos.painelVendas === true
    );
  }

  function possuiPlanoAtivo(usuario) {
    if (!usuario) return false;

    const cargo = normalizarCargo(usuario);

    if (
      [
        "admin",
        "superadmin",
        "super-admin",
        "moderador",
        "suporte",
        "vendedor"
      ].includes(cargo)
    ) {
      return true;
    }

    if (
      usuario.suspenso ||
      ["suspenso", "bloqueado"].includes(usuario.status) ||
      usuario.aprovado === false
    ) {
      return false;
    }

    const plano = String(usuario.plano || "free").trim().toLowerCase();

    if (
      ![
        "premium",
        "black",
        "black30",
        "black90",
        "black180",
        "black360",
        "admin"
      ].includes(plano)
    ) {
      return false;
    }

    if (!usuario.dataExpiracao) return true;

    const expiracao = new Date(usuario.dataExpiracao);
    expiracao.setHours(23, 59, 59, 999);

    return Date.now() <= expiracao.getTime();
  }

  function primeiroNome(usuario) {
    return String(usuario?.nome || "Dev").trim().split(/\s+/)[0] || "Dev";
  }

  function configurarCards(usuario) {
    const cargo = normalizarCargo(usuario);
    const acessos = usuario?.acessosRapidos || {};
    const vendedor = usuario?.vendedor === true || cargo === "vendedor";

    const dashboard = document.querySelector('[data-go="dashboard.html"]');
    const admin = document.querySelector('[data-go="admin.html"]');
    const vendas = document.querySelector('[data-go="painel-vendas.html"]');

    if (dashboard) dashboard.hidden = false;

    if (admin) {
      admin.hidden = !(
        acessos.painelAdmin === true ||
        ["superadmin", "super-admin", "admin", "moderador"].includes(cargo)
      );
    }

    if (vendas) {
      vendas.hidden = !(
        acessos.painelVendas === true ||
        vendedor ||
        ["superadmin", "super-admin", "admin", "suporte"].includes(cargo)
      );
    }
  }

  function abrirEscolha(usuario) {
    const overlay = $("adminChoiceOverlay");
    const titulo = $("adminChoiceTitle");
    const descricao = document.querySelector(".admin-choice-top > p");

    if (!overlay) return;

    configurarCards(usuario);

    if (titulo) {
      titulo.innerHTML = `Bem-vindo, <span>${escapeHTML(primeiroNome(usuario))}!</span> 👑`;
    }

    if (descricao) {
      descricao.textContent = "Selecione o painel que deseja acessar agora.";
    }

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("admin-choice-open");

    requestAnimationFrame(() => {
      overlay.classList.add("active", "open");
    });
  }

  function fecharEscolha() {
    const overlay = $("adminChoiceOverlay");
    if (!overlay) return;

    overlay.classList.remove("active", "open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("admin-choice-open");

    setTimeout(() => {
      if (!overlay.classList.contains("active")) {
        overlay.hidden = true;
      }
    }, 180);
  }

  function escapeHTML(valor) {
    return String(valor || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function redirecionar(usuario) {
    if (!usuario) {
      limparSessao();
      ocultarLoading();
      mostrarMensagem("Não foi possível validar sua conta.");
      return;
    }

    if (ehAcessoEspecial(usuario)) {
      ocultarLoading();
      abrirEscolha(usuario);
      return;
    }

    window.location.assign(
      possuiPlanoAtivo(usuario) ? "dashboard.html" : "dashboard-free.html"
    );
  }

  function mostrarMensagem(texto, tipo = "erro") {
    const box = $("mensagem");
    if (!box) return;

    box.textContent = String(texto || "");
    box.className = `auth-message ${tipo} active`;

    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.classList.remove("active"), 5200);
  }

  function mostrarLoading(texto = "Preparando seu acesso…") {
    const overlay = $("authLoadingOverlay");
    if (!overlay) return;

    const label = $("authLoadingTexto");
    if (label) label.textContent = texto;

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      overlay.classList.add("ativo", "active", "open");
    });
  }

  function ocultarLoading() {
    const overlay = $("authLoadingOverlay");
    if (!overlay) return;

    overlay.classList.remove("ativo", "active", "open");
    overlay.setAttribute("aria-hidden", "true");

    setTimeout(() => {
      if (!overlay.classList.contains("active")) {
        overlay.hidden = true;
      }
    }, 180);
  }

  function botaoCarregando(botao, ativo) {
    if (!botao) return;

    if (ativo) {
      botao.dataset.original = botao.innerHTML;
      botao.disabled = true;
      botao.classList.add("carregando");
      botao.innerHTML = "<span>Aguarde…</span><span>◌</span>";
      return;
    }

    botao.disabled = false;
    botao.classList.remove("carregando");

    if (botao.dataset.original) {
      botao.innerHTML = botao.dataset.original;
    }
  }

  function ativarLogin() {
    $("tabLogin")?.classList.add("active");
    $("tabCadastro")?.classList.remove("active");
    $("tabLogin")?.setAttribute("aria-selected", "true");
    $("tabCadastro")?.setAttribute("aria-selected", "false");

    if ($("formLogin")) {
      $("formLogin").hidden = false;
      $("formLogin").classList.add("active");
    }

    if ($("formCadastro")) {
      $("formCadastro").hidden = true;
      $("formCadastro").classList.remove("active");
    }

    if ($("authTitulo")) $("authTitulo").textContent = "Bem-vindo(a) de volta!";
    if ($("authDescricao")) {
      $("authDescricao").textContent = "Acesse sua conta e continue sua jornada.";
    }
  }

  function ativarCadastro() {
    $("tabCadastro")?.classList.add("active");
    $("tabLogin")?.classList.remove("active");
    $("tabCadastro")?.setAttribute("aria-selected", "true");
    $("tabLogin")?.setAttribute("aria-selected", "false");

    if ($("formCadastro")) {
      $("formCadastro").hidden = false;
      $("formCadastro").classList.add("active");
    }

    if ($("formLogin")) {
      $("formLogin").hidden = true;
      $("formLogin").classList.remove("active");
    }

    if ($("authTitulo")) $("authTitulo").textContent = "Crie sua conta grátis";
    if ($("authDescricao")) {
      $("authDescricao").textContent = "Comece agora no dashboard gratuito da Turma do Primo.";
    }
  }

  function forcaSenha(senha) {
    let pontos = 0;

    if (senha.length >= 6) pontos++;
    if (senha.length >= 10) pontos++;
    if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
    if (/\d/.test(senha)) pontos++;
    if (/[^A-Za-z0-9]/.test(senha)) pontos++;

    if (pontos <= 1) return ["fraca", "Fraca"];
    if (pontos <= 3) return ["media", "Média"];
    return ["forte", "Forte"];
  }

  function atualizarForca() {
    const input = $("cadastroSenha");
    const indicador = $("senhaForcaIndicador");
    const texto = $("senhaForcaTexto");

    if (!input || !indicador || !texto) return;

    indicador.classList.remove("fraca", "media", "forte", "visivel");

    if (!input.value) {
      texto.textContent = "Digite uma senha";
      return;
    }

    const [nivel, label] = forcaSenha(input.value);
    indicador.classList.add("visivel", nivel);
    texto.textContent = label;
  }

  async function realizarLogin(evento) {
    evento.preventDefault();

    const email = emailNormalizado($("loginEmail")?.value);
    const senha = $("loginSenha")?.value || "";
    const botao = evento.currentTarget.querySelector(".auth-submit");

    if (!emailValido(email)) {
      mostrarMensagem("Digite um e-mail válido.");
      $("loginEmail")?.focus();
      return;
    }

    if (senha.length < 4) {
      mostrarMensagem("A senha precisa ter pelo menos 4 caracteres.");
      $("loginSenha")?.focus();
      return;
    }

    botaoCarregando(botao, true);
    mostrarLoading("Verificando suas credenciais…");

    try {
      const resposta = await api("/login", {
        method: "POST",
        body: { email, senha }
      });

      if (!resposta?.token) {
        throw new Error("O servidor não retornou um token de acesso.");
      }

      salvarToken(resposta.token);

      if ($("authLoadingTexto")) {
        $("authLoadingTexto").textContent = "Validando suas permissões…";
      }

      const me = await api("/me", { auth: true });

      if (!me?.usuario) {
        throw new Error("Não foi possível validar sua conta.");
      }

      if ($("authLoadingTexto")) {
        $("authLoadingTexto").textContent = "Tudo pronto. Entrando…";
      }

      setTimeout(() => redirecionar(me.usuario), 350);
    } catch (erro) {
      limparSessao();
      ocultarLoading();
      mostrarMensagem(erro.message || "Não foi possível fazer login.");
    } finally {
      botaoCarregando(botao, false);
    }
  }

  async function criarConta(evento) {
    evento.preventDefault();

    const nome = String($("cadastroNome")?.value || "").trim();
    const email = emailNormalizado($("cadastroEmail")?.value);
    const telefone = String($("cadastroTelefone")?.value || "").trim();
    const senha = $("cadastroSenha")?.value || "";
    const botao = evento.currentTarget.querySelector(".auth-submit");

    if (nome.length < 3) {
      mostrarMensagem("Digite seu nome completo.");
      $("cadastroNome")?.focus();
      return;
    }

    if (!emailValido(email)) {
      mostrarMensagem("Digite um e-mail válido.");
      $("cadastroEmail")?.focus();
      return;
    }

    if (telefone.replace(/\D/g, "") && telefone.replace(/\D/g, "").length < 10) {
      mostrarMensagem("Digite o WhatsApp corretamente.");
      $("cadastroTelefone")?.focus();
      return;
    }

    if (senha.length < 6) {
      mostrarMensagem("A senha precisa ter pelo menos 6 caracteres.");
      $("cadastroSenha")?.focus();
      return;
    }

    botaoCarregando(botao, true);
    mostrarLoading("Criando sua conta gratuita…");

    try {
      const resposta = await api("/criar", {
        method: "POST",
        body: { nome, email, telefone, senha }
      });

      if (!resposta?.sucesso) {
        throw new Error(resposta?.mensagem || "Não foi possível criar a conta.");
      }

      ocultarLoading();
      evento.currentTarget.reset();
      atualizarForca();
      ativarLogin();

      if ($("loginEmail")) $("loginEmail").value = email;

      mostrarMensagem(
        "Conta criada com sucesso. Agora faça seu login.",
        "sucesso"
      );

      setTimeout(() => $("loginSenha")?.focus(), 120);
    } catch (erro) {
      ocultarLoading();
      mostrarMensagem(erro.message || "Não foi possível criar a conta.");
    } finally {
      botaoCarregando(botao, false);
    }
  }

  function alternarSenha(botao) {
    const input = $(botao.dataset.target);
    if (!input) return;

    const mostrar = input.type === "password";
    input.type = mostrar ? "text" : "password";
    botao.setAttribute("aria-pressed", String(mostrar));
    botao.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
    botao.textContent = mostrar ? "◌" : "◉";
  }

  function abrirDestino(botao) {
    if (botao.hidden || botao.disabled) return;

    if (!pegarToken()) {
      fecharEscolha();
      mostrarMensagem("Sua sessão expirou. Faça login novamente.");
      return;
    }

    window.location.assign(botao.dataset.go);
  }

  function registrarEventos() {
    $("tabLogin")?.addEventListener("click", ativarLogin);
    $("tabCadastro")?.addEventListener("click", ativarCadastro);
    $("formLogin")?.addEventListener("submit", realizarLogin);
    $("formCadastro")?.addEventListener("submit", criarConta);
    $("cadastroSenha")?.addEventListener("input", atualizarForca);

    $("cadastroTelefone")?.addEventListener("input", (evento) => {
      evento.target.value = mascaraTelefone(evento.target.value);
    });

    $$(".toggle-password").forEach((botao) => {
      botao.addEventListener("click", () => alternarSenha(botao));
    });

    $$('[data-go]').forEach((botao) => {
      botao.addEventListener("click", () => abrirDestino(botao));
    });

    $("fecharAdminChoice")?.addEventListener("click", fecharEscolha);

    $("adminChoiceOverlay")?.addEventListener("click", (evento) => {
      if (evento.target === evento.currentTarget) fecharEscolha();
    });

    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") fecharEscolha();
    });
  }
})();
