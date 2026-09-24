"use strict";
(() => {
  if (window.__TURMA_NOTIFICATIONS_LIVE_V18__) return;
  window.__TURMA_NOTIFICATIONS_LIVE_V18__ = true;

  const KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

  let items = [];
  let initialized = false;
  let knownUnread = new Set();
  let loading = false;

  function token() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of KEYS) {
        try { const value = storage.getItem(key); if (value) return value; } catch (_) {}
      }
    }
    return "";
  }

  async function api(path, options = {}) {
    const authToken = token();
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    if (options.body) headers["Content-Type"] = "application/json";
    const response = await fetch(path, { ...options, headers, credentials: "same-origin", cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}`);
    return data;
  }

  async function firstAvailable(paths, options = {}) {
    let lastError;
    for (const path of paths) {
      try { return await api(path, options); }
      catch (error) {
        lastError = error;
        if (!/404|não encontrada|not found/i.test(String(error?.message || ""))) break;
      }
    }
    throw lastError || new Error("Notificações indisponíveis.");
  }

  function ensureBadge(unread) {
    const native = $("#notificationBadge");
    if (native) {
      native.textContent = String(unread);
      native.hidden = unread < 1;
    }
    $$('a[href="/notificacoes"],a[href="/notificacoes.html"]').forEach((link) => {
      let badge = $(".notification-v18-badge", link);
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "notification-v18-badge";
        Object.assign(badge.style, {
          position: "absolute", top: "-5px", right: "-5px", minWidth: "18px", height: "18px",
          padding: "0 5px", borderRadius: "999px", display: "grid", placeItems: "center",
          background: "#a855f7", color: "#fff", font: "800 10px Inter,sans-serif", boxShadow: "0 5px 14px rgba(126,34,206,.36)"
        });
        if (getComputedStyle(link).position === "static") link.style.position = "relative";
        link.appendChild(badge);
      }
      badge.textContent = unread > 99 ? "99+" : String(unread);
      badge.hidden = unread < 1;
      badge.style.display = unread < 1 ? "none" : "grid";
    });
  }

  function render() {
    const list = $("#notificationList");
    const unread = items.filter((item) => !Boolean(item.lida)).length;
    ensureBadge(unread);
    if (!list) return;

    const browserButton = ("Notification" in window)
      ? `<button class="dash-push-enable" id="enablePushButton" type="button"><span>🔔</span><div><strong>${Notification.permission === "granted" ? "Notificações do navegador ativadas" : "Ativar notificações no dispositivo"}</strong><small>${Notification.permission === "granted" ? "Novos avisos também podem aparecer no dispositivo." : "Permita avisos enquanto usa a plataforma."}</small></div></button>`
      : "";
    const cards = items.length
      ? items.map((item) => `<article class="dash-notification-item ${item.lida ? "" : "unread"}" data-notification-id="${escapeHtml(item.id || item._id)}" data-link="${escapeHtml(item.link || "")}"><span>${escapeHtml(item.icone || "🔔")}</span><div><strong>${escapeHtml(item.titulo || "Notificação")}</strong><small>${escapeHtml(item.mensagem || "")}</small></div></article>`).join("")
      : `<div class="dash-notification-empty">Nenhuma notificação no momento.</div>`;
    list.innerHTML = browserButton + cards;
  }

  async function showBrowserNotification(item) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const id = item.id || item._id || "aviso";
    const options = { body: String(item.mensagem || ""), icon: "/assets/turma-primo-logo.svg", tag: `turma-${id}`, renotify: false };
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        if (registration?.showNotification) { await registration.showNotification(item.titulo || "Turma do Primo", options); return; }
      }
      new Notification(item.titulo || "Turma do Primo", options);
    } catch (_) {}
  }

  async function load({ notify = true } = {}) {
    if (loading) return;
    loading = true;
    try {
      const data = await firstAvailable(["/minhas-notificacoes", "/notificacoes/minhas"]);
      const next = Array.isArray(data.notificacoes) ? data.notificacoes : [];
      const unreadNow = new Set(next.filter((item) => !item.lida).map((item) => String(item.id || item._id || "")).filter(Boolean));
      if (initialized && notify) {
        next.forEach((item) => {
          const id = String(item.id || item._id || "");
          if (!item.lida && id && !knownUnread.has(id)) showBrowserNotification(item);
        });
      }
      items = next;
      knownUnread = unreadNow;
      initialized = true;
      render();
      const naoLidas = Number.isFinite(Number(data.naoLidas)) ? Number(data.naoLidas) : unreadNow.size;
      window.dispatchEvent(new CustomEvent("turma:notifications-updated", { detail: { total: items.length, naoLidas } }));
    } catch (error) {
      console.warn("Notificações indisponíveis:", error.message);
      ensureBadge(0);
    } finally { loading = false; }
  }

  async function markOne(id) {
    if (!id) return;
    try {
      await firstAvailable([`/notificacoes/${encodeURIComponent(id)}/lida`, `/minhas-notificacoes/${encodeURIComponent(id)}/lida`], { method: "POST" });
      const item = items.find((entry) => String(entry.id || entry._id) === String(id));
      if (item) item.lida = true;
      knownUnread.delete(String(id));
      render();
      window.dispatchEvent(new CustomEvent("turma:notifications-updated", { detail: { total: items.length, naoLidas: items.filter((item) => !item.lida).length } }));
    } catch (error) { console.warn(error.message); }
  }

  async function markAll() {
    try {
      await api("/notificacoes/marcar-todas-lidas", { method: "POST" });
      items.forEach((item) => { item.lida = true; });
      knownUnread.clear();
      render();
      window.dispatchEvent(new CustomEvent("turma:notifications-updated", { detail: { total: items.length, naoLidas: 0 } }));
    } catch (error) { console.warn(error.message); }
  }

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const button = $("#enablePushButton");
    if (button) button.disabled = true;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Permissão de notificações não concedida.");
      localStorage.setItem("turma.notifications.browser", "1");
      if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
          const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
          const keyData = await api("/push/public-key");
          if (keyData?.publicKey) {
            const padding = "=".repeat((4 - keyData.publicKey.length % 4) % 4);
            const raw = atob((keyData.publicKey + padding).replace(/-/g, "+").replace(/_/g, "/"));
            const key = Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
            await api("/push/subscribe", { method: "POST", body: JSON.stringify({ subscription }) });
          }
        } catch (error) { console.info("Push em segundo plano opcional:", error.message); }
      }
      render();
    } catch (error) {
      console.warn(error.message);
      if (button) {
        const strong = $("strong", button); const small = $("small", button);
        if (strong) strong.textContent = "Permissão não ativada";
        if (small) small.textContent = "Libere as notificações nas configurações do navegador.";
      }
    } finally { if (button) button.disabled = false; }
  }

  function safeNavigate(link) {
    if (!link) return;
    try {
      const url = new URL(link, location.origin);
      if (url.origin === location.origin || url.protocol === "https:") location.assign(url.href);
    } catch (_) {}
  }

  function bind() {
    document.addEventListener("click", (event) => {
      if (event.target.closest("#enablePushButton")) { enableNotifications(); return; }
      const card = event.target.closest("[data-notification-id]");
      if (!card) return;
      markOne(card.dataset.notificationId);
      safeNavigate(card.dataset.link);
    });
    $("#markNotificationsRead")?.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); markAll(); });
    document.addEventListener("turma:notifications-refresh", () => load({ notify: false }));
    window.addEventListener("focus", () => load({ notify: false }));
    window.addEventListener("online", () => load({ notify: false }));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) load({ notify: false }); });
  }

  function init() {
    bind();
    load({ notify: false });
    window.setInterval(() => { if (!document.hidden && navigator.onLine !== false) load({ notify: true }); }, 30000);
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
