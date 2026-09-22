"use strict";
(() => {
  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  if (route() !== "/roleta") return;

  const cards = {
    immersive: {
      title: "Roullete immersive (Evolution)",
      badge: "EVOLUTION",
      match: /immersive|evolution/i,
      dark: "/assets/roulette/cards/immersive-dark.svg?v=20260922-1",
      light: "/assets/roulette/cards/immersive-light.svg?v=20260922-1"
    },
    playtech: {
      title: "Roleta Brasileira (Playtech)",
      badge: "PLAYTECH",
      match: /playtech/i,
      dark: "/assets/roulette/cards/playtech-dark.svg?v=20260922-1",
      light: "/assets/roulette/cards/playtech-light.svg?v=20260922-1"
    },
    pragmatic: {
      title: "Roleta Brasileira (Pragmatic)",
      badge: "PRAGMATIC PLAY",
      match: /pragmatic/i,
      dark: "/assets/roulette/cards/pragmatic-dark.svg?v=20260922-1",
      light: "/assets/roulette/cards/pragmatic-light.svg?v=20260922-1"
    },
    turistas: {
      title: "Turistas roullet",
      badge: "IMAGINE LIVE",
      match: /turkish|turistas|imagine/i,
      dark: "/assets/roulette/cards/turistas-dark.svg?v=20260922-1",
      light: "/assets/roulette/cards/turistas-light.svg?v=20260922-1"
    }
  };

  const order = ["immersive", "playtech", "pragmatic", "turistas"];
  const currentTheme = () => document.documentElement.dataset.theme === "light" ? "light" : "dark";

  function findCard(config) {
    return [...document.querySelectorAll(".roulette-casino-grid .roulette-casino-card")]
      .find(card => config.match.test(card.textContent || ""));
  }

  function applyCard(card, config, theme) {
    if (!card) return;
    card.dataset.rouletteArt = config.title;
    const image = card.querySelector(".roulette-card-image img");
    if (image) {
      image.src = config[theme];
      image.alt = config.title;
      image.classList.add("roulette-theme-art");
      image.removeAttribute("referrerpolicy");
      image.removeAttribute("onerror");
      image.onerror = null;
    }
    const title = card.querySelector(".roulette-card-body h3");
    if (title) title.textContent = config.title;
    const badge = card.querySelector(".roulette-badge");
    if (badge) badge.textContent = config.badge;
  }

  function applyThemeArt() {
    const theme = currentTheme();
    order.forEach(key => applyCard(findCard(cards[key]), cards[key], theme));
  }

  function normalizeOrder() {
    const grid = document.querySelector(".roulette-casino-grid");
    if (!grid) return;
    order.forEach(key => {
      const card = findCard(cards[key]);
      if (card) grid.appendChild(card);
    });
  }

  function trimOptionalTools() {
    const panel = document.querySelector(".roulette-tools-panel");
    if (!panel) return;
    const title = panel.querySelector("h2");
    const description = panel.querySelector("header p");
    if (title) title.textContent = "Ferramentas opcionais";
    if (description) description.textContent = "Atalhos extras para complementar sua rotina.";
    const tools = [...panel.querySelectorAll(".roulette-tool-card-new")];
    tools.slice(3).forEach(tool => tool.remove());
  }

  function init() {
    normalizeOrder();
    applyThemeArt();
    trimOptionalTools();

    new MutationObserver(records => {
      if (records.some(record => record.attributeName === "data-theme")) applyThemeArt();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    window.addEventListener("turma:theme-change", applyThemeArt);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
