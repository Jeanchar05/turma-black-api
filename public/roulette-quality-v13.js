"use strict";
(() => {
  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  if (route() !== "/roleta") return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const PHOTO = "/assets/roulette/primo-portrait.svg?v=13";

  const configs = [
    { key: "immersive", provider: "evolution", match: /immersive|evolution/i, title: "Roullete immersive (Evolution)", badge: "EVOLUTION", subtitle: "Experiência imersiva" },
    { key: "playtech", provider: "playtech", match: /playtech/i, title: "Roleta Brasileira (Playtech)", badge: "PLAYTECH", subtitle: "Mesa brasileira" },
    { key: "pragmatic", provider: "pragmatic", match: /pragmatic/i, title: "Roleta Brasileira (Pragmatic)", badge: "PRAGMATIC PLAY", subtitle: "Mesa brasileira" },
    { key: "tukias", provider: "tukias", match: /turkish|turistas|tukias|imagine/i, title: "Tukias roullet", badge: "TUKIAS", subtitle: "Mesa selecionada" },
  ];

  function cardFor(config) {
    return $$(".roulette-casino-grid .roulette-casino-card").find((card) => config.match.test(card.textContent || ""));
  }

  function apply(card, config) {
    if (!card) return;
    card.dataset.rouletteArt = config.title;
    const image = $(".roulette-card-image", card);
    if (image && !$(".roulette-v13-art", image)) {
      const oldBadge = $(".roulette-badge", image)?.outerHTML || "";
      image.innerHTML = `<div class="roulette-v13-art" data-provider="${config.provider}"><div class="roulette-v13-copy"><small>${config.badge}</small><strong>${config.title}</strong><em>${config.subtitle}</em></div><img class="roulette-v13-person" src="${PHOTO}" alt="Primo da Roleta"></div>${oldBadge}`;
    }
    const title = $(".roulette-card-body h3", card); if (title) title.textContent = config.title;
    const badge = $(".roulette-badge", card); if (badge) badge.textContent = config.badge;
  }

  function reorder() {
    const grid = $(".roulette-casino-grid"); if (!grid) return;
    configs.forEach((config) => { const card = cardFor(config); if (card) grid.appendChild(card); });
  }

  function init() {
    reorder();
    configs.forEach((config) => apply(cardFor(config), config));
    setTimeout(() => { reorder(); configs.forEach((config) => apply(cardFor(config), config)); }, 900);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
