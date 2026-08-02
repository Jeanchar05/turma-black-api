"use strict";
(() => {
  const root=document.documentElement;
  const memory=Number(navigator.deviceMemory||0),cores=Number(navigator.hardwareConcurrency||0),isMobile=matchMedia("(max-width: 820px)").matches;
  if((memory&&memory<=4)||(cores&&cores<=4)||isMobile)root.classList.add("performance-lite");
  function installTheme(){if(!document.querySelector('script[data-global-theme-loader]')){const script=document.createElement("script");script.src="/theme-global-v2.js?v=20260802-global-theme";script.defer=true;script.dataset.globalThemeLoader="1";document.head.appendChild(script)}}
  function optimizeImage(img,index=0){if(!img||img.dataset.perfReady==="1")return;img.dataset.perfReady="1";img.decoding="async";if(index>1&&!img.closest(".dash-loading,.notes-loading,.support-loading,.study-module-card:nth-child(-n+2)")){img.loading="lazy";img.fetchPriority="low"}img.addEventListener("error",()=>img.classList.add("image-load-failed"),{once:true})}
  function optimize(node=document){node.querySelectorAll?.("img").forEach(optimizeImage);node.querySelectorAll?.("video").forEach(video=>{video.preload="metadata";video.setAttribute("playsinline","")})}
  function pause(){if(document.hidden)document.querySelectorAll("video,audio").forEach(media=>{try{media.pause()}catch{}})}
  function init(){installTheme();optimize();const observer=new MutationObserver(entries=>{for(const entry of entries)for(const node of entry.addedNodes){if(node.nodeType!==1)continue;if(node.matches?.("img"))optimizeImage(node);optimize(node)}});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),8000);document.addEventListener("visibilitychange",pause,{passive:true});window.addEventListener("pagehide",()=>observer.disconnect(),{once:true})}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();