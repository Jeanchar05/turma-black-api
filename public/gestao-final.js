"use strict";
(() => {
  if (window.__TURMA_GESTAO_FINAL__) return;
  window.__TURMA_GESTAO_FINAL__ = true;

  function enhance() {
    const hero = document.querySelector('.bankroll-hero');
    if (hero && window.TURMA_GESTAO_CAPA) {
      hero.classList.add('bankroll-hero-official');
      hero.innerHTML = `<img src="${window.TURMA_GESTAO_CAPA}" alt="Gestão de Banca — controle, disciplina, consistência e lucro">`;
    }

    document.getElementById('exportBankrollButton')?.remove();
    document.querySelector('.history-panel')?.remove();

    const layout = document.querySelector('.bankroll-layout');
    if (layout) layout.classList.add('bankroll-layout-no-history');

    const chartPanel = document.querySelector('.chart-panel');
    if (chartPanel) {
      chartPanel.classList.add('bankroll-chart-featured');
      const small = chartPanel.querySelector('.bankroll-panel-head small');
      if (small) small.textContent = 'Evolução visual da sua banca';
    }

    document.querySelectorAll('.bankroll-history-list,.bankroll-history-item').forEach(el => el.remove());

    const search = document.querySelector('.bankroll-search-copy em');
    if (search) search.textContent = 'Planeje, proteja e acompanhe sua banca com disciplina';
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', enhance, { once: true })
    : enhance();

  document.addEventListener('turma:protected-ready', enhance);
})();
