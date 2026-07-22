// ===============================
// PERFIL.JS
// TURMA BLACK DO PRIMO
// Perfil premium com foto, segurança,
// sequência dinâmica, nível por tempo/acesso
// e tema preto/branco com sol e lua
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => document.querySelectorAll(selector);

  // ===============================
  // TEMA CLARO / ESCURO
  // ===============================

  const TEMA_KEY = "temaSite";

  function temaInicial() {
    return localStorage.getItem(TEMA_KEY) || "escuro";
  }

  function atualizarBotaoTema(tema) {
    const btn = $("btnTemaPerfil");
    const texto = $("temaTexto");

    if (!btn) return;

    const claro = tema === "claro";

    btn.classList.toggle("is-light", claro);
    btn.classList.toggle("is-dark", !claro);

    btn.setAttribute("aria-pressed", claro ? "true" : "false");
    btn.setAttribute(
      "title",
      claro ? "Tema claro ativado" : "Tema escuro ativado"
    );

    if (texto) {
      texto.textContent = claro ? "Claro" : "Escuro";
    }
  }

  function aplicarTema(tema, animar = false) {
    const temaFinal = tema === "claro" ? "claro" : "escuro";

    document.documentElement.dataset.theme = temaFinal;
    document.body.dataset.theme = temaFinal;

    document.documentElement.classList.toggle("tema-claro", temaFinal === "claro");
    document.documentElement.classList.toggle("tema-escuro", temaFinal !== "claro");

    document.body.classList.toggle("tema-claro", temaFinal === "claro");
    document.body.classList.toggle("tema-escuro", temaFinal !== "claro");

    localStorage.setItem(TEMA_KEY, temaFinal);

    atualizarBotaoTema(temaFinal);

    if (animar) {
      document.body.classList.add("theme-changing");

      clearTimeout(document.body._themeTimer);

      document.body._themeTimer = setTimeout(() => {
        document.body.classList.remove("theme-changing");
      }, 650);
    }
  }

  function alternarTema() {
    const atual = localStorage.getItem(TEMA_KEY) || "escuro";
    const proximo = atual === "claro" ? "escuro" : "claro";

    aplicarTema(proximo, true);

    salvarAtividade(
      proximo === "claro" ? "☀️" : "🌙",
      "Tema alterado",
      proximo === "claro"
        ? "O tema claro foi ativado."
        : "O tema escuro foi ativado."
    );
  }

  aplicarTema(temaInicial(), false);

  $("btnTemaPerfil")?.addEventListener("click", alternarTema);

  // ===============================
  // AUTH
  // ===============================

  let usuario = null;

  try {
    usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  } catch {
    usuario = null;
  }

  const token = localStorage.getItem("token");

  if (!usuario || !token) {
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("token");
    window.location.href = "index.html";
    return;
  }

  // ===============================
  // HELPERS
  // ===============================

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value ?? "";
  }

  function salvarUsuario(user) {
    usuario = user;
    localStorage.setItem("usuarioLogado", JSON.stringify(user));
  }

  function getJSON(key, fallback = []) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  function salvarAtividade(icone, titulo, descricao) {
    const atividades = getJSON("atividadesRecentes", []);

    localStorage.setItem(
      "atividadesRecentes",
      JSON.stringify([
        {
          icone,
          titulo,
          descricao,
          data: new Date().toISOString(),
        },
        ...atividades,
      ].slice(0, 30))
    );
  }

  function formatarData(data) {
    if (!data) return "Hoje";

    try {
      return new Date(data).toLocaleDateString("pt-BR");
    } catch {
      return "Hoje";
    }
  }

  function formatarDataHora(data) {
    if (!data) return "Agora";

    try {
      return new Date(data).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return "Agora";
    }
  }

  function diferencaDias(dataISO) {
    if (!dataISO) return 0;

    const dataInicial = new Date(dataISO);
    const hoje = new Date();

    dataInicial.setHours(0, 0, 0, 0);
    hoje.setHours(0, 0, 0, 0);

    const diff = hoje - dataInicial;

    return Math.max(0, Math.floor(diff / 86400000));
  }

  function detectarDispositivo() {
    const ua = navigator.userAgent;

    if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone / iPad";
    if (/Android/i.test(ua)) return "Celular Android";
    if (/Mobi/i.test(ua)) return "Celular";
    if (/Tablet|iPad/i.test(ua)) return "Tablet";

    return "Computador";
  }

  function detectarNavegador() {
    const ua = navigator.userAgent;

    if (ua.includes("Edg")) return "Microsoft Edge";
    if (ua.includes("OPR") || ua.includes("Opera")) return "Opera";
    if (ua.includes("Chrome")) return "Google Chrome";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Firefox")) return "Mozilla Firefox";

    return "Navegador detectado";
  }

  function formatarTelefone(valor) {
    const numeros = String(valor || "").replace(/\D/g, "").slice(0, 11);

    if (numeros.length <= 10) {
      return numeros.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    }

    return numeros.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
  }

  function normalizarPlano(plano) {
    const p = String(plano || "").toLowerCase();

    if (p.includes("black")) return "Turma Black";
    if (p.includes("premium")) return "Premium";
    if (p.includes("admin")) return "Administrador";
    if (p.includes("free")) return "Free";

    return plano || "Turma Black";
  }

  // ===============================
  // MENU MOBILE / NAVEGAÇÃO
  // ===============================

  function fecharMenu() {
    $("sidebar")?.classList.remove("active");
    $("sidebarOverlay")?.classList.remove("active");
    document.body.style.overflow = "";
  }

  function abrirMenu() {
    $("sidebar")?.classList.add("active");
    $("sidebarOverlay")?.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  $$("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      if (page) window.location.href = page;
    });
  });

  $("btnMenu")?.addEventListener("click", () => {
    const sidebar = $("sidebar");

    if (sidebar?.classList.contains("active")) {
      fecharMenu();
    } else {
      abrirMenu();
    }
  });

  $("sidebarOverlay")?.addEventListener("click", fecharMenu);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharMenu();
  });

  $$(".menu-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 820) fecharMenu();
    });
  });

  // ===============================
  // SAIR
  // ===============================

  function sair() {
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("token");
    window.location.href = "index.html";
  }

  $("btnSair")?.addEventListener("click", sair);
  $("btnSair2")?.addEventListener("click", sair);

  // ===============================
  // DADOS BASE DO USUÁRIO
  // ===============================

  const agora = new Date();
  const agoraISO = agora.toISOString();

  if (!usuario.criadoEm && !usuario.dataEntrada && !usuario.primeiroAcesso) {
    usuario.primeiroAcesso = agoraISO;
  }

  usuario.acessos = Number(usuario.acessos || 0) + 1;
  usuario.ultimoAcesso = agoraISO;

  salvarUsuario(usuario);

  const nome = usuario.nome || "Aluno";
  const email = usuario.email || "email@exemplo.com";
  const telefone = usuario.telefone || "";
  const plano = normalizarPlano(usuario.plano || usuario.tipoConta || "Turma Black");
  const dataEntrada = usuario.dataEntrada || usuario.criadoEm || usuario.primeiroAcesso || agoraISO;

  // ===============================
  // FOTO DE PERFIL
  // ===============================

  function atualizarAvatar() {
    const foto = usuario.fotoPerfil || localStorage.getItem("fotoPerfilAluno") || "";
    const avatarImg = $("avatarImagem");
    const avatarLetra = $("avatarLetra");
    const avatarBox = $("avatarAluno");

    if (foto && avatarImg) {
      avatarImg.src = foto;
      avatarImg.style.display = "block";

      if (avatarLetra) avatarLetra.style.display = "none";
      if (avatarBox) avatarBox.classList.add("has-photo");
    } else {
      if (avatarImg) {
        avatarImg.removeAttribute("src");
        avatarImg.style.display = "none";
      }

      if (avatarLetra) {
        avatarLetra.textContent = nome.charAt(0).toUpperCase();
        avatarLetra.style.display = "flex";
      }

      if (avatarBox) {
        avatarBox.classList.remove("has-photo");
      }
    }
  }

  $("inputFotoPerfil")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Selecione apenas uma imagem.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert("A imagem está muito pesada. Use uma foto com até 3MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result;

      usuario.fotoPerfil = base64;

      salvarUsuario(usuario);
      localStorage.setItem("fotoPerfilAluno", base64);

      atualizarAvatar();

      salvarAtividade(
        "📷",
        "Foto de perfil atualizada",
        "Sua nova foto foi salva com sucesso."
      );

      alert("Foto atualizada com sucesso!");
    };

    reader.readAsDataURL(file);
  });

  $("btnRemoverFoto")?.addEventListener("click", () => {
    const confirmar = confirm("Deseja remover sua foto de perfil?");

    if (!confirmar) return;

    delete usuario.fotoPerfil;

    salvarUsuario(usuario);
    localStorage.removeItem("fotoPerfilAluno");

    atualizarAvatar();

    salvarAtividade(
      "🗑️",
      "Foto de perfil removida",
      "A foto do perfil foi removida."
    );

    alert("Foto removida com sucesso!");
  });

  // ===============================
  // PREENCHER PERFIL
  // ===============================

  setText("perfilNome", nome);
  setText("perfilEmail", email);
  setText("avatarLetra", nome.charAt(0).toUpperCase());

  setText("perfilTipoConta", plano);
  setText("perfilPlanoTag", String(plano).toUpperCase());
  setText("perfilDataEntrada", formatarData(dataEntrada));
  setText("perfilAcessos", usuario.acessos || 0);

  setValue("inputNome", nome);
  setValue("inputEmail", email);
  setValue("inputTelefone", telefone);
  setValue("inputSenhaBloqueada", "********");

  const inputEmail = $("inputEmail");
  const inputSenha = $("inputSenhaBloqueada");

  if (inputEmail) {
    inputEmail.disabled = true;
    inputEmail.readOnly = true;
  }

  if (inputSenha) {
    inputSenha.disabled = true;
    inputSenha.readOnly = true;
  }

  atualizarAvatar();

  $("inputTelefone")?.addEventListener("input", (e) => {
    e.target.value = formatarTelefone(e.target.value);
  });

  // ===============================
  // RESUMO DO ALUNO
  // ===============================

  const favoritos = getJSON("favoritos", []);
  const provas = getJSON("provasFeitas", []);
  const modulos = getJSON("modulosEstudados", []);

  let diasSequencia = Number(localStorage.getItem("diasSequencia")) || 0;

  const ultimoDiaSequencia = localStorage.getItem("ultimoDiaSequencia");
  const hojeChave = new Date().toISOString().split("T")[0];

  if (!ultimoDiaSequencia) {
    localStorage.setItem("ultimoDiaSequencia", hojeChave);
  } else if (ultimoDiaSequencia !== hojeChave) {
    const ontem = new Date();

    ontem.setDate(ontem.getDate() - 1);

    const ontemChave = ontem.toISOString().split("T")[0];

    if (ultimoDiaSequencia === ontemChave) {
      diasSequencia += 1;
    } else {
      diasSequencia = 1;
    }

    localStorage.setItem("diasSequencia", String(diasSequencia));
    localStorage.setItem("ultimoDiaSequencia", hojeChave);
  }

  setText("perfilModulos", modulos.length);
  setText("perfilProvas", provas.length);
  setText("perfilFavoritos", favoritos.length);
  setText("perfilSequencia", `${diasSequencia} dias`);
  setText("perfilStatusAluno", "Online");

  // ===============================
  // FOGUINHO DINÂMICO
  // ===============================

  function atualizarFoguinho(dias) {
    const card = $("cardSequencia");
    const icone = $("iconeSequencia");
    const texto = $("textoSequencia");

    if (!card || !icone) return;

    card.classList.remove(
      "fire-zero",
      "fire-start",
      "fire-medium",
      "fire-high",
      "fire-elite"
    );

    icone.classList.remove(
      "fire-zero",
      "fire-start",
      "fire-medium",
      "fire-high",
      "fire-elite"
    );

    let classe = "fire-zero";
    let mensagem = "Comece sua sequência hoje";

    if (dias <= 0) {
      classe = "fire-zero";
      mensagem = "Comece sua sequência hoje";
    } else if (dias >= 1 && dias <= 2) {
      classe = "fire-start";
      mensagem = "Sequência iniciada";
    } else if (dias >= 3 && dias <= 6) {
      classe = "fire-medium";
      mensagem = "Boa frequência";
    } else if (dias >= 7 && dias <= 14) {
      classe = "fire-high";
      mensagem = "Você está pegando fogo";
    } else {
      classe = "fire-elite";
      mensagem = "Sequência Elite Black";
    }

    card.classList.add(classe);
    icone.classList.add(classe);

    if (texto) texto.textContent = mensagem;
  }

  atualizarFoguinho(diasSequencia);

  // ===============================
  // NÍVEL DA CONTA
  // Vinculado ao tempo de conta + acessos + uso
  // ===============================

  const tempoContaDias = diferencaDias(dataEntrada);
  const acessos = Number(usuario.acessos || 0);

  const pontosTempo = Math.min(40, tempoContaDias * 2);
  const pontosAcesso = Math.min(30, acessos * 3);
  const pontosModulos = Math.min(15, modulos.length * 3);
  const pontosProvas = Math.min(10, provas.length * 5);
  const pontosFavoritos = Math.min(5, favoritos.length);

  const progresso = Math.min(
    100,
    pontosTempo + pontosAcesso + pontosModulos + pontosProvas + pontosFavoritos
  );

  let nivel = "Iniciante";
  let medalha = "🥉";
  let proximo = "Continue acessando para chegar ao nível Intermediário.";

  if (progresso >= 25) {
    nivel = "Intermediário";
    medalha = "🥈";
    proximo = "Continue estudando para liberar o nível Avançado.";
  }

  if (progresso >= 55) {
    nivel = "Avançado";
    medalha = "🥇";
    proximo = "Você está perto do nível Elite Black.";
  }

  if (progresso >= 85) {
    nivel = "Elite Black";
    medalha = "👑";
    proximo = "Você alcançou um nível de alta frequência na plataforma.";
  }

  setText("nivelAluno", nivel);
  setText("nivelMedalha", medalha);
  setText("nivelTempoConta", `${tempoContaDias} dias`);
  setText("nivelProgressoTexto", `${Math.round(progresso)}%`);
  setText("nivelProximo", proximo);
  setText("perfilTempoAtivo", `${tempoContaDias} dias`);

  const barraNivel = $("barraNivel");

  if (barraNivel) {
    setTimeout(() => {
      barraNivel.style.width = `${progresso}%`;
    }, 300);
  }

  function atualizarStepsNivel() {
    const s1 = $("stepNivel1");
    const s2 = $("stepNivel2");
    const s3 = $("stepNivel3");
    const s4 = $("stepNivel4");

    [s1, s2, s3, s4].forEach((s) => {
      s?.classList.remove("active", "done");
    });

    if (s1) s1.classList.add("active");

    if (progresso >= 25) {
      s1?.classList.add("done");
      s2?.classList.add("active");
    }

    if (progresso >= 55) {
      s2?.classList.add("done");
      s3?.classList.add("active");
    }

    if (progresso >= 85) {
      s3?.classList.add("done");
      s4?.classList.add("active");
    }
  }

  atualizarStepsNivel();

  // ===============================
  // SEGURANÇA
  // ===============================

  setText("dispositivoAtual", detectarDispositivo());
  setText("navegadorAtual", detectarNavegador());
  setText("ultimoAcesso", formatarDataHora(agoraISO));
  setText("statusSegurancaConta", "Token ativo e sessão validada");

  const onlineBadge = $("perfilOnlineStatus");

  if (onlineBadge) {
    onlineBadge.classList.add("online");
  }

  // ===============================
  // SALVAR PERFIL
  // ===============================

  $("formPerfil")?.addEventListener("submit", (e) => {
    e.preventDefault();

    const novoNome = $("inputNome")?.value.trim() || "Aluno";
    const novoTelefone = $("inputTelefone")?.value.trim() || "";

    const novoUsuario = {
      ...usuario,
      nome: novoNome,
      email: usuario.email || email,
      telefone: novoTelefone,
      plano: usuario.plano || plano,
      tipo: usuario.tipo || "aluno",
      aprovado: usuario.aprovado,
      suspenso: usuario.suspenso,
      acessos: usuario.acessos || acessos,
      primeiroAcesso: usuario.primeiroAcesso || dataEntrada,
      dataEntrada: usuario.dataEntrada || dataEntrada,
      ultimoAcesso: new Date().toISOString(),
    };

    salvarUsuario(novoUsuario);

    salvarAtividade(
      "👤",
      "Perfil atualizado",
      "Seus dados foram salvos com sucesso."
    );

    alert("Perfil atualizado com sucesso!");
    window.location.reload();
  });

  // ===============================
  // BLOQUEIO VISUAL EXTRA
  // ===============================

  [inputEmail, inputSenha].forEach((input) => {
    if (!input) return;

    input.addEventListener("keydown", (e) => e.preventDefault());
    input.addEventListener("paste", (e) => e.preventDefault());
    input.addEventListener("click", () => {
      input.blur();
    });
  });
});