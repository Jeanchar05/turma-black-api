"use strict";
(() => {
  const panel = () => document.getElementById("faqPanel");
  const overlaySelectors = [
    "#faqModal",
    ".support-faq-modal",
    ".faq-modal",
    "[data-faq-modal]",
    ".support-modal[data-modal='faq']",
    ".support-overlay[data-modal='faq']"
  ];

  function removeLegacyFaq() {
    overlaySelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => element.remove());
    });
    document.body?.classList.remove("support-modal-open", "modal-open", "no-scroll", "overflow-hidden");
    if (document.body) {
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("position");
      document.body.style.removeProperty("width");
      document.body.style.removeProperty("padding-right");
    }
  }

  function closeFaq() {
    const faq = panel();
    if (!faq) return;
    faq.hidden = true;
    faq.setAttribute("aria-hidden", "true");
    document.body?.classList.remove("support-faq-open");
    document.querySelectorAll("[data-toggle-faq]").forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });
  }

  function openFaq() {
    removeLegacyFaq();
    const faq = panel();
    if (!faq) return;
    faq.hidden = false;
    faq.setAttribute("aria-hidden", "false");
    document.body?.classList.add("support-faq-open");
    document.querySelectorAll("[data-toggle-faq]").forEach((button) => {
      button.setAttribute("aria-expanded", "true");
    });
    requestAnimationFrame(() => faq.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function toggleFaq() {
    const faq = panel();
    if (!faq) return;
    if (faq.hidden) openFaq();
    else closeFaq();
  }

  function boot() {
    removeLegacyFaq();
    closeFaq();

    document.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-toggle-faq], [data-open-faq], [data-scroll='faq']");
      if (toggle) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleFaq();
        return;
      }

      const close = event.target.closest("[data-close-inline-faq]");
      if (close) {
        event.preventDefault();
        closeFaq();
      }
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeFaq();
    }, true);

    window.addEventListener("pageshow", () => {
      removeLegacyFaq();
      closeFaq();
    });

    const observer = new MutationObserver(() => removeLegacyFaq());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
