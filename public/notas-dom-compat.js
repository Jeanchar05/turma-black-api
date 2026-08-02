"use strict";
(() => {
  const specs = {
    categoryList:"div", popularTags:"div", resultCount:"span", notesGrid:"div",
    categoryFilter:"select", noteCategory:"select", noteChecklist:"div", noteAttachments:"div",
    countAll:"span", countFavorite:"span", countPinned:"span", countRecent:"span",
    countArchived:"span", countTrash:"span", saveStatus:"span"
  };
  const host = document.createElement("div");
  host.id = "notesCompatibilityHost";
  host.hidden = true;
  host.setAttribute("aria-hidden","true");
  for (const [id, tag] of Object.entries(specs)) {
    if (document.getElementById(id)) continue;
    const el = document.createElement(tag);
    el.id = id;
    host.appendChild(el);
  }
  document.body.appendChild(host);
})();