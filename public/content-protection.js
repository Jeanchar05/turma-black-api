"use strict";
(() => {
  const editable = target => target instanceof Element && !!target.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[data-allow-copy]');
  const protectedContent = target => target instanceof Element && !!target.closest('[data-protected-content]');
  const deny = event => { if (!editable(event.target) && protectedContent(event.target)) event.preventDefault(); };
  ["copy", "cut", "contextmenu", "dragstart"].forEach(type => document.addEventListener(type, deny));
  // These are deterrents only; browser/OS capture and developer tools cannot
  // be disabled by a website. Never infer an attack or revoke a session here.
  document.addEventListener("keydown", event => {
    if (editable(event.target)) return;
    const key = event.key.toLowerCase();
    if (event.key === "F12" || ((event.ctrlKey || event.metaKey) && (key === "u" || key === "s" || key === "p" || (event.shiftKey && ["i", "j", "c"].includes(key))))) event.preventDefault();
  });
  document.querySelectorAll('[data-protected-content] video').forEach(video => {
    video.setAttribute("controlsList", "nodownload noremoteplayback");
    video.disablePictureInPicture = true;
  });
})();
