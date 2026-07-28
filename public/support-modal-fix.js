"use strict";

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  let lastFocus = null;

  function scrollbarCompensation() {
    return `${Math.max(0, window.innerWidth - document.documentElement.clientWidth)}px`;
  }

  function faqModal() {
    return document.getElementById("faqModal");
  }

  function closeDuplicateFaqOverlays() {
    const official = faqModal();
    document.querySelectorAll(".support-faq-modal, .faq-modal, [data-faq-modal]").forEach((item) => {
      if (item !== official) {
        item.hidden = true;
        item.setAttribute("aria-hidden", "true");
        item.classList.remove("active", "open", "visible", "show");
        item.style.display = "none";
      }
    });
  }

  function setFaqOpen(open, trigger = null) {
    const modal = faqModal();
    if (!modal) return;

    if (open) {
      lastFocus = trigger || document.activeElement;
      document.documentElement.style.setProperty("--support-scrollbar-compensation", scrollbarCompensation());
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("support-modal-open");
      requestAnimationFrame(() => modal.querySelector("[data-close-faq]")?.focus());
      return;
    }

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("active", "open", "visible", "show");
    document.body.classList.remove("support-modal-open");
    document.documentElement.style.removeProperty("--support-scrollbar-compensation");
    modal.querySelectorAll("details[open]").forEach((details) => details.removeAttribute("open"));
    if (lastFocus instanceof HTMLElement && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  function resetModalState() {
    closeDuplicateFaqOverlays();
    setFaqOpen(false);
  }

  document.addEventListener("click", (event) => {
    const open = event.target.closest("[data-open-faq]");
    if (open) {
      event.preventDefault();
      event.stopPropagation();
      setFaqOpen(true, open);
      return;
    }

    if (event.target.closest("[data-close-faq]")) {
      event.preventDefault();
      event.stopPropagation();
      setFaqOpen(false);
      return;
    }

    const modal = faqModal();
    if (modal && event.target === modal) setFaqOpen(false);
  }, true);

  document.addEventListener("keydown", (event) => {
    const modal = faqModal();
    if (!modal || modal.hidden) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setFaqOpen(false);
      return;
    }

    if (event.key === "Tab") {
      const focusable = Array.from(modal.querySelectorAll('button, summary, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((item) => !item.disabled && item.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener("pageshow", resetModalState);
  window.addEventListener("beforeunload", () => document.body.classList.remove("support-modal-open"));

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", resetModalState, { once: true });
  } else {
    resetModalState();
  }
})();
