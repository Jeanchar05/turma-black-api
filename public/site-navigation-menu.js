"use strict";
(() => {
  let scheduled = false;
  function update() {
    scheduled = false;
    document.querySelectorAll("aside a[href],nav a[href]").forEach((a) => {
      let p;
      try {
        p = new URL(a.getAttribute("href"), location.origin).pathname.replace(
          /\.html$/,
          "",
        );
      } catch {
        return;
      }
      if (p === "/minigames") {
        a.remove();
        return;
      }
      if (p !== "/roleta") return;
      const w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode()))
        if (n.textContent.trim() === "Roleta")
          n.textContent = n.textContent.replace("Roleta", "Roleta Operacional");
      if (a.title === "Roleta") a.title = "Roleta Operacional";
      if (a.getAttribute("aria-label") === "Roleta")
        a.setAttribute("aria-label", "Roleta Operacional");
    });
  }
  update();
  new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  }).observe(document.body, { subtree: true, childList: true });
})();
