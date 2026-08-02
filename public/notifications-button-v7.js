"use strict";
(() => {
  if (window.__TURMA_NOTIFICATION_BUTTON_V7__) return;
  window.__TURMA_NOTIFICATION_BUTTON_V7__ = true;

  function createButton(host, notes = false) {
    if (!host || host.querySelector('#notificationButton,.dash-notification-btn,.roulette-notification,.favorites-notification,[data-notification-toggle]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = notes ? 'notes-icon-button dash-notification-btn' : 'dash-notification-btn';
    button.dataset.notificationToggle = '1';
    button.setAttribute('aria-label', 'Abrir notificações');
    button.innerHTML = '<svg><use href="/assets/dashboard-icons.svg#i-bell"></use></svg><b hidden>0</b>';
    const user = host.querySelector('.dash-user-menu,.notes-top-user,.favorites-user,.roulette-avatar-top');
    host.insertBefore(button, user || host.firstChild);
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const panel = document.getElementById('turmaNotificationPopover');
      if (panel) panel.hidden = !panel.hidden;
    });
  }

  function install() {
    document.querySelectorAll('.dash-top-actions').forEach(host => createButton(host, false));
    const notes = document.querySelector('.notes-top-actions');
    if (notes) createButton(notes, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 120), { once:true });
  else setTimeout(install, 120);
  document.addEventListener('turma:protected-ready', () => setTimeout(install, 80));
})();
