const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));

if (!usuario) {
  window.location.href = "index.html";
}

// ======================
// DADOS INICIAIS
// ======================

function carregarConfiguracoes() {
  const config = JSON.parse(localStorage.getItem("configUsuario")) || {};

  document.getElementById("cfgAnimacoes").checked = config.animacoes ?? true;
  document.getElementById("cfgTemaRoxo").checked = config.temaRoxo ?? true;
  document.getElementById("cfgSons").checked = config.sons ?? false;

  document.getElementById("cfgRenovacao").checked = config.renovacao ?? true;
  document.getElementById("cfgEstrategias").checked = config.estrategias ?? true;
  document.getElementById("cfgAtualizacoes").checked = config.atualizacoes ?? true;

  document.getElementById("cfgAcessos").innerText = usuario.acessos || 0;

  document.getElementById("cfgUltimoLogin").innerText =
    usuario.ultimoLogin
      ? new Date(usuario.ultimoLogin).toLocaleString("pt-BR")
      : "Nunca acessou";

  atualizarAvatar();
  salvarAuto();
}

// ======================
// SALVAR AUTOMÁTICO
// ======================

function salvarAuto() {
  const inputs = document.querySelectorAll("input[type='checkbox']");

  inputs.forEach(input => {
    input.addEventListener("change", () => {
      salvarConfiguracoes();
    });
  });
}

function salvarConfiguracoes() {
  const config = {
    animacoes: document.getElementById("cfgAnimacoes").checked,
    temaRoxo: document.getElementById("cfgTemaRoxo").checked,
    sons: document.getElementById("cfgSons").checked,
    renovacao: document.getElementById("cfgRenovacao").checked,
    estrategias: document.getElementById("cfgEstrategias").checked,
    atualizacoes: document.getElementById("cfgAtualizacoes").checked
  };

  localStorage.setItem("configUsuario", JSON.stringify(config));
}

// ======================
// AVATAR
// ======================

function atualizarAvatar() {
  const nome = usuario.nome || "Aluno";
  const foto = usuario.foto || "";

  const avatarTopo = document.getElementById("avatarTopo");

  if (foto) {
    avatarTopo.style.backgroundImage = `url(${foto})`;
    avatarTopo.innerText = "";
  } else {
    avatarTopo.innerText = nome.charAt(0).toUpperCase();
  }
}

// ======================
// ALTERAR SENHA
// ======================

function alterarSenha() {
  const nova = document.getElementById("novaSenhaConfig").value.trim();
  const confirmar = document.getElementById("confirmarSenhaConfig").value.trim();

  if (!nova || !confirmar) {
    alert("Preencha os campos.");
    return;
  }

  if (nova !== confirmar) {
    alert("As senhas não coincidem.");
    return;
  }

  let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];

  const index = usuarios.findIndex(u => u.email === usuario.email);

  if (index !== -1) {
    usuarios[index].senha = nova;
    localStorage.setItem("usuarios", JSON.stringify(usuarios));
  }

  usuario.senha = nova;
  localStorage.setItem("usuarioLogado", JSON.stringify(usuario));

  alert("Senha alterada com sucesso!");
}

// ======================
// LIMPAR DADOS
// ======================

function limparDadosUso() {
  if (!confirm("Deseja limpar seus dados de uso?")) return;

  usuario.acessos = 0;
  usuario.ultimoLogin = null;

  let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
  const index = usuarios.findIndex(u => u.email === usuario.email);

  if (index !== -1) {
    usuarios[index].acessos = 0;
    usuarios[index].ultimoLogin = null;
    localStorage.setItem("usuarios", JSON.stringify(usuarios));
  }

  localStorage.setItem("usuarioLogado", JSON.stringify(usuario));

  alert("Dados de uso resetados!");
  carregarConfiguracoes();
}

// ======================
// RESET TOTAL
// ======================

function resetarContaLocal() {
  if (!confirm("Isso irá apagar TODOS os dados locais. Continuar?")) return;

  localStorage.clear();
  window.location.href = "index.html";
}

// ======================
// NAVEGAÇÃO
// ======================

function irPara(pagina) {
  window.location.href = pagina;
}

function marcarMenuAtivo() {
  const paginaAtual = window.location.pathname.split("/").pop();

  document.querySelectorAll("[data-page]").forEach(botao => {
    botao.classList.remove("active");

    if (botao.dataset.page === paginaAtual) {
      botao.classList.add("active");
    }
  });
}

// ======================
// INICIAR
// ======================

carregarConfiguracoes();
marcarMenuAtivo();