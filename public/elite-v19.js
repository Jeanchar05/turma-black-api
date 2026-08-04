"use strict";
(() => {
  if (window.__TURMA_ELITE_V19__) return;
  window.__TURMA_ELITE_V19__ = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const route = (location.pathname.replace(/\/$/, "") || "/").replace(/\.html$/, "").toLowerCase();
  const THEME_KEY = "turma_global_theme_v2";
  const SOUND_KEY = "turma_elite_sound";
  const nav = [
    ["/dashboard", "Início", "i-home"],
    ["/estudo", "Estudos", "i-book"],
    ["/modulos", "Módulos", "i-layers"],
    ["/gestao", "Gestão", "i-activity"],
    ["/perfil", "Perfil", "i-user"]
  ];
  const moduleFallback = [
    ["Gêmeos", 67, "Ⅱ"], ["Espelhos", 0, "◇"], ["Fibonacci", 0, "Φ"],
    ["Magneto", 0, "∩"], ["Camaleões", 0, "◉"]
  ];
  let audioContext = null;
  let soundEnabled = true;

  function active(href) {
    if (href === "/dashboard") return route === "/" || route.startsWith("/dashboard");
    return route === href || route.startsWith(`${href}-`);
  }

  function normalizeNavigation() {
    const current = route === "/roleta-reel" ? "/minigames" : route;
    $$(".dash-nav,.notes-main-nav,.support-nav,.favorites-nav,.roulette-nav").forEach((container) => {
      const links = $$('a[href]', container);
      links.forEach((link) => {
        const href = (link.getAttribute("href") || "").replace(/\.html$/, "").replace(/\/$/, "") || "/";
        const text = link.querySelector("b,span:last-child");
        if (href === "/notas" && text) text.textContent = "Anotações";
        link.classList.toggle("active", href === current || (href === "/dashboard" && current === "/"));
      });
      if (!container.querySelector('a[href="/gestao"]')) {
        const anchor = document.createElement("a");
        anchor.className = `dash-nav-item${current === "/gestao" ? " active" : ""}`;
        anchor.href = "/gestao";
        anchor.innerHTML = '<svg><use href="/assets/dashboard-icons.svg#i-activity"></use></svg><b>Gestão</b>';
        container.querySelector('a[href="/modulos"]')?.insertAdjacentElement("afterend", anchor);
      }
    });
    $$(".notes-title-group h1").forEach((title) => title.textContent = "Anotações");
    document.title = document.title.replace(/^Notas\b/i, "Anotações");
  }

  function getTheme() {
    try {
      const value = localStorage.getItem(THEME_KEY) || localStorage.getItem("theme") || localStorage.getItem("turma_theme");
      return value === "light" ? "light" : "dark";
    } catch (_) { return "dark"; }
  }

  function paintTheme(value, persist = true) {
    const theme = value === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#edf0f5" : "#03050a");
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
        localStorage.setItem("theme", theme);
        localStorage.setItem("turma_theme", theme);
      } catch (_) {}
    }
    const icon = theme === "light" ? "i-sun" : "i-moon";
    $$('[data-global-theme],.dash-theme-toggle,#studyThemeToggle,#profileThemeToggle,#reelThemeToggle,#themeButton,#rouletteThemeToggle,#examThemeToggle,#favoritesThemeToggle').forEach((button) => {
      button.setAttribute("aria-pressed", String(theme === "light"));
      button.title = theme === "light" ? "Ativar tema escuro" : "Ativar tema claro";
      const use = $("use", button);
      if (use && /i-(moon|sun)/.test(use.getAttribute("href") || "")) use.setAttribute("href", `/assets/dashboard-icons.svg#${icon}`);
    });
  }

  function bindTheme() {
    paintTheme(getTheme(), false);
    document.addEventListener("click", (event) => {
      const button = event.target.closest('[data-global-theme],.dash-theme-toggle,#studyThemeToggle,#profileThemeToggle,#reelThemeToggle,#themeButton,#rouletteThemeToggle,#examThemeToggle,#favoritesThemeToggle');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      paintTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
      playTone("soft");
    }, true);
  }

  function loadSoundPreference() {
    try { soundEnabled = localStorage.getItem(SOUND_KEY) !== "0"; } catch (_) { soundEnabled = true; }
  }

  function getAudioContext() {
    if (!audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      audioContext = new AudioCtor();
    }
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  }

  function tone(frequency, duration, volume = 0.018, delay = 0, type = "sine") {
    if (!soundEnabled) return;
    try {
      const context = getAudioContext();
      if (!context) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + delay);
      gain.gain.setValueAtTime(volume, context.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + duration + 0.02);
    } catch (_) {}
  }

  function playTone(kind = "click") {
    if (kind === "soft") tone(520, 0.055, 0.014);
    else if (kind === "success") { tone(520, .075, .018); tone(720, .1, .018, .07); }
    else { tone(420, .045, .012); tone(610, .035, .008, .035); }
  }

  function soundButton() {
    const top = $(".dash-top-actions,.notes-top-actions,.support-top-actions");
    if (!top || $(".elite-sound-toggle", top)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "elite-sound-toggle";
    button.setAttribute("aria-label", "Ativar ou desativar sons da interface");
    button.innerHTML = `<span aria-hidden="true">${soundEnabled ? "🔊" : "🔇"}</span>`;
    button.title = soundEnabled ? "Desativar sons" : "Ativar sons";
    const themeButton = $(".dash-theme-toggle,#studyThemeToggle,#profileThemeToggle,#reelThemeToggle,#themeButton,#examThemeToggle,#favoritesThemeToggle", top);
    if (themeButton) themeButton.insertAdjacentElement("beforebegin", button); else top.prepend(button);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      soundEnabled = !soundEnabled;
      try { localStorage.setItem(SOUND_KEY, soundEnabled ? "1" : "0"); } catch (_) {}
      button.innerHTML = `<span aria-hidden="true">${soundEnabled ? "🔊" : "🔇"}</span>`;
      button.title = soundEnabled ? "Desativar sons" : "Ativar sons";
      if (soundEnabled) playTone("success");
    });
  }

  function bindInterfaceSounds() {
    document.addEventListener("pointerdown", (event) => {
      if (!soundEnabled) return;
      const target = event.target.closest('button,a,.study-module-card,.module-video-item,.exam-card,[data-favorite-card]');
      if (!target || target.classList.contains("elite-sound-toggle") || target.closest("input,textarea,select,[contenteditable=true]")) return;
      playTone(target.matches('.dash-primary-btn,.notes-new-button,.support-primary-btn,.profile-primary-btn,.bankroll-btn.primary,.modules-primary-action,.minigames-play,.reel-spin') ? "success" : "click");
    }, { passive: true });
  }

  function removeMobileBars() {
    $$(".tp-mobile-bottom-nav,.dash-mobile-bottom,.m16-bottom").forEach((bar) => bar.remove());
  }

  function createMobileBar() {
    if (route === "/" || route.includes("dashboard-free") || route.startsWith("/admin") || route.startsWith("/painel-vendas")) return;
    removeMobileBars();
    const bar = document.createElement("nav");
    bar.className = "tp-mobile-bottom-nav";
    bar.setAttribute("aria-label", "Navegação principal no celular");
    bar.innerHTML = nav.map(([href, label, icon]) => `<a href="${href}" class="${active(href) ? "active" : ""}"><svg><use href="/assets/dashboard-icons.svg#${icon}"></use></svg><span>${label}</span></a>`).join("");
    document.body.appendChild(bar);
  }

  function bindDrawer(sidebar, button, overlay) {
    if (!sidebar || !button || button.dataset.eliteDrawer === "1") return;
    button.dataset.eliteDrawer = "1";
    const close = () => {
      sidebar.classList.remove("open");
      if (overlay) overlay.hidden = true;
      document.body.classList.remove("elite-menu-open");
    };
    button.addEventListener("click", (event) => {
      if (!matchMedia("(max-width: 860px)").matches) return;
      event.preventDefault();
      sidebar.classList.add("open");
      if (overlay) overlay.hidden = false;
      document.body.classList.add("elite-menu-open");
      playTone("soft");
    });
    overlay?.addEventListener("click", close);
    sidebar.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
  }

  function drawers() {
    [
      ["#dashSidebar", "#dashMenuToggle", "#dashMobileOverlay"],
      ["#studySidebar", "#studyMenuToggle", "#studyMobileOverlay"],
      ["#modulesSidebar", "#modulesMenuToggle", "#modulesMobileOverlay"],
      ["#profileSidebar", "#profileMenuToggle", "#profileMobileOverlay"],
      ["#examSidebar", "#examMenuToggle", "#examMobileOverlay"],
      ["#favoritesSidebar", "#favoritesMenuToggle", "#favoritesMobileOverlay"],
      ["#reelSidebar", "#reelMenuToggle", "#reelMobileOverlay"],
      ["#notesSidebar", "#notesMenuButton", "#notesMobileOverlay"],
      ["#supportSidebar", "#supportMenuButton", "#supportMobileOverlay"],
      ["#rouletteSidebar", "#rouletteMenuToggle", "#rouletteMobileOverlay"]
    ].forEach(([sidebar, button, overlay]) => bindDrawer($(sidebar), $(button), $(overlay)));
  }

  function notificationFix() {
    $$('a[href="/notificacoes"],a[href="/notificacoes.html"]').forEach((link) => {
      link.href = "#";
      if (link.dataset.eliteNotification === "1") return;
      link.dataset.eliteNotification = "1";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const panelButton = $("#notificationButton,.dash-notification-btn");
        if (panelButton && panelButton !== link) panelButton.click();
      });
    });
  }

  function notesMobile() {
    if (route !== "/notas") return;
    const editor = $("#notesEditor");
    const form = $("#noteEditorForm");
    if (!editor || !form) return;
    const sync = () => editor.classList.toggle("is-open", !form.hidden && !editor.classList.contains("is-empty"));
    new MutationObserver(sync).observe(form, { attributes: true, attributeFilter: ["hidden", "style", "class"] });
    document.addEventListener("click", (event) => {
      if (event.target.closest('[data-editor-action="close"]')) {
        editor.classList.remove("is-open");
        if (matchMedia("(max-width: 860px)").matches) editor.classList.add("is-empty");
      }
      if (event.target.closest(".note-card,[data-note-card],[data-create-note],#newNoteButton")) setTimeout(sync, 60);
    });
    const tags = $("#noteTags");
    if (tags) tags.placeholder = "Ex.: resumo, estratégia, importante";
    sync();
  }

  function dashboardFallback() {
    if (!route.startsWith("/dashboard") || route.includes("free")) return;
    const ringText = parseFloat(($("#statProgress")?.textContent || "0").replace(",", ".")) || 0;
    $(".dash-progress-icon")?.style.setProperty("--progress", `${Math.max(0, Math.min(100, ringText))}%`);
    const list = $("#tpV10ModuleProgress");
    if (list && !list.children.length) {
      list.innerHTML = moduleFallback.map(([name, percent, symbol]) => `<article><span class="tp-v10-mini-icon">${symbol}</span><div><b>${name}</b><i style="--p:${percent}%"></i></div><small>${percent}%</small></article>`).join("");
    }
  }

  function scoreRings() {
    const score = parseFloat(($("#homeScore")?.textContent || "0").replace(",", ".")) || 0;
    $("#homeScoreRing")?.style.setProperty("--score", `${Math.max(0, Math.min(100, score))}%`);
  }

  function imageSafety() {
    $$("img").forEach((image) => {
      image.decoding = "async";
      if (!image.closest(".reference-hero,.study-approved-hero,.support-hero,.m16-hero")) image.loading = "lazy";
      if (image.dataset.eliteError === "1") return;
      image.dataset.eliteError = "1";
      image.addEventListener("error", () => image.classList.add("image-load-failed"), { once: true });
    });
  }

  function revealAnimations() {
    const selectors = [
      ".reference-hero", ".reference-stats>article", ".reference-card", ".dash-modules-shelf",
      ".study-approved-hero", ".study-metric", ".study-module-card", ".study-home-side-card",
      ".modules-heading", ".module-video-item", ".modules-player-card",
      ".bankroll-hero", ".bankroll-summary-card", ".bankroll-panel",
      ".minigames-heading", ".minigames-banner", ".minigames-feature",
      ".support-hero", ".support-shortcuts>button", ".support-card",
      ".profile-heading", ".profile-identity-card", ".profile-card",
      ".exam-heading", ".exam-card", ".exam-side-card",
      ".favorites-hero", ".favorites-stats>article", ".favorites-card", ".favorites-quick-card",
      ".reel-heading", ".reel-wheel-card", ".reel-side-card", ".reel-race-section"
    ];
    $$(selectors.join(",")).forEach((element, index) => {
      element.dataset.eliteReveal = "";
      element.style.transitionDelay = `${Math.min(index % 8, 7) * 38}ms`;
    });
    if (!("IntersectionObserver" in window)) {
      $$('[data-elite-reveal]').forEach((element) => element.classList.add("elite-in"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("elite-in");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -30px" });
    $$('[data-elite-reveal]').forEach((element) => observer.observe(element));
  }

  function releaseLoading() {
    setTimeout(() => {
      $$(".dash-loading,.notes-loading,.support-loading,.modules-loading").forEach((loading) => {
        loading.hidden = true;
        loading.style.display = "none";
      });
      document.body.style.opacity = "1";
      document.body.style.visibility = "visible";
    }, 950);
  }

  function init() {
    document.documentElement.dataset.uiElite = "v19";
    loadSoundPreference();
    normalizeNavigation();
    bindTheme();
    soundButton();
    bindInterfaceSounds();
    createMobileBar();
    drawers();
    notificationFix();
    notesMobile();
    dashboardFallback();
    scoreRings();
    imageSafety();
    revealAnimations();
    releaseLoading();

    let timer = 0;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        normalizeNavigation();
        notificationFix();
        dashboardFallback();
        scoreRings();
        imageSafety();
        if (!$(".tp-mobile-bottom-nav")) createMobileBar();
      }, 80);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
