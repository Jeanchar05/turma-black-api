"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];

  function token() {
    for (const key of TOKEN_KEYS) {
      try {
        const value = sessionStorage.getItem(key);
        if (value) return value;
      } catch (_) {}
    }
    return "";
  }

  function loadPolish() {
    if (!document.querySelector('link[href*="support-polish.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "support-polish.css?v=20260728-support-7";
      document.head.appendChild(link);
    }
  }

  function icon(name) {
    return `<svg aria-hidden="true"><use href="assets/support-icons.svg#${name}"></use></svg>`;
  }

  function removeLegacyFaq() {
    const selectors = [
      "#faqModal",
      "#supportFaqModal",
      ".support-faq-modal",
      ".faq-modal",
      ".support-info-modal",
      "[data-faq-modal]",
      ".support-modal[data-modal='faq']",
      ".support-overlay[data-modal='faq']"
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => element.remove());
    });

    document.body?.classList.remove(
      "support-modal-open",
      "modal-open",
      "no-scroll",
      "overflow-hidden"
    );

    if (document.body) {
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("position");
      document.body.style.removeProperty("width");
      document.body.style.removeProperty("padding-right");
    }
  }

  function releaseLoading() {
    const loading = $("supportLoading");
    if (!loading) return;
    loading.style.transition = "opacity .22s ease, visibility .22s ease";
    loading.style.opacity = "0";
    loading.style.visibility = "hidden";
    loading.style.pointerEvents = "none";
    setTimeout(() => loading.remove(), 260);
  }

  function showRecoverableError(message) {
    const list = $("ticketList");
    if (!list || !/carregando/i.test(list.textContent || "")) return;
    list.innerHTML = `
      <div class="support-empty support-runtime-error">
        ${icon("i-retry")}
        <strong>Não foi possível carregar os chamados.</strong>
        <span>${String(message || "A central continua disponível. Tente atualizar apenas esta área.")}</span>
        <button type="button" id="supportRuntimeRetry">Tentar novamente</button>
      </div>`;
  }

  function polishShortcuts() {
    document.querySelectorAll(".support-shortcuts button").forEach((button) => {
      const title = button.querySelector("strong")?.textContent?.trim().toLowerCase() || "";

      if (title.includes("perguntas")) {
        button.removeAttribute("data-open-faq");
        button.removeAttribute("data-scroll");
        button.setAttribute("data-toggle-faq", "");
        button.setAttribute("aria-expanded", "false");
        const holder = button.querySelector("span");
        if (holder) holder.innerHTML = icon("i-faq");
      }

      if (title.includes("feedback")) {
        const holder = button.querySelector("span");
        if (holder) holder.innerHTML = icon("i-feedback");
      }
    });
  }

  function polishChannels() {
    document.querySelectorAll(".support-channel-grid a").forEach((link) => {
      const isWhatsapp = link.href.includes("wa.me");
      const holder = link.querySelector("span");
      if (holder) holder.innerHTML = icon(isWhatsapp ? "i-whatsapp" : "i-mail");

      const small = link.querySelector("small");
      if (small) small.textContent = isWhatsapp
        ? "Atendimento pelo WhatsApp"
        : "Atendimento por e-mail";

      const action = link.querySelector("b");
      if (action) action.textContent = isWhatsapp ? "Conversar" : "Enviar";
    });
  }

  function registerEvents() {
    document.addEventListener("click", (event) => {
      if (event.target.closest("#supportRuntimeRetry")) {
        const refresh = $("refreshTickets");
        if (refresh) refresh.click();
        else location.reload();
      }
    });
  }

  function boot() {
    removeLegacyFaq();
    loadPolish();
    polishShortcuts();
    polishChannels();
    registerEvents();

    const observer = new MutationObserver(removeLegacyFaq);
    observer.observe(document.body, { childList: true, subtree: true });

    const fastRelease = setTimeout(releaseLoading, 2200);
    const recovery = setTimeout(() => {
      releaseLoading();
      showRecoverableError("A página está disponível. Atualize os chamados pelo botão acima.");
    }, 10000);

    window.addEventListener("support:ready", () => {
      clearTimeout(fastRelease);
      clearTimeout(recovery);
      releaseLoading();
    }, { once: true });

    window.addEventListener("error", releaseLoading);
    window.addEventListener("unhandledrejection", releaseLoading);
    window.addEventListener("pageshow", removeLegacyFaq);

    if (!token()) {
      clearTimeout(fastRelease);
      clearTimeout(recovery);
      releaseLoading();
      setTimeout(() => location.replace("/"), 250);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
