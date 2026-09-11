"use strict";

(() => {
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const validViews = new Set(["dashboard", "aulas", "premium", "assine"]);
  const sprite = "/assets/free-icons-v12.svg";

  function icon(id, className = "") {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true"><use href="${sprite}#${id}"></use></svg>`;
  }

  function closeMenu() {
    document.getElementById("freeSidebar")?.classList.remove("open");
    const overlay = document.getElementById("freeOverlay");
    if (overlay) overlay.hidden = true;
  }

  function setView(rawView, updateHash = true) {
    const view = validViews.has(rawView) ? rawView : "dashboard";

    $$('[data-free-view]').forEach((section) => {
      const active = section.dataset.freeView === view;
      section.classList.toggle("active", active);
      section.hidden = !active;
      section.style.display = active ? "block" : "none";
      section.setAttribute("aria-hidden", active ? "false" : "true");
    });

    $$('[data-free-view-target]').forEach((control) => {
      const active = control.dataset.freeViewTarget === view;
      control.classList.toggle("active", active && control.classList.contains("free-v10-nav-item"));
      if (control.classList.contains("free-v10-nav-item")) {
        control.setAttribute("aria-current", active ? "page" : "false");
      }
    });

    document.body.dataset.freeActiveView = view;
    closeMenu();

    if (updateHash) {
      try { history.replaceState(null, "", `#${view}`); } catch (_) {}
    }

    window.scrollTo({ top: 0, behavior: "auto" });
    window.dispatchEvent(new CustomEvent("free:viewchange", { detail: { view } }));
  }

  function installIcons() {
    const navMap = {
      dashboard: "i-dashboard",
      aulas: "i-lessons",
      premium: "i-premium"
    };

    $$(`.free-v10-nav-item[data-free-view-target]`).forEach((button) => {
      const current = button.querySelector("svg");
      const id = navMap[button.dataset.freeViewTarget];
      if (current && id) current.outerHTML = icon(id, "free-v12-nav-svg");
    });

    const subscribe = document.querySelector(".free-v10-subscribe");
    if (subscribe) {
      const bolt = subscribe.querySelector(".bolt");
      if (bolt) bolt.innerHTML = icon("i-subscribe", "free-v12-subscribe-svg");
    }

    const shortcuts = $$(".free-v10-shortcut");
    const shortcutIcons = ["i-play", "i-premium", "i-subscribe"];
    shortcuts.forEach((button, index) => {
      const holder = button.querySelector(".ico");
      if (holder && shortcutIcons[index]) holder.innerHTML = icon(shortcutIcons[index], "free-v12-card-svg");
    });

    const featureIcons = ["i-dashboard", "i-modules", "i-games", "i-roulette", "i-exam", "i-favorite"];
    $$(".free-v10-feature .ico").forEach((holder, index) => {
      if (featureIcons[index]) holder.innerHTML = icon(featureIcons[index], "free-v12-feature-svg");
    });

    const payment = $$(".free-v10-payment-row .ico");
    if (payment[0]) payment[0].innerHTML = icon("i-payment", "free-v12-payment-svg");
    if (payment[1]) payment[1].innerHTML = icon("i-auto", "free-v12-payment-svg");

    $$(".free-v10-orbit-cards article").forEach((card, index) => {
      const holder = card.querySelector("span");
      const ids = ["i-lessons", "i-premium", "i-subscribe"];
      if (holder && ids[index]) holder.innerHTML = icon(ids[index], "free-v12-orbit-svg");
    });
  }

  function bindHardNavigation() {
    document.addEventListener("click", (event) => {
      const control = event.target.closest("[data-free-view-target]");
      if (!control) return;
      event.preventDefault();
      event.stopPropagation();
      setView(control.dataset.freeViewTarget, true);
    }, true);

    window.addEventListener("hashchange", () => {
      setView((window.TurmaNavigation?.hash ?? location.hash).replace("#", ""), false);
    });
  }

  function init() {
    installIcons();
    bindHardNavigation();
    setView((window.TurmaNavigation?.hash ?? location.hash).replace("#", ""), false);
    document.documentElement.classList.add("free-v12-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
