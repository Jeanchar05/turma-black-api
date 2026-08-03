"use strict";
(() => {
  if (window.__TURMA_SITE_STABILIZATION_V9__) return;
  window.__TURMA_SITE_STABILIZATION_V9__ = true;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const modules = [
    { key:"gemeos", names:["gemeos","gêmeos"], title:"GÊMEOS", subtitle:"11 · 22 · 33", icon:"Ⅱ", accent:"#b56cff" },
    { key:"espelhos", names:["espelho","espelhos"], title:"ESPELHOS", subtitle:"REFLEXO E CONEXÃO", icon:"◇", accent:"#f2c45a" },
    { key:"fibonacci", names:["fibonacci"], title:"FIBONACCI", subtitle:"SEQUÊNCIA E PROTEÇÃO", icon:"∞", accent:"#8d63ff" },
    { key:"magneto", names:["magneto"], title:"MAGNETO", subtitle:"NÚMEROS QUE SE PUXAM", icon:"∩", accent:"#46a6ff" },
    { key:"camaleoes", names:["camaleoes","camaleões"], title:"CAMALEÕES", subtitle:"ADAPTAÇÃO E LEITURA", icon:"◉", accent:"#66dc9a" },
    { key:"pitagoras", names:["pitagoras","pitágoras","triangulacao","triangulação"], title:"PITÁGORAS", subtitle:"TRIANGULAÇÃO", icon:"△", accent:"#ff8fb3" },
    { key:"cavalo", names:["cavalo","cavalos"], title:"CAVALO", subtitle:"1·4·7  2·5·8  3·6·9", icon:"♞", accent:"#61b7ff" },
    { key:"eclipse", names:["eclipse zero","eclipse"], title:"ECLIPSE ZERO", subtitle:"TERMINAIS 0 E 9", icon:"◐", accent:"#f0c45a" }
  ];

  function svgCover(item) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><radialGradient id="g" cx="74%" cy="32%" r="70%"><stop stop-color="${item.accent}" stop-opacity=".34"/><stop offset=".48" stop-color="#28103e"/><stop offset="1" stop-color="#07030d"/></radialGradient><linearGradient id="a" x1="0" x2="1"><stop stop-color="${item.accent}"/><stop offset="1" stop-color="#f4d27a"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#000" flood-opacity=".62"/></filter></defs><rect width="1600" height="900" rx="48" fill="url(#g)"/><circle cx="1240" cy="350" r="260" fill="none" stroke="${item.accent}" stroke-opacity=".22" stroke-width="4"/><circle cx="1240" cy="350" r="190" fill="none" stroke="#f0c45a" stroke-opacity=".18" stroke-width="3"/><path d="M0 710C330 610 620 650 920 760S1380 860 1600 720" fill="none" stroke="${item.accent}" stroke-opacity=".18" stroke-width="5"/><g transform="translate(120 105)"><rect width="96" height="112" rx="22" fill="#13081d" stroke="#f0c45a" stroke-width="3"/><text x="48" y="78" text-anchor="middle" font-family="Georgia" font-size="62" font-weight="700" fill="#f0c45a">P</text><text x="125" y="46" font-family="Arial" font-size="20" letter-spacing="8" fill="#cfc4d5">TURMA DO PRIMO</text><text x="125" y="83" font-family="Arial" font-size="14" letter-spacing="5" fill="${item.accent}">MÓDULO EXCLUSIVO</text></g><g transform="translate(120 380)" filter="url(#s)"><text font-family="Arial" font-size="30" font-weight="700" letter-spacing="9" fill="${item.accent}">MÓDULO</text><text y="115" font-family="Georgia" font-size="118" font-weight="700" fill="url(#a)">${item.title}</text><text y="175" font-family="Arial" font-size="22" letter-spacing="8" fill="#d9cedf">${item.subtitle}</text></g><g transform="translate(1240 350)"><circle r="132" fill="#100718" stroke="${item.accent}" stroke-width="5"/><circle r="96" fill="#1e0b2b" stroke="#f0c45a" stroke-opacity=".7" stroke-width="3"/><text y="45" text-anchor="middle" font-family="Georgia" font-size="138" fill="url(#a)">${item.icon}</text></g><g transform="translate(120 790)"><rect width="620" height="2" fill="url(#a)"/><text y="42" font-family="Arial" font-size="16" letter-spacing="5" fill="#b9adbf">ESTUDE · PRATIQUE · EVOLUA</text></g></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function identify(element) {
    const text = normalize(`${element.textContent || ""} ${element.getAttribute?.("href") || ""} ${element.getAttribute?.("data-module") || ""}`);
    return modules.find(item => item.names.some(name => text.includes(normalize(name))));
  }

  function fixModuleImages() {
    const candidates = $$(".study-module-card,.module-video-item,[data-module],a[href*='estudo-']");
    candidates.forEach(card => {
      const item = identify(card);
      if (!item) return;
      const image = $(".study-module-art img,.module-video-cover img,img", card);
      if (!image) return;
      const src = svgCover(item);
      if (image.dataset.v9Cover === item.key) return;
      image.dataset.v9Cover = item.key;
      image.src = src;
      image.removeAttribute("srcset");
      image.loading = "eager";
      image.decoding = "async";
      image.alt = `Capa do módulo ${item.title}`;
      image.onerror = () => { image.src = src; };
    });
  }

  function fixInternalHero() {
    const path = normalize(location.pathname);
    const item = modules.find(module => module.names.some(name => path.includes(normalize(name))));
    if (!item) return;
    const hero = $(".strategy-hero,.strategy-head,.module-hero");
    if (!hero || $(".tp-v9-module-cover", hero)) return;
    const art = $(".hero-art", hero);
    if (art) {
      art.innerHTML = `<img class="tp-v9-module-cover" src="${svgCover(item)}" alt="Capa do módulo ${item.title}">`;
      art.classList.remove("study-final-hidden-art");
    } else {
      hero.insertAdjacentHTML("beforeend", `<div class="hero-art"><img class="tp-v9-module-cover" src="${svgCover(item)}" alt="Capa do módulo ${item.title}"></div>`);
    }
  }

  function fixNotes() {
    const editor = $("#noteEditorForm");
    if (!editor) return;
    const category = $("#noteCategory");
    const tags = $("#noteTags");
    if (category && category.parentElement && !category.parentElement.querySelector(":scope > span")) category.insertAdjacentHTML("beforebegin", "<span>Categoria</span>");
    if (tags && tags.parentElement && !tags.parentElement.querySelector(":scope > span")) tags.insertAdjacentHTML("beforebegin", "<span>Adicionar tags</span>");
    $(".notes-title-group h1")?.replaceChildren(document.createTextNode("Anotações"));
    $$(".notes-main-nav a").forEach(link => { if (normalize(link.textContent).trim() === "notas") link.querySelector("span")?.replaceChildren(document.createTextNode("Anotações")); });

    const toolbar = $("#notesToolbar");
    if (toolbar && !toolbar.dataset.v9Bound) {
      toolbar.dataset.v9Bound = "1";
      toolbar.addEventListener("click", event => {
        const button = event.target.closest("[data-command]");
        if (!button) return;
        event.preventDefault();
        const command = button.dataset.command;
        const value = button.dataset.value || null;
        const content = $("#noteContent");
        content?.focus();
        if (command === "createLink") {
          const url = prompt("Cole o endereço do link:", "https://");
          if (url) document.execCommand("createLink", false, url);
        } else document.execCommand(command, false, value);
        content?.dispatchEvent(new InputEvent("input", { bubbles:true }));
      });
    }
  }

  function fixSidebarAndNotifications() {
    $$("a[href='/notificacoes'],a[href='/notificacoes.html']").forEach(link => {
      link.href = "#";
      link.addEventListener("click", event => {
        event.preventDefault();
        const panel = $("#notificationPanel");
        if (panel) panel.hidden = !panel.hidden;
      });
    });
    const menus = [
      ["#studyMenuToggle","#studySidebar","#studyMobileOverlay"],
      ["#reelMenuToggle","#reelSidebar","#reelMobileOverlay"],
      ["#notesMenuButton","#notesSidebar","#notesMobileOverlay"],
      ["#dashMenuToggle","#dashSidebar","#dashMobileOverlay"]
    ];
    menus.forEach(([button,sidebar,overlay]) => {
      const btn=$(button), side=$(sidebar), layer=$(overlay);
      if (!btn || !side || btn.dataset.v9Bound) return;
      btn.dataset.v9Bound="1";
      btn.addEventListener("click", () => { side.classList.add("open"); if(layer) layer.hidden=false; });
      layer?.addEventListener("click", () => { side.classList.remove("open"); layer.hidden=true; });
    });
  }

  function fixBrokenImages() {
    document.addEventListener("error", event => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      const card = image.closest(".study-module-card,.module-video-item,[data-module]");
      const item = card && identify(card);
      if (item && image.dataset.v9Fallback !== item.key) {
        image.dataset.v9Fallback = item.key;
        image.src = svgCover(item);
      }
    }, true);
  }

  function run() {
    fixModuleImages();
    fixInternalHero();
    fixNotes();
    fixSidebarAndNotifications();
    fixBrokenImages();
    const observer = new MutationObserver(() => { fixModuleImages(); fixInternalHero(); fixNotes(); });
    observer.observe(document.body, { childList:true, subtree:true });
    setTimeout(() => observer.disconnect(), 15000);
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", run, { once:true }) : run();
})();
