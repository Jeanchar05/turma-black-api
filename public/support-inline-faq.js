"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const overlaySelectors = [
    "#faqModal",
    "#supportFaqModal",
    ".support-faq-modal",
    ".faq-modal",
    ".support-info-modal",
    "[data-faq-modal]",
    ".support-modal[data-modal='faq']",
    ".support-overlay[data-modal='faq']"
  ];

  let activeFilter = "all";

  function installFinalLayoutFix() {
    if (!document.querySelector('link[data-support-final-fix]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/support-final-fix.css?v=20260729-support-final-3";
      link.dataset.supportFinalFix = "true";
      document.head.appendChild(link);
    }

    const image = document.querySelector(".support-hero > img");
    if (image) {
      image.draggable = false;
      image.style.pointerEvents = "none";
    }
  }

  function removeLegacyFaq() {
    overlaySelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => element.remove());
    });

    document.body?.classList.remove("support-faq-open", "support-modal-open", "modal-open", "no-scroll", "overflow-hidden");
    if (document.body && !document.body.classList.contains("support-menu-open")) {
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("position");
      document.body.style.removeProperty("width");
      document.body.style.removeProperty("padding-right");
    }
  }

  function openSupportMenu() {
    const sidebar = $("supportSidebar");
    const overlay = $("supportMobileOverlay");
    if (!sidebar) return;
    sidebar.classList.add("open");
    document.body?.classList.add("support-menu-open");
    if (overlay) overlay.hidden = false;
    $("supportMenuButton")?.setAttribute("aria-expanded", "true");
  }

  function closeSupportMenu() {
    const sidebar = $("supportSidebar");
    const overlay = $("supportMobileOverlay");
    sidebar?.classList.remove("open");
    document.body?.classList.remove("support-menu-open");
    const chatOpen = Boolean($("supportChatModal") && !$("supportChatModal").hidden);
    if (overlay && !chatOpen) overlay.hidden = true;
    $("supportMenuButton")?.setAttribute("aria-expanded", "false");
  }

  function toggleSupportMenu() {
    if ($("supportSidebar")?.classList.contains("open")) closeSupportMenu();
    else openSupportMenu();
  }

  function updateFaq() {
    const query = normalize($("faqSearch")?.value);
    const items = $$("#faqList details");
    let visible = 0;

    items.forEach((item) => {
      const category = item.dataset.faqCategory || "";
      const haystack = normalize(`${item.textContent} ${item.dataset.faqKeywords || ""}`);
      const matchesCategory = activeFilter === "all" || category === activeFilter;
      const matchesQuery = !query || haystack.includes(query);
      const show = matchesCategory && matchesQuery;

      item.hidden = !show;
      if (!show) item.removeAttribute("open");
      if (show) visible += 1;
    });

    if ($("faqResultCount")) $("faqResultCount").textContent = `${visible} ${visible === 1 ? "resposta" : "respostas"}`;
    if ($("faqEmpty")) $("faqEmpty").hidden = visible !== 0;
  }

  function setFaqFilter(value) {
    activeFilter = value || "all";
    $$('[data-faq-filter]').forEach((button) => button.classList.toggle("active", button.dataset.faqFilter === activeFilter));
    updateFaq();
  }

  function updateRatingLabel(value) {
    const labels = { 1: "Ruim", 2: "Pode melhorar", 3: "Boa", 4: "Muito boa", 5: "Excelente" };
    const label = $("feedbackRatingText");
    if (label) label.textContent = labels[value] || "Excelente";
  }

  function updateFeedbackCount() {
    const field = $("feedbackMessage");
    const count = $("feedbackCharCount");
    if (field && count) count.textContent = `${field.value.length}/5000`;
  }

  function resetFeedbackUi() {
    window.setTimeout(() => {
      updateRatingLabel(5);
      updateFeedbackCount();
    }, 0);
  }

  function scrollToSection(id) {
    const target = $(id);
    if (!target) return;
    closeSupportMenu();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function boot() {
    installFinalLayoutFix();
    removeLegacyFaq();
    updateFaq();
    updateFeedbackCount();
    updateRatingLabel(5);
    $("supportMenuButton")?.setAttribute("aria-expanded", "false");

    $("faqSearch")?.addEventListener("input", updateFaq);
    $("feedbackMessage")?.addEventListener("input", updateFeedbackCount);
    $("feedbackForm")?.addEventListener("reset", resetFeedbackUi);

    document.addEventListener("click", (event) => {
      const menuButton = event.target.closest("#supportMenuButton");
      if (menuButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleSupportMenu();
        return;
      }

      if (event.target.closest("#supportMobileOverlay") && $("supportSidebar")?.classList.contains("open")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeSupportMenu();
        return;
      }

      const navLink = event.target.closest(".support-nav a");
      if (navLink && matchMedia("(max-width:1120px)").matches) closeSupportMenu();

      const scrollButton = event.target.closest("[data-scroll]");
      if (scrollButton) {
        event.preventDefault();
        event.stopPropagation();
        scrollToSection(scrollButton.dataset.scroll);
        return;
      }

      const filter = event.target.closest("[data-faq-filter]");
      if (filter) {
        event.preventDefault();
        setFaqFilter(filter.dataset.faqFilter);
        return;
      }

      const rating = event.target.closest("[data-rating]");
      if (rating) updateRatingLabel(Number(rating.dataset.rating));

      const legacyFaqTrigger = event.target.closest("[data-toggle-faq], [data-open-faq]");
      if (legacyFaqTrigger) {
        event.preventDefault();
        scrollToSection("faqPanel");
      }
    }, true);

    document.addEventListener("toggle", (event) => {
      const opened = event.target;
      if (!(opened instanceof HTMLDetailsElement) || !opened.matches("#faqList details") || !opened.open) return;
      $$("#faqList details[open]").forEach((item) => {
        if (item !== opened) item.removeAttribute("open");
      });
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && $("supportSidebar")?.classList.contains("open")) closeSupportMenu();
    }, true);

    window.addEventListener("resize", () => {
      if (!matchMedia("(max-width:1120px)").matches) closeSupportMenu();
    });

    window.addEventListener("pageshow", () => {
      installFinalLayoutFix();
      removeLegacyFaq();
      closeSupportMenu();
      updateFaq();
    });

    const observer = new MutationObserver(() => {
      removeLegacyFaq();
      installFinalLayoutFix();
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
