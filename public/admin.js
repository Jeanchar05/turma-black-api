"use strict";

(() => {
  const API_URL = String(
    window.TURMA_BLACK_API_URL ||
    "https://turma-black-api-es3u.onrender.com"
  ).replace(/\/$/, "");

  const TOKEN_KEYS = [
    "token",
    "adminToken",
    "authToken",
    "accessToken",
    "jwt"
  ];

  const CACHE_MS = 30000;

  const $ = (id) => document.getElementById(id);

  const $$ = (selector) =>
    Array.from(document.querySelectorAll(selector));

  const state = {
    token: "",
    usuario: null,
    cargo: "",
    permissoes: {},
    aba: "visaoGeral",

    confirmacao: null,
    editandoAgenda: null,
    editandoAluno: null,
    novoVendedor: false,

    dados: {
      dashboard: {},

      usuarios: [],
      usuariosResumo: {},

      alunos: [],
      alunosResumo: {},

      vendedores: [],
      vendedoresResumo: {},

      vendas: [],
      vendasResumo: {},
      ranking: [],

      agenda: [],
      agendaResumo: {},

      notificacoes: [],
      notificacoesResumo: {},

      suporte: [],
      suporteResumo: {},

      provas: [],
      resultados: [],
      provasResumo: {},

      admins: [],
      adminsResumo: {},

      configuracao: {}
    },

    carregadoEm: {},
    emAndamento: new Map()
  };

  const modalCloseTimers = new Map();
  let menuCloseTimer = null;
  let eventosRegistrados = false;

  document.addEventListener(
    "DOMContentLoaded",
    iniciar,
    { once: true }
  );

  /* =========================================================
     INICIALIZAÇÃO
  ========================================================= */

  async function iniciar() {
    if (!eventosRegistrados) {
      registrarEventos();
      eventosRegistrados = true;
    }

    mostrarLoading(
      true,
      "Validando seu acesso..."
    );

    try {
      state.token = pegarToken();

      if (!state.token) {
        const error = new Error(
          "Sessão expirada. Faça login novamente."
        );

        error.status = 401;
        throw error;
      }

      const me = await api("/me");

      const acesso = await api(
        "/admin/meu-acesso"
      );

      state.usuario =
        acesso.usuario ||
        me.usuario;

      state.cargo =
        normalizarCargo(state.usuario);

      state.permissoes =
        acesso.permissoes ||
        state.usuario?.permissoes ||
        {};

      if (
        !state.usuario ||
        (
          !ehSuperAdmin() &&
          !temPermissao("painelAdmin")
        )
      ) {
        const error = new Error(
          "Você não tem acesso ao Painel Administrativo."
        );

        error.status = 403;
        throw error;
      }

      preencherPerfil();
      aplicarPermissoes();

      const primeiroBotao =
        document.querySelector(
          "[data-admin-tab]:not([hidden])"
        );

      const primeiraAba =
        primeiroBotao?.dataset.adminTab ||
        "visaoGeral";

      await abrirAba(
        primeiraAba,
        true
      );

      setText(
        "statusBackendAdmin",
        "Backend online"
      );

      setText(
        "adminStatus",
        "🟢 Online"
      );
    } catch (error) {
      console.error(error);

      setText("statusBackendAdmin", "Backend indisponível");
      setText("adminStatus", "🔴 Falha na conexão");

      if (error.status === 401) {
        limparSessao();

        alert(
          error.message ||
          "Sua sessão expirou. Faça login novamente."
        );

        window.location.replace("index.html");
        return;
      }

      if (error.status === 403) {
        alert(
          error.message ||
          "Você não tem acesso ao Painel Administrativo."
        );

        window.location.replace("dashboard.html");
        return;
      }

      mensagem(
        error.message ||
        "Não foi possível carregar o painel. Tente atualizar novamente.",
        "erro"
      );
    } finally {
      mostrarLoading(false);
    }
  }

  /* =========================================================
     SESSÃO
  ========================================================= */

  function pegarToken() {
    for (const key of TOKEN_KEYS) {
      try {
        const token =
          sessionStorage.getItem(key);

        if (token) {
          return token;
        }
      } catch (_) {}
    }

    return "";
  }

  function limparSessao() {
    for (const key of TOKEN_KEYS) {
      try {
        sessionStorage.removeItem(key);
      } catch (_) {}
    }
  }

  /* =========================================================
     API
  ========================================================= */

  async function api(
    endpoint,
    {
      method = "GET",
      body = null,
      silent = false,
      timeout = 15000
    } = {}
  ) {
    const controller =
      new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      timeout
    );

    const config = {
      method,
      signal: controller.signal,

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`
      }
    };

    if (
      body !== null &&
      body !== undefined
    ) {
      config.body =
        JSON.stringify(body);
    }

    try {
      const response = await fetch(
        `${API_URL}${endpoint}`,
        config
      );

      const text =
        await response.text();

      let data = {};

      try {
        data = text
          ? JSON.parse(text)
          : {};
      } catch (_) {
        data = {
          mensagem:
            text ||
            "Resposta inválida do servidor."
        };
      }

      if (response.status === 401) {
        limparSessao();

        window.location.replace(
          "index.html"
        );

        const error = new Error(
          "Sua sessão expirou."
        );

        error.status = 401;
        error.codigo = data.codigo || "TOKEN_INVALIDO";

        throw error;
      }

      if (
        !response.ok ||
        data.erro
      ) {
        const message =
          data.erro ||
          data.mensagem ||
          data.message ||
          `Erro ${response.status}.`;

        if (silent) {
          console.warn(
            `[Admin API] ${endpoint}: ${message}`
          );

          return null;
        }

        const error = new Error(message);

        error.status = response.status;
        error.codigo = data.codigo || "";

        throw error;
      }

      return data;
    } catch (error) {
      if (silent) {
        return null;
      }

      if (
        error.name ===
        "AbortError"
      ) {
        throw new Error(
          "O servidor demorou para responder."
        );
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /* =========================================================
     CACHE E CONTROLE DE REQUISIÇÕES
  ========================================================= */

  async function carregarComCache(
    chave,
    carregador,
    force = false
  ) {
    const agora = Date.now();

    const recente =
      state.carregadoEm[chave] &&
      agora - state.carregadoEm[chave] <
        CACHE_MS;

    if (
      !force &&
      recente
    ) {
      return;
    }

    if (
      state.emAndamento.has(chave)
    ) {
      return state.emAndamento.get(
        chave
      );
    }

    const promessa = Promise
      .resolve()
      .then(carregador)
      .then(() => {
        state.carregadoEm[chave] =
          Date.now();
      })
      .finally(() => {
        state.emAndamento.delete(
          chave
        );
      });

    state.emAndamento.set(
      chave,
      promessa
    );

    return promessa;
  }

  /* =========================================================
     PERMISSÕES
  ========================================================= */

  function normalizarCargo(usuario) {
    return String(
      usuario?.cargo ||
      usuario?.tipo ||
      ""
    )
      .trim()
      .toLowerCase()
      .replaceAll("_", "-")
      .replace(/\s+/g, "-");
  }

  function ehSuperAdmin() {
    return [
      "superadmin",
      "super-admin"
    ].includes(state.cargo);
  }

  function podeGerenciarUsuarios() {
    return (
      ehSuperAdmin() ||
      state.cargo === "admin"
    );
  }

  function temPermissao(chave) {
    if (ehSuperAdmin()) {
      return true;
    }

    const aliases = {
      painelAdmin: [
        "painelAdmin"
      ],

      usuarios: [
        "usuarios"
      ],

      aprovacoes: [
        "aprovacoes"
      ],

      controleAlunos: [
        "controleAlunos"
      ],

      painelVendas: [
        "painelVendas"
      ],

      relatorios: [
        "relatorios"
      ],

      agenda: [
        "agenda",
        "agendaPrimo"
      ],

      notificacoes: [
        "notificacoes"
      ],

      suporte: [
        "suporte"
      ],

      provas: [
        "provas"
      ],

      controleAdmin: [
        "controleAdmin",
        "adminControle"
      ],

      seguranca: [
        "seguranca"
      ],

      planos: [
        "planos"
      ]
    };

    return (
      aliases[chave] ||
      [chave]
    ).some((item) => {
      return (
        state.permissoes?.[item] ===
        true
      );
    });
  }

  function permissaoDaAba(id) {
    const mapa = {
      visaoGeral: "painelAdmin",
      usuarios: "usuarios",
      aprovacoes: "aprovacoes",
      controleAlunos: "controleAlunos",
      vendedores: "painelVendas",
      relatorios: "relatorios",
      agendaPrimo: "agenda",
      notificacoes: "notificacoes",
      suporte: "suporte",
      provas: "provas",
      adminControle: "controleAdmin",
      seguranca: "seguranca",
      planos: "planos"
    };

    return temPermissao(
      mapa[id] ||
      id
    );
  }

  function aplicarPermissoes() {
    $$("[data-admin-tab]")
      .forEach((botao) => {
        const permitido =
          permissaoDaAba(
            botao.dataset.adminTab
          );

        botao.hidden =
          !permitido;

        botao.disabled =
          !permitido;
      });

    $$('[data-requires-permission]')
      .forEach((elemento) => {
        const permitido = temPermissao(
          elemento.dataset.requiresPermission
        );

        elemento.hidden = !permitido;
        elemento.disabled = !permitido;
      });

    $$("[data-admin-section]")
      .forEach((secao) => {
        if (
          !permissaoDaAba(secao.id)
        ) {
          secao.hidden = true;
        }
      });
  }

  /* =========================================================
     HELPERS
  ========================================================= */

  function setText(id, valor) {
    const elemento = $(id);

    if (elemento) {
      elemento.textContent =
        valor ?? "";
    }
  }

  function setValue(id, valor) {
    const elemento = $(id);

    if (elemento) {
      elemento.value =
        valor ?? "";
    }
  }

  function value(id) {
    return $(id)?.value ?? "";
  }

  function escapeHTML(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function className(valor) {
    return String(
      valor ||
      "neutro"
    )
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-z0-9_-]/g,
        "-"
      );
  }

  function moeda(valor) {
    return Number(
      valor ||
      0
    ).toLocaleString(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL"
      }
    );
  }

  function formatarData(
    valor,
    apenasData = false
  ) {
    if (!valor) {
      return "Sem data";
    }

    const data =
      new Date(valor);

    if (
      Number.isNaN(
        data.getTime()
      )
    ) {
      return String(valor);
    }

    if (apenasData) {
      return data.toLocaleDateString(
        "pt-BR"
      );
    }

    return data.toLocaleString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
    );
  }

  function iniciais(nome) {
    return (
      String(nome || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((parte) => {
          return parte
            .charAt(0)
            .toUpperCase();
        })
        .join("") ||
      "?"
    );
  }

  function planoNormalizado(plano) {
    const valor = String(
      plano ||
      "free"
    )
      .toLowerCase()
      .replace(/\s+/g, "");

    if (
      valor.includes("360")
    ) {
      return "black360";
    }

    if (
      valor.includes("180")
    ) {
      return "black180";
    }

    if (
      valor.includes("90")
    ) {
      return "black90";
    }

    if (
      valor.includes("30") ||
      valor === "black" ||
      valor === "premium"
    ) {
      return "black30";
    }

    if (
      valor.includes("admin")
    ) {
      return "admin";
    }

    if (
      valor.includes("particular")
    ) {
      return "particular";
    }

    return "free";
  }

  function textoPlano(plano) {
    const mapa = {
      free: "Free",
      black30: "Black 30",
      black90: "Black 90",
      black180: "Black 180",
      black360: "Black 360",
      particular: "Particular",
      admin: "Admin"
    };

    return (
      mapa[
        planoNormalizado(plano)
      ] ||
      plano ||
      "Free"
    );
  }

  function diasPlano(plano) {
    const mapa = {
      black30: 30,
      black90: 90,
      black180: 180,
      black360: 360
    };

    return (
      mapa[
        planoNormalizado(plano)
      ] ||
      0
    );
  }

  function expiracaoPlano(plano) {
    const dias =
      diasPlano(plano);

    if (!dias) {
      return "";
    }

    const data =
      new Date();

    data.setDate(
      data.getDate() +
      dias
    );

    return data.toISOString();
  }

  function statusPill(
    status,
    label = ""
  ) {
    return `
      <span class="status-pill ${className(status)}">
        ${escapeHTML(label || status || "Ativo")}
      </span>
    `;
  }

  function vazio(texto) {
    return `
      <div class="admin-empty">
        <span>—</span>
        <p>${escapeHTML(texto)}</p>
      </div>
    `;
  }

  function arrayProfundo(
    objeto,
    chaves
  ) {
    if (
      !objeto ||
      typeof objeto !== "object"
    ) {
      return [];
    }

    const fila = [objeto];
    const visitados = new Set();

    while (fila.length) {
      const atual =
        fila.shift();

      if (
        !atual ||
        typeof atual !== "object" ||
        visitados.has(atual)
      ) {
        continue;
      }

      visitados.add(atual);

      for (
        const chave of chaves
      ) {
        if (
          Array.isArray(
            atual[chave]
          )
        ) {
          return atual[chave];
        }
      }

      for (
        const valor of
        Object.values(atual)
      ) {
        if (
          valor &&
          typeof valor === "object"
        ) {
          fila.push(valor);
        }
      }
    }

    return [];
  }

  function valorProfundo(
    objeto,
    chaves,
    fallback = 0
  ) {
    if (
      !objeto ||
      typeof objeto !== "object"
    ) {
      return fallback;
    }

    const fila = [objeto];
    const visitados = new Set();

    while (fila.length) {
      const atual =
        fila.shift();

      if (
        !atual ||
        typeof atual !== "object" ||
        visitados.has(atual)
      ) {
        continue;
      }

      visitados.add(atual);

      for (
        const chave of chaves
      ) {
        if (
          atual[chave] !==
            undefined &&
          atual[chave] !==
            null &&
          !Array.isArray(
            atual[chave]
          )
        ) {
          return atual[chave];
        }
      }

      for (
        const valor of
        Object.values(atual)
      ) {
        if (
          valor &&
          typeof valor === "object"
        ) {
          fila.push(valor);
        }
      }
    }

    return fallback;
  }

  function preencherPerfil() {
    const nome =
      state.usuario?.nome ||
      state.usuario?.email ||
      "Admin";

    setText(
      "adminNome",
      nome
    );

    setText(
      "adminNomeHeader",
      nome.split(/\s+/)[0]
    );

    setText(
      "adminAvatar",
      iniciais(nome)
    );

    const cargos = {
      superadmin:
        "👑 Super Admin",

      "super-admin":
        "👑 Super Admin",

      admin:
        "🟣 Admin",

      moderador:
        "🟢 Moderador",

      suporte:
        "🔵 Suporte",

      vendedor:
        "🏆 Vendedor"
    };

    setText(
      "adminCargo",
      cargos[state.cargo] ||
      state.cargo
    );
  }

  function mensagem(
    texto,
    tipo = "sucesso"
  ) {
    const box =
      $("mensagemAdmin");

    if (!box) {
      return;
    }

    box.hidden = false;
    box.textContent = texto;
    box.className =
      `mensagem ${tipo} active`;

    clearTimeout(box._timer);

    box._timer = setTimeout(
      () => {
        box.classList.remove(
          "active"
        );

        box.hidden = true;
      },
      4200
    );
  }

  function mostrarLoading(
    ativo,
    texto = "Carregando..."
  ) {
    const overlay =
      $("adminLoading");

    if (!overlay) {
      return;
    }

    setText(
      "adminLoadingTexto",
      texto
    );

    overlay.hidden = !ativo;

    overlay.setAttribute(
      "aria-hidden",
      String(!ativo)
    );

    overlay.classList.toggle(
      "active",
      ativo
    );
  }

  function setBusy(
    botao,
    ativo,
    texto = "Aguarde..."
  ) {
    if (!botao) {
      return;
    }

    if (ativo) {
      botao.dataset.originalText =
        botao.textContent;

      botao.disabled = true;

      botao.classList.add(
        "is-loading"
      );

      botao.textContent = texto;

      return;
    }

    botao.disabled = false;

    botao.classList.remove(
      "is-loading"
    );

    if (
      botao.dataset.originalText
    ) {
      botao.textContent =
        botao.dataset.originalText;
    }
  }

  /* =========================================================
     MODAIS
  ========================================================= */

  function abrirModal(id) {
    const modal = $(id);

    if (!modal) {
      return;
    }

    clearTimeout(
      modalCloseTimers.get(id)
    );

    modalCloseTimers.delete(id);

    modal.hidden = false;

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    requestAnimationFrame(
      () => {
        modal.classList.add(
          "active",
          "open"
        );
      }
    );

    document.body.classList.add(
      "modal-open"
    );
  }

  function fecharModal(id) {
    const modal = $(id);

    if (!modal) {
      return;
    }

    modal.classList.remove(
      "active",
      "open"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    const timer = setTimeout(() => {
      modal.hidden = true;

      modalCloseTimers.delete(id);

      const aberto =
        document.querySelector(
          ".modal-overlay.active, .modal-overlay.open"
        );

      if (!aberto) {
        document.body.classList.remove(
          "modal-open"
        );
      }
    }, 170);

    modalCloseTimers.set(id, timer);
  }

  function confirmar(
    titulo,
    texto,
    callback
  ) {
    setText(
      "modalAdminTitulo",
      titulo
    );

    setText(
      "modalAdminTexto",
      texto
    );

    state.confirmacao =
      callback;

    abrirModal(
      "modalAdminConfirm"
    );
  }

  function atualizarSincronizacao() {
    setText(
      "ultimaSincronizacao",
      new Date().toLocaleTimeString(
        "pt-BR",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      )
    );
  }

  /* =========================================================
     ABAS
  ========================================================= */

  async function abrirAba(
    id,
    force = false
  ) {
    if (
      !permissaoDaAba(id)
    ) {
      mensagem(
        "Você não tem permissão para acessar esta aba.",
        "erro"
      );

      return;
    }

    state.aba = id;

    $$("[data-admin-section]")
      .forEach((secao) => {
        const ativa =
          secao.id === id;

        secao.hidden = !ativa;

        secao.classList.toggle(
          "active",
          ativa
        );
      });

    $$("[data-admin-tab]")
      .forEach((botao) => {
        const ativo =
          botao.dataset.adminTab === id;

        botao.classList.toggle(
          "active",
          ativo
        );

        botao.setAttribute(
          "aria-selected",
          String(ativo)
        );
      });

    fecharMenuMobile();

    await carregarAba(
      id,
      force
    );
  }

  async function carregarAba(
    id,
    force = false
  ) {
    setText(
      "ultimaSincronizacao",
      "Sincronizando..."
    );

    try {
      const loaders = {
        visaoGeral:
          carregarDashboard,

        usuarios:
          carregarUsuarios,

        aprovacoes:
          carregarUsuarios,

        controleAlunos:
          carregarAlunos,

        vendedores:
          carregarVendedores,

        relatorios:
          carregarVendas,

        agendaPrimo:
          carregarAgenda,

        notificacoes:
          carregarNotificacoes,

        suporte:
          carregarSuporte,

        provas:
          carregarProvas,

        adminControle:
          carregarAdmins,

        seguranca:
          carregarConfiguracao,

        planos:
          carregarConfiguracao
      };

      await loaders[id]?.(force);

      renderAba(id);

      atualizarSincronizacao();
    } catch (error) {
      console.error(error);

      mensagem(
        error.message ||
        "Erro ao carregar esta aba.",
        "erro"
      );

      setText(
        "ultimaSincronizacao",
        "Falha"
      );
    }
  }

  function renderAba(id) {
    const renders = {
      visaoGeral:
        renderDashboard,

      usuarios:
        renderUsuarios,

      aprovacoes:
        renderAprovacoes,

      controleAlunos:
        renderAlunos,

      vendedores:
        renderVendedores,

      relatorios:
        renderRelatorios,

      agendaPrimo:
        renderAgenda,

      notificacoes:
        renderNotificacoes,

      suporte:
        renderSuporte,

      provas:
        renderProvas,

      adminControle:
        renderAdmins,

      seguranca:
        renderConfiguracao,

      planos:
        renderConfiguracao
    };

    renders[id]?.();
  }

  /* =========================================================
     CARREGAMENTO DAS APIS
  ========================================================= */

  async function carregarDashboard(
    force = false
  ) {
    return carregarComCache(
      "dashboard",

      async () => {
        state.dados.dashboard =
          await api(
            "/admin/dashboard"
          ) || {};
      },

      force
    );
  }

  async function carregarUsuarios(
    force = false
  ) {
    return carregarComCache(
      "usuarios",

      async () => {
        const [
          lista,
          resumo
        ] = await Promise.all([
          api(
            "/usuarios"
          ),

          api(
            "/usuarios/resumo",
            { silent: true }
          )
        ]);

        state.dados.usuarios =
          arrayProfundo(
            lista,
            [
              "usuarios",
              "users",
              "lista",
              "dados"
            ]
          ).map(
            normalizarUsuario
          );

        state.dados.usuariosResumo =
          resumo?.resumo ||
          resumo ||
          {};
      },

      force
    );
  }

  async function carregarAlunos(
    force = false
  ) {
    return carregarComCache(
      "alunos",

      async () => {
        const [
          lista,
          resumo
        ] = await Promise.all([
          api(
            "/admin/controle-alunos"
          ),

          api(
            "/admin/controle-alunos/resumo",
            { silent: true }
          )
        ]);

        state.dados.alunos =
          arrayProfundo(
            lista,
            [
              "alunos",
              "lista",
              "dados"
            ]
          ).map(
            normalizarAluno
          );

        state.dados.alunosResumo =
          resumo?.resumo ||
          resumo ||
          {};
      },

      force
    );
  }

  async function carregarVendedores(
    force = false
  ) {
    return carregarComCache(
      "vendedores",

      async () => {
        const [
          lista,
          resumo,
          ranking,
          vendasResumo
        ] = await Promise.all([
          api(
            "/admin/vendedores"
          ),

          api(
            "/admin/vendedores/resumo",
            { silent: true }
          ),

          api(
            "/admin/vendas/ranking",
            { silent: true }
          ),

          api(
            "/admin/vendas/resumo",
            { silent: true }
          )
        ]);

        state.dados.vendedores =
          arrayProfundo(
            lista,
            [
              "vendedores",
              "usuarios",
              "admins",
              "lista",
              "dados"
            ]
          ).map(
            normalizarVendedor
          );

        state.dados.ranking =
          arrayProfundo(
            ranking,
            [
              "ranking",
              "vendedores",
              "lista",
              "dados"
            ]
          ).map(
            normalizarVendedor
          );

        state.dados.vendedoresResumo =
          resumo?.resumo ||
          resumo ||
          {};

        state.dados.vendasResumo =
          vendasResumo?.resumo ||
          vendasResumo ||
          state.dados.vendasResumo;
      },

      force
    );
  }

  async function carregarVendas(
    force = false
  ) {
    return carregarComCache(
      "vendas",

      async () => {
        const [
          lista,
          resumo,
          ranking
        ] = await Promise.all([
          api(
            "/admin/vendas"
          ),

          api(
            "/admin/vendas/resumo",
            { silent: true }
          ),

          api(
            "/admin/vendas/ranking",
            { silent: true }
          )
        ]);

        state.dados.vendas =
          arrayProfundo(
            lista,
            [
              "vendas",
              "sales",
              "lista",
              "dados"
            ]
          ).map(
            normalizarVenda
          );

        state.dados.vendasResumo =
          resumo?.resumo ||
          resumo ||
          {};

        state.dados.ranking =
          arrayProfundo(
            ranking,
            [
              "ranking",
              "vendedores",
              "lista",
              "dados"
            ]
          ).map(
            normalizarVendedor
          );
      },

      force
    );
  }

  async function carregarAgenda(
    force = false
  ) {
    return carregarComCache(
      "agenda",

      async () => {
        const [
          lista,
          resumo
        ] = await Promise.all([
          api(
            "/admin/agenda-primo"
          ),

          api(
            "/admin/agenda-primo/resumo",
            { silent: true }
          )
        ]);

        state.dados.agenda =
          arrayProfundo(
            lista,
            [
              "agenda",
              "eventos",
              "lista",
              "dados"
            ]
          ).map(
            normalizarAgenda
          );

        state.dados.agendaResumo =
          resumo?.resumo ||
          resumo ||
          {};
      },

      force
    );
  }

  async function carregarNotificacoes(
    force = false
  ) {
    return carregarComCache(
      "notificacoes",

      async () => {
        const [
          lista,
          resumo
        ] = await Promise.all([
          api(
            "/admin/notificacoes"
          ),

          api(
            "/admin/notificacoes/resumo",
            { silent: true }
          )
        ]);

        state.dados.notificacoes =
          arrayProfundo(
            lista,
            [
              "notificacoes",
              "notifications",
              "lista",
              "dados"
            ]
          ).map(
            normalizarNotificacao
          );

        state.dados.notificacoesResumo =
          resumo?.resumo ||
          resumo ||
          {};
      },

      force
    );
  }

  async function carregarSuporte(
    force = false
  ) {
    return carregarComCache(
      "suporte",

      async () => {
        const [
          lista,
          resumo
        ] = await Promise.all([
          api(
            "/admin/suporte"
          ),

          api(
            "/admin/suporte/resumo",
            { silent: true }
          )
        ]);

        state.dados.suporte =
          arrayProfundo(
            lista,
            [
              "chamados",
              "tickets",
              "lista",
              "dados"
            ]
          ).map(
            normalizarChamado
          );

        state.dados.suporteResumo =
          resumo?.resumo ||
          resumo ||
          {};
      },

      force
    );
  }

  async function carregarProvas(
    force = false
  ) {
    return carregarComCache(
      "provas",

      async () => {
        const [
          provas,
          resultados,
          resumo
        ] = await Promise.all([
          api(
            "/admin/provas",
            { silent: true }
          ),

          api(
            "/admin/provas/resultados"
          ),

          api(
            "/admin/provas/resumo",
            { silent: true }
          )
        ]);

        state.dados.provas =
          arrayProfundo(
            provas,
            [
              "provas",
              "lista",
              "dados"
            ]
          );

        state.dados.resultados =
          arrayProfundo(
            resultados,
            [
              "resultados",
              "lista",
              "dados"
            ]
          ).map(
            normalizarResultado
          );

        state.dados.provasResumo =
          resumo?.resumo ||
          resumo ||
          {};
      },

      force
    );
  }

  async function carregarAdmins(
    force = false
  ) {
    return carregarComCache(
      "admins",

      async () => {
        const [
          lista,
          resumo
        ] = await Promise.all([
          api(
            "/admin/controle-admins"
          ),

          api(
            "/admin/controle-admins/resumo",
            { silent: true }
          )
        ]);

        state.dados.admins =
          arrayProfundo(
            lista,
            [
              "admins",
              "usuarios",
              "lista",
              "dados"
            ]
          ).map(
            normalizarAdmin
          );

        state.dados.adminsResumo =
          resumo?.resumo ||
          resumo ||
          {};
      },

      force
    );
  }

  async function carregarConfiguracao(
    force = false
  ) {
    return carregarComCache(
      "configuracao",

      async () => {
        const dados =
          await api(
            "/admin/configuracao"
          );

        state.dados.configuracao =
          dados?.configuracao ||
          dados ||
          {};
      },

      force
    );
  }

  /* =========================================================
     NORMALIZADORES
  ========================================================= */

  function normalizarUsuario(usuario) {
    const cargo =
      normalizarCargo(usuario) ||
      "aluno";

    let status =
      String(
        usuario.status ||
        "ativo"
      ).toLowerCase();

    if (usuario.suspenso) {
      status = "suspenso";
    }

    if (
      usuario.aprovado === false
    ) {
      status = "pendente";
    }

    return {
      ...usuario,

      id:
        usuario.id ||
        usuario._id ||
        usuario.email,

      nome:
        usuario.nome ||
        usuario.name ||
        "Usuário",

      email:
        String(
          usuario.email ||
          ""
        ).toLowerCase(),

      cargo,
      status,

      plano:
        planoNormalizado(
          usuario.plano
        ),

      codigo:
        usuario.codigo ||
        usuario.codigoAprovacao ||
        "",

      criadoEm:
        usuario.createdAt ||
        usuario.criadoEm ||
        usuario.dataCadastro ||
        "",

      dataExpiracao:
        usuario.dataExpiracao ||
        ""
    };
  }

  function normalizarAluno(aluno) {
    return {
      ...aluno,

      id:
        aluno.id ||
        aluno._id,

      nome:
        aluno.nome ||
        "Aluno",

      email:
        String(
          aluno.email ||
          ""
        ).toLowerCase(),

      telefone:
        aluno.telefone ||
        "",

      plano:
        planoNormalizado(
          aluno.plano
        ),

      status:
        aluno.statusCalculado ||
        aluno.status ||
        "ativo",

      valor:
        Number(
          aluno.valor ||
          0
        ),

      vencimento:
        aluno.vencimento ||
        "",

      pagamento:
        aluno.formaPagamento ||
        "PIX",

      statusPagamento:
        aluno.statusPagamento ||
        "pendente",

      observacoes:
        aluno.observacoes ||
        ""
    };
  }

  function normalizarVendedor(vendedor) {
    const total = Number(
      vendedor.totalVendido ||
      vendedor.valorTotal ||
      vendedor.total ||
      0
    );

    return {
      ...vendedor,

      id:
        vendedor.id ||
        vendedor._id ||
        vendedor.email ||
        vendedor.vendedorId,

      nome:
        vendedor.nome ||
        vendedor.vendedorNome ||
        vendedor.email ||
        "Vendedor",

      email:
        String(
          vendedor.email ||
          vendedor.vendedorEmail ||
          ""
        ).toLowerCase(),

      status:
        vendedor.status ||
        "ativo",

      vendas:
        Number(
          vendedor.vendas ||
          vendedor.totalVendas ||
          vendedor.quantidadeVendas ||
          0
        ),

      totalVendido:
        total,

      comissao:
        Number(
          vendedor.comissaoTotal ||
          vendedor.comissaoValor ||
          vendedor.comissao ||
          total * 0.2
        )
    };
  }

  function normalizarVenda(venda) {
    const valor = Number(
      venda.valor ||
      venda.total ||
      0
    );

    return {
      ...venda,

      id:
        venda.id ||
        venda._id,

      alunoNome:
        venda.alunoNome ||
        venda.nomeAluno ||
        venda.nome ||
        "Aluno",

      alunoEmail:
        String(
          venda.alunoEmail ||
          venda.emailAluno ||
          ""
        ).toLowerCase(),

      vendedorNome:
        venda.vendedorNome ||
        venda.nomeVendedor ||
        "",

      vendedorEmail:
        String(
          venda.vendedorEmail ||
          venda.emailVendedor ||
          ""
        ).toLowerCase(),

      plano:
        planoNormalizado(
          venda.plano
        ),

      valor,

      comissao:
        Number(
          venda.comissao ||
          valor * 0.2
        ),

      status:
        venda.status ||
        "pago",

      criadoEm:
        venda.createdAt ||
        venda.criadoEm ||
        venda.dataVenda ||
        venda.data ||
        ""
    };
  }

  function normalizarAgenda(agenda) {
    return {
      ...agenda,

      id:
        agenda.id ||
        agenda._id,

      titulo:
        agenda.titulo ||
        "Evento",

      descricao:
        agenda.descricao ||
        "",

      dataInicio:
        agenda.dataInicio ||
        agenda.data ||
        "",

      horaInicio:
        agenda.horaInicio ||
        agenda.hora ||
        "",

      dataFinal:
        agenda.dataFinal ||
        agenda.dataInicio ||
        agenda.data ||
        "",

      horaFinal:
        agenda.horaFinal ||
        "",

      tipo:
        agenda.tipo ||
        "evento",

      status:
        agenda.status ||
        "Agendar",

      link:
        agenda.link ||
        "",

      local:
        agenda.local ||
        ""
    };
  }

  function normalizarNotificacao(notificacao) {
    return {
      ...notificacao,

      id:
        notificacao.id ||
        notificacao._id,

      titulo:
        notificacao.titulo ||
        "Notificação",

      mensagem:
        notificacao.mensagem ||
        "",

      tipo:
        notificacao.tipo ||
        "geral",

      destino:
        notificacao.destino ||
        "todos",

      prioridade:
        notificacao.prioridade ||
        "normal",

      ativa:
        notificacao.ativa !== false,

      fixada:
        notificacao.fixada === true,

      criadaEm:
        notificacao.createdAt ||
        notificacao.criadaEm ||
        notificacao.data ||
        ""
    };
  }

  function normalizarChamado(chamado) {
    return {
      ...chamado,

      id:
        chamado.id ||
        chamado._id,

      nome:
        chamado.nome ||
        chamado.usuarioNome ||
        "Usuário",

      email:
        chamado.email ||
        chamado.usuarioEmail ||
        "",

      assunto:
        chamado.assunto ||
        "Chamado",

      mensagem:
        chamado.mensagem ||
        "",

      status:
        chamado.status ||
        "aberto",

      prioridade:
        chamado.prioridade ||
        "normal",

      criadoEm:
        chamado.createdAt ||
        chamado.criadoEm ||
        ""
    };
  }

  function normalizarResultado(resultado) {
    return {
      ...resultado,

      id:
        resultado.id ||
        resultado._id,

      nome:
        resultado.usuarioNome ||
        resultado.alunoNome ||
        resultado.nome ||
        "Aluno",

      email:
        resultado.usuarioEmail ||
        resultado.alunoEmail ||
        resultado.email ||
        "",

      prova:
        resultado.provaTitulo ||
        resultado.titulo ||
        resultado.prova ||
        "Prova",

      nota:
        Number(
          resultado.nota ||
          resultado.percentual ||
          0
        ),

      status:
        resultado.status ||
        (
          resultado.aprovado
            ? "aprovado"
            : "reprovado"
        ),

      criadoEm:
        resultado.finalizadoEm ||
        resultado.createdAt ||
        resultado.criadoEm ||
        ""
    };
  }

  function normalizarAdmin(admin) {
    return {
      ...admin,

      id:
        admin.id ||
        admin._id ||
        admin.email,

      nome:
        admin.nome ||
        admin.email ||
        "Administrador",

      email:
        String(
          admin.email ||
          ""
        ).toLowerCase(),

      cargo:
        normalizarCargo(admin) ||
        "admin",

      status:
        admin.status ||
        "ativo",

      vendedor:
        admin.vendedor === true ||
        normalizarCargo(admin) ===
          "vendedor",

      comissao:
        Number(
          admin.comissao ||
          20
        )
    };
  }

  /* =========================================================
     DASHBOARD
  ========================================================= */

  function renderDashboard() {
    const dados =
      state.dados.dashboard ||
      {};

    const resumo =
      dados.resumo ||
      dados.dashboard ||
      dados;

    setText(
      "adminTotalUsuarios",

      valorProfundo(
        resumo,
        [
          "totalUsuarios",
          "usuarios",
          "total"
        ],
        0
      )
    );

    setText(
      "adminTotalPremium",

      valorProfundo(
        resumo,
        [
          "premium",
          "usuariosPremium",
          "totalPremium"
        ],
        0
      )
    );

    setText(
      "adminTotalFree",

      valorProfundo(
        resumo,
        [
          "free",
          "usuariosFree",
          "totalFree"
        ],
        0
      )
    );

    setText(
      "adminTotalVendas",

      moeda(
        valorProfundo(
          resumo,
          [
            "totalVendido",
            "vendasMes",
            "faturamento"
          ],
          0
        )
      )
    );

    const topNome =
      valorProfundo(
        resumo,
        [
          "topVendedorNome",
          "melhorVendedor",
          "topVendedor"
        ],
        "-"
      );

    setText(
      "adminTopVendedor",

      typeof topNome === "object"
        ? (
          topNome.nome ||
          topNome.email ||
          "-"
        )
        : topNome
    );

    setText(
      "adminMetaMensal",

      `${
        Number(
          valorProfundo(
            resumo,
            [
              "percentualMeta",
              "metaPercentual",
              "meta"
            ],
            0
          )
        ) || 0
      }%`
    );

    const recentes =
      arrayProfundo(
        dados,
        [
          "ultimosCadastros",
          "usuariosRecentes",
          "ultimosUsuarios"
        ]
      );

    const ranking =
      arrayProfundo(
        dados,
        [
          "ranking",
          "rankingVendedores",
          "vendedores"
        ]
      );

    const agenda =
      arrayProfundo(
        dados,
        [
          "agenda",
          "proximosEventos",
          "eventos"
        ]
      );

    const historico =
      arrayProfundo(
        dados,
        [
          "historico",
          "atividades",
          "atividadeRecente"
        ]
      );

    const alertas =
      arrayProfundo(
        dados,
        [
          "alertas",
          "avisos"
        ]
      );

    renderListaSimples(
      "adminUltimosCadastros",
      recentes,

      (item) => `
        <div class="admin-list-item">

          <span>
            ${escapeHTML(
              iniciais(
                item.nome ||
                item.email
              )
            )}
          </span>

          <div>
            <strong>
              ${escapeHTML(
                item.nome ||
                "Usuário"
              )}
            </strong>

            <p>
              ${escapeHTML(
                item.email ||
                ""
              )}
            </p>

            <small>
              ${escapeHTML(
                formatarData(
                  item.createdAt ||
                  item.criadoEm ||
                  item.dataCadastro
                )
              )}
            </small>
          </div>

          ${statusPill(
            item.status ||
            "ativo",

            item.status ||
            "Ativo"
          )}

        </div>
      `
    );

    renderListaSimples(
      "rankingVendedoresAdmin",
      ranking,

      (item, indice) => `
        <div class="admin-list-item">

          <span>
            ${indice + 1}
          </span>

          <div>
            <strong>
              ${escapeHTML(
                item.nome ||
                item.vendedorNome ||
                "Vendedor"
              )}
            </strong>

            <p>
              ${escapeHTML(
                item.email ||
                item.vendedorEmail ||
                ""
              )}
            </p>

            <small>
              ${
                Number(
                  item.vendas ||
                  item.totalVendas ||
                  0
                )
              } vendas
              •
              ${moeda(
                item.totalVendido ||
                item.valorTotal ||
                0
              )}
            </small>
          </div>

        </div>
      `
    );

    renderListaSimples(
      "dashboardAgenda",
      agenda,

      (item) => `
        <div class="admin-list-item">

          <span>AG</span>

          <div>
            <strong>
              ${escapeHTML(
                item.titulo ||
                "Evento"
              )}
            </strong>

            <p>
              ${escapeHTML(
                item.descricao ||
                "Sem descrição"
              )}
            </p>

            <small>
              ${escapeHTML(
                item.dataInicio ||
                item.data ||
                ""
              )}

              ${escapeHTML(
                item.horaInicio ||
                item.hora ||
                ""
              )}
            </small>
          </div>

          ${statusPill(
            item.status ||
            "Agendar",

            item.status ||
            "Agendar"
          )}

        </div>
      `
    );

    renderListaSimples(
      "adminHistoricoSistema",
      historico,

      (item) => `
        <div class="admin-history-item">

          <strong>
            ${escapeHTML(
              item.titulo ||
              item.acao ||
              item.tipo ||
              "Atividade"
            )}
          </strong>

          <p>
            ${escapeHTML(
              item.mensagem ||
              item.descricao ||
              item.texto ||
              ""
            )}
          </p>

          <small>
            ${escapeHTML(
              formatarData(
                item.createdAt ||
                item.criadoEm ||
                item.data
              )
            )}
          </small>

        </div>
      `
    );

    const boxAlertas =
      $("adminAlertasSeguranca");

    if (boxAlertas) {
      if (alertas.length) {
        boxAlertas.innerHTML =
          alertas.map((item) => `
            <div class="admin-list-item">

              <span>!</span>

              <div>
                <strong>
                  ${escapeHTML(
                    item.titulo ||
                    "Alerta"
                  )}
                </strong>

                <p>
                  ${escapeHTML(
                    item.mensagem ||
                    item.descricao ||
                    ""
                  )}
                </p>
              </div>

            </div>
          `).join("");
      } else {
        boxAlertas.innerHTML = `
          <div class="admin-list-item">

            <span>✓</span>

            <div>
              <strong>
                Sistema normal
              </strong>

              <p>
                Nenhum alerta importante no momento.
              </p>
            </div>

          </div>
        `;
      }
    }

    renderGrafico(recentes);
  }

  function renderListaSimples(
    id,
    lista,
    render
  ) {
    const box = $(id);

    if (!box) {
      return;
    }

    box.innerHTML =
      lista.length
        ? lista
            .slice(0, 8)
            .map(render)
            .join("")
        : vazio(
            "Nenhum dado disponível."
          );
  }

  function renderGrafico(
    usuarios = []
  ) {
    const box =
      $("graficoCrescimento");

    if (!box) {
      return;
    }

    const meses =
      Array.from(
        { length: 7 },

        (_, indice) => {
          const data =
            new Date();

          data.setMonth(
            data.getMonth() -
            (6 - indice)
          );

          return {
            ano:
              data.getFullYear(),

            mes:
              data.getMonth(),

            total: 0
          };
        }
      );

    usuarios.forEach(
      (usuario) => {
        const data =
          new Date(
            usuario.createdAt ||
            usuario.criadoEm ||
            usuario.dataCadastro ||
            ""
          );

        const item =
          meses.find((mes) => {
            return (
              mes.ano ===
                data.getFullYear() &&
              mes.mes ===
                data.getMonth()
            );
          });

        if (item) {
          item.total += 1;
        }
      }
    );

    const maior =
      Math.max(
        ...meses.map(
          (mes) => mes.total
        ),
        1
      );

    box.innerHTML =
      meses.map((mes) => {
        const altura =
          Math.max(
            12,

            Math.round(
              (
                mes.total /
                maior
              ) * 94
            )
          );

        return `
          <div
            title="${mes.total} cadastro(s)"
            style="height:${altura}%"
          >
            <span>
              ${mes.total}
            </span>
          </div>
        `;
      }).join("");
  }

  /* =========================================================
     USUÁRIOS
  ========================================================= */

  function renderUsuarios() {
    const busca = `
      ${value("buscaUsuariosAdmin")}
      ${value("adminPesquisaGlobal")}
    `
      .trim()
      .toLowerCase();

    const filtro =
      value("filtroStatusAdmin") ||
      "todos";

    const lista =
      state.dados.usuarios
        .filter((usuario) => {
          const texto = `
            ${usuario.nome}
            ${usuario.email}
            ${usuario.codigo}
            ${usuario.plano}
            ${usuario.cargo}
          `.toLowerCase();

          return (
            texto.includes(busca) &&
            (
              filtro === "todos" ||
              usuario.status === filtro
            )
          );
        });

    setText(
      "usuariosTotal",
      state.dados.usuarios.length
    );

    setText(
      "usuariosAtivos",

      state.dados.usuarios
        .filter((usuario) => {
          return (
            usuario.status ===
            "ativo"
          );
        }).length
    );

    setText(
      "usuariosSuspensos",

      state.dados.usuarios
        .filter((usuario) => {
          return (
            usuario.status ===
            "suspenso"
          );
        }).length
    );

    setText(
      "usuariosBloqueados",

      state.dados.usuarios
        .filter((usuario) => {
          return (
            usuario.status ===
            "bloqueado"
          );
        }).length
    );

    const box =
      $("listaUsuariosAdmin");

    if (box) {
      box.innerHTML =
        lista.length
          ? lista
              .map(cardUsuario)
              .join("")
          : vazio(
              "Nenhum usuário encontrado."
            );
    }
  }

  function renderAprovacoes() {
    const lista =
      state.dados.usuarios
        .filter((usuario) => {
          return (
            usuario.codigo ||
            usuario.status ===
              "pendente"
          );
        });

    setText(
      "resumoPendentes",
      lista.length
    );

    setText(
      "resumoAprovados",

      state.dados.usuarios
        .filter((usuario) => {
          return (
            usuario.status ===
            "ativo"
          );
        }).length
    );

    const box =
      $("listaPendentesAdmin");

    if (box) {
      box.innerHTML =
        lista.length
          ? lista
              .map(cardUsuario)
              .join("")
          : vazio(
              "Nenhuma ativação premium pendente."
            );
    }
  }

  function cardUsuario(usuario) {
    const administrativo = [
      "superadmin",
      "super-admin",
      "admin",
      "moderador",
      "suporte",
      "vendedor"
    ].includes(usuario.cargo);

    const acoesUsuario = [];

    if (administrativo) {
      acoesUsuario.push(`
        <small>
          Conta administrativa protegida
        </small>
      `);
    } else {
      if (
        usuario.codigo &&
        temPermissao("aprovacoes")
      ) {
        acoesUsuario.push(`
          <button
            type="button"
            class="btn-admin-ok"
            data-action="user-approve"
            data-code="${escapeHTML(usuario.codigo)}"
          >
            Aprovar código
          </button>
        `);
      }

      if (
        podeGerenciarUsuarios() &&
        temPermissao("planos")
      ) {
        acoesUsuario.push(`
          <button
            type="button"
            class="btn-admin-free"
            data-action="user-plan"
            data-email="${escapeHTML(usuario.email)}"
            data-plan="free"
          >
            Free
          </button>

          <button
            type="button"
            class="btn-admin-ok"
            data-action="user-plan"
            data-email="${escapeHTML(usuario.email)}"
            data-plan="black30"
          >
            Black 30
          </button>

          <button
            type="button"
            class="btn-admin-ok"
            data-action="user-plan"
            data-email="${escapeHTML(usuario.email)}"
            data-plan="black90"
          >
            Black 90
          </button>
        `);
      }

      if (
        podeGerenciarUsuarios() &&
        temPermissao("usuarios")
      ) {
        acoesUsuario.push(`
          <button
            type="button"
            class="btn-admin-warn"
            data-action="user-suspend"
            data-email="${escapeHTML(usuario.email)}"
          >
            Suspender
          </button>

          <button
            type="button"
            class="btn-admin-ok"
            data-action="user-reactivate"
            data-email="${escapeHTML(usuario.email)}"
          >
            Reativar
          </button>
        `);
      }

      if (ehSuperAdmin()) {
        acoesUsuario.push(`
          <button
            type="button"
            class="btn-admin-danger"
            data-action="user-delete"
            data-id="${escapeHTML(usuario.id)}"
          >
            Excluir
          </button>
        `);
      }

      if (!acoesUsuario.length) {
        acoesUsuario.push(`
          <small>
            Acesso limitado à aprovação de códigos
          </small>
        `);
      }
    }

    return `
      <article class="admin-user-card admin-user-row">

        <div class="admin-user-main">

          <div class="admin-avatar">
            ${escapeHTML(
              iniciais(usuario.nome)
            )}
          </div>

          <div class="admin-user-info">

            <strong>
              ${escapeHTML(usuario.nome)}
            </strong>

            <span>
              ${escapeHTML(usuario.email)}
            </span>

            <small>
              Cargo:
              ${escapeHTML(usuario.cargo)}
            </small>

            <small>
              Plano:
              ${escapeHTML(
                textoPlano(usuario.plano)
              )}
            </small>

            <small>
              Código:
              ${escapeHTML(
                usuario.codigo ||
                "Sem código"
              )}
            </small>

            <small>
              Vencimento:
              ${escapeHTML(
                usuario.dataExpiracao
                  ? formatarData(
                    usuario.dataExpiracao,
                    true
                  )
                  : "Sem vencimento"
              )}
            </small>

          </div>

        </div>

        <div class="admin-user-side">

          ${statusPill(
            usuario.status,
            usuario.status
          )}

          <div class="admin-user-actions">

            ${acoesUsuario.join("")}

          </div>

        </div>

      </article>
    `;
  }

  /* =========================================================
     CONTROLE DE ALUNOS
  ========================================================= */

  function renderAlunos() {
    const busca =
      value("buscaControleAlunos")
        .toLowerCase()
        .trim();

    const filtro =
      value("filtroControleStatus") ||
      "todos";

    const lista =
      state.dados.alunos
        .filter((aluno) => {
          const texto = `
            ${aluno.nome}
            ${aluno.email}
            ${aluno.telefone}
          `.toLowerCase();

          return (
            texto.includes(busca) &&
            (
              filtro === "todos" ||
              className(aluno.status) ===
                filtro
            )
          );
        });

    setText(
      "controleAlunosTotal",
      state.dados.alunos.length
    );

    setText(
      "controleAlunosAtivos",

      state.dados.alunos
        .filter((aluno) => {
          return (
            className(aluno.status) ===
            "ativo"
          );
        }).length
    );

    setText(
      "controleAlunosVencendo",

      state.dados.alunos
        .filter((aluno) => {
          return (
            className(aluno.status) ===
            "vencendo"
          );
        }).length
    );

    setText(
      "controleAlunosVencidos",

      state.dados.alunos
        .filter((aluno) => {
          return (
            className(aluno.status) ===
            "vencido"
          );
        }).length
    );

    const box =
      $("listaControleAlunos");

    if (!box) {
      return;
    }

    box.innerHTML =
      lista.length
        ? lista.map((aluno) => `
          <article class="admin-user-card admin-user-row">

            <div class="admin-user-main">

              <div class="admin-avatar">
                ${escapeHTML(
                  iniciais(aluno.nome)
                )}
              </div>

              <div class="admin-user-info">

                <strong>
                  ${escapeHTML(aluno.nome)}
                </strong>

                <span>
                  ${escapeHTML(
                    aluno.email ||
                    aluno.telefone ||
                    "Sem contato"
                  )}
                </span>

                <small>
                  Plano:
                  ${escapeHTML(
                    textoPlano(aluno.plano)
                  )}
                </small>

                <small>
                  Valor:
                  ${moeda(aluno.valor)}
                </small>

                <small>
                  Vencimento:
                  ${escapeHTML(
                    aluno.vencimento
                      ? formatarData(
                        aluno.vencimento,
                        true
                      )
                      : "Sem vencimento"
                  )}
                </small>

              </div>

            </div>

            <div class="admin-user-side">

              ${statusPill(
                aluno.status,
                aluno.status
              )}

              <div class="admin-user-actions">

                <button
                  type="button"
                  class="btn-admin-ok"
                  data-action="student-edit"
                  data-id="${escapeHTML(aluno.id)}"
                >
                  Editar
                </button>

                <button
                  type="button"
                  class="btn-admin-ok"
                  data-action="student-renew"
                  data-id="${escapeHTML(aluno.id)}"
                >
                  +30 dias
                </button>

                <button
                  type="button"
                  class="btn-admin-danger"
                  data-action="student-delete"
                  data-id="${escapeHTML(aluno.id)}"
                >
                  Excluir
                </button>

              </div>

            </div>

          </article>
        `).join("")
        : vazio(
          "Nenhum aluno encontrado."
        );
  }

  /* =========================================================
     VENDEDORES
  ========================================================= */

  function renderVendedores() {
    const busca =
      value("buscaVendedoresAdmin")
        .toLowerCase()
        .trim();

    const base =
      state.dados.ranking.length
        ? state.dados.ranking
        : state.dados.vendedores;

    const lista =
      base.filter((vendedor) => {
        const texto = `
          ${vendedor.nome}
          ${vendedor.email}
        `.toLowerCase();

        return texto.includes(busca);
      });

    const total =
      Number(
        valorProfundo(
          state.dados.vendasResumo,
          [
            "totalVendido",
            "valorTotal",
            "total"
          ],
          0
        )
      );

    const top =
      [...lista].sort((a, b) => {
        return (
          b.totalVendido -
          a.totalVendido
        );
      })[0];

    setText(
      "relatorioTotalVendido",
      moeda(total)
    );

    setText(
      "relatorioTotalAlunos",

      valorProfundo(
        state.dados.vendasResumo,
        [
          "totalVendas",
          "vendas",
          "quantidade"
        ],
        0
      )
    );

    setText(
      "relatorioTopVendedor",
      top?.nome ||
      "-"
    );

    setText(
      "relatorioMeta",

      `${
        Number(
          valorProfundo(
            state.dados.vendasResumo,
            [
              "percentualMeta",
              "metaPercentual"
            ],
            0
          )
        ) || 0
      }%`
    );

    const box =
      $("listaVendedoresAdmin");

    if (!box) {
      return;
    }

    box.innerHTML =
      lista.length
        ? lista.map(
          (vendedor, indice) => `
            <article class="admin-user-card admin-user-row">

              <div class="admin-user-main">

                <div class="admin-avatar">
                  ${indice + 1}
                </div>

                <div class="admin-user-info">

                  <strong>
                    ${escapeHTML(vendedor.nome)}
                  </strong>

                  <span>
                    ${escapeHTML(vendedor.email)}
                  </span>

                  <small>
                    ${vendedor.vendas}
                    venda(s)
                  </small>

                </div>

              </div>

              <div class="admin-mini-metrics">

                <div>
                  <strong>
                    ${moeda(vendedor.totalVendido)}
                  </strong>

                  <small>
                    Vendido
                  </small>
                </div>

                <div>
                  <strong>
                    ${moeda(vendedor.comissao)}
                  </strong>

                  <small>
                    Comissão
                  </small>
                </div>

              </div>

            </article>
          `
        ).join("")
        : vazio(
          "Nenhum vendedor encontrado."
        );
  }

  /* =========================================================
     RELATÓRIOS
  ========================================================= */

  function vendasFiltradas() {
    const periodo =
      value("filtroPeriodoRelatorio") ||
      "mes";

    const hoje =
      new Date();

    return state.dados.vendas
      .filter((venda) => {
        if (periodo === "todos") {
          return true;
        }

        const data =
          new Date(venda.criadoEm);

        if (
          Number.isNaN(
            data.getTime()
          )
        ) {
          return false;
        }

        if (periodo === "hoje") {
          return (
            data.toDateString() ===
            hoje.toDateString()
          );
        }

        if (periodo === "semana") {
          return (
            hoje - data <=
            7 * 86400000
          );
        }

        return (
          data.getMonth() ===
            hoje.getMonth() &&
          data.getFullYear() ===
            hoje.getFullYear()
        );
      });
  }

  function renderRelatorios() {
    const lista =
      vendasFiltradas();

    const total =
      lista.reduce(
        (soma, venda) => {
          return (
            soma +
            venda.valor
          );
        },
        0
      );

    const comissoes =
      lista.reduce(
        (soma, venda) => {
          return (
            soma +
            venda.comissao
          );
        },
        0
      );

    setText(
      "relatorioFinanceiroTotal",
      moeda(total)
    );

    setText(
      "relatorioComissoes",
      moeda(comissoes)
    );

    setText(
      "relatorioVendasPagas",

      lista.filter((venda) => {
        return (
          venda.status ===
          "pago"
        );
      }).length
    );

    setText(
      "relatorioTicketMedio",

      moeda(
        lista.length
          ? total / lista.length
          : 0
      )
    );

    const box =
      $("listaRelatorioVendas");

    if (!box) {
      return;
    }

    box.innerHTML =
      lista.length
        ? lista.map((venda) => `
          <article class="admin-user-card admin-user-row">

            <div class="admin-user-main">

              <div class="admin-avatar">
                R$
              </div>

              <div class="admin-user-info">

                <strong>
                  ${escapeHTML(venda.alunoNome)}
                  —
                  ${moeda(venda.valor)}
                </strong>

                <span>
                  ${escapeHTML(
                    textoPlano(venda.plano)
                  )}
                </span>

                <small>
                  Vendedor:
                  ${escapeHTML(
                    venda.vendedorNome ||
                    venda.vendedorEmail ||
                    "Sem vendedor"
                  )}
                </small>

                <small>
                  ${escapeHTML(
                    formatarData(venda.criadoEm)
                  )}
                </small>

              </div>

            </div>

            ${statusPill(
              venda.status,
              venda.status
            )}

          </article>
        `).join("")
        : vazio(
          "Nenhuma venda neste período."
        );
  }

  /* =========================================================
     AGENDA
  ========================================================= */

  function renderAgenda() {
    const lista =
      state.dados.agenda;

    setText(
      "agendaTotal",
      lista.length
    );

    setText(
      "agendaAgendados",

      lista.filter((agenda) => {
        return (
          className(agenda.status) ===
          "agendado"
        );
      }).length
    );

    setText(
      "agendaConcluidos",

      lista.filter((agenda) => {
        return (
          className(agenda.status) ===
          "concluido"
        );
      }).length
    );

    setText(
      "agendaCancelados",

      lista.filter((agenda) => {
        return (
          className(agenda.status) ===
          "cancelado"
        );
      }).length
    );

    const box =
      $("listaAgendaPrimo");

    if (!box) {
      return;
    }

    box.innerHTML =
      lista.length
        ? lista.map((agenda) => `
          <article class="admin-user-card admin-user-row">

            <div class="admin-user-main">

              <div class="admin-avatar">
                AG
              </div>

              <div class="admin-user-info">

                <strong>
                  ${escapeHTML(agenda.titulo)}
                </strong>

                <span>
                  ${escapeHTML(
                    agenda.descricao ||
                    "Sem descrição"
                  )}
                </span>

                <small>
                  ${escapeHTML(agenda.dataInicio)}
                  ${escapeHTML(agenda.horaInicio)}

                  ${
                    agenda.local
                      ? ` • ${escapeHTML(agenda.local)}`
                      : ""
                  }
                </small>

              </div>

            </div>

            <div class="admin-user-side">

              ${statusPill(
                agenda.status,
                agenda.status
              )}

              <div class="admin-user-actions">

                <button
                  type="button"
                  class="btn-admin-ok"
                  data-action="agenda-edit"
                  data-id="${escapeHTML(agenda.id)}"
                >
                  Editar
                </button>

                <button
                  type="button"
                  class="btn-admin-danger"
                  data-action="agenda-delete"
                  data-id="${escapeHTML(agenda.id)}"
                >
                  Excluir
                </button>

              </div>

            </div>

          </article>
        `).join("")
        : vazio(
          "Nenhum evento cadastrado."
        );
  }

  /* =========================================================
     NOTIFICAÇÕES
  ========================================================= */

  function renderNotificacoes() {
    const lista =
      [...state.dados.notificacoes]
        .sort((a, b) => {
          return (
            Number(b.fixada) -
              Number(a.fixada) ||
            new Date(b.criadaEm) -
              new Date(a.criadaEm)
          );
        });

    setText(
      "notificacoesTotal",
      lista.length
    );

    setText(
      "notificacoesAtivas",

      lista.filter((item) => {
        return item.ativa;
      }).length
    );

    setText(
      "notificacoesFixadas",

      lista.filter((item) => {
        return item.fixada;
      }).length
    );

    setText(
      "notificacoesUrgentes",

      lista.filter((item) => {
        return (
          item.prioridade ===
          "urgente"
        );
      }).length
    );

    setText(
      "adminNotificacaoBadge",

      lista.filter((item) => {
        return item.ativa;
      }).length
    );

    const box =
      $("listaNotificacoesAdmin");

    if (!box) {
      return;
    }

    box.innerHTML =
      lista.length
        ? lista.map((notificacao) => `
          <article
            class="
              admin-history-item
              notification-card
              ${notificacao.fixada ? "fixada" : ""}
              ${notificacao.ativa ? "" : "inativa"}
            "
          >

            <strong>
              ${notificacao.fixada ? "📌 " : ""}
              ${escapeHTML(notificacao.titulo)}
            </strong>

            <p>
              ${escapeHTML(notificacao.mensagem)}
            </p>

            <small>
              ${escapeHTML(notificacao.tipo)}
              •
              ${escapeHTML(notificacao.destino)}
              •
              ${escapeHTML(notificacao.prioridade)}
              •
              ${notificacao.ativa ? "Ativa" : "Inativa"}
            </small>

            <div class="admin-user-actions notification-actions">

              <button
                type="button"
                class="btn-admin-ok"
                data-action="notif-${notificacao.fixada ? "unfix" : "fix"}"
                data-id="${escapeHTML(notificacao.id)}"
              >
                ${notificacao.fixada ? "Desfixar" : "Fixar"}
              </button>

              ${
                notificacao.ativa
                  ? `
                    <button
                      type="button"
                      class="btn-admin-warn"
                      data-action="notif-disable"
                      data-id="${escapeHTML(notificacao.id)}"
                    >
                      Desativar
                    </button>
                  `
                  : ""
              }

              <button
                type="button"
                class="btn-admin-ok"
                data-action="notif-resend"
                data-id="${escapeHTML(notificacao.id)}"
              >
                Reenviar
              </button>

              <button
                type="button"
                class="btn-admin-danger"
                data-action="notif-delete"
                data-id="${escapeHTML(notificacao.id)}"
              >
                Excluir
              </button>

            </div>

          </article>
        `).join("")
        : vazio(
          "Nenhuma notificação enviada."
        );
  }

  /* =========================================================
     SUPORTE
  ========================================================= */

  function renderSuporte() {
    const filtro =
      value("filtroSuporteStatus") ||
      "todos";

    const lista =
      state.dados.suporte
        .filter((chamado) => {
          return (
            filtro === "todos" ||
            chamado.status === filtro
          );
        });

    setText(
      "suporteAbertos",

      state.dados.suporte
        .filter((chamado) => {
          return (
            chamado.status ===
            "aberto"
          );
        }).length
    );

    setText(
      "suporteAtendimento",

      state.dados.suporte
        .filter((chamado) => {
          return (
            chamado.status ===
            "em_atendimento"
          );
        }).length
    );

    setText(
      "suporteResolvidos",

      state.dados.suporte
        .filter((chamado) => {
          return (
            chamado.status ===
            "resolvido"
          );
        }).length
    );

    setText(
      "suporteUrgentes",

      state.dados.suporte
        .filter((chamado) => {
          return (
            chamado.prioridade ===
            "urgente"
          );
        }).length
    );

    const box =
      $("listaSuporteAdmin");

    if (!box) {
      return;
    }

    box.innerHTML =
      lista.length
        ? lista.map((chamado) => `
          <article class="admin-user-card admin-user-row">

            <div class="admin-user-main">

              <div class="admin-avatar">
                🎧
              </div>

              <div class="admin-user-info">

                <strong>
                  ${escapeHTML(chamado.assunto)}
                </strong>

                <span>
                  ${escapeHTML(chamado.nome)}
                  —
                  ${escapeHTML(chamado.email)}
                </span>

                <small>
                  ${escapeHTML(chamado.mensagem)}
                </small>

                <small>
                  ${escapeHTML(
                    formatarData(chamado.criadoEm)
                  )}
                </small>

              </div>

            </div>

            <div class="admin-user-side">

              ${statusPill(
                chamado.status,
                chamado.status
              )}

              ${statusPill(
                chamado.prioridade,
                chamado.prioridade
              )}

              <button
                type="button"
                class="btn-admin-ok"
                data-action="support-reply"
                data-id="${escapeHTML(chamado.id)}"
              >
                Responder
              </button>

            </div>

          </article>
        `).join("")
        : vazio(
          "Nenhum chamado encontrado."
        );
  }

  /* =========================================================
     PROVAS
  ========================================================= */

  function renderProvas() {
    const lista =
      state.dados.resultados;

    const notas =
      lista.map(
        (resultado) =>
          resultado.nota
      );

    setText(
      "totalProvasFeitas",
      lista.length
    );

    setText(
      "mediaGeralProvas",

      `${
        notas.length
          ? Math.round(
            notas.reduce(
              (a, b) => a + b,
              0
            ) /
            notas.length
          )
          : 0
      }%`
    );

    setText(
      "melhorNotaProvas",

      `${
        notas.length
          ? Math.max(...notas)
          : 0
      }%`
    );

    const box =
      $("listaProvasAdmin");

    if (!box) {
      return;
    }

    box.innerHTML =
      lista.length
        ? lista.map((resultado) => `
          <article class="admin-user-card admin-user-row">

            <div class="admin-user-info">

              <strong>
                ${escapeHTML(resultado.nome)}
              </strong>

              <span>
                ${escapeHTML(resultado.email)}
              </span>

              <small>
                Prova:
                ${escapeHTML(resultado.prova)}
              </small>

              <small>
                Nota:
                ${resultado.nota}%
              </small>

            </div>

            ${statusPill(
              resultado.status,
              resultado.status
            )}

          </article>
        `).join("")
        : vazio(
          "Nenhum resultado encontrado."
        );
  }

  /* =========================================================
     CONTROLE ADMIN
  ========================================================= */

  function renderAdmins() {
    const lista =
      state.dados.admins;

    setText(
      "superAdminsAtivos",

      lista.filter((admin) => {
        return [
          "superadmin",
          "super-admin"
        ].includes(admin.cargo);
      }).length
    );

    setText(
      "adminsAtivos",

      lista.filter((admin) => {
        return (
          admin.cargo ===
          "admin"
        );
      }).length
    );

    setText(
      "moderadoresAtivos",

      lista.filter((admin) => {
        return (
          admin.cargo ===
          "moderador"
        );
      }).length
    );

    setText(
      "suportesAtivos",

      lista.filter((admin) => {
        return (
          admin.cargo ===
          "suporte"
        );
      }).length
    );

    const box =
      $("listaAdminsSistema");

    if (!box) {
      return;
    }

    box.innerHTML =
      lista.length
        ? lista.map((admin) => `
          <article class="admin-user-card admin-user-row">

            <div class="admin-user-main">

              <div class="admin-avatar">
                ${escapeHTML(
                  iniciais(admin.nome)
                )}
              </div>

              <div class="admin-user-info">

                <strong>
                  ${escapeHTML(admin.nome)}
                </strong>

                <span>
                  ${escapeHTML(admin.email)}
                </span>

                <small>
                  Cargo:
                  ${escapeHTML(admin.cargo)}
                </small>

                <small>
                  Vendedor:
                  ${admin.vendedor ? "Sim" : "Não"}
                  •
                  Comissão:
                  ${admin.comissao}%
                </small>

              </div>

            </div>

            <div class="admin-user-side">

              ${statusPill(
                admin.status,
                admin.status
              )}

              ${
                admin.email !==
                state.usuario?.email
                  ? `
                    <div class="admin-user-actions">

                      <button
                        type="button"
                        class="btn-admin-warn"
                        data-action="admin-toggle"
                        data-id="${escapeHTML(admin.id)}"
                        data-status="${escapeHTML(admin.status)}"
                      >
                        ${admin.status === "ativo" ? "Desativar" : "Ativar"}
                      </button>

                      <button
                        type="button"
                        class="btn-admin-danger"
                        data-action="admin-delete"
                        data-id="${escapeHTML(admin.id)}"
                      >
                        Remover
                      </button>

                    </div>
                  `
                  : `
                    <small>
                      Sua conta
                    </small>
                  `
              }

            </div>

          </article>
        `).join("")
        : vazio(
          "Nenhum administrador encontrado."
        );
  }

  /* =========================================================
     CONFIGURAÇÕES
  ========================================================= */

  function renderConfiguracao() {
    const configuracao =
      state.dados.configuracao ||
      {};

    const seguranca =
      configuracao.seguranca ||
      {};

    const planos =
      configuracao.planos ||
      {};

    setValue(
      "limiteDispositivos",
      seguranca.limiteDispositivos ??
      1
    );

    setValue(
      "modoSegurancaConteudo",
      seguranca.modoSegurancaConteudo ??
      "ativo"
    );

    setValue(
      "bloquearPendente",
      seguranca.bloquearPendente ??
      "sim"
    );

    setValue(
      "planoFreeValor",
      planos.free?.valor ??
      0
    );

    setValue(
      "planoBlack30Valor",
      planos.black30?.valor ??
      ""
    );

    setValue(
      "planoBlack90Valor",
      planos.black90?.valor ??
      ""
    );

    setValue(
      "planoBlack180Valor",
      planos.black180?.valor ??
      ""
    );

    setValue(
      "planoBlack360Valor",
      planos.black360?.valor ??
      ""
    );

    setValue(
      "comissaoPadrao",
      configuracao.comissaoPadrao ??
      20
    );

    const box =
      $("listaDispositivosAdmin");

    if (box) {
      box.innerHTML = `
        <div class="admin-history-item">

          <strong>
            Proteção por cargo
          </strong>

          <p>
            Administradores podem ser isentos dos bloqueios de conteúdo.
          </p>

          <small>
            Modo atual:
            ${escapeHTML(
              seguranca.modoSegurancaConteudo ||
              "ativo"
            )}
          </small>

        </div>

        <div class="admin-history-item">

          <strong>
            Limite de dispositivos
          </strong>

          <p>
            ${Number(
              seguranca.limiteDispositivos ||
              1
            )}
            dispositivo(s) por conta.
          </p>

        </div>
      `;
    }
  }

  /* =========================================================
     AÇÕES DE USUÁRIO
  ========================================================= */

  async function aprovarCodigo(
    codigo =
      value("codigoAprovacaoAdmin"),

    plano =
      value("planoAprovacaoAdmin") ||
      "black30"
  ) {
    if (
      !String(codigo).trim()
    ) {
      throw new Error(
        "Informe o código premium."
      );
    }

    await api(
      "/aprovar",
      {
        method: "POST",

        body: {
          codigo:
            String(codigo).trim(),

          plano
        }
      }
    );

    setValue(
      "codigoAprovacaoAdmin",
      ""
    );

    state.carregadoEm.usuarios = 0;

    await carregarUsuarios(true);

    renderAprovacoes();

    mensagem(
      "Código aprovado com sucesso."
    );
  }

  async function alterarPlano(
    email,
    plano
  ) {
    await api(
      "/usuario/plano",
      {
        method: "POST",

        body: {
          email,
          plano,
          aprovado: true,
          suspenso: false,
          status: "ativo",

          dataExpiracao:
            expiracaoPlano(plano)
        }
      }
    );

    await carregarUsuarios(true);

    renderAba(state.aba);

    mensagem(
      "Plano atualizado."
    );
  }

  async function acaoUsuario(
    endpoint,
    email,
    sucesso
  ) {
    await api(
      endpoint,
      {
        method: "POST",
        body: { email }
      }
    );

    await carregarUsuarios(true);

    renderAba(state.aba);

    mensagem(sucesso);
  }

  async function excluirUsuario(id) {
    await api(
      `/usuario/${encodeURIComponent(id)}`,
      {
        method: "DELETE"
      }
    );

    await carregarUsuarios(true);

    renderAba(state.aba);

    mensagem(
      "Usuário excluído."
    );
  }

  /* =========================================================
     AÇÕES DE ALUNOS
  ========================================================= */

  function abrirAluno(id = null) {
    state.editandoAluno = id;

    const aluno =
      state.dados.alunos
        .find((item) => {
          return (
            String(item.id) ===
            String(id)
          );
        });

    setText(
      "tituloModalAlunoControle",
      aluno
        ? "Editar aluno"
        : "Novo aluno"
    );

    setValue(
      "alunoControleId",
      aluno?.id ||
      ""
    );

    setValue(
      "alunoControleNome",
      aluno?.nome ||
      ""
    );

    setValue(
      "alunoControleEmail",
      aluno?.email ||
      ""
    );

    setValue(
      "alunoControleTelefone",
      aluno?.telefone ||
      ""
    );

    setValue(
      "alunoControlePlano",
      aluno?.plano ||
      "black30"
    );

    setValue(
      "alunoControleValor",
      aluno?.valor ||
      ""
    );

    setValue(
      "alunoControlePagamento",
      aluno?.pagamento ||
      "PIX"
    );

    setValue(
      "alunoControleStatusPagamento",
      aluno?.statusPagamento ||
      "pago"
    );

    setValue(
      "alunoControleVencimento",

      aluno?.vencimento
        ? String(
          aluno.vencimento
        ).slice(0, 10)
        : ""
    );

    setValue(
      "alunoControleObservacoes",
      aluno?.observacoes ||
      ""
    );

    abrirModal(
      "modalAlunoControle"
    );
  }

  async function salvarAluno() {
    const id =
      state.editandoAluno;

    const body = {
      nome:
        value(
          "alunoControleNome"
        ).trim(),

      email:
        value(
          "alunoControleEmail"
        )
          .trim()
          .toLowerCase(),

      telefone:
        value(
          "alunoControleTelefone"
        ).trim(),

      plano:
        value(
          "alunoControlePlano"
        ),

      valor:
        Number(
          value(
            "alunoControleValor"
          ) || 0
        ),

      formaPagamento:
        value(
          "alunoControlePagamento"
        ),

      statusPagamento:
        value(
          "alunoControleStatusPagamento"
        ),

      vencimento:
        value(
          "alunoControleVencimento"
        ),

      observacoes:
        value(
          "alunoControleObservacoes"
        ).trim()
    };

    if (!body.nome) {
      throw new Error(
        "Informe o nome do aluno."
      );
    }

    await api(
      id
        ? `/admin/controle-alunos/${encodeURIComponent(id)}`
        : "/admin/controle-alunos",

      {
        method:
          id
            ? "PUT"
            : "POST",

        body
      }
    );

    fecharModal(
      "modalAlunoControle"
    );

    state.editandoAluno = null;

    await carregarAlunos(true);

    renderAlunos();

    mensagem(
      "Aluno salvo com sucesso."
    );
  }

  async function renovarAluno(id) {
    await api(
      `/admin/controle-alunos/${encodeURIComponent(id)}/renovar`,

      {
        method: "POST",

        body: {
          dias: 30,
          diasPlano: 30
        }
      }
    );

    await carregarAlunos(true);

    renderAlunos();

    mensagem(
      "Plano renovado por 30 dias."
    );
  }

  async function excluirAluno(id) {
    await api(
      `/admin/controle-alunos/${encodeURIComponent(id)}`,

      {
        method: "DELETE"
      }
    );

    await carregarAlunos(true);

    renderAlunos();

    mensagem(
      "Aluno excluído."
    );
  }

  /* =========================================================
     AÇÕES DA AGENDA
  ========================================================= */

  function abrirAgenda(id = null) {
    state.editandoAgenda = id;

    const agenda =
      state.dados.agenda
        .find((item) => {
          return (
            String(item.id) ===
            String(id)
          );
        });

    setText(
      "tituloModalAgenda",

      agenda
        ? "Editar evento"
        : "Novo evento"
    );

    setValue(
      "agendaTituloInput",
      agenda?.titulo ||
      ""
    );

    setValue(
      "agendaDataInput",

      agenda?.dataInicio
        ? String(
          agenda.dataInicio
        ).slice(0, 10)
        : new Date()
          .toISOString()
          .slice(0, 10)
    );

    setValue(
      "agendaHoraInput",
      agenda?.horaInicio ||
      "20:00"
    );

    setValue(
      "agendaHoraFinalInput",
      agenda?.horaFinal ||
      "21:00"
    );

    setValue(
      "agendaTipoInput",
      agenda?.tipo ||
      "evento"
    );

    setValue(
      "agendaStatusInput",
      agenda?.status ||
      "Agendar"
    );

    setValue(
      "agendaLinkInput",
      agenda?.link ||
      ""
    );

    setValue(
      "agendaLocalInput",
      agenda?.local ||
      ""
    );

    setValue(
      "agendaDescricaoInput",
      agenda?.descricao ||
      ""
    );

    abrirModal(
      "modalAgendaAdmin"
    );
  }

  async function salvarAgenda() {
    const id =
      state.editandoAgenda;

    const data =
      value("agendaDataInput");

    const body = {
      titulo:
        value(
          "agendaTituloInput"
        ).trim(),

      descricao:
        value(
          "agendaDescricaoInput"
        ).trim(),

      dataInicio:
        data,

      horaInicio:
        value(
          "agendaHoraInput"
        ),

      dataFinal:
        data,

      horaFinal:
        value(
          "agendaHoraFinalInput"
        ) ||
        value(
          "agendaHoraInput"
        ),

      tipo:
        value(
          "agendaTipoInput"
        ),

      status:
        value(
          "agendaStatusInput"
        ),

      link:
        value(
          "agendaLinkInput"
        ).trim(),

      local:
        value(
          "agendaLocalInput"
        ).trim()
    };

    if (
      !body.titulo ||
      !body.dataInicio ||
      !body.horaInicio
    ) {
      throw new Error(
        "Preencha título, data e hora."
      );
    }

    await api(
      id
        ? `/admin/agenda-primo/${encodeURIComponent(id)}`
        : "/admin/agenda-primo",

      {
        method:
          id
            ? "PUT"
            : "POST",

        body
      }
    );

    fecharModal(
      "modalAgendaAdmin"
    );

    state.editandoAgenda = null;

    await carregarAgenda(true);

    renderAgenda();

    mensagem(
      "Evento salvo."
    );
  }

  async function excluirAgenda(id) {
    await api(
      `/admin/agenda-primo/${encodeURIComponent(id)}`,

      {
        method: "DELETE"
      }
    );

    await carregarAgenda(true);

    renderAgenda();

    mensagem(
      "Evento excluído."
    );
  }

  /* =========================================================
     AÇÕES DE NOTIFICAÇÃO
  ========================================================= */

  async function enviarNotificacao() {
    const body = {
      titulo:
        value(
          "notificacaoTitulo"
        ).trim(),

      mensagem:
        value(
          "notificacaoMensagem"
        ).trim(),

      tipo:
        value(
          "notificacaoTipo"
        ),

      destino:
        value(
          "notificacaoDestino"
        ),

      prioridade:
        value(
          "notificacaoPrioridade"
        ),

      email:
        value(
          "notificacaoEmail"
        )
          .trim()
          .toLowerCase(),

      link:
        value(
          "notificacaoLink"
        ).trim(),

      fixada:
        $("notificacaoFixada")
          ?.checked === true
    };

    if (
      !body.titulo ||
      !body.mensagem
    ) {
      throw new Error(
        "Preencha o título e a mensagem."
      );
    }

    if (
      body.destino ===
        "especifico" &&
      !body.email
    ) {
      throw new Error(
        "Informe o e-mail do destinatário."
      );
    }

    await api(
      "/admin/notificacoes",

      {
        method: "POST",
        body
      }
    );

    $("formNotificacao")
      ?.reset();

    alternarEmailNotificacao();

    await carregarNotificacoes(true);

    renderNotificacoes();

    mensagem(
      "Notificação enviada."
    );
  }

  async function acaoNotificacao(
    id,
    acao
  ) {
    await api(
      `/admin/notificacoes/${encodeURIComponent(id)}/${acao}`,

      {
        method: "POST"
      }
    );

    await carregarNotificacoes(true);

    renderNotificacoes();

    mensagem(
      "Notificação atualizada."
    );
  }

  async function excluirNotificacao(id) {
    await api(
      `/admin/notificacoes/${encodeURIComponent(id)}`,

      {
        method: "DELETE"
      }
    );

    await carregarNotificacoes(true);

    renderNotificacoes();

    mensagem(
      "Notificação excluída."
    );
  }

  /* =========================================================
     AÇÕES DO SUPORTE
  ========================================================= */

  function abrirSuporte(id) {
    const chamado =
      state.dados.suporte
        .find((item) => {
          return (
            String(item.id) ===
            String(id)
          );
        });

    if (!chamado) {
      return;
    }

    setValue(
      "suporteChamadoId",
      chamado.id
    );

    const resumo =
      $("suporteChamadoResumo");

    if (resumo) {
      resumo.innerHTML = `
        <strong>
          ${escapeHTML(chamado.assunto)}
        </strong>

        <p>
          ${escapeHTML(chamado.mensagem)}
        </p>

        <small>
          ${escapeHTML(chamado.nome)}
          —
          ${escapeHTML(chamado.email)}
        </small>
      `;
    }

    setValue(
      "suporteNovoStatus",

      chamado.status === "aberto"
        ? "em_atendimento"
        : chamado.status
    );

    setValue(
      "suporteRespostaMensagem",
      ""
    );

    abrirModal(
      "modalSuporteAdmin"
    );
  }

  async function responderSuporte() {
    const id =
      value("suporteChamadoId");

    const resposta =
      value(
        "suporteRespostaMensagem"
      ).trim();

    const status =
      value(
        "suporteNovoStatus"
      );

    if (
      !id ||
      !resposta
    ) {
      throw new Error(
        "Digite uma resposta."
      );
    }

    await api(
      `/admin/suporte/${encodeURIComponent(id)}/responder`,

      {
        method: "POST",

        body: {
          mensagem: resposta,
          status
        }
      }
    );

    fecharModal(
      "modalSuporteAdmin"
    );

    await carregarSuporte(true);

    renderSuporte();

    mensagem(
      "Resposta enviada."
    );
  }

  /* =========================================================
     AÇÕES DE ADMIN
  ========================================================= */

  function abrirNovoAdmin(
    vendedor = false
  ) {
    state.novoVendedor =
      vendedor;

    $("formNovoAdmin")
      ?.reset();

    setText(
      "tituloModalNovoAdmin",

      vendedor
        ? "Novo vendedor"
        : "Novo administrador"
    );

    setValue(
      "novoAdminCargo",

      vendedor
        ? "vendedor"
        : "admin"
    );

    setValue(
      "novoAdminComissao",
      "20"
    );

    if (
      $("novoAdminEhVendedor")
    ) {
      $("novoAdminEhVendedor")
        .checked = vendedor;
    }

    abrirModal(
      "modalNovoAdmin"
    );
  }

  async function salvarAdmin() {
    const cargo =
      value("novoAdminCargo");

    const body = {
      nome:
        value(
          "novoAdminNome"
        ).trim(),

      email:
        value(
          "novoAdminEmail"
        )
          .trim()
          .toLowerCase(),

      telefone:
        value(
          "novoAdminTelefone"
        ).trim(),

      senha:
        value(
          "novoAdminSenha"
        ),

      cargo,

      vendedor:
        state.novoVendedor ||
        cargo === "vendedor" ||
        $("novoAdminEhVendedor")
          ?.checked === true,

      comissao:
        Number(
          value(
            "novoAdminComissao"
          ) ||
          20
        ),

      status: "ativo"
    };

    if (
      !body.nome ||
      !body.email ||
      body.senha.length < 6
    ) {
      throw new Error(
        "Preencha nome, e-mail e senha com pelo menos 6 caracteres."
      );
    }

    await api(
      "/admin/controle-admins",

      {
        method: "POST",
        body
      }
    );

    fecharModal(
      "modalNovoAdmin"
    );

    state.novoVendedor =
      false;

    await carregarAdmins(true);

    if (
      state.aba === "vendedores"
    ) {
      await carregarVendedores(true);
    }

    renderAba(state.aba);

    mensagem(
      "Administrador salvo."
    );
  }

  async function sincronizarVendedores() {
    await api(
      "/admin/vendedores/sincronizar",

      {
        method: "POST"
      }
    );

    await Promise.all([
      carregarAdmins(true),
      carregarVendedores(true)
    ]);

    renderAba(state.aba);

    mensagem(
      "Vendedores sincronizados."
    );
  }

  async function alterarStatusAdmin(
    id,
    statusAtual
  ) {
    const status =
      statusAtual === "ativo"
        ? "suspenso"
        : "ativo";

    await api(
      `/admin/controle-admins/${encodeURIComponent(id)}/status`,

      {
        method: "POST",
        body: { status }
      }
    );

    await carregarAdmins(true);

    renderAdmins();

    mensagem(
      "Status atualizado."
    );
  }

  async function excluirAdmin(id) {
    await api(
      `/admin/controle-admins/${encodeURIComponent(id)}`,

      {
        method: "DELETE"
      }
    );

    await carregarAdmins(true);

    renderAdmins();

    mensagem(
      "Administrador removido."
    );
  }

  /* =========================================================
     SEGURANÇA E PLANOS
  ========================================================= */

  async function salvarSeguranca() {
    await api(
      "/admin/configuracao",

      {
        method: "PUT",

        body: {
          seguranca: {
            limiteDispositivos:
              Number(
                value(
                  "limiteDispositivos"
                ) ||
                1
              ),

            modoSegurancaConteudo:
              value(
                "modoSegurancaConteudo"
              ),

            bloquearPendente:
              value(
                "bloquearPendente"
              ),

            ignorarCargos: [
              "superadmin",
              "admin"
            ]
          }
        }
      }
    );

    await carregarConfiguracao(true);

    renderConfiguracao();

    mensagem(
      "Configurações de segurança salvas."
    );
  }

  async function salvarPlanos() {
    await api(
      "/admin/configuracao",

      {
        method: "PUT",

        body: {
          comissaoPadrao:
            Number(
              value(
                "comissaoPadrao"
              ) ||
              20
            ),

          planos: {
            free: {
              valor:
                Number(
                  value(
                    "planoFreeValor"
                  ) ||
                  0
                ),

              dias: 0,
              ativo: true
            },

            black30: {
              valor:
                Number(
                  value(
                    "planoBlack30Valor"
                  ) ||
                  0
                ),

              dias: 30,
              ativo: true
            },

            black90: {
              valor:
                Number(
                  value(
                    "planoBlack90Valor"
                  ) ||
                  0
                ),

              dias: 90,
              ativo: true
            },

            black180: {
              valor:
                Number(
                  value(
                    "planoBlack180Valor"
                  ) ||
                  0
                ),

              dias: 180,
              ativo: true
            },

            black360: {
              valor:
                Number(
                  value(
                    "planoBlack360Valor"
                  ) ||
                  0
                ),

              dias: 360,
              ativo: true
            }
          }
        }
      }
    );

    await carregarConfiguracao(true);

    renderConfiguracao();

    mensagem(
      "Planos atualizados."
    );
  }

  /* =========================================================
     EXPORTAÇÃO
  ========================================================= */

  function exportarCSV() {
    const linhas = [
      [
        "Aluno",
        "E-mail",
        "Plano",
        "Valor",
        "Vendedor",
        "Status",
        "Data"
      ],

      ...vendasFiltradas()
        .map((venda) => [
          venda.alunoNome,
          venda.alunoEmail,
          textoPlano(venda.plano),
          venda.valor,
          venda.vendedorNome ||
            venda.vendedorEmail,
          venda.status,
          venda.criadoEm
        ])
    ];

    const csv =
      linhas.map((linha) => {
        return linha
          .map((item) => {
            return `"${String(item ?? "")
              .replaceAll('"', '""')}"`;
          })
          .join(";");
      }).join("\n");

    const blob =
      new Blob(
        [
          "\ufeff" +
          csv
        ],

        {
          type:
            "text/csv;charset=utf-8"
        }
      );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      "relatorio-vendas.csv";

    link.click();

    URL.revokeObjectURL(url);
  }

  /* =========================================================
     EVENTOS GERAIS
  ========================================================= */

  function registrarEventos() {
    document.addEventListener(
      "click",

      async (event) => {
        const botao =
          event.target.closest(
            "button"
          );

        if (!botao) {
          if (
            event.target.classList
              ?.contains(
                "modal-overlay"
              )
          ) {
            fecharModal(
              event.target.id
            );
          }

          return;
        }

        if (
          botao.dataset.closeModal
        ) {
          fecharModal(
            botao.dataset.closeModal
          );

          return;
        }

        if (
          botao.dataset.adminTab
        ) {
          await abrirAba(
            botao.dataset.adminTab
          );

          return;
        }

        const id = botao.id;

        const action =
          botao.dataset.action;

        try {
          if (
            id === "btnAdminMenu"
          ) {
            abrirMenuMobile();
            return;
          }

          if (
            id === "btnSairAdmin"
          ) {
            await api(
              "/logout",
              {
                method: "POST",
                silent: true
              }
            );

            limparSessao();

            window.location.replace(
              "index.html"
            );

            return;
          }

          if (
            id === "btnVerPlataforma"
          ) {
            window.location.href =
              "dashboard.html";

            return;
          }

          if (
            id === "btnAtualizarAdmin"
          ) {
            await executarBotao(
              botao,

              () => {
                if (!state.usuario) {
                  return iniciar();
                }

                return carregarAba(
                  state.aba,
                  true
                );
              }
            );

            return;
          }

          if (
            [
              "btnAtualizarCadastros",
              "btnAtualizarUsuarios"
            ].includes(id)
          ) {
            await executarBotao(
              botao,

              async () => {
                await carregarUsuarios(true);
                renderAba(state.aba);
              }
            );

            return;
          }

          if (
            id === "btnAtualizarGrafico"
          ) {
            renderDashboard();
            return;
          }

          if (
            id === "btnAbrirAgendaRapida"
          ) {
            await abrirAba(
              "agendaPrimo"
            );

            return;
          }

          if (
            id === "btnAbrirNotificacoesRapidas"
          ) {
            await abrirAba(
              "notificacoes"
            );

            return;
          }

          if (
            id === "btnAprovarPorCodigo"
          ) {
            await executarBotao(
              botao,
              () => aprovarCodigo()
            );

            return;
          }

          if (
            id === "btnNovoAlunoControle"
          ) {
            abrirAluno();
            return;
          }

          if (
            id === "btnAtualizarControleAlunos"
          ) {
            await executarBotao(
              botao,

              async () => {
                await carregarAlunos(true);
                renderAlunos();
              }
            );

            return;
          }

          if (
            id === "btnNovoVendedor"
          ) {
            abrirNovoAdmin(true);
            return;
          }

          if (
            id === "btnAtualizarVendedores"
          ) {
            await executarBotao(
              botao,

              async () => {
                await carregarVendedores(true);
                renderVendedores();
              }
            );

            return;
          }

          if (
            id === "btnAtualizarRelatorios"
          ) {
            await executarBotao(
              botao,

              async () => {
                await carregarVendas(true);
                renderRelatorios();
              }
            );

            return;
          }

          if (
            id === "btnExportarRelatorio"
          ) {
            exportarCSV();
            return;
          }

          if (
            id === "btnAbrirModalAgenda"
          ) {
            abrirAgenda();
            return;
          }

          if (
            id === "btnAtualizarAgenda"
          ) {
            await executarBotao(
              botao,

              async () => {
                await carregarAgenda(true);
                renderAgenda();
              }
            );

            return;
          }

          if (
            id === "btnAtualizarNotificacoes"
          ) {
            await executarBotao(
              botao,

              async () => {
                await carregarNotificacoes(true);
                renderNotificacoes();
              }
            );

            return;
          }

          if (
            id === "btnAtualizarSuporte"
          ) {
            await executarBotao(
              botao,

              async () => {
                await carregarSuporte(true);
                renderSuporte();
              }
            );

            return;
          }

          if (
            id === "btnAtualizarProvas"
          ) {
            await executarBotao(
              botao,

              async () => {
                await carregarProvas(true);
                renderProvas();
              }
            );

            return;
          }

          if (
            id === "btnAbrirModalAdmin"
          ) {
            abrirNovoAdmin(false);
            return;
          }

          if (
            id === "btnSincronizarVendedores"
          ) {
            await executarBotao(
              botao,
              sincronizarVendedores
            );

            return;
          }

          if (
            id === "btnAtualizarPlanos"
          ) {
            await executarBotao(
              botao,

              async () => {
                await carregarConfiguracao(true);
                renderConfiguracao();
              }
            );

            return;
          }

          if (
            id === "btnCancelarAdminModal"
          ) {
            state.confirmacao = null;

            fecharModal(
              "modalAdminConfirm"
            );

            return;
          }

          if (
            id === "btnConfirmarAdminModal"
          ) {
            const callback =
              state.confirmacao;

            state.confirmacao = null;

            fecharModal(
              "modalAdminConfirm"
            );

            if (callback) {
              await callback();
            }

            return;
          }

          if (
            id === "btnCancelarNovoAdmin"
          ) {
            fecharModal(
              "modalNovoAdmin"
            );

            return;
          }

          if (
            id === "btnCancelarAgenda"
          ) {
            fecharModal(
              "modalAgendaAdmin"
            );

            return;
          }

          if (
            id === "btnCancelarAlunoControle"
          ) {
            fecharModal(
              "modalAlunoControle"
            );

            return;
          }

          if (
            id === "btnCancelarRespostaSuporte"
          ) {
            fecharModal(
              "modalSuporteAdmin"
            );

            return;
          }

          if (
            action === "user-approve"
          ) {
            await executarBotao(
              botao,

              () =>
                aprovarCodigo(
                  botao.dataset.code
                )
            );

            return;
          }

          if (
            action === "user-plan"
          ) {
            await executarBotao(
              botao,

              () =>
                alterarPlano(
                  botao.dataset.email,
                  botao.dataset.plan
                )
            );

            return;
          }

          if (
            action === "user-suspend"
          ) {
            await executarBotao(
              botao,

              () =>
                acaoUsuario(
                  "/suspender",
                  botao.dataset.email,
                  "Usuário suspenso."
                )
            );

            return;
          }

          if (
            action === "user-reactivate"
          ) {
            await executarBotao(
              botao,

              () =>
                acaoUsuario(
                  "/reativar",
                  botao.dataset.email,
                  "Usuário reativado."
                )
            );

            return;
          }

          if (
            action === "user-delete"
          ) {
            confirmar(
              "Excluir usuário?",

              "Esta ação não poderá ser desfeita.",

              () =>
                excluirUsuario(
                  botao.dataset.id
                )
            );

            return;
          }

          if (
            action === "student-edit"
          ) {
            abrirAluno(
              botao.dataset.id
            );

            return;
          }

          if (
            action === "student-renew"
          ) {
            await executarBotao(
              botao,

              () =>
                renovarAluno(
                  botao.dataset.id
                )
            );

            return;
          }

          if (
            action === "student-delete"
          ) {
            confirmar(
              "Excluir aluno?",

              "O registro será removido.",

              () =>
                excluirAluno(
                  botao.dataset.id
                )
            );

            return;
          }

          if (
            action === "agenda-edit"
          ) {
            abrirAgenda(
              botao.dataset.id
            );

            return;
          }

          if (
            action === "agenda-delete"
          ) {
            confirmar(
              "Excluir evento?",

              "O evento será removido.",

              () =>
                excluirAgenda(
                  botao.dataset.id
                )
            );

            return;
          }

          if (
            action === "notif-fix"
          ) {
            await executarBotao(
              botao,

              () =>
                acaoNotificacao(
                  botao.dataset.id,
                  "fixar"
                )
            );

            return;
          }

          if (
            action === "notif-unfix"
          ) {
            await executarBotao(
              botao,

              () =>
                acaoNotificacao(
                  botao.dataset.id,
                  "desfixar"
                )
            );

            return;
          }

          if (
            action === "notif-disable"
          ) {
            await executarBotao(
              botao,

              () =>
                acaoNotificacao(
                  botao.dataset.id,
                  "desativar"
                )
            );

            return;
          }

          if (
            action === "notif-resend"
          ) {
            await executarBotao(
              botao,

              () =>
                acaoNotificacao(
                  botao.dataset.id,
                  "reenviar"
                )
            );

            return;
          }

          if (
            action === "notif-delete"
          ) {
            confirmar(
              "Excluir notificação?",

              "A notificação será removida.",

              () =>
                excluirNotificacao(
                  botao.dataset.id
                )
            );

            return;
          }

          if (
            action === "support-reply"
          ) {
            abrirSuporte(
              botao.dataset.id
            );

            return;
          }

          if (
            action === "admin-toggle"
          ) {
            await executarBotao(
              botao,

              () =>
                alterarStatusAdmin(
                  botao.dataset.id,
                  botao.dataset.status
                )
            );

            return;
          }

          if (
            action === "admin-delete"
          ) {
            confirmar(
              "Remover administrador?",

              "O acesso administrativo será removido.",

              () =>
                excluirAdmin(
                  botao.dataset.id
                )
            );

            return;
          }
        } catch (error) {
          console.error(error);

          mensagem(
            error.message ||
            "Erro ao executar ação.",
            "erro"
          );
        }
      }
    );

    /* SUBMITS */

    document.addEventListener(
      "submit",

      async (event) => {
        const form =
          event.target;

        if (
          !(form instanceof HTMLFormElement)
        ) {
          return;
        }

        event.preventDefault();

        const botao =
          form.querySelector(
            '[type="submit"]'
          );

        try {
          if (
            form.id === "formNotificacao"
          ) {
            await executarBotao(
              botao,
              enviarNotificacao
            );
          }

          if (
            form.id === "formAgendaAdmin"
          ) {
            await executarBotao(
              botao,
              salvarAgenda
            );
          }

          if (
            form.id === "formAlunoControle"
          ) {
            await executarBotao(
              botao,
              salvarAluno
            );
          }

          if (
            form.id === "formRespostaSuporte"
          ) {
            await executarBotao(
              botao,
              responderSuporte
            );
          }

          if (
            form.id === "formNovoAdmin"
          ) {
            await executarBotao(
              botao,
              salvarAdmin
            );
          }

          if (
            form.id === "formSeguranca"
          ) {
            await executarBotao(
              botao,
              salvarSeguranca
            );
          }

          if (
            form.id === "formPlanos"
          ) {
            await executarBotao(
              botao,
              salvarPlanos
            );
          }
        } catch (error) {
          console.error(error);

          mensagem(
            error.message ||
            "Erro ao salvar.",
            "erro"
          );
        }
      }
    );

    /* BUSCAS COM DEBOUNCE */

    let timerBusca;

    document.addEventListener(
      "input",

      (event) => {
        clearTimeout(timerBusca);

        timerBusca =
          setTimeout(() => {
            if (
              [
                "buscaUsuariosAdmin",
                "adminPesquisaGlobal"
              ].includes(
                event.target.id
              ) &&
              state.aba === "usuarios"
            ) {
              renderUsuarios();
            }

            if (
              event.target.id ===
                "buscaControleAlunos" &&
              state.aba ===
                "controleAlunos"
            ) {
              renderAlunos();
            }

            if (
              event.target.id ===
                "buscaVendedoresAdmin" &&
              state.aba ===
                "vendedores"
            ) {
              renderVendedores();
            }
          }, 160);
      }
    );

    /* SELECTS */

    document.addEventListener(
      "change",

      (event) => {
        if (
          event.target.id ===
          "filtroStatusAdmin"
        ) {
          renderUsuarios();
        }

        if (
          event.target.id ===
          "filtroControleStatus"
        ) {
          renderAlunos();
        }

        if (
          event.target.id ===
          "filtroPeriodoRelatorio"
        ) {
          renderRelatorios();
        }

        if (
          event.target.id ===
          "filtroSuporteStatus"
        ) {
          renderSuporte();
        }

        if (
          event.target.id ===
          "notificacaoDestino"
        ) {
          alternarEmailNotificacao();
        }
      }
    );

    /* TECLADO */

    document.addEventListener(
      "keydown",

      (event) => {
        if (
          event.key === "Escape"
        ) {
          $$(".modal-overlay")
            .filter((modal) => {
              return !modal.hidden;
            })
            .forEach((modal) => {
              fecharModal(modal.id);
            });
        }

        if (
          event.key === "Enter" &&
          event.target.id ===
            "codigoAprovacaoAdmin"
        ) {
          event.preventDefault();

          aprovarCodigo()
            .catch((error) => {
              mensagem(
                error.message,
                "erro"
              );
            });
        }
      }
    );

    $("adminOverlay")
      ?.addEventListener(
        "click",
        fecharMenuMobile
      );
  }

  async function executarBotao(
    botao,
    callback
  ) {
    setBusy(botao, true);

    try {
      await callback();
    } finally {
      setBusy(botao, false);
    }
  }

  /* =========================================================
     MENU MOBILE
  ========================================================= */

  function abrirMenuMobile() {
    clearTimeout(menuCloseTimer);
    menuCloseTimer = null;

    $("adminSidebar")
      ?.classList.add(
        "active",
        "open"
      );

    const overlay =
      $("adminOverlay");

    if (overlay) {
      overlay.hidden = false;

      overlay.classList.add(
        "active",
        "visible"
      );

      overlay.setAttribute(
        "aria-hidden",
        "false"
      );
    }

    $("btnAdminMenu")
      ?.setAttribute(
        "aria-expanded",
        "true"
      );
  }

  function fecharMenuMobile() {
    $("adminSidebar")
      ?.classList.remove(
        "active",
        "open"
      );

    const overlay =
      $("adminOverlay");

    if (overlay) {
      overlay.classList.remove(
        "active",
        "visible"
      );

      overlay.setAttribute(
        "aria-hidden",
        "true"
      );

      clearTimeout(menuCloseTimer);

      menuCloseTimer = setTimeout(() => {
        overlay.hidden = true;
        menuCloseTimer = null;
      }, 160);
    }

    $("btnAdminMenu")
      ?.setAttribute(
        "aria-expanded",
        "false"
      );
  }

  function alternarEmailNotificacao() {
    const especifico =
      value(
        "notificacaoDestino"
      ) === "especifico";

    const campo =
      $("campoNotificacaoEmail");

    if (campo) {
      campo.hidden =
        !especifico;
    }

    if (
      $("notificacaoEmail")
    ) {
      $("notificacaoEmail")
        .required = especifico;
    }
  }
})();
