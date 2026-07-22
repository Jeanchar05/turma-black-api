"use strict";

const SUPORTE_API_URL = String(
  window.TURMA_BLACK_API_URL ||
  "https://turma-black-api-es3u.onrender.com"
).replace(/\/$/, "");

document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];

  let usuario = null;

  function pegarToken() {
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
  }

  function irParaLogin() {
    limparSessao();
    window.location.replace("index.html");
  }

  async function chamarAPI(endpoint, metodo = "GET", dados = null, silent = false) {
    const token = pegarToken();

    if (!token) {
      irParaLogin();
      throw new Error("Sessão expirada.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const config = {
      method: metodo,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    };

    if (dados !== null && dados !== undefined) {
      config.body = JSON.stringify(dados);
    }

    try {
      const resposta = await fetch(`${SUPORTE_API_URL}${endpoint}`, config);
      const texto = await resposta.text();
      const json = texto ? JSON.parse(texto) : {};

      if (resposta.status === 401) {
        irParaLogin();
        throw new Error("Sessão expirada.");
      }

      if (!resposta.ok || json.erro) {
        throw new Error(
          json.erro ||
          json.mensagem ||
          `Erro ${resposta.status} na API.`
        );
      }

      return json;
    } catch (error) {
      if (silent) return null;

      if (error.name === "AbortError") {
        throw new Error("O servidor demorou para responder.");
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function abrirMenu() {
    $("sidebar")?.classList.add("active");
    $("sidebarOverlay")?.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function fecharMenu() {
    $("sidebar")?.classList.remove("active");
    $("sidebarOverlay")?.classList.remove("active");
    document.body.style.overflow = "";
  }

  document.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      if (page) window.location.href = page;
    });
  });

  $("btnMenu")?.addEventListener("click", () => {
    $("sidebar")?.classList.contains("active") ? fecharMenu() : abrirMenu();
  });

  $("sidebarOverlay")?.addEventListener("click", fecharMenu);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") fecharMenu();
  });

  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 900) fecharMenu();
    });
  });

  $("btnSair")?.addEventListener("click", async () => {
    await chamarAPI("/logout", "POST", null, true);
    irParaLogin();
  });

  $("formSuporte")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const tipo = $("tipoSuporte")?.value;
    const prioridade = $("prioridadeSuporte")?.value;
    const assunto = $("assuntoSuporte")?.value.trim();
    const mensagem = $("mensagemSuporte")?.value.trim();
    const botao = event.target.querySelector('[type="submit"]');

    if (!usuario) {
      alert("Não foi possível validar seu usuário. Atualize a página.");
      return;
    }

    if (!tipo || !prioridade || !assunto || !mensagem) {
      alert("Preencha todos os campos do chamado.");
      return;
    }

    if (botao) botao.disabled = true;

    try {
      await chamarAPI("/suporte", "POST", {
        tipo,
        prioridade,
        assunto,
        mensagem
      });

      registrarAtividade({
        icone: "💬",
        titulo: "Chamado aberto",
        descricao: assunto
      });

      event.target.reset();
      await carregarChamados();
      alert("Chamado aberto com sucesso!");
    } catch (error) {
      console.error(error);
      alert(error.message || "Erro ao abrir chamado.");
    } finally {
      if (botao) botao.disabled = false;
    }
  });

  async function carregarChamados() {
    const lista = $("listaChamados");
    if (!lista) return;

    lista.innerHTML = `
      <div class="empty-ticket">
        <span>⏳</span>
        <p>Carregando chamados...</p>
      </div>
    `;

    try {
      const dados = await chamarAPI("/meus-chamados");
      const chamados = Array.isArray(dados.chamados) ? dados.chamados : [];

      if (!chamados.length) {
        lista.innerHTML = `
          <div class="empty-ticket">
            <span>💬</span>
            <p>Nenhum chamado aberto ainda.</p>
          </div>
        `;
        return;
      }

      lista.innerHTML = chamados.map((chamado) => {
        const prioridadeClass = normalizarPrioridade(chamado.prioridade);
        const statusClass = normalizarStatus(chamado.status);

        return `
          <div class="ticket-item">
            <div class="ticket-top">
              <div>
                <strong>${escapeHTML(chamado.assunto || "Chamado")}</strong>
                <small>${escapeHTML(formatarData(chamado.criadoEm || chamado.createdAt))}</small>
              </div>

              <span class="ticket-priority ${prioridadeClass}">
                ${escapeHTML(textoPrioridade(chamado.prioridade))}
              </span>
            </div>

            <p>${escapeHTML(chamado.mensagem || "")}</p>

            <div class="ticket-meta">
              <span>${escapeHTML(chamado.tipo || chamado.categoria || "Geral")}</span>
              <span class="${statusClass}">${escapeHTML(textoStatus(chamado.status))}</span>
            </div>

            ${
              chamado.resposta
                ? `
                  <div class="ticket-response">
                    <strong>Resposta do suporte:</strong>
                    <p>${escapeHTML(chamado.resposta)}</p>
                    <small>${escapeHTML(formatarData(chamado.respondidoEm))}</small>
                  </div>
                `
                : `
                  <div class="ticket-waiting">
                    Aguardando resposta do suporte.
                  </div>
                `
            }
          </div>
        `;
      }).join("");
    } catch (error) {
      console.error(error);

      lista.innerHTML = `
        <div class="empty-ticket">
          <span>⚠️</span>
          <p>${escapeHTML(error.message || "Erro ao carregar chamados.")}</p>
        </div>
      `;
    }
  }

  function normalizarPrioridade(prioridade) {
    const valor = String(prioridade || "").toLowerCase();

    if (valor.includes("baixa")) return "priority-baixa";
    if (valor.includes("alta")) return "priority-alta";
    if (valor.includes("urgente")) return "priority-urgente";
    return "priority-media";
  }

  function textoPrioridade(prioridade) {
    const valor = String(prioridade || "normal").toLowerCase();
    if (valor === "normal") return "Média";
    return `${valor.charAt(0).toUpperCase()}${valor.slice(1)}`;
  }

  function normalizarStatus(status) {
    const valor = String(status || "").toLowerCase();

    if (valor === "em_atendimento") return "ticket-status-analise";
    if (valor === "respondido" || valor === "resolvido") {
      return "ticket-status-respondido";
    }
    if (valor === "fechado") return "ticket-status-fechado";
    return "ticket-status-aberto";
  }

  function textoStatus(status) {
    const mapa = {
      aberto: "Aberto",
      em_atendimento: "Em atendimento",
      respondido: "Respondido",
      resolvido: "Resolvido",
      fechado: "Fechado"
    };

    return mapa[String(status || "").toLowerCase()] || "Aberto";
  }

  function registrarAtividade(atividade) {
    try {
      const atividades = JSON.parse(
        sessionStorage.getItem("atividadesRecentes") || "[]"
      );

      atividades.unshift({
        ...atividade,
        data: new Date().toLocaleString("pt-BR")
      });

      sessionStorage.setItem(
        "atividadesRecentes",
        JSON.stringify(atividades.slice(0, 20))
      );
    } catch (_) {}
  }

  function formatarData(data) {
    if (!data) return "Sem data";

    const valor = new Date(data);
    return Number.isNaN(valor.getTime()) ? String(data) : valor.toLocaleString("pt-BR");
  }

  function escapeHTML(texto) {
    return String(texto || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  try {
    const dados = await chamarAPI("/me");
    usuario = dados.usuario || null;

    if (!usuario) {
      irParaLogin();
      return;
    }

    await carregarChamados();
  } catch (error) {
    console.error(error);

    if (pegarToken()) {
      const lista = $("listaChamados");
      if (lista) {
        lista.innerHTML = `
          <div class="empty-ticket">
            <span>⚠️</span>
            <p>${escapeHTML(error.message || "Não foi possível carregar o suporte.")}</p>
          </div>
        `;
      }
    }
  }
});
