"use strict";
(() => {
  if (window.__TURMA_FLOATING_CONTROLS_V7__) return;
  window.__TURMA_FLOATING_CONTROLS_V7__ = true;
  const path = (window.TurmaNavigation?.pathname || location.pathname).toLowerCase();
  const FOCUS_DISMISSED_KEY = "turma_focus_float_v7_dismissed";
  const $ = (selector, root = document) => root.querySelector(selector);

  function keepSupportOutOfCentral() {
    const host = $("#supportFloatV6"); if (!host) return;
    if (path === "/suporte") host.style.setProperty("display", "none", "important");
    else host.style.removeProperty("display");
  }
  function focusDismissed(){try{return localStorage.getItem(FOCUS_DISMISSED_KEY)==="1"}catch(_){return false}}
  function setFocusDismissed(value){try{localStorage.setItem(FOCUS_DISMISSED_KEY,value?"1":"0")}catch(_){}applyFocusVisibility()}
  function applyFocusVisibility(){if(!focusDismissed())return;$("#floatingFocus")?.style.setProperty("display","none","important");$("#focusBubble")?.style.setProperty("display","none","important")}
  function restoreFocusVisibility(){$("#floatingFocus")?.style.removeProperty("display");$("#focusBubble")?.style.removeProperty("display")}
  function addFocusTrash(){const header=$("#floatingFocus header");if(!header||$("#focusDiscard"))return;const button=document.createElement("button");button.id="focusDiscard";button.className="floating-focus-close focus-discard-v7";button.type="button";button.title="Encerrar e ocultar timer";button.setAttribute("aria-label","Encerrar e ocultar timer até iniciar outra sessão");button.textContent="⌫";const minimize=$("#focusMinimize");header.insertBefore(button,minimize||null);button.addEventListener("click",async()=>{setFocusDismissed(true);const sync=window.TurmaStudySync;try{if(sync?.focus)await sync.focus("reset",Number(sync.state?.focus?.duration||1500));else $("#focusReset")?.click()}catch(_){}applyFocusVisibility()})}
  function bindFocusStart(){document.addEventListener("click",event=>{if(event.target.closest("#focusStart,#floatingFocusAction")){setFocusDismissed(false);restoreFocusVisibility()}},true);addEventListener("turma:study-change",()=>{const focus=window.TurmaStudySync?.state?.focus;if(focus?.status==="running"&&focusDismissed()){setFocusDismissed(false);restoreFocusVisibility()}})}
  function watch(){const observer=new MutationObserver(()=>{keepSupportOutOfCentral();addFocusTrash();applyFocusVisibility()});observer.observe(document.documentElement,{childList:true,subtree:true});keepSupportOutOfCentral();addFocusTrash();applyFocusVisibility()}
  bindFocusStart();
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",watch,{once:true});else watch();
})();