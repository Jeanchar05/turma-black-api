// ===============================
// SCRIPT.JS - LOGIN / CADASTRO
// TURMA DO PRIMO
// Novo fluxo:
// Criar conta = FREE
// Premium/código = depois no dashboard-free
// ===============================

"use strict";

const API_URL = "https://turma-black-api-es3u.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];

  function limparLocalStorageAntigo() {
    const keysAntigas = [
      "token",
      "adminToken",
      "authToken",
      "accessToken",
      "jwt",
      "usuario",
      "usuarioLogado",
      "user",
      "currentUser",
      "perfil",
      "cargo",
      "plano"
    ];

    keysAntigas.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
    });
  }

  limparLocalStorageAntigo();

  function salvarTokenSessao(token) {
    TOKEN_KEYS.forEach((key) => {
      try {
        sessionStorage.removeItem(key);
      } catch (_) {}
    });

    if (token) {
      sessionStorage.setItem("token", token);
    }
  }

  function salvarUsuarioSessao(usuario) {
    try {
      if (usuario) {
        sessionStorage.setItem("usuarioLogado", JSON.stringify(usuario));
      } else {
        sessionStorage.removeItem("usuarioLogado");
      }
    } catch (_) {}
  }

  function pegarTokenSessao() {
    for (const key of TOKEN_KEYS) {
      try {
        const token = sessionStorage.getItem(key);
        if (token) return token;
      } catch (_) {}
    }

    return "";
  }

  function limparSessao() {
    TOKEN_KEYS.forEach((key) => {
      try {
        sessionStorage.removeItem(key);
      } catch (_) {}
    });

    salvarUsuarioSessao(null);

    limparLocalStorageAntigo();
  }

  function mostrarMensagem(texto, tipo = "erro") {
    const msg = $("mensagem");
    if (!msg) return;

    msg.textContent = texto;
    msg.className = `auth-message ${tipo} active`;

    clearTimeout(msg._timeout);

    msg._timeout = setTimeout(() => {
      msg.classList.remove("active");
    }, 4500);
  }

  function normalizarEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function marcarInvalido(input, invalido) {
    if (!input) return;
    input.classList.toggle("invalido", Boolean(invalido));
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
      .replace(/\s+/g, "-");
  }

  function planoAtivo(usuario) {
    if (!usuario) return false;

    const cargo = normalizarCargo(usuario);

    if (
      cargo === "admin" ||
      cargo === "superadmin" ||
      cargo === "super-admin" ||
      cargo === "moderador" ||
      cargo === "suporte" ||
      cargo === "vendedor"
    ) {
      return true;
    }

    if (
      usuario.suspenso ||
      usuario.status === "suspenso" ||
      usuario.status === "bloqueado" ||
      usuario.aprovado === false
    ) {
      return false;
    }

    const plano = String(usuario.plano || "").trim().toLowerCase();

    const planosPagos = [
      "premium",
      "black",
      "black30",
      "black90",
      "black180",
      "black360",
      "admin"
    ];

    if (!planosPagos.includes(plano)) {
      return false;
    }

    if (!usuario.dataExpiracao) {
      return true;
    }

    return new Date() <= new Date(`${usuario.dataExpiracao}T23:59:59`);
  }

  function usuarioTemPainelEspecial(usuario) {
    const cargo = normalizarCargo(usuario);

    return (
      cargo === "admin" ||
      cargo === "superadmin" ||
      cargo === "super-admin" ||
      cargo === "moderador" ||
      cargo === "suporte" ||
      cargo === "vendedor" ||
      usuario?.vendedor === true
    );
  }

  function configurarCardsPorCargo(usuario) {
    const cargo = normalizarCargo(usuario);
    const vendedor = usuario?.vendedor === true || cargo === "vendedor";
    const permissoes = usuario?.permissoes || {};
    const acessos = usuario?.acessosRapidos || {};

    document.querySelectorAll("[data-go]").forEach((card) => {
      card.hidden = false;
      card.disabled = false;
    });

    const cardAdmin = document.querySelector('[data-go="admin.html"]');
    const cardVendas = document.querySelector('[data-go="painel-vendas.html"]');
    const cardDashboard = document.querySelector('[data-go="dashboard.html"]');

    const superadmin = cargo === "superadmin" || cargo === "super-admin";
    const podeAdmin = superadmin || permissoes.painelAdmin === true || acessos.painelAdmin === true;
    const podeVendas = superadmin || vendedor || permissoes.painelVendas === true || acessos.painelVendas === true;
    const podeDashboard = permissoes.dashboard !== false && acessos.dashboard !== false;

    if (cardAdmin) cardAdmin.hidden = !podeAdmin;
    if (cardVendas) cardVendas.hidden = !podeVendas;
    if (cardDashboard) cardDashboard.hidden = !podeDashboard;
  }

  function abrirPainelEscolhaAdmin(usuario) {
    const overlay = $("adminChoiceOverlay");
    if (!overlay) return;

    configurarCardsPorCargo(usuario);

    overlay.classList.add("active", "open");

    document.querySelectorAll("[data-go]").forEach((btn) => {
      btn.onclick = () => {
        if (btn.hidden || btn.disabled) return;
        window.location.href = btn.dataset.go;
      };
    });

    $("fecharAdminChoice")?.addEventListener("click", () => {
      overlay.classList.remove("active", "open");
    });
  }

  function redirecionarUsuario(usuario) {
    if (!usuario) {
      limparSessao();
      window.location.href = "index.html";
      return;
    }

    if (usuarioTemPainelEspecial(usuario)) {
      ocultarLoadingAuth();

      setTimeout(() => {
        abrirPainelEscolhaAdmin(usuario);
      }, 250);

      return;
    }

    if (planoAtivo(usuario)) {
      window.location.href = "dashboard.html";
      return;
    }

    window.location.href = "dashboard-free.html";
  }

  async function chamarAPI(endpoint, metodo = "GET", dados = null, usarToken = false) {
    const config = {
      method: metodo,
      headers: {
        "Content-Type": "application/json"
      }
    };

    if (usarToken) {
      const token = pegarTokenSessao();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    if (dados !== null && dados !== undefined) {
      config.body = JSON.stringify(dados);
    }

    let resposta;
    let json = {};

    try {
      resposta = await fetch(`${API_URL}${endpoint}`, config);
      json = await resposta.json().catch(() => ({}));
    } catch (error) {
      throw new Error("Não foi possível conectar ao servidor. Verifique sua internet.");
    }

    if (!resposta.ok) {
      throw new Error(
        json.erro ||
        json.mensagem ||
        json.message ||
        `Erro na API (${resposta.status}).`
      );
    }

    if (json.erro) {
      throw new Error(json.erro);
    }

    return json;
  }

  async function buscarUsuarioOnline() {
    const token = pegarTokenSessao();

    if (!token) return null;

    try {
      const dados = await chamarAPI("/me", "GET", null, true);

      if (!dados.sucesso || !dados.usuario) {
        limparSessao();
        return null;
      }

      salvarUsuarioSessao(dados.usuario);
      return dados.usuario;
    } catch (error) {
      limparSessao();
      return null;
    }
  }

  async function validarSessaoInicial() {
    const token = pegarTokenSessao();

    if (!token) return;

    const usuario = await buscarUsuarioOnline();

    if (!usuario) return;

    redirecionarUsuario(usuario);
  }

  function aplicarMascaraTelefone(valor) {
    let numero = String(valor || "").replace(/\D/g, "").slice(0, 11);

    if (numero.length <= 10) {
      return numero
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }

    return numero
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }

  function ativarProtecaoIndex() {
    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      mostrarMensagem("Ação bloqueada por segurança.", "erro");
    });

    document.addEventListener("copy", (e) => {
      const tag = e.target.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      e.preventDefault();
      mostrarMensagem("Copiar está bloqueado nesta página.", "erro");
    });

    document.addEventListener("cut", (e) => {
      const tag = e.target.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      e.preventDefault();
      mostrarMensagem("Recortar está bloqueado nesta página.", "erro");
    });

    document.addEventListener("selectstart", (e) => {
      const tag = e.target.tagName?.toLowerCase();

      if (tag !== "input" && tag !== "textarea") {
        e.preventDefault();
      }
    });

    document.addEventListener("keydown", async (e) => {
      const key = String(e.key || "").toLowerCase();

      const bloqueado =
        e.key === "F12" ||
        e.key === "PrintScreen" ||
        (e.ctrlKey && ["u", "s", "p"].includes(key)) ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(key));

      if (!bloqueado) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.key === "PrintScreen") {
        try {
          await navigator.clipboard.writeText("");
        } catch (_) {}
      }

      mostrarMensagem("Comando bloqueado por segurança.", "erro");
      return false;
    });
  }

  ativarProtecaoIndex();

  const MENSAGENS_LOADING = [
    "Verificando suas credenciais…",
    "Consultando seu acesso online…",
    "Preparando seu painel…",
    "Carregando seus módulos…",
    "Tudo certo! Entrando…"
  ];

  function mostrarLoadingAuth(textoInicial) {
    const overlay = $("authLoadingOverlay");
    const texto = $("authLoadingTexto");

    if (!overlay) return;

    if (texto) {
      texto.textContent = textoInicial || MENSAGENS_LOADING[0];
    }

    overlay.classList.add("ativo", "active", "open");

    let i = 0;

    clearInterval(overlay._msgInterval);

    overlay._msgInterval = setInterval(() => {
      i = (i + 1) % MENSAGENS_LOADING.length;

      if (texto) {
        texto.textContent = MENSAGENS_LOADING[i];
      }
    }, 1100);
  }

  function ocultarLoadingAuth() {
    const overlay = $("authLoadingOverlay");

    if (!overlay) return;

    clearInterval(overlay._msgInterval);
    overlay.classList.remove("ativo", "active", "open");
  }

  function ativarLoadingBtn(btn) {
    if (!btn) return;

    btn.dataset.textoOriginal = btn.textContent;
    btn.classList.add("carregando");
    btn.disabled = true;
    btn.textContent = "Aguarde...";
  }

  function desativarLoadingBtn(btn) {
    if (!btn) return;

    btn.classList.remove("carregando");
    btn.disabled = false;

    if (btn.dataset.textoOriginal) {
      btn.textContent = btn.dataset.textoOriginal;
    }
  }

  function ativarLogin() {
    $("tabLogin")?.classList.add("active");
    $("tabCadastro")?.classList.remove("active");

    $("formLogin")?.classList.add("active");
    $("formCadastro")?.classList.remove("active");

    if ($("authTitulo")) {
      $("authTitulo").textContent = "Entrar na plataforma";
    }

    if ($("authDescricao")) {
      $("authDescricao").textContent = "Informe seus dados para acessar sua conta.";
    }
  }

  function ativarCadastro() {
    $("tabCadastro")?.classList.add("active");
    $("tabLogin")?.classList.remove("active");

    $("formCadastro")?.classList.add("active");
    $("formLogin")?.classList.remove("active");

    if ($("authTitulo")) {
      $("authTitulo").textContent = "Criar conta grátis";
    }

    if ($("authDescricao")) {
      $("authDescricao").textContent = "Crie sua conta gratuita e acesse o dashboard free.";
    }
  }

  $("tabLogin")?.addEventListener("click", ativarLogin);
  $("tabCadastro")?.addEventListener("click", ativarCadastro);

  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = $(btn.dataset.target);

      if (!input) return;

      input.type = input.type === "password" ? "text" : "password";
      btn.textContent = input.type === "password" ? "👁" : "🙈";
    });
  });

  function calcularForcaSenha(senha) {
    let pontos = 0;

    if (senha.length >= 6) pontos++;
    if (senha.length >= 10) pontos++;
    if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) pontos++;
    if (/\d/.test(senha)) pontos++;
    if (/[^A-Za-z0-9]/.test(senha)) pontos++;

    if (pontos <= 2) return "fraca";
    if (pontos <= 3) return "media";
    return "forte";
  }

  const TEXTOS_FORCA = {
    fraca: "Senha fraca — tente adicionar números ou símbolos",
    media: "Senha razoável — pode melhorar com símbolos",
    forte: "Senha forte 👍"
  };

  const inputSenhaCadastro = $("cadastroSenha");
  const indicadorForca = $("senhaForcaIndicador");
  const barraForcaTexto = $("senhaForcaTexto");

  inputSenhaCadastro?.addEventListener("input", () => {
    const valor = inputSenhaCadastro.value;

    if (!indicadorForca) return;

    if (!valor) {
      indicadorForca.classList.remove("visivel", "fraca", "media", "forte");
      return;
    }

    const nivel = calcularForcaSenha(valor);

    indicadorForca.classList.add("visivel");
    indicadorForca.classList.remove("fraca", "media", "forte");
    indicadorForca.classList.add(nivel);

    if (barraForcaTexto) {
      barraForcaTexto.textContent = TEXTOS_FORCA[nivel];
    }
  });

  $("cadastroTelefone")?.addEventListener("input", (e) => {
    e.target.value = aplicarMascaraTelefone(e.target.value);
  });

  $("loginEmail")?.addEventListener("blur", () => {
    const valor = normalizarEmail($("loginEmail").value);
    marcarInvalido($("loginEmail"), valor && !validarEmail(valor));
  });

  $("cadastroEmail")?.addEventListener("blur", () => {
    const valor = normalizarEmail($("cadastroEmail").value);
    marcarInvalido($("cadastroEmail"), valor && !validarEmail(valor));
  });

  $("formLogin")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = normalizarEmail($("loginEmail")?.value);
    const senha = $("loginSenha")?.value || "";
    const btn = e.target.querySelector(".auth-submit");

    if (!validarEmail(email)) {
      marcarInvalido($("loginEmail"), true);
      mostrarMensagem("Digite um e-mail válido.", "erro");
      return;
    }

    if (senha.length < 4) {
      mostrarMensagem("A senha precisa ter pelo menos 4 caracteres.", "erro");
      return;
    }

    marcarInvalido($("loginEmail"), false);

    ativarLoadingBtn(btn);
    mostrarLoadingAuth("Verificando suas credenciais…");

    try {
      const login = await chamarAPI("/login", "POST", {
        email,
        senha
      });

      if (!login.sucesso || !login.token) {
        ocultarLoadingAuth();
        desativarLoadingBtn(btn);
        mostrarMensagem(login.erro || "Não foi possível fazer login.", "erro");
        return;
      }

      salvarTokenSessao(login.token);

      const textoFinal = $("authLoadingTexto");

      if (textoFinal) {
        textoFinal.textContent = "Validando seu acesso online…";
      }

      const dadosMe = await chamarAPI("/me", "GET", null, true);

      if (!dadosMe.sucesso || !dadosMe.usuario) {
        limparSessao();
        ocultarLoadingAuth();
        desativarLoadingBtn(btn);
        mostrarMensagem("Não foi possível validar seu acesso.", "erro");
        return;
      }

      salvarUsuarioSessao(dadosMe.usuario);

      if (textoFinal) {
        textoFinal.textContent = "Tudo certo! Entrando…";
      }

      setTimeout(() => {
        desativarLoadingBtn(btn);
        redirecionarUsuario(dadosMe.usuario);
      }, 650);
    } catch (error) {
      console.error(error);

      limparSessao();
      ocultarLoadingAuth();
      desativarLoadingBtn(btn);

      mostrarMensagem(error.message || "Não foi possível fazer login.", "erro");
    }
  });

  $("formCadastro")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = $("cadastroNome")?.value.trim();
    const email = normalizarEmail($("cadastroEmail")?.value);
    const telefone = $("cadastroTelefone")?.value.trim();
    const senha = $("cadastroSenha")?.value || "";
    const btn = e.target.querySelector(".auth-submit");

    if (!nome || nome.length < 3) {
      mostrarMensagem("Digite seu nome completo.", "erro");
      return;
    }

    if (!validarEmail(email)) {
      marcarInvalido($("cadastroEmail"), true);
      mostrarMensagem("Digite um e-mail válido.", "erro");
      return;
    }

    if (telefone && telefone.replace(/\D/g, "").length < 10) {
      mostrarMensagem("Digite seu número/WhatsApp corretamente.", "erro");
      return;
    }

    if (senha.length < 6) {
      mostrarMensagem("A senha precisa ter pelo menos 6 caracteres.", "erro");
      return;
    }

    marcarInvalido($("cadastroEmail"), false);

    ativarLoadingBtn(btn);
    mostrarLoadingAuth("Criando sua conta gratuita…");

    try {
      const dados = await chamarAPI("/criar", "POST", {
        nome,
        email,
        telefone,
        senha
      });

      ocultarLoadingAuth();
      desativarLoadingBtn(btn);

      if (!dados.sucesso) {
        mostrarMensagem(dados.erro || "Erro ao criar conta.", "erro");
        return;
      }

      mostrarMensagem("Conta criada com sucesso! Agora faça login para entrar.", "sucesso");

      $("formCadastro")?.reset();
      indicadorForca?.classList.remove("visivel", "fraca", "media", "forte");

      setTimeout(() => {
        ativarLogin();

        if ($("loginEmail")) {
          $("loginEmail").value = email;
        }

        if ($("loginSenha")) {
          $("loginSenha").focus();
        }
      }, 900);
    } catch (error) {
      console.error(error);

      ocultarLoadingAuth();
      desativarLoadingBtn(btn);

      mostrarMensagem(error.message || "Erro ao criar conta. Verifique o servidor.", "erro");
    }
  });

  $("adminChoiceOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "adminChoiceOverlay") {
      $("adminChoiceOverlay")?.classList.remove("active", "open");
    }
  });

  validarSessaoInicial();
});
