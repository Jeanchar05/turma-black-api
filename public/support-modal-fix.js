"use strict";
(() => {
  const FAQ_MODAL_SELECTORS = [
    "#faqModal",
    ".support-faq-modal",
    ".faq-modal",
    "[data-faq-modal]",
    ".support-modal[data-modal='faq']",
    ".support-overlay[data-modal='faq']"
  ];

  const fallbackQuestions = `
    <details><summary>Não consigo acessar minha conta. O que faço?</summary><p>Confira o e-mail e a senha cadastrados. Caso continue sem acesso, abra um chamado na categoria “Acesso à conta” e informe o e-mail utilizado.</p></details>
    <details><summary>Como acompanho uma solicitação?</summary><p>Todos os seus chamados aparecem nesta página. Clique em “Abrir atendimento” para visualizar o histórico e conversar com a equipe.</p></details>
    <details><summary>Posso enviar imagens ou documentos?</summary><p>Sim. Você pode anexar imagens, PDFs e documentos de até 4 MB durante a abertura ou dentro do chat.</p></details>
    <details><summary>Como alterar meus dados?</summary><p>Acesse a página Perfil pelo menu lateral. Dúvidas sobre e-mail ou plano podem ser enviadas pelo suporte.</p></details>`;

  function unlockPage() {
    document.body?.classList.remove("support-modal-open", "modal-open", "no-scroll", "overflow-hidden");
    if (document.body) {
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");
      document.body.style.removeProperty("position");
      document.body.style.removeProperty("width");
    }
    document.documentElement.style.removeProperty("--support-scrollbar-compensation");
  }

  function collectFaqMarkup() {
    for (const selector of FAQ_MODAL_SELECTORS) {
      const modal = document.querySelector(selector);
      const list = modal?.querySelector(".support-faq-list");
      if (list?.innerHTML.trim()) return list.innerHTML;
    }
    return fallbackQuestions;
  }

  function removeFaqOverlays() {
    FAQ_MODAL_SELECTORS.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (element.id === "faq" || element.classList.contains("support-faq")) return;
        element.remove();
      });
    });
    unlockPage();
  }

  function ensureInlineFaq() {
    let section = document.getElementById("faq");
    if (section) {
      removeFaqOverlays();
      return section;
    }

    const content = document.querySelector(".support-content");
    if (!content) {
      removeFaqOverlays();
      return null;
    }

    const questions = collectFaqMarkup();
    section = document.createElement("section");
    section.id = "faq";
    section.className = "support-card support-faq support-faq-inline";
    section.innerHTML = `
      <div class="support-card-title">
        <div><small>AJUDA RÁPIDA</small><h2>Perguntas frequentes</h2><p>Respostas para as dúvidas mais comuns da plataforma.</p></div>
      </div>
      <div class="support-faq-list">${questions}</div>`;
    content.appendChild(section);
    removeFaqOverlays();
    return section;
  }

  function openInlineFaq() {
    const section = ensureInlineFaq();
    if (!section) return;
    section.classList.remove("support-faq-highlight");
    requestAnimationFrame(() => {
      section.classList.add("support-faq-highlight");
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    window.setTimeout(() => section.classList.remove("support-faq-highlight"), 1500);
  }

  function overlayStillNeeded() {
    const chatOpen = document.getElementById("supportChatModal")?.hidden === false;
    const feedbackOpen = document.getElementById("feedbackModal")?.hidden === false;
    const sidebarOpen = document.getElementById("supportSidebar")?.classList.contains("open");
    return chatOpen || feedbackOpen || sidebarOpen;
  }

  function normalizeMobileOverlay() {
    const overlay = document.getElementById("supportMobileOverlay");
    if (overlay && !overlayStillNeeded()) overlay.hidden = true;
  }

  function boot() {
    ensureInlineFaq();
    normalizeMobileOverlay();

    document.addEventListener("click", (event) => {
      const open = event.target.closest("[data-open-faq], [data-scroll='faq'], a[href='#faq']");
      if (open) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openInlineFaq();
        return;
      }

      const close = event.target.closest("[data-close-faq], .support-faq-close");
      if (close) {
        event.preventDefault();
        event.stopImmediatePropagation();
        removeFaqOverlays();
        normalizeMobileOverlay();
      }
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        removeFaqOverlays();
        normalizeMobileOverlay();
      }
    }, true);

    const observer = new MutationObserver((mutations) => {
      let found = false;
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (FAQ_MODAL_SELECTORS.some((selector) => node.matches?.(selector) || node.querySelector?.(selector))) found = true;
      }));
      if (found) {
        window.setTimeout(() => {
          removeFaqOverlays();
          normalizeMobileOverlay();
        }, 0);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("pageshow", () => {
      ensureInlineFaq();
      normalizeMobileOverlay();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
