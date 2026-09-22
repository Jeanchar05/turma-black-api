"use strict";
(() => {
  if (window.__TURMA_PROFILE_SAVE_GUARD_V6__) return;
  window.__TURMA_PROFILE_SAVE_GUARD_V6__ = true;
  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  if (route() !== "/perfil") return;

  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  let originalPhone = "";
  const $ = (selector, root = document) => root.querySelector(selector);

  function token() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of TOKEN_KEYS) {
        try { const value = storage.getItem(key); if (value) return value; } catch (_) {}
      }
    }
    return "";
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      method: options.method || "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token()}`, ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}`);
    return data;
  }

  function phoneDigits(value) {
    let digits = String(value || "").replace(/\D+/g, "");
    if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
    return digits;
  }

  function notify(message, type = "success") {
    let stack = $("#profileToastStack");
    if (!stack) { stack = document.createElement("div"); stack.id = "profileToastStack"; document.body.appendChild(stack); }
    const item = document.createElement("div");
    item.className = `profile-toast ${type}`;
    item.textContent = message;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 3400);
  }

  async function save(event) {
    if (event.target?.id !== "profileForm") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.target;
    const button = $('button[type="submit"]', form);
    if (button) { button.disabled = true; button.textContent = "Salvando…"; }
    try {
      const name = $("#profileName")?.value.trim() || "";
      const photo = $("#profilePhoto")?.value.trim() || "";
      const data = await api("/profile-v6/perfil", { method: "PUT", body: { nome: name, foto: photo } });
      const entered = phoneDigits($("#profilePhone")?.value || "");
      const changed = entered && entered !== phoneDigits(originalPhone);
      const status = $("#profileSaveStatus");
      if (status) status.textContent = changed ? "Nome e foto salvos. Confirme o telefone separadamente." : "Alterações sincronizadas com sua conta.";
      notify(changed ? "Nome e foto salvos. Para trocar o telefone, use “Verificar novo número”." : (data.mensagem || "Perfil atualizado."), changed ? "error" : "success");
    } catch (error) { notify(error.message, "error"); }
    finally { if (button) { button.disabled = false; button.textContent = "Salvar alterações"; } }
  }

  async function init() {
    document.addEventListener("submit", save, true);
    try {
      const me = await api("/me");
      originalPhone = me.usuario?.telefone || me.telefone || "";
      document.addEventListener("turma:phone-verified", (event) => { originalPhone = event.detail?.telefone || originalPhone; });
    } catch (_) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
