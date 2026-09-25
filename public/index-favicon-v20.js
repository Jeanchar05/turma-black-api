"use strict";
(() => {
  const href = "/favicon-v20.svg?v=20260924-v20";
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; document.head.appendChild(icon); }
  icon.type = "image/svg+xml"; icon.href = href;
  let apple = document.querySelector('link[rel="apple-touch-icon"]');
  if (!apple) { apple = document.createElement("link"); apple.rel = "apple-touch-icon"; document.head.appendChild(apple); }
  apple.href = href;
})();