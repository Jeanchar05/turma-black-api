let usuario = JSON.parse(localStorage.getItem("usuarioLogado"));

if (!usuario) {
  window.location.href = "index.html";
}

let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
let usuarioAtualizado = usuarios.find(u => u.email === usuario.email);

if (usuarioAtualizado) {
  usuario = usuarioAtualizado;
  localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
}

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

function carregarAvatar() {
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

function detectarDispositivo() {
  const ua = navigator.userAgent;

  if (/Mobi|Android/i.test(ua)) return "Celular";
  if (/Tablet|iPad/i.test(ua)) return "Tablet";
  return "Computador";
}

function getHistorico() {
  return usuario.historicoAcessos || [];
}

function salvarUsuarioAtualizado() {
  const index = usuarios.findIndex(u => u.email === usuario.email);

  if (index !== -1) {
    usuarios[index] = usuario;
    localStorage.setItem("usuarios", JSON.stringify(usuarios));
  }

  localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
}

function carregarHistorico() {
  const historico = getHistorico();
  const lista = document.getElementById("listaHistorico");

  document.getElementById("totalAcessosHistorico").innerText = usuario.acessos || 0;
  document.getElementById("histTotal").innerText = usuario.acessos || 0;

  document.getElementById("histUltimo").innerText = usuario.ultimoLogin
    ? new Date(usuario.ultimoLogin).toLocaleString("pt-BR")
    : "--";

  if (!historico.length) {
    lista.innerHTML = `
      <div class="historico-vazio">
        Nenhum acesso registrado ainda.
      </div>
    `;
    return;
  }

  lista.innerHTML = "";

  historico
    .slice()
    .reverse()
    .forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "historico-item";

      div.innerHTML = `
        <div>
          <strong>${new Date(item.data).toLocaleString("pt-BR")}</strong>
          <small>${item.dispositivo || "Dispositivo não identificado"}</small>
        </div>

        <span>${item.status || "Login realizado"}</span>
      `;

      lista.appendChild(div);
    });
}

function limparHistoricoAcessos() {
  if (!confirm("Deseja limpar seu histórico de acessos?")) return;

  usuario.historicoAcessos = [];
  salvarUsuarioAtualizado();

  carregarHistorico();
}

function registrarAcessoSeNaoExistir() {
  const historico = usuario.historicoAcessos || [];
  const agora = new Date();

  const ultimo = historico[historico.length - 1];

  if (ultimo) {
    const diff = agora - new Date(ultimo.data);

    if (diff < 60 * 1000) {
      return;
    }
  }

  historico.push({
    data: agora.toISOString(),
    dispositivo: detectarDispositivo(),
    status: "Login realizado"
  });

  usuario.historicoAcessos = historico;
  salvarUsuarioAtualizado();
}

registrarAcessoSeNaoExistir();
carregarAvatar();
carregarHistorico();
marcarMenuAtivo();