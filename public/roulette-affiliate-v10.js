"use strict";
(() => {
  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  if (route() !== "/roleta") return;
  const AFFILIATE_URL = "https://go.aff.esportiva.bet/bhotuu7q";

  function upgradeExistingLinks() {
    const primary = document.getElementById("esportivaAccess");
    if (primary) {
      primary.href = AFFILIATE_URL;
      primary.textContent = "Acessar Esportiva pelo link da Turma ↗";
      primary.setAttribute("aria-label", "Acessar Esportiva pelo link oficial de afiliado da Turma do Primo");
    }

    document.querySelectorAll(".roulette-panel-head-new > a").forEach((link) => {
      if (/abrir plataforma/i.test(link.textContent || "")) {
        link.href = AFFILIATE_URL;
        link.innerHTML = "Acessar Esportiva <b>→</b>";
      }
    });
  }

  function buildAffiliateBanner() {
    if (document.querySelector(".roulette-affiliate-banner")) return;
    const roulettePanel = document.querySelector(".roulette-panel-new");
    if (!roulettePanel) return;

    const section = document.createElement("section");
    section.className = "roulette-affiliate-banner";
    section.innerHTML = `
      <div class="roulette-affiliate-copy">
        <span class="roulette-affiliate-kicker">LINK OFICIAL DA TURMA</span>
        <div class="roulette-affiliate-brand"><strong>Esportiva</strong><b>Bet</b></div>
        <h2>Entre pela Esportiva e acesse as roletas da Turma.</h2>
        <p>Use o nosso link oficial para abrir a plataforma. Depois, volte à Roleta Operacional para acessar diretamente as mesas e ferramentas que você já utiliza.</p>
        <div class="roulette-affiliate-actions">
          <a class="roulette-affiliate-primary" href="${AFFILIATE_URL}" target="_blank" rel="noopener noreferrer sponsored">Acessar Esportiva <span>↗</span></a>
          <a class="roulette-affiliate-secondary" href="#roulette-casino-grid">Ver roletas</a>
        </div>
        <small>18+ · Jogue com responsabilidade. Aposte apenas valores que não comprometam suas despesas essenciais.</small>
      </div>
      <div class="roulette-affiliate-art" aria-hidden="true">
        <div class="roulette-affiliate-orbit orbit-one"></div>
        <div class="roulette-affiliate-orbit orbit-two"></div>
        <div class="roulette-affiliate-wheel">
          <span class="roulette-affiliate-crown">♛</span>
        </div>
        <div class="roulette-affiliate-quote">Disciplina primeiro.<br><strong>Decisão depois.</strong></div>
      </div>`;

    roulettePanel.id = roulettePanel.id || "roulette-casino-grid";
    roulettePanel.insertAdjacentElement("afterend", section);
  }

  function init() {
    upgradeExistingLinks();
    buildAffiliateBanner();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
