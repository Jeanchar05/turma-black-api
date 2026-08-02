"use strict";
(() => {
  const root = document.documentElement;
  const memory = Number(navigator.deviceMemory || 0);
  const cores = Number(navigator.hardwareConcurrency || 0);
  const isMobile = matchMedia("(max-width: 820px)").matches;
  const lite = (memory && memory <= 4) || (cores && cores <= 4) || isMobile;
  if (lite) root.classList.add("performance-lite");

  function optimizeImage(img, index = 0) {
    if (!img || img.dataset.perfReady === "1") return;
    img.dataset.perfReady = "1";
    img.decoding = "async";
    if (index > 1 && !img.closest(".dash-loading,.notes-loading,.support-loading,.study-module-card:nth-child(-n+2)")) {
      img.loading = "lazy";
      img.fetchPriority = "low";
    }
    img.addEventListener("error", () => img.classList.add("image-load-failed"), { once: true });
  }

  function optimize(rootNode = document) {
    rootNode.querySelectorAll?.("img").forEach(optimizeImage);
    rootNode.querySelectorAll?.("video").forEach(video => {
      video.preload = "metadata";
      if (!video.hasAttribute("playsinline")) video.setAttribute("playsinline", "");
    });
  }

  function removeDuplicateAssets() {
    const seenScripts = new Set();
    document.querySelectorAll("script[src]").forEach(script => {
      const key = new URL(script.src, location.href).pathname;
      if (seenScripts.has(key)) script.remove(); else seenScripts.add(key);
    });
    const seenStyles = new Set();
    document.querySelectorAll('link[rel="stylesheet"][href]').forEach(link => {
      const key = new URL(link.href, location.href).pathname;
      if (seenStyles.has(key)) link.remove(); else seenStyles.add(key);
    });
  }

  function pauseOffscreenMedia() {
    if (!document.hidden) return;
    document.querySelectorAll("video,audio").forEach(media => {
      try { media.pause(); } catch (_) {}
    });
  }

  function init() {
    removeDuplicateAssets();
    optimize();
    const observer = new MutationObserver(entries => {
      for (const entry of entries) {
        for (const node of entry.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.("img")) optimizeImage(node);
          optimize(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
    document.addEventListener("visibilitychange", pauseOffscreenMedia, { passive: true });
    window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
