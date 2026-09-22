"use strict";
(() => {
  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  if (route() !== "/roleta") return;

  const AFFILIATE_URL = "https://go.aff.esportiva.bet/bhotuu7q";

  function secureLink(link) {
    if (!link) return;
    link.href = AFFILIATE_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer sponsored";
  }

  function updateExistingLinks() {
    secureLink(document.getElementById("esportivaAccess"));
    document.querySelectorAll('a[href^="https://esportiva.bet.br?ref="]').forEach(secureLink);
  }

  function injectCallout() {
    if (document.querySelector(".roulette-affiliate-callout")) return;
    const platform = document.querySelector(".roulette-platform-new");
    const tables = document.querySelector(".roulette-panel-new");
    if (!platform || !tables) return;

    const section = document.createElement("section");
    section.className = "roulette-affiliate-callout";
    section.setAttribute("aria-labelledby", "esportivaAffiliateTitle");
    section.innerHTML = `
      <div class="roulette-affiliate-copy">
        <span class="roulette-affiliate-kicker">LINK OFICIAL DA TURMA</span>
        <h2 id="esportivaAffiliateTitle">Jogue na <strong>Esportiva</strong></h2>
        <p>Acesse a plataforma pelo link de indicação da Turma do Primo e, em seguida, escolha uma das roletas disponíveis abaixo.</p>
        <div class="roulette-affiliate-actions">
          <a class="roulette-affiliate-primary" href="${AFFILIATE_URL}" target="_blank" rel="noopener noreferrer sponsored">Acessar Esportiva <b>↗</b></a>
          <button class="roulette-affiliate-secondary" type="button" data-scroll-roulette>Ver roletas <b>↓</b></button>
        </div>
        <small>18+ · Jogue com responsabilidade · Link de afiliado</small>
      </div>
      <div class="roulette-affiliate-mark" aria-hidden="true">
        <span>ESPORTIVA</span><b>BET</b>
        <i>Turma do Primo</i>
      </div>`;

    platform.insertAdjacentElement("afterend", section);
    section.querySelector("[data-scroll-roulette]")?.addEventListener("click", () => {
      tables.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
  }

  function init() {
    updateExistingLinks();
    injectCallout();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
