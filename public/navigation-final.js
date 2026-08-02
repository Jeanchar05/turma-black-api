"use strict";
(() => {
  if (window.__TURMA_NAVIGATION_FINAL__) return;
  window.__TURMA_NAVIGATION_FINAL__ = true;

  const ORDER = [
    "dashboard",
    "anotacoes",
    "minigames",
    "estudo",
    "modulos",
    "suporte",
    "perfil",
    "roleta",
    "provas",
    "favoritos"
  ];

  const MENU = {
    dashboard: {
      label: "Dashboard",
      description: "Resumo rápido da sua jornada.",
      paths: ["/dashboard", "/dashboard.html"],
      dataNav: ["inicio", "dashboard"]
    },
    anotacoes: {
      label: "Anotações",
      description: "Caderno interativo, PDF e compartilhamento.",
      paths: ["/notas", "/notas.html", "/anotacoes", "/anotacoes.html"],
      dataNav: ["notas", "anotacoes"]
    },
    minigames: {
      label: "Minigames",
      description: "Roleta especial e novos jogos em breve.",
      paths: ["/minigames", "/minigames.html"],
      dataNav: ["minigames"]
    },
    estudo: {
      label: "Estudo",
      description: "Estratégias e módulos de estudo.",
      paths: ["/estudo", "/estudo.html"],
      dataNav: ["estudo"]
    },
    modulos: {
      label: "Módulos",
      description: "Videoaulas práticas de cada estratégia.",
      paths: ["/modulos", "/modulos.html"],
      dataNav: ["modulos"]
    },
    suporte: {
      label: "Suporte",
      description: "Ajuda, feedback e reporte de bugs.",
      paths: ["/suporte", "/suporte.html"],
      dataNav: ["suporte"]
    },
    perfil: {
      label: "Perfil",
      description: "Perfil e configurações pessoais.",
      paths: ["/perfil", "/perfil.html"],
      dataNav: ["perfil"]
    },
    roleta: {
      label: "Roleta",
      description: "Roleta operacional e plataforma parceira.",
      paths: ["/roleta", "/roleta.html"],
      dataNav: ["roleta"]
    },
    provas: {
      label: "Provas",
      description: "Desafios, provas e aprendizado.",
      paths: ["/provas", "/provas.html"],
      dataNav: ["provas"]
    },
    favoritos: {
      label: "Favoritos",
      description: "Seus módulos e conteúdos favoritos.",
      paths: ["/favoritos", "/favoritos.html"],
      dataNav: ["favoritos"]
    }
  };

  const ADMIN_PATHS = [
    "/admin",
    "/admin.html",
    "/painel-vendas",
    "/painel-vendas.html",
    "/relatorios",
    "/usuarios",
    "/configuracoes"
  ];

  function normalizedPath(value) {
    try {
      return new URL(value, window.location.origin).pathname.replace(/\/$/, "") || "/";
    } catch (_) {
      return "";
    }
  }

  function itemKey(element) {
    const dataNav = String(element.dataset?.nav || "").trim().toLowerCase();
    const href = element.getAttribute?.("href");
    const path = href ? normalizedPath(href) : "";

    return ORDER.find((key) => {
      const item = MENU[key];
      return item.dataNav.includes(dataNav) || item.paths.includes(path);
    }) || "";
  }

  function labelNode(element) {
    return element.querySelector("b") ||
      element.querySelector("span:not([class*='icon']):not([class*='badge'])") ||
      element.querySelector("strong");
  }

  function applyItem(element, key) {
    const item = MENU[key];
    if (!item) return;

    const label = labelNode(element);
    if (label) label.textContent = item.label;

    element.dataset.menuKey = key;
    element.dataset.menuDescription = item.description;
    element.title = item.description;
    element.setAttribute("aria-label", `${item.label}: ${item.description}`);
  }

  function removeStudentAdminLinks(sidebar) {
    if (!sidebar || /^\/admin(?:\/|$)/.test(location.pathname)) return;

    sidebar.querySelectorAll("a[href],button[data-nav]").forEach((element) => {
      const href = element.getAttribute("href");
      const path = href ? normalizedPath(href) : "";
      const dataNav = String(element.dataset?.nav || "").toLowerCase();
      const isAdmin = ADMIN_PATHS.includes(path) || [
        "admin", "painel-admin", "painel-vendas", "relatorios", "usuarios", "configuracoes"
      ].includes(dataNav);
      if (isAdmin) element.remove();
    });

    sidebar.querySelectorAll("h2,h3,h4,small,span,p").forEach((element) => {
      if (/^administra[cç][aã]o$/i.test(element.textContent.trim())) {
        const parent = element.closest("section,.nav-section,.menu-section") || element;
        if (!parent.querySelector?.("a[href],button[data-nav]")) parent.remove();
      }
    });
  }

  function normalizeNav(nav) {
    const directItems = Array.from(nav.children).filter((element) => {
      return element.matches?.("a[href],button[data-nav]") && itemKey(element);
    });

    if (directItems.length < 5) return;

    const byKey = new Map();
    directItems.forEach((element) => {
      const key = itemKey(element);
      if (key && !byKey.has(key)) byKey.set(key, element);
    });

    ORDER.forEach((key) => {
      const element = byKey.get(key);
      if (!element) return;
      applyItem(element, key);
      nav.appendChild(element);
    });
  }

  function updateAnotacoesPage() {
    const path = normalizedPath(location.pathname);
    if (!["/notas", "/notas.html", "/anotacoes", "/anotacoes.html"].includes(path)) return;

    document.title = "Anotações | Turma do Primo";

    const title = document.querySelector(".notes-title-group h1");
    const subtitle = document.querySelector(".notes-title-group p");
    if (title) title.textContent = "Anotações";
    if (subtitle) subtitle.textContent = "Seu caderno interativo para registrar, organizar, gerar PDF e compartilhar seus estudos.";

    const newButton = document.querySelector("#newNoteButton");
    if (newButton) newButton.innerHTML = "<span>＋</span> Nova anotação";

    const emptyTitle = document.querySelector("#editorEmptyState strong");
    const emptyText = document.querySelector("#editorEmptyState p");
    const createButton = document.querySelector("#editorEmptyState [data-create-note]");
    if (emptyTitle) emptyTitle.textContent = "Selecione uma anotação";
    if (emptyText) emptyText.textContent = "Escolha um card ou crie uma nova anotação para começar.";
    if (createButton) createButton.textContent = "＋ Criar anotação";

    const allFilter = document.querySelector('.notes-filter[data-filter="all"] span');
    if (allFilter) {
      const svg = allFilter.querySelector("svg")?.outerHTML || "";
      allFilter.innerHTML = `${svg} Todas as anotações`;
    }

    const resultCount = document.querySelector("#resultCount");
    if (resultCount && /^\d+ notas?$/i.test(resultCount.textContent.trim())) {
      resultCount.textContent = resultCount.textContent.replace(/notas?/i, "anotações");
    }

    const titleInput = document.querySelector("#noteTitle");
    if (titleInput) titleInput.placeholder = "Título da anotação";
  }

  function updateDashboardCopy() {
    const search = document.querySelector(".dash-search-trigger em");
    if (search) search.textContent = "Buscar conteúdos, módulos e anotações…";

    document.querySelectorAll('[data-nav="notas"]').forEach((element) => {
      if (element.closest(".dash-nav")) return;
      if (/ver notas/i.test(element.textContent)) element.textContent = "Ver anotações";
    });
  }

  function initialize() {
    document.querySelectorAll("aside").forEach(removeStudentAdminLinks);
    document.querySelectorAll(".dash-nav,.notes-main-nav,aside nav").forEach(normalizeNav);
    updateAnotacoesPage();
    updateDashboardCopy();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  document.addEventListener("turma:protected-ready", initialize);
})();
