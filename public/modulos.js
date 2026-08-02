"use strict";
(() => {
  if (window.__TURMA_MODULES_PAGE__) return;
  window.__TURMA_MODULES_PAGE__ = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const COMPLETED_KEY = "turma_video_lessons_completed_v1";
  const SELECTED_KEY = "turma_video_lesson_selected_v1";

  const modules = [
    {
      id: "gemeos",
      number: "01",
      title: "Gêmeos",
      subtitle: "Família 11, 22 e 33",
      description: "Aprenda como os números 11, 22 e 33 formam a família dos gêmeos e como identificar a leitura na prática.",
      duration: "A definir",
      youtube: "",
      studyUrl: "/estudo-gemeos",
      image: "/assets/study/gemeos-card-v3.webp",
      symbol: "11"
    },
    {
      id: "espelhos",
      number: "02",
      title: "Espelhos",
      subtitle: "Inversões e conexões",
      description: "Entenda as inversões numéricas, suas regiões e como conectar os espelhos aos vizinhos na Race.",
      duration: "A definir",
      youtube: "",
      studyUrl: "/estudo-espelhos",
      image: "/assets/study/espelhos-module.webp",
      symbol: "69"
    },
    {
      id: "fibonacci",
      number: "03",
      title: "Fibonacci",
      subtitle: "Somas, terminais e Race",
      description: "Veja como usar soma, subtração, terminais e congruências para construir leituras de Fibonacci.",
      duration: "A definir",
      youtube: "",
      studyUrl: "/estudo-fibonacci",
      image: "/assets/study/fibonacci-card-v3.webp",
      symbol: "Φ"
    },
    {
      id: "magneto",
      number: "04",
      title: "Magneto",
      subtitle: "Atração e conexão",
      description: "Aprenda a encontrar conexões que atraem outros números por meio do histórico e das regiões da mesa.",
      duration: "A definir",
      youtube: "",
      studyUrl: "/estudo-magneto",
      image: "/assets/study/magneto-card-v1.svg",
      symbol: "M"
    },
    {
      id: "camaleoes",
      number: "05",
      title: "Camaleões",
      subtitle: "Adaptação e leitura",
      description: "Descubra grupos escondidos e adapte a leitura usando soma e subtração dos dígitos.",
      duration: "A definir",
      youtube: "",
      studyUrl: "/estudo-camaleoes",
      image: "/assets/study/camaleoes-card-v1.svg",
      symbol: "C"
    },
    {
      id: "pitagoras",
      number: "06",
      title: "Pitágoras",
      subtitle: "Geometria e conexão",
      description: "Conecte pontos na Race, encontre o terceiro vértice e transforme geometria em leitura prática.",
      duration: "A definir",
      youtube: "",
      studyUrl: "/estudo-triangulacao",
      image: "/assets/study/triangulacao-card-v1.svg",
      symbol: "△"
    },
    {
      id: "cavalos",
      number: "07",
      title: "Cavalos",
      subtitle: "Movimento, salto e padrão",
      description: "Treine os movimentos de cavalo, reconheça saltos recorrentes e aplique as conexões na Race.",
      duration: "A definir",
      youtube: "",
      studyUrl: "/estudo-cavalos",
      image: "",
      symbol: "♞"
    },
    {
      id: "eclipse-zero",
      number: "08",
      title: "Eclipse Zero",
      subtitle: "Terminal 0 e proteção 9",
      description: "Ative o Terminal 0, use o Terminal 9 como proteção e aprenda a interpretar a mudança da leitura.",
      duration: "A definir",
      youtube: "",
      studyUrl: "/estudo-eclipse-zero",
      image: "/assets/study/eclipse-zero-card.svg",
      symbol: "0"
    }
  ];

  let selectedId = restoreSelectedId();
  let searchTerm = "";
  let activeFilter = "all";

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

  function restoreSelectedId() {
    try {
      const saved = localStorage.getItem(SELECTED_KEY);
      return modules.some((module) => module.id === saved) ? saved : modules[0].id;
    } catch (_) {
      return modules[0].id;
    }
  }

  function completedIds() {
    try {
      const parsed = JSON.parse(localStorage.getItem(COMPLETED_KEY) || "[]");
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (_) {
      return new Set();
    }
  }

  function saveCompleted(set) {
    try {
      localStorage.setItem(COMPLETED_KEY, JSON.stringify([...set]));
    } catch (_) {}
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function youtubeId(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
    try {
      const url = new URL(raw);
      if (url.hostname.includes("youtu.be")) return url.pathname.split("/").filter(Boolean)[0] || "";
      if (url.searchParams.get("v")) return url.searchParams.get("v") || "";
      const parts = url.pathname.split("/").filter(Boolean);
      const embedIndex = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
      if (embedIndex >= 0) return parts[embedIndex + 1] || "";
    } catch (_) {}
    return "";
  }

  function moduleCard(module, completed) {
    const isActive = module.id === selectedId;
    const image = module.image
      ? `<img src="${escapeHtml(module.image)}" alt="Capa do módulo ${escapeHtml(module.title)}" loading="lazy" decoding="async" onerror="this.hidden=true">`
      : "";

    return `
      <button class="module-video-item ${isActive ? "active" : ""} ${completed ? "completed" : ""}" type="button" data-module-id="${module.id}" aria-pressed="${isActive}">
        <span class="module-video-cover">
          <span class="module-video-index">${module.number}</span>
          <span class="module-fallback">${escapeHtml(module.symbol)}</span>
          ${image}
        </span>
        <span class="module-video-copy">
          <small>MÓDULO ${module.number}</small>
          <strong>${escapeHtml(module.title)}</strong>
          <p>${escapeHtml(module.description)}</p>
          <div><span>${completed ? "Aula concluída" : "Videoaula prática"}</span><i></i><span>${escapeHtml(module.duration)}</span></div>
        </span>
        <span class="module-video-action" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M8 5.5v13L18.5 12 8 5.5Z"></path></svg>
        </span>
      </button>`;
  }

  function filteredModules() {
    const completed = completedIds();
    return modules.filter((module) => {
      const searchable = `${module.title} ${module.subtitle} ${module.description}`.toLowerCase();
      const matchesSearch = !searchTerm || searchable.includes(searchTerm);
      const matchesFilter = activeFilter === "all" ||
        (activeFilter === "completed" && completed.has(module.id)) ||
        (activeFilter === "pending" && !completed.has(module.id));
      return matchesSearch && matchesFilter;
    });
  }

  function renderList() {
    const list = $("#modulesList");
    const empty = $("#modulesEmpty");
    if (!list) return;

    const completed = completedIds();
    const visible = filteredModules();
    list.innerHTML = visible.map((module) => moduleCard(module, completed.has(module.id))).join("");
    if (empty) empty.hidden = visible.length > 0;

    $$('[data-module-id]', list).forEach((button) => {
      button.addEventListener("click", () => selectModule(button.dataset.moduleId, true));
    });
  }

  function selectedModule() {
    return modules.find((module) => module.id === selectedId) || modules[0];
  }

  function renderPlayer() {
    const module = selectedModule();
    const completed = completedIds().has(module.id);
    const videoId = youtubeId(module.youtube);
    const frame = $("#modulesPlayerFrame");

    if (frame) {
      if (videoId) {
        frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1" title="Videoaula ${escapeHtml(module.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
      } else {
        frame.innerHTML = `
          <div class="modules-video-placeholder" id="modulesVideoPlaceholder">
            <span class="modules-play-symbol" aria-hidden="true">
              <svg viewBox="0 0 64 64"><path d="M24 17.5v29l24-14.5-24-14.5Z"></path></svg>
            </span>
            <small>VIDEOAULA</small>
            <strong>${escapeHtml(module.title)}</strong>
            <p>Esta aula está preparada para receber o vídeo oficial do YouTube assim que a gravação for publicada.</p>
          </div>`;
      }
    }

    $("#selectedModuleNumber") && ($("#selectedModuleNumber").textContent = `MÓDULO ${module.number}`);
    $("#selectedModuleStatus") && ($("#selectedModuleStatus").textContent = videoId ? "DISPONÍVEL" : "EM PREPARAÇÃO");
    $("#selectedModuleTitle") && ($("#selectedModuleTitle").textContent = module.title);
    $("#selectedModuleDescription") && ($("#selectedModuleDescription").textContent = module.description);
    $("#selectedModuleDuration") && ($("#selectedModuleDuration").textContent = module.duration);
    $("#selectedProgressText") && ($("#selectedProgressText").textContent = completed ? "100%" : "0%");
    $("#selectedProgressBar")?.style.setProperty("width", completed ? "100%" : "0%");

    const completeButton = $("#markLessonCompleted");
    if (completeButton) {
      completeButton.classList.toggle("is-completed", completed);
      const label = completeButton.querySelector("span");
      if (label) label.textContent = completed ? "Aula concluída" : "Marcar como concluída";
    }

    const note = $("#modulesComingNote");
    if (note) note.hidden = Boolean(videoId);
  }

  function selectModule(id, userInitiated = false) {
    if (!modules.some((module) => module.id === id)) return;
    selectedId = id;
    try { localStorage.setItem(SELECTED_KEY, id); } catch (_) {}
    renderList();
    renderPlayer();

    if (userInitiated && matchMedia("(max-width: 980px)").matches) {
      $("#modulesPlayerCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function toggleCompleted() {
    const module = selectedModule();
    const completed = completedIds();
    if (completed.has(module.id)) completed.delete(module.id);
    else completed.add(module.id);
    saveCompleted(completed);
    renderList();
    renderPlayer();
    renderSummary();
  }

  function renderSummary() {
    const total = modules.length;
    const completed = completedIds().size;
    const percentage = Math.round((completed / total) * 100);

    $("#modulesCompletedCount") && ($("#modulesCompletedCount").textContent = String(completed));
    $("#modulesProgressPercent") && ($("#modulesProgressPercent").textContent = `${percentage}%`);
    $("#sidebarProgressText") && ($("#sidebarProgressText").textContent = `${completed} de ${total} aulas concluídas`);
    $("#sidebarProgressBar")?.style.setProperty("width", `${percentage}%`);
  }

  function applyUser(user = {}) {
    const name = String(user.nome || user.name || "Primo");
    const first = name.trim().split(/\s+/)[0] || "Primo";
    const role = String(user.cargo || user.tipo || user.role || "Aluno");
    const photo = user.foto || user.fotoPerfil || user.avatar || user.photoURL || "";

    $$('[data-user-name]').forEach((element) => { element.textContent = first; });
    $$('[data-user-role]').forEach((element) => { element.textContent = role; });
    $$('[data-user-avatar]').forEach((element) => {
      if (photo) element.innerHTML = `<img src="${escapeHtml(photo)}" alt="${escapeHtml(first)}" decoding="async">`;
      else element.textContent = first.charAt(0).toUpperCase();
    });
  }

  async function loadUser() {
    const access = token();
    if (!access) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch("/me", {
        headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) applyUser(data.usuario || data.user || {});
    } catch (_) {
      // A tela continua funcional mesmo se o perfil demorar para responder.
    } finally {
      clearTimeout(timeout);
    }
  }

  function bind() {
    $("#modulesSearch")?.addEventListener("input", (event) => {
      searchTerm = String(event.target.value || "").trim().toLowerCase();
      renderList();
    });

    $("#modulesFilter")?.addEventListener("change", (event) => {
      activeFilter = event.target.value || "all";
      renderList();
    });

    $("#markLessonCompleted")?.addEventListener("click", toggleCompleted);
    $("#openStudyModule")?.addEventListener("click", () => {
      location.href = selectedModule().studyUrl;
    });

    $("#modulesMenuToggle")?.addEventListener("click", () => {
      $("#modulesSidebar")?.classList.add("open");
      const overlay = $("#modulesMobileOverlay");
      if (overlay) overlay.hidden = false;
    });

    $("#modulesMobileOverlay")?.addEventListener("click", () => {
      $("#modulesSidebar")?.classList.remove("open");
      $("#modulesMobileOverlay").hidden = true;
    });

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        $("#modulesSearch")?.focus();
      }
      if (event.key === "Escape") {
        $("#modulesSidebar")?.classList.remove("open");
        const overlay = $("#modulesMobileOverlay");
        if (overlay) overlay.hidden = true;
      }
    });
  }

  function releaseLoading() {
    const loader = $("#modulesLoading");
    if (!loader) return;
    loader.style.opacity = "0";
    loader.style.pointerEvents = "none";
    setTimeout(() => loader.remove(), 220);
  }

  function init() {
    bind();
    renderList();
    renderPlayer();
    renderSummary();
    loadUser();
    document.body.classList.add("protected-ready");
    releaseLoading();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();
})();
