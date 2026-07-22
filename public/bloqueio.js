"use strict";

const tokenBloqueio = sessionStorage.getItem("token");

if (!tokenBloqueio) {
  document.body.innerHTML = `
    <div class="bloqueio-overlay">
      <div class="bloqueio-card">
        <div class="bloqueio-topo">
          <div class="bloqueio-icone">🔒</div>

          <div>
            <h1 class="bloqueio-titulo">Acesso Restrito</h1>
            <p class="bloqueio-sub">
              Faça login para continuar acessando a plataforma.
            </p>
          </div>
        </div>

        <div class="bloqueio-alerta">
          Esta área é exclusiva para usuários autenticados da plataforma Turma Black.
        </div>

        <div class="bloqueio-acoes">
          <button class="bloqueio-btn login" type="button" data-login>
            Fazer Login
          </button>

          <button class="bloqueio-btn voltar" type="button" data-voltar>
            Voltar
          </button>
        </div>
      </div>
    </div>
  `;

  document.querySelector("[data-login]")?.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  document.querySelector("[data-voltar]")?.addEventListener("click", () => {
    window.history.back();
  });
}
