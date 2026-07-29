"use strict";
(() => {
  function scrollToTarget(id) {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scroll]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    scrollToTarget(button.dataset.scroll);
  }, true);

  const heroImage = document.querySelector(".support-hero > img");
  if (heroImage) {
    heroImage.draggable = false;
    heroImage.style.pointerEvents = "none";
  }
})();
