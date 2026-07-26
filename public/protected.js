"use strict";

(() => {
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  document.addEventListener("DOMContentLoaded", validarPagina, { once: true });

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

  function normalizarCargo(usuario) {
    return String(usuario?.cargo || usuario?.tipo || "aluno")
      .trim()
      .toLowerCase()
      .replaceAll("_", "-");
  }

  function temAcesso(usuario, acesso) {
    if (!acesso || acesso === "dashboard") return true;

    const cargo = normalizarCargo(usuario);
    const acessos = usuario?.acessosRapidos || {};

    if (acesso === "painelAdmin") {
      return (
        acessos.painelAdmin === true ||
        ["superadmin", "super-admin", "admin", "moderador"].includes(cargo)
      );
    }

    if (acesso === "painelVendas") {
      return (
        acessos.painelVendas === true ||
        usuario?.vendedor === true ||
        ["superadmin", "super-admin", "admin", "suporte", "vendedor"].includes(cargo)
      );
    }

    return false;
  }

  async function validarPagina() {
    const token = pegarToken();

    if (!token) {
      window.location.replace("index.html");
      return;
    }

    try {
      const resposta = await fetch(`${window.location.origin}/me`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok || !dados?.usuario) {
        throw new Error(dados?.erro || "Sessão inválida.");
      }

      const usuario = dados.usuario;
      const necessario = document.body.dataset.requiredAccess || "dashboard";

      if (!temAcesso(usuario, necessario)) {
        window.location.replace("dashboard.html");
        return;
      }

      preencherUsuario(usuario);
      document.body.classList.add("protected-ready");
    } catch (_) {
      limparSessao();
      window.location.replace("index.html");
    }
  }

  function preencherUsuario(usuario) {
    const nome = String(usuario?.nome || "Dev Turma do Primo");
    const primeiroNome = nome.trim().split(/\s+/)[0] || "Dev";
    const cargo = normalizarCargo(usuario);

    $$('[data-user-name]').forEach((elemento) => {
      elemento.textContent = primeiroNome;
    });

    $$('[data-user-fullname]').forEach((elemento) => {
      elemento.textContent = nome;
    });

    $$('[data-user-role]').forEach((elemento) => {
      elemento.textContent = cargo === "superadmin" ? "Super Admin" : cargo;
    });

    $$('[data-logout]').forEach((botao) => {
      botao.addEventListener("click", () => {
        limparSessao();
        window.location.replace("index.html");
      });
    });
  }
})();
