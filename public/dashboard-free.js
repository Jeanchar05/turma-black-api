"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];

  const lessons = [
    { id:"cavalo", title:"Estratégia do Cavalo", description:"Entenda a lógica dos terminais e como organizar a leitura da estratégia.", category:"estrategias", duration:"08 min", source:"Instagram", recent:true, symbol:"♞", tone:"purple", status:"soon" },
    { id:"gemeos", title:"Entendendo os Gêmeos", description:"Uma introdução simples à leitura dos números repetidos e suas relações.", category:"fundamentos", duration:"09 min", source:"Instagram", recent:true, symbol:"11", tone:"blue", status:"soon" },
    { id:"fibonacci", title:"Fibonacci na prática", description:"Veja como organizar a sequência e identificar os pontos principais da estratégia.", category:"estrategias", duration:"11 min", source:"Instagram", recent:true, symbol:"Φ", tone:"violet", status:"soon" },
    { id:"espelhos", title:"Espelhos e inversões", description:"Conheça a ideia por trás das inversões e como reconhecer padrões rapidamente.", category:"fundamentos", duration:"10 min", source:"Instagram", recent:false, symbol:"69", tone:"gold", status:"soon" },
    { id:"magneto", title:"Magneto: zonas de força", description:"Uma visão introdutória da estratégia e de como as conexões são organizadas.", category:"estrategias", duration:"12 min", source:"Instagram", recent:false, symbol:"M", tone:"purple", status:"soon" },
    { id:"pitagoras", title:"Pitágoras: lógica e probabilidade", description:"Fundamentos para entender a construção e a leitura da estratégia.", category:"fundamentos", duration:"12 min", source:"Instagram", recent:false, symbol:"△", tone:"blue", status:"soon" }
  ];

  const toneBackground = {
    purple:"radial-gradient(circle at 72% 30%,rgba(168,85,247,.28),transparent 28%),linear-gradient(145deg,#251130,#09050e)",
    violet:"radial-gradient(circle at 68% 28%,rgba(113,45,205,.31),transparent 30%),linear-gradient(145deg,#1e1230,#08050e)",
    blue:"radial-gradient(circle at 70% 28%,rgba(60,130,246,.22),transparent 30%),linear-gradient(145deg,#101a2d,#08050e)",
    gold:"radial-gradient(circle at 70% 28%,rgba(240,188,77,.20),transparent 30%),linear-gradient(145deg,#241a10,#09060a)"
  };

  function token() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of TOKEN_KEYS) {
        try {
          const value = storage.getItem(key);
          if (value) return value;
        } catch (_) {}
      }
    }
    return "";
  }

  async function api(endpoint, options = {}) {
    const response = await fetch(endpoint, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token()}`,
        ...(options.body ? { "Content-Type": "application/json" } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}`);
    return data;
  }

  function firstName(name) {
    return String(name || "Aluno").trim().split(/\s+/)[0] || "Aluno";
  }

  function greeting(name) {
    const hour = new Date().getHours();
    const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
    return `${period}, ${name} 👋`;
  }

  function applyUser(user) {
    const name = firstName(user?.nome);
    $$('[data-user-name]').forEach((el) => { el.textContent = name; });
    $$('[data-user-avatar]').forEach((el) => {
      el.textContent = name.charAt(0).toUpperCase();
      const photo = String(user?.foto || "").trim();
      if (photo) {
        el.style.backgroundImage = `url("${photo.replaceAll('"', '%22')}")`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
        el.textContent = "";
      }
    });
    if ($("freeGreeting")) $("freeGreeting").textContent = greeting(name);
  }

  async function loadUser() {
    try {
      const data = await api("/me");
      const user = data.usuario || data.user || {};
      applyUser(user);
      const role = String(user.cargo || user.tipo || "aluno").toLowerCase();
      if (role === "aluno" && user.acessoPremium === true) {
        window.location.replace("/dashboard");
      }
    } catch (_) {}
  }

  function lessonCard(lesson) {
    const soon = lesson.status !== "published";
    return `
      <article class="free-v10-lesson" data-lesson-card data-category="${lesson.category}" data-recent="${lesson.recent ? "1" : "0"}" data-source="instagram" data-search="${`${lesson.title} ${lesson.description} ${lesson.category}`.toLowerCase()}">
        <div class="free-v10-lesson-thumb" style="--lesson-bg:${toneBackground[lesson.tone]}">
          <span class="free-v10-lesson-badge ${soon ? "soon" : ""}">${soon ? "EM BREVE" : "NOVA AULA"}</span>
          <span class="free-v10-lesson-symbol">${lesson.symbol}</span>
          <span class="free-v10-lesson-play">${soon ? "⌛" : "▶"}</span>
        </div>
        <div class="free-v10-lesson-copy">
          <h3>${lesson.title}</h3>
          <p>${lesson.description}</p>
          <div class="free-v10-lesson-meta"><span>${lesson.duration}</span><span>${lesson.source}</span></div>
        </div>
      </article>`;
  }

  function renderLessons() {
    const grid = $("freeLessonsGrid");
    if (grid) grid.innerHTML = lessons.map(lessonCard).join("");

    const recent = $("freeRecentLessons");
    if (recent) {
      recent.innerHTML = lessons.filter((item) => item.recent).slice(0, 3).map((lesson) => `
        <button class="free-v10-mini-lesson" type="button" data-free-view-target="aulas">
          <span class="free-v10-mini-thumb" style="background:${toneBackground[lesson.tone]}"><span>▶</span></span>
          <span class="free-v10-mini-copy"><b>${lesson.title}</b><small>${lesson.duration} • ${lesson.source}</small></span>
        </button>`).join("");
    }

    $$('[data-lesson-count]').forEach((el) => { el.textContent = String(lessons.length); });
  }

  function closeMobileMenu() {
    $("freeSidebar")?.classList.remove("open");
    if ($("freeOverlay")) $("freeOverlay").hidden = true;
  }

  function validView(value) {
    return ["dashboard", "aulas", "premium", "assine"].includes(value) ? value : "dashboard";
  }

  function setView(view, options = {}) {
    const next = validView(view);
    $$('[data-free-view]').forEach((section) => section.classList.toggle("active", section.dataset.freeView === next));
    $$('[data-free-view-target]').forEach((control) => control.classList.toggle("active", control.dataset.freeViewTarget === next && control.classList.contains("free-v10-nav-item")));
    closeMobileMenu();
    if (!options.skipHash) history.replaceState(null, "", `#${next}`);
    if (!options.keepScroll) window.scrollTo({ top: 0, behavior: options.instant ? "auto" : "smooth" });
    if (next === "aulas" && options.focusSearch) setTimeout(() => $("freeSearch")?.focus(), 160);
  }

  let activeFilter = "all";
  function applyLessonFilters() {
    const query = String($("freeSearch")?.value || "").trim().toLowerCase();
    let visible = 0;
    $$('[data-lesson-card]').forEach((card) => {
      const category = card.dataset.category;
      const filterMatch = activeFilter === "all" ||
        (activeFilter === "recentes" && card.dataset.recent === "1") ||
        (activeFilter === "instagram" && card.dataset.source === "instagram") ||
        activeFilter === category;
      const searchMatch = !query || String(card.dataset.search || "").includes(query);
      const show = filterMatch && searchMatch;
      card.hidden = !show;
      if (show) visible += 1;
    });

    const grid = $("freeLessonsGrid");
    let empty = $("freeLessonEmpty");
    if (!visible && grid) {
      if (!empty) {
        empty = document.createElement("div");
        empty.id = "freeLessonEmpty";
        empty.className = "free-v10-empty";
        grid.appendChild(empty);
      }
      empty.textContent = "Nenhuma aula encontrada com esse filtro.";
      empty.hidden = false;
    } else if (empty) empty.hidden = true;
  }

  function showMessage(text, type = "sucesso") {
    const box = $("premiumRequestMessage");
    if (!box) return;
    box.textContent = text;
    box.className = `auth-message ${type} active`;
  }

  function openCheckout(button) {
    const checkout = String(button?.dataset.checkout || "");
    if (!checkout) return showMessage("Não foi possível localizar o checkout deste plano.", "erro");
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Abrindo checkout seguro…";
    showMessage("Redirecionando para o checkout oficial da Bestfy…", "sucesso");
    setTimeout(() => {
      window.location.assign(checkout);
      setTimeout(() => { button.disabled = false; button.textContent = original; }, 1800);
    }, 180);
  }

  function bind() {
    $("freeMenu")?.addEventListener("click", () => {
      $("freeSidebar")?.classList.add("open");
      if ($("freeOverlay")) $("freeOverlay").hidden = false;
    });
    $("freeOverlay")?.addEventListener("click", closeMobileMenu);

    document.addEventListener("click", (event) => {
      const target = event.target.closest("[data-free-view-target]");
      if (target) {
        event.preventDefault();
        setView(target.dataset.freeViewTarget);
        return;
      }
      const planButton = event.target.closest("[data-checkout]");
      if (planButton) {
        event.preventDefault();
        openCheckout(planButton);
      }
    });

    $$('[data-filter]').forEach((button) => button.addEventListener("click", () => {
      activeFilter = button.dataset.filter || "all";
      $$('[data-filter]').forEach((item) => item.classList.toggle("active", item === button));
      applyLessonFilters();
    }));

    $("freeSearch")?.addEventListener("input", () => {
      setView("aulas", { keepScroll:true, instant:true, skipHash:false });
      applyLessonFilters();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) {
        event.preventDefault();
        setView("aulas", { focusSearch:true });
      }
    });

    $$('[data-scroll-premium]').forEach((button) => button.addEventListener("click", () => {
      $("premiumResources")?.scrollIntoView({ behavior:"smooth", block:"start" });
    }));

    window.addEventListener("hashchange", () => setView((window.TurmaNavigation?.hash ?? location.hash).replace("#", ""), { skipHash:true, instant:true }));
  }

  async function init() {
    renderLessons();
    bind();
    setView((window.TurmaNavigation?.hash ?? location.hash).replace("#", ""), { skipHash:true, instant:true });
    applyLessonFilters();
    await Promise.allSettled([loadUser()]);
    $("freeLoading")?.remove();
    document.body.classList.add("protected-ready");
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once:true })
    : init();
})();
