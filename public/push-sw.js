"use strict";
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { title: "Turma do Primo", body: event.data?.text() || "Você recebeu uma nova notificação." }; }
  const title = data.title || data.titulo || "Turma do Primo";
  const options = {
    body: data.body || data.mensagem || "Você recebeu uma nova notificação.",
    icon: data.icon || "/assets/turma-primo-logo.svg",
    badge: data.badge || "/assets/turma-primo-logo.svg",
    tag: data.tag || data.id || "turma-notificacao",
    renotify: true,
    requireInteraction: data.prioridade === "urgente",
    data: { url: data.url || data.link || "/dashboard", id: data.id || "" },
    actions: [{ action: "open", title: "Abrir" }]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        client.navigate(target).catch(() => {});
        return client.focus();
      }
    }
    return clients.openWindow ? clients.openWindow(target) : undefined;
  }));
});