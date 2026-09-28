"use strict";
(() => {
  if (window.__TURMA_HIG_DASHBOARD_V1__) return;
  window.__TURMA_HIG_DASHBOARD_V1__ = true;

  const icon = (name) => `<svg aria-hidden="true"><use href="/assets/dashboard-icons.svg#${name}"></use></svg>`;
  const qs = (selector, root = document) => root.querySelector(selector);

  function markPilot() {
    document.body.classList.add("tp-hig-pilot");
  }

  function groupNavigation() {
    const nav = document.getElementById("mainNav");
    if (!nav || nav.dataset.higGrouped === "1") return;
    const links = [...nav.querySelectorAll(":scope > a")];
    if (!links.length) return;

    const byPath = new Map(links.map((link) => [new URL(link.href, location.origin).pathname, link]));
    const groups = [
      ["PLATAFORMA", ["/dashboard", "/estudo", "/modulos", "/roleta", "/roleta-real"]],
      ["APRENDIZADO", ["/provas", "/gestao", "/notas", "/favoritos"]],
      ["CONTA", ["/perfil"]]
    ];

    const fragment = document.createDocumentFragment();
    groups.forEach(([label, paths]) => {
      const section = document.createElement("section");
      section.className = "hig-nav-section";
      const title = document.createElement("p");
      title.className = "hig-nav-section-title";
      title.textContent = label;
      const list = document.createElement("div");
      list.className = "hig-nav-section-links";
      paths.forEach((path) => {
        const link = byPath.get(path);
        if (link) list.append(link);
      });
      if (list.childElementCount) {
        section.append(title, list);
        fragment.append(section);
      }
    });

    links.forEach((link) => {
      if (link.parentElement === nav) fragment.append(link);
    });
    nav.replaceChildren(fragment);
    nav.dataset.higGrouped = "1";
  }

  function studySnapshot() {
    try {
      const state = window.TurmaStudySync?.state;
      const summary = state && window.TurmaStudyState?.summary ? window.TurmaStudyState.summary(state) : null;
      const done = Number(summary?.etapasConcluidas) || 0;
      const modules = Number(summary?.modulosConcluidos) || 0;
      return { done, modules, total: 24, percent: Math.max(0, Math.min(100, Math.round((done / 24) * 100))) };
    } catch {
      return { done: 0, modules: 0, total: 24, percent: 0 };
    }
  }

  function examToday() {
    const day = new Date().getDay();
    if (day === 0) return { title: "Desafio do Primo", meta: "25 questões · dificuldade máxima", href: "/provas", icon: "i-crown" };
    if (day === 6) return { title: "Prova Semanal", meta: "20 questões · revisão da semana", href: "/provas", icon: "i-exam" };
    return { title: "Prova Diária", meta: "10 questões · disponível de segunda a sexta", href: "/provas", icon: "i-exam" };
  }

  function currentModule() {
    const title = qs("#resumeTitle")?.textContent?.trim() || "Continue seus estudos";
    const href = qs("#resumeLink")?.getAttribute("href") || "/estudo";
    const description = qs("#resumeDescription")?.textContent?.trim() || "Retome do ponto em que parou.";
    return { title, href, description };
  }

  function ensureJourneyOverview() {
    const heading = qs("main > .heading");
    if (!heading) return null;
    let section = qs("#higJourneyOverview");
    if (section) return section;

    section = document.createElement("section");
    section.id = "higJourneyOverview";
    section.className = "hig-journey-overview";
    section.setAttribute("aria-label", "Resumo da sua jornada");
    section.innerHTML = `
      <article class="hig-journey-card primary" data-hig-card="progress">
        <span class="hig-card-kicker">${icon("i-activity")} PROGRESSO GERAL</span>
        <strong data-hig-progress-title>Carregando sua jornada…</strong>
        <p data-hig-progress-copy>Sincronizando módulos e etapas concluídas.</p>
        <div class="hig-progress-track" aria-hidden="true"><i data-hig-progress-bar></i></div>
        <div class="hig-progress-meta"><span data-hig-progress-meta>— de 24 etapas</span><span data-hig-progress-percent>—%</span></div>
      </article>
      <article class="hig-journey-card" data-hig-card="continue">
        <span class="hig-card-kicker">${icon("i-book")} CONTINUE DE ONDE PAROU</span>
        <strong data-hig-module-title>Seus estudos</strong>
        <p data-hig-module-copy>Retome sua trilha de aprendizado.</p>
        <a data-hig-module-link href="/estudo">Continuar →</a>
      </article>
      <article class="hig-journey-card" data-hig-card="exam">
        <span class="hig-card-kicker" data-hig-exam-kicker>${icon("i-exam")} AVALIAÇÃO DO DIA</span>
        <strong data-hig-exam-title>Provas</strong>
        <p data-hig-exam-copy>Confira sua avaliação disponível.</p>
        <a data-hig-exam-link href="/provas">Ver provas →</a>
      </article>`;
    heading.insertAdjacentElement("afterend", section);
    return section;
  }

  function paintJourneyOverview() {
    const section = ensureJourneyOverview();
    if (!section) return;

    const progress = studySnapshot();
    const module = currentModule();
    const exam = examToday();

    qs("[data-hig-progress-title]", section).textContent = `${progress.percent}% da jornada`;
    qs("[data-hig-progress-copy]", section).textContent = progress.done
      ? `${progress.modules} módulo${progress.modules === 1 ? "" : "s"} concluído${progress.modules === 1 ? "" : "s"}. Continue no seu ritmo.`
      : "Sua evolução aparece aqui conforme você conclui as etapas dos módulos.";
    qs("[data-hig-progress-meta]", section).textContent = `${progress.done} de ${progress.total} etapas`;
    qs("[data-hig-progress-percent]", section).textContent = `${progress.percent}%`;
    qs("[data-hig-progress-bar]", section).style.width = `${progress.percent}%`;

    qs("[data-hig-module-title]", section).textContent = module.title;
    qs("[data-hig-module-copy]", section).textContent = module.description;
    qs("[data-hig-module-link]", section).href = module.href;

    qs("[data-hig-exam-title]", section).textContent = exam.title;
    qs("[data-hig-exam-copy]", section).textContent = exam.meta;
    qs("[data-hig-exam-link]", section).href = exam.href;
    qs("[data-hig-exam-kicker]", section).innerHTML = `${icon(exam.icon)} AVALIAÇÃO DO DIA`;
  }

  function improveMobileDrawerSemantics() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("menuBackdrop");
    if (!sidebar || !backdrop || sidebar.dataset.higObserved === "1") return;
    sidebar.dataset.higObserved = "1";
    const sync = () => {
      const open = sidebar.classList.contains("open");
      sidebar.setAttribute("aria-hidden", open || matchMedia("(min-width:721px)").matches ? "false" : "true");
      backdrop.setAttribute("aria-hidden", open ? "false" : "true");
    };
    new MutationObserver(sync).observe(sidebar, { attributes:true, attributeFilter:["class"] });
    matchMedia("(min-width:721px)").addEventListener?.("change", sync);
    sync();
  }

  function init() {
    markPilot();
    groupNavigation();
    ensureJourneyOverview();
    paintJourneyOverview();
    improveMobileDrawerSemantics();
    window.addEventListener("turma:study-change", paintJourneyOverview);
    window.addEventListener("turma:theme", paintJourneyOverview);
    setTimeout(() => { groupNavigation(); paintJourneyOverview(); }, 350);
    setTimeout(paintJourneyOverview, 1200);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once:true })
    : init();
})();
