"use strict";
(() => {
  if (window.__TURMA_NOTIFICATIONS_LIVE__) return;
  window.__TURMA_NOTIFICATIONS_LIVE__ = true;

  const KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (s) => document.querySelector(s);
  const token = () => {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of KEYS) {
        try { const value = storage.getItem(key); if (value) return value; } catch (_) {}
      }
    }
    return "";
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  let items = [];
  let initialized = false;
  let knownUnread = new Set();

  async function api(path, options = {}) {
    const value = token();
    if (!value) throw new Error("Sessão não encontrada.");
    const response = await fetch(path, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${value}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      },
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}`);
    return data;
  }

  function render() {
    const list = $("#notificationList");
    const badge = $("#notificationBadge");
    const unread = items.filter((item) => !item.lida).length;
    if (badge) { badge.textContent = String(unread); badge.hidden = !unread; }
    if (!list) return;

    const browserButton = ("Notification" in window)
      ? `<button class="dash-push-enable" id="enablePushButton" type="button"><span>🔔</span><div><strong>${Notification.permission === "granted" ? "Notificações do navegador ativadas" : "Ativar notificações no dispositivo"}</strong><small>${Notification.permission === "granted" ? "Novos avisos aparecem no sistema e no navegador." : "Permita avisos novos sem depender de atualizar a página."}</small></div></button>`
      : "";

    const cards = items.length
      ? items.map((item) => `<article class="dash-notification-item ${item.lida ? "" : "unread"}" data-notification-id="${escapeHtml(item.id)}" data-link="${escapeHtml(item.link || "")}"><span>${escapeHtml(item.icone || "🔔")}</span><div><strong>${escapeHtml(item.titulo || "Notificação")}</strong><small>${escapeHtml(item.mensagem || "")}</small></div></article>`).join("")
      : `<div class="dash-notification-empty">Nenhuma notificação no momento.</div>`;
    list.innerHTML = browserButton + cards;
  }

  async function showBrowserNotification(item) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const options = { body: String(item.mensagem || ""), icon: "/assets/turma-primo-logo.svg", tag: `turma-${item.id}`, renotify: false };
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        if (registration?.showNotification) { await registration.showNotification(item.titulo || "Turma do Primo", options); return; }
      }
      new Notification(item.titulo || "Turma do Primo", options);
    } catch (_) {}
  }

  async function load({ notify = true } = {}) {
    if (!token()) return;
    try {
      const data = await api("/minhas-notificacoes");
      const next = Array.isArray(data.notificacoes) ? data.notificacoes : [];
      const unreadNow = new Set(next.filter((item) => !item.lida).map((item) => String(item.id)));
      if (initialized && notify) {
        for (const item of next) {
          const id = String(item.id || "");
          if (!item.lida && id && !knownUnread.has(id)) showBrowserNotification(item);
        }
      }
      items = next;
      knownUnread = unreadNow;
      initialized = true;
      render();
      window.dispatchEvent(new CustomEvent("turma:notifications-updated", { detail: { total: items.length, naoLidas: Number(data.naoLidas || 0) } }));
    } catch (error) {
      console.warn("Notificações indisponíveis:", error.message);
    }
  }

  async function markOne(id) {
    if (!id) return;
    try {
      await api(`/notificacoes/${encodeURIComponent(id)}/lida`, { method: "POST" });
      const item = items.find((entry) => String(entry.id) === String(id));
      if (item) item.lida = true;
      knownUnread.delete(String(id));
      render();
    } catch (error) { console.warn(error.message); }
  }

  async function markAll() {
    try {
      await api("/notificacoes/marcar-todas-lidas", { method: "POST" });
      items.forEach((item) => { item.lida = true; });
      knownUnread.clear();
      render();
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

      // Push em segundo plano é opcional. Se VAPID não estiver configurado,
      // os avisos dentro do site e enquanto a plataforma estiver aberta continuam funcionando.
      if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
          const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
          const keyData = await api("/push/public-key");
          if (keyData?.publicKey) {
            const padding = "=".repeat((4 - keyData.publicKey.length % 4) % 4);
            const base64 = (keyData.publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
            const raw = atob(base64);
            const key = Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
            await api("/push/subscribe", { method: "POST", body: JSON.stringify({ subscription }) });
          }
        } catch (pushError) {
          console.info("Push em segundo plano não configurado; mantendo notificações da plataforma:", pushError.message);
        }
      }
      render();
      new Notification("Turma do Primo", { body: "Notificações ativadas com sucesso!", icon: "/assets/turma-primo-logo.svg", tag: "turma-notifications-enabled" });
    } catch (error) {
      console.warn(error.message);
      if (button) {
        const strong = button.querySelector("strong");
        const small = button.querySelector("small");
        if (strong) strong.textContent = "Permissão não ativada";
        if (small) small.textContent = "Libere as notificações nas configurações do navegador.";
      }
    } finally {
      if (button) button.disabled = false;
    }
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
    document.addEventListener("visibilitychange", () => { if (!document.hidden) load({ notify: false }); });
  }

  function init() {
    bind();
    load({ notify: false });
    window.setInterval(() => load({ notify: true }), 30000);
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();