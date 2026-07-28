"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const token = () => {
    for (const key of TOKEN_KEYS) {
      try { const value = sessionStorage.getItem(key); if (value) return value; } catch (_) {}
    }
    return "";
  };

  function loadPolish() {
    if (!document.querySelector('link[href*="support-polish.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "support-polish.css?v=20260728-support-3";
      document.head.appendChild(link);
    }
  }

  function icon(name) {
    return `<svg aria-hidden="true"><use href="assets/support-icons.svg#${name}"></use></svg>`;
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

  function buildFaqModal() {
    if ($("supportFaqModal")) return;
    const modal = document.createElement("div");
    modal.className = "support-info-modal";
    modal.id = "supportFaqModal";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <section class="support-info-card" role="dialog" aria-modal="true" aria-labelledby="supportFaqTitle">
        <header><div><small>AJUDA RÁPIDA</small><h2 id="supportFaqTitle">Perguntas frequentes</h2><p>Respostas diretas para as dúvidas mais comuns.</p></div><button type="button" data-close-faq aria-label="Fechar">×</button></header>
        <div class="support-info-list">
          <details><summary>Não consigo acessar minha conta. O que faço?</summary><p>Confira o e-mail e a senha cadastrados. Caso continue sem acesso, abra um chamado na categoria “Acesso à conta” e informe o e-mail utilizado.</p></details>
          <details><summary>Como acompanho uma solicitação?</summary><p>Todos os chamados aparecem em “Meus chamados”. Clique em “Abrir atendimento” para visualizar o histórico e conversar com a equipe.</p></details>
          <details><summary>Posso enviar imagens ou documentos?</summary><p>Sim. Imagens, PDFs e documentos de até 4 MB podem ser enviados na abertura do ticket ou dentro do chat.</p></details>
          <details><summary>Como alterar meus dados?</summary><p>Acesse Perfil pelo menu lateral. Alterações relacionadas a e-mail, acesso ou plano podem ser solicitadas pelo suporte.</p></details>
          <details><summary>Onde acompanho a resposta da equipe?</summary><p>Abra o chamado correspondente. O chat mostra todas as mensagens, o atendente responsável, anexos e o status atualizado.</p></details>
        </div>
        <div class="support-help-note">${icon("i-faq")}<div><strong>Ainda precisa de ajuda?</strong><small>Feche esta janela e abra um chamado para falar diretamente com a equipe.</small></div></div>
      </section>`;
    document.body.appendChild(modal);
  }

  function polishShortcuts() {
    const shortcuts = document.querySelectorAll(".support-shortcuts button");
    shortcuts.forEach((button) => {
      const title = button.querySelector("strong")?.textContent?.trim().toLowerCase() || "";
      if (title.includes("perguntas")) {
        button.removeAttribute("data-scroll");
        button.setAttribute("data-open-faq", "");
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
    const links = document.querySelectorAll(".support-channel-grid a");
    links.forEach((link) => {
      const isWhatsapp = link.href.includes("wa.me");
      const holder = link.querySelector("span");
      if (holder) holder.innerHTML = icon(isWhatsapp ? "i-whatsapp" : "i-mail");
      const small = link.querySelector("small");
      if (small) small.textContent = isWhatsapp ? "Atendimento pelo WhatsApp" : "Atendimento por e-mail";
      const action = link.querySelector("b");
      if (action) action.textContent = isWhatsapp ? "Conversar" : "Enviar";
    });
  }

  function openFaq() {
    const modal = $("supportFaqModal");
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeFaq() {
    const modal = $("supportFaqModal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function registerPolishEvents() {
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-open-faq]")) openFaq();
      if (event.target.closest("[data-close-faq]")) closeFaq();
      if (event.target === $("supportFaqModal")) closeFaq();
      if (event.target.closest("#supportRuntimeRetry")) {
        const refresh = $("refreshTickets");
        if (refresh) refresh.click(); else location.reload();
      }
    }, true);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeFaq(); });
  }

  function boot() {
    loadPolish();
    buildFaqModal();
    polishShortcuts();
    polishChannels();
    registerPolishEvents();

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

    if (!token()) {
      clearTimeout(fastRelease);
      clearTimeout(recovery);
      releaseLoading();
      setTimeout(() => location.replace("/"), 250);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();