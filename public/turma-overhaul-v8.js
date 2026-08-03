"use strict";
(() => {
  if (window.__TURMA_OVERHAUL_V8__) return;
  window.__TURMA_OVERHAUL_V8__ = true;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const path = (location.pathname.replace(/\/$/, "") || "/").toLowerCase();
  const VERSION = "20260803-overhaul-v8";
  const coverSvg=(title,sub,symbol)=>"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><radialGradient id="b" cx="74%" cy="42%" r="78%"><stop stop-color="#3a1169"/><stop offset=".48" stop-color="#140722"/><stop offset="1" stop-color="#050208"/></radialGradient><linearGradient id="g"><stop stop-color="#fff3b5"/><stop offset=".4" stop-color="#f4c95d"/><stop offset="1" stop-color="#a96a16"/></linearGradient></defs><rect width="1600" height="900" rx="44" fill="url(#b)"/><circle cx="1245" cy="420" r="220" fill="#09030f" stroke="#9d42ed" stroke-width="10"/><circle cx="1245" cy="420" r="160" fill="none" stroke="#f2c45b" stroke-opacity=".3"/><text x="1245" y="495" text-anchor="middle" fill="url(#g)" font-family="Georgia" font-size="220" font-weight="700">${symbol}</text><text x="130" y="170" fill="#f4cf6a" font-family="Arial" font-size="28" font-weight="800" letter-spacing="8">TURMA DO PRIMO</text><text x="130" y="405" fill="#fff" font-family="Arial" font-size="122" font-weight="900">${title}</text><text x="136" y="487" fill="#d5b3ef" font-family="Arial" font-size="31" font-weight="700" letter-spacing="5">${sub}</text><rect x="130" y="565" width="310" height="64" rx="32" fill="#ffffff0b" stroke="#d682ff55"/><text x="285" y="607" text-anchor="middle" fill="#f0c45a" font-family="Arial" font-size="23" font-weight="800" letter-spacing="3">MÓDULO PREMIUM</text></svg>`);
  const COVERS = {
    gemeos:coverSvg("GÊMEOS","11 · 22 · 33","11"),espelhos:coverSvg("ESPELHOS","INVERSÃO E CONEXÃO","69"),fibonacci:coverSvg("FIBONACCI","SEQUÊNCIA E TERMINAIS","Φ"),magneto:coverSvg("MAGNETO","NÚMEROS QUE SE PUXAM","M"),camaleoes:coverSvg("CAMALEÕES","GRUPOS E ADAPTAÇÃO","C"),pitagoras:coverSvg("PITÁGORAS","TRIANGULAÇÃO NA RACE","△"),cavalos:coverSvg("CAVALO","FAMÍLIAS DE TERMINAIS","♞"),cavalo:coverSvg("CAVALO","FAMÍLIAS DE TERMINAIS","♞"),eclipse:coverSvg("ECLIPSE ZERO","TERMINAIS 0 E 9","0"),"eclipse-zero":coverSvg("ECLIPSE ZERO","TERMINAIS 0 E 9","0")
  };
  const MENU = [
    ["dashboard", "Dashboard", "/dashboard", "i-home"],
    ["anotacoes", "Anotações", "/notas", "i-note"],
    ["minigames", "Minigames", "/minigames", "i-game"],
    ["estudo", "Estudo", "/estudo", "i-book"],
    ["modulos", "Módulos", "/modulos", "i-layers"],
    ["gestao", "Gestão", "/gestao", "i-activity"],
    ["suporte", "Suporte", "/suporte", "i-support"],
    ["perfil", "Perfil", "/perfil", "i-user"],
    ["roleta", "Roleta", "/roleta", "i-roulette"],
    ["provas", "Provas", "/provas", "i-exam"],
    ["favoritos", "Favoritos", "/favoritos", "i-star"]
  ];

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function load(src, type, marker) {
    if (document.querySelector(`[data-${marker}]`)) return;
    const el = document.createElement(type === "style" ? "link" : "script");
    if (type === "style") { el.rel = "stylesheet"; el.href = `${src}?v=${VERSION}`; }
    else { el.src = `${src}?v=${VERSION}`; el.defer = true; }
    el.dataset[marker] = "1";
    document.head.appendChild(el);
  }
  function currentKey() {
    if (path.startsWith("/estudo-")) return "estudo";
    return MENU.find(([, , href]) => path === href || path === `${href}.html`)?.[0] || "";
  }
  function navItemHtml(key, label, href, icon) {
    if (key === "gestao") return `<a class="dash-nav-item" href="${href}" data-menu-key="${key}"><span class="tp-management-icon"><svg viewBox="0 0 24 24"><path d="M3 20h18M5 18V9m6 9V4m6 14v-6M4 10l6-6 6 9 5-6"/></svg></span><b>${label}</b></a>`;
    return `<a class="dash-nav-item" href="${href}" data-menu-key="${key}"><svg><use href="/assets/dashboard-icons.svg#${icon}"></use></svg><b>${label}</b></a>`;
  }
  function standardizeNav() {
    if (document.body.classList.contains("free-dashboard-page")) return;
    const active = currentKey();
    $$(".dash-nav,.notes-main-nav,.roulette-sidebar nav,.support-sidebar nav,.favorites-sidebar nav").forEach(nav => {
      if (nav.closest(".admin-sidebar") || nav.dataset.v8Standardized === "1") return;
      const hasEnough = nav.querySelectorAll("a,button").length >= 5;
      if (!hasEnough) return;
      nav.innerHTML = MENU.map(args => navItemHtml(...args)).join("");
      nav.querySelector(`[data-menu-key="${active}"]`)?.classList.add("active");
      nav.dataset.v8Standardized = "1";
    });
  }
  function moduleKey(el) {
    const text = normalize(`${el.dataset.module || ""} ${el.dataset.moduleId || ""} ${el.textContent || ""} ${el.getAttribute?.("href") || ""}`);
    if (text.includes("geme")) return "gemeos";
    if (text.includes("espelh")) return "espelhos";
    if (text.includes("fibonacci")) return "fibonacci";
    if (text.includes("magnet")) return "magneto";
    if (text.includes("camale")) return "camaleoes";
    if (text.includes("pitag") || text.includes("triang")) return "pitagoras";
    if (text.includes("caval")) return "cavalos";
    if (text.includes("eclipse")) return "eclipse-zero";
    return "";
  }
  function applyCovers() {
    const candidates = $$(".study-module-card,.module-video-item,[data-module-card],[data-module-id],a[href*='estudo-']");
    candidates.forEach(card => {
      const key = moduleKey(card), src = COVERS[key];
      if (!src) return;
      let img = card.querySelector(".study-module-art img,.module-video-cover img,img");
      const host = card.querySelector(".study-module-art,.module-video-cover");
      if (!img && host) { img = document.createElement("img"); host.appendChild(img); }
      if (!img) return;
      const final = src.startsWith("data:") ? src : `${src}?v=${VERSION}`;
      if (img.src !== new URL(final, location.origin).href) img.src = final;
      img.removeAttribute("srcset"); img.hidden = false; img.loading = "eager"; img.decoding = "async";
      img.onerror = () => { img.onerror = null; img.src = "/assets/turma-primo-logo.svg"; img.style.objectFit = "contain"; img.style.padding = "26px"; };
    });
    if (path === "/modulos" || path === "/modulos.html") {
      const selected = $("[data-module-id].active") || $("[data-module-id]");
      const key = selected ? moduleKey(selected) : "gemeos";
      const frame = $("#modulesPlayerFrame");
      if (frame && key && !frame.querySelector(".modules-player-cover")) {
        const img = document.createElement("img"); img.className = "modules-player-cover"; img.src = COVERS[key].startsWith("data:") ? COVERS[key] : `${COVERS[key]}?v=${VERSION}`; img.alt = ""; frame.prepend(img);
      } else if (frame?.querySelector(".modules-player-cover") && COVERS[key]) frame.querySelector(".modules-player-cover").src = COVERS[key].startsWith("data:") ? COVERS[key] : `${COVERS[key]}?v=${VERSION}`;
    }
  }
  function ensureEbookActions() {
    if (path !== "/modulos" && path !== "/modulos.html") return;
    const routes = {
      gemeos: "/estudo-gemeos", espelhos: "/estudo-espelhos", fibonacci: "/estudo-fibonacci",
      magneto: "/estudo-magneto", camaleoes: "/estudo-camaleoes", pitagoras: "/estudo-triangulacao",
      cavalos: "/estudo-cavalos", "eclipse-zero": "/estudo-eclipse-zero"
    };
    const selected = $("[data-module-id].active") || $("[data-module-id]");
    const key = selected ? moduleKey(selected) : "gemeos";
    const actions = $(".modules-player-actions");
    if (actions) {
      let ebook = $("#openModuleEbook", actions);
      if (!ebook) {
        ebook = document.createElement("button");
        ebook.id = "openModuleEbook";
        ebook.type = "button";
        ebook.className = "modules-secondary-action tp-ebook-action";
        ebook.innerHTML = '<svg><use href="/assets/dashboard-icons.svg#i-note"></use></svg><span>Acessar e-book</span>';
        actions.appendChild(ebook);
      }
      ebook.dataset.href = routes[key] || "/estudo";
      ebook.onclick = () => { location.href = ebook.dataset.href; };
    }
    $$("[data-module-id]").forEach(item => {
      const itemKey = moduleKey(item), copy = item.querySelector(".module-video-copy");
      if (!copy || copy.querySelector(".tp-ebook-inline")) return;
      const link = document.createElement("a");
      link.className = "tp-ebook-inline";
      link.href = routes[itemKey] || "/estudo";
      link.textContent = "Acessar e-book →";
      link.addEventListener("click", event => event.stopPropagation());
      copy.appendChild(link);
    });
  }
  function fixNotesCopy() {
    if (!["/notas", "/notas.html", "/anotacoes", "/anotacoes.html"].includes(path)) return;
    document.title = "Anotações | Turma do Primo";
    const replacements = [[".notes-title-group h1", "Anotações"], [".notes-title-group p", "Registre, organize e compartilhe seus estudos."], ["#newNoteButton", "＋ Nova anotação"]];
    replacements.forEach(([s, t]) => { const el = $(s); if (el && !el.querySelector("svg")) el.textContent = t; });
    $$(".note-card-category").forEach(el => { el.textContent = el.textContent.replace(/^\s*[●#]+\s*/, ""); });
    $$("#noteCategory option,#categoryFilter option").forEach(opt => { opt.textContent = opt.textContent.replace(/^#+\s*/, "").replace(/[_-]+/g, " "); });
  }
  function metrics() {
    const keys = ["study_espelhos_gemeos_v1","study_espelhos_v1","study_fibonacci_v1","study_magneto_v1","study_camaleoes_v2","study_triangulacao_v1","study_cavalos_v1","study_eclipse_zero_v1"];
    const values = keys.map(key => { try { const x = JSON.parse(localStorage.getItem(key) || "{}"); const p = Object.values(x.progress || {}); return p.length ? Math.round(p.filter(Boolean).length / Math.max(3, p.length) * 100) : 0; } catch { return 0; } });
    let lessonDone = 0; try { const a = JSON.parse(localStorage.getItem("turma_video_lessons_completed_v1") || "[]"); lessonDone = Array.isArray(a) ? a.length : 0; } catch {}
    const done = Math.max(values.filter(v => v >= 100).length, lessonDone);
    const average = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    let examAverage = 0; try { const h = JSON.parse(localStorage.getItem("turma_exam_history_v8") || "[]"); if (h.length) examAverage = h.reduce((a, x) => a + Number(x.score || 0), 0) / h.length; } catch {}
    const set = (s, v) => $$(s).forEach(el => el.textContent = v);
    set("#statModules,#legendDone,#homeCompletedSide", `${Math.min(8, done)} / 8`);
    set("#statProgress,#progressValue,#homeScore", `${average}%`);
    set("#statAverage", examAverage ? examAverage.toFixed(1).replace(".", ",") : "0,0");
    $("#progressRing")?.style.setProperty("--value", average);
    $("#homeScoreRing")?.style.setProperty("--score", `${average}%`);
  }
  function fixPortraits() {
    $(".auth-portrait")?.setAttribute("draggable", "false");
    const dash = $(".dash-hero-portrait-wrap img,.dash-hero-portrait"); if (dash) { dash.loading = "eager"; dash.decoding = "async"; dash.setAttribute("draggable", "false"); }
  }
  function fixThemeMeta() {
    const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f3f1f6" : "#07030d");
  }
  function loadRouteFeatures() {
    if (path.startsWith("/estudo-") && path !== "/estudo.html") {
      load("/module-lab-v8.css", "style", "moduleLabV8Css");
      load("/module-lab-v8.js", "script", "moduleLabV8Js");
    }
    if (path === "/provas" || path === "/provas.html") {
      load("/exams-engine-v8.js", "script", "examsEngineV8Js");
    }
  }
  function observe() {
    let timer = 0;
    const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => { standardizeNav(); applyCovers(); ensureEbookActions(); fixNotesCopy(); metrics(); }, 90); });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  }
  function init() {
    document.body.classList.add("tp-overhaul-v8");
    standardizeNav(); applyCovers(); ensureEbookActions(); fixNotesCopy(); metrics(); fixPortraits(); fixThemeMeta(); loadRouteFeatures(); observe();
    window.addEventListener("turma:theme-change", fixThemeMeta);
    window.addEventListener("storage", metrics);
    document.addEventListener("click", e => {
      const item = e.target.closest("[data-module-id]");
      if (item) setTimeout(applyCovers, 30);
    });
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
