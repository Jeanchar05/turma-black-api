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

  function removeLegacyFaq() {
    overlaySelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => element.remove());
    });

    document.body?.classList.remove("support-faq-open", "support-modal-open", "modal-open", "no-scroll", "overflow-hidden");
    if (document.body) {
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("position");
      document.body.style.removeProperty("width");
      document.body.style.removeProperty("padding-right");
    }
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

  function boot() {
    removeLegacyFaq();
    updateFaq();
    updateFeedbackCount();
    updateRatingLabel(5);

    $("faqSearch")?.addEventListener("input", updateFaq);
    $("feedbackMessage")?.addEventListener("input", updateFeedbackCount);
    $("feedbackForm")?.addEventListener("reset", resetFeedbackUi);

    document.addEventListener("click", (event) => {
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
        $("faqPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    document.addEventListener("toggle", (event) => {
      const opened = event.target;
      if (!(opened instanceof HTMLDetailsElement) || !opened.matches("#faqList details") || !opened.open) return;
      $$("#faqList details[open]").forEach((item) => {
        if (item !== opened) item.removeAttribute("open");
      });
    }, true);

    window.addEventListener("pageshow", () => {
      removeLegacyFaq();
      updateFaq();
    });

    const observer = new MutationObserver(removeLegacyFaq);
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
