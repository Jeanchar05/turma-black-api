
(function () {
  "use strict";

  const CONFIG = {
    loginPage: "index.html",
    painelAdmin: "admin.html",
    maxTrocasAba: 3,
    maxBloqueios: 5,
    verificarIntervalo: 2000
  };

  const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));

  if (!usuario) return;

  const userId = usuario.email || usuario.nome || "usuario_padrao";
  const deviceKey = "device_" + userId;
  const statusKey = "status_" + userId;
  const logsKey = "security_logs";
  const deviceAtual = gerarDeviceId();

  iniciarDispositivoUnico();
  iniciarMonitoramento();
  iniciarIA();
  verificarStatusContinuamente();

  /* =========================
     GERAR ID DO DISPOSITIVO
  ========================= */
  function gerarDeviceId() {
    return btoa(
      navigator.userAgent +
      screen.width +
      screen.height +
      navigator.language
    );
  }

  /* =========================
     1 DISPOSITIVO POR CONTA
  ========================= */
  function iniciarDispositivoUnico() {
    const deviceSalvo = localStorage.getItem(deviceKey);

    if (!deviceSalvo) {
      localStorage.setItem(deviceKey, deviceAtual);
      salvarLog("LOGIN_DEVICE", "Primeiro dispositivo registrado.");
      return;
    }

    if (deviceSalvo !== deviceAtual) {
      salvarLog("DEVICE_DUPLICADO", "Login detectado em outro dispositivo.");
      expulsarUsuario("Esta conta já está vinculada a outro dispositivo.");
    }
  }

  /* =========================
     VERIFICAR STATUS
  ========================= */
  const usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];
const usuarioAtual = usuarios.find(u => u.email === usuario.email);

if (usuarioAtual) {
  if (usuarioAtual.statusSeguranca === "suspenso") {
    expulsarUsuario("Conta suspensa pelo admin.");
  }

  if (usuarioAtual.statusSeguranca === "expulso") {
    expulsarUsuario("Você foi expulso.");
  }
}

  /* =========================
     MONITORAMENTO
  ========================= */
  function iniciarMonitoramento() {
    let trocasAba = Number(sessionStorage.getItem("trocasAba")) || 0;
    let bloqueios = Number(sessionStorage.getItem("bloqueiosSeguranca")) || 0;

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        trocasAba++;
        sessionStorage.setItem("trocasAba", trocasAba);
        salvarLog("TROCA_ABA", `Usuário saiu da aba ${trocasAba} vez(es).`);

        if (trocasAba >= CONFIG.maxTrocasAba) {
          marcarSuspeito("Muitas trocas de aba detectadas.");
        }
      }
    });

    document.addEventListener("contextmenu", e => {
      e.preventDefault();
      bloqueios++;
      sessionStorage.setItem("bloqueiosSeguranca", bloqueios);
      salvarLog("CLIQUE_DIREITO", "Tentativa de clique direito.");
    });

    document.addEventListener("keydown", e => {
      const tecla = e.key.toLowerCase();

      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(tecla)) ||
        (e.ctrlKey && ["u", "s", "p"].includes(tecla))
      ) {
        e.preventDefault();
        bloqueios++;
        sessionStorage.setItem("bloqueiosSeguranca", bloqueios);
        salvarLog("ATALHO_BLOQUEADO", "Tentativa de atalho proibido.");

        if (bloqueios >= CONFIG.maxBloqueios) {
          marcarSuspeito("Muitas tentativas bloqueadas.");
        }
      }
    });
  }

  /* =========================
     IA COMPORTAMENTO SUSPEITO
  ========================= */
  function iniciarIA() {
    setInterval(() => {
      const trocas = Number(sessionStorage.getItem("trocasAba")) || 0;
      const bloqueios = Number(sessionStorage.getItem("bloqueiosSeguranca")) || 0;

      let risco = 0;

      risco += trocas * 20;
      risco += bloqueios * 25;

      if (risco >= 100) {
        salvarLog("IA_RISCO_ALTO", `Risco calculado: ${risco}%`);
        localStorage.setItem(statusKey, "suspenso");
        expulsarUsuario("IA detectou comportamento suspeito.");
      } else if (risco >= 60) {
        salvarLog("IA_RISCO_MEDIO", `Risco calculado: ${risco}%`);
        mostrarAlerta("⚠️ Comportamento suspeito detectado.");
      }
    }, 3000);
  }

  /* =========================
     MARCAR SUSPEITO
  ========================= */
  function marcarSuspeito(motivo) {
    salvarLog("SUSPEITO", motivo);
    mostrarAlerta("⚠️ Atividade suspeita detectada.");
  }

  /* =========================
     EXPULSAR USUÁRIO
  ========================= */
  function expulsarUsuario(motivo) {
    salvarLog("USUARIO_EXPULSO", motivo);

    localStorage.removeItem("usuarioLogado");
    sessionStorage.clear();

    document.body.innerHTML = `
      <div class="security-kick-screen">
        <div class="security-kick-box">
          <h1>🚫 Acesso encerrado</h1>
          <p>${motivo}</p>
          <button onclick="window.location.href='${CONFIG.loginPage}'">
            Voltar para o login
          </button>
        </div>
      </div>
    `;
  }

  /* =========================
     SALVAR LOG
  ========================= */
  function salvarLog(tipo, descricao) {
    const logs = JSON.parse(localStorage.getItem(logsKey)) || [];

    logs.unshift({
      usuario: userId,
      nome: usuario.nome || "Aluno",
      tipo,
      descricao,
      data: new Date().toLocaleString("pt-BR"),
      navegador: navigator.userAgent,
      tela: `${screen.width}x${screen.height}`
    });

    localStorage.setItem(logsKey, JSON.stringify(logs.slice(0, 300)));
  }

  /* =========================
     ALERTA
  ========================= */
  function mostrarAlerta(texto) {
    let alerta = document.getElementById("advancedSecurityAlert");

    if (!alerta) {
      alerta = document.createElement("div");
      alerta.id = "advancedSecurityAlert";
      document.body.appendChild(alerta);
    }

    alerta.innerText = texto;
    alerta.classList.add("show");

    setTimeout(() => {
      alerta.classList.remove("show");
    }, 2200);
  }

})();