"use strict";
(() => {
  if (window.__TURMA_PROFILE_V6__) return;
  window.__TURMA_PROFILE_V6__ = true;
  const route = () => window.TurmaNavigation?.pathname || location.pathname;
  if (route() !== "/perfil") return;

  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  let phoneVerificationId = "";

  function token() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of TOKEN_KEYS) {
        try { const value = storage.getItem(key); if (value) return value; } catch (_) {}
      }
    }
    return "";
  }

  async function api(path, options = {}) {
    const jwt = token();
    if (!jwt) throw new Error("Sessão expirada.");
    const response = await fetch(path, {
      method: options.method || "GET",
      headers: {
        Accept: options.raw ? "application/pdf" : "application/json",
        Authorization: `Bearer ${jwt}`,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {})
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    if (options.raw) return response;
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) {
      const error = new Error(data.erro || data.mensagem || `Erro ${response.status}`);
      error.data = data;
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function notify(message, type = "success") {
    let stack = $("#profileToastStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "profileToastStack";
      document.body.appendChild(stack);
    }
    const item = document.createElement("div");
    item.className = `profile-toast ${type}`;
    item.textContent = message;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 3400);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function applyAvatar(photo) {
    if (!photo) return;
    $$('[data-profile-avatar]').forEach((avatar) => {
      avatar.textContent = "";
      avatar.style.backgroundImage = `url(${JSON.stringify(String(photo))})`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
    });
  }

  function injectPhotoControl() {
    const wrap = $(".profile-avatar-wrap");
    if (!wrap || $("#profilePhotoUploadV6")) return;
    const control = document.createElement("label");
    control.id = "profilePhotoUploadV6";
    control.className = "profile-v6-photo-upload";
    control.innerHTML = '<input type="file" accept="image/jpeg,image/png,image/webp" hidden><span>✦</span><b>Trocar foto</b>';
    wrap.appendChild(control);
    const input = $("input", control);
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) return notify("Use uma imagem de até 4 MB.", "error");
      control.classList.add("busy");
      try {
        const base64 = await fileToBase64(file);
        const data = await api("/dashboard-premium/perfil/foto", { method: "POST", body: { base64 } });
        applyAvatar(data.foto);
        const legacy = $("#profilePhoto");
        if (legacy) legacy.value = data.foto;
        notify("Foto de perfil atualizada.");
      } catch (error) {
        notify(error.message, "error");
      } finally {
        control.classList.remove("busy");
        input.value = "";
      }
    });
  }

  function injectPhoneVerification() {
    const phone = $("#profilePhone");
    if (!phone || $("#profilePhoneVerifyV6")) return;
    const actions = document.createElement("div");
    actions.id = "profilePhoneVerifyV6";
    actions.className = "profile-v6-phone-actions";
    actions.innerHTML = '<button type="button">Verificar novo número</button><small>Alterações de telefone exigem um código de confirmação.</small>';
    phone.closest("label")?.appendChild(actions);
    $("button", actions).addEventListener("click", async () => {
      const value = phone.value.trim();
      if (!value) return notify("Informe o novo telefone primeiro.", "error");
      const button = $("button", actions);
      button.disabled = true;
      button.textContent = "Enviando código…";
      try {
        const data = await api("/dashboard-premium/perfil/telefone/solicitar", { method: "POST", body: { telefone: value } });
        phoneVerificationId = data.verificationId;
        openPhoneModal(data);
      } catch (error) {
        if (error.data?.codigo === "PHONE_OTP_NOT_CONFIGURED") notify("A verificação está pronta, mas o provedor de SMS/WhatsApp ainda precisa ser conectado.", "error");
        else notify(error.message, "error");
      } finally {
        button.disabled = false;
        button.textContent = "Verificar novo número";
      }
    });
  }

  function ensurePhoneModal() {
    const existing = $("#profilePhoneModalV6");
    if (existing) return existing;
    const modal = document.createElement("div");
    modal.id = "profilePhoneModalV6";
    modal.className = "profile-v6-modal";
    modal.hidden = true;
    modal.innerHTML = `<div class="profile-v6-modal-card">
      <button class="profile-v6-modal-close" type="button">×</button>
      <span>VERIFICAÇÃO DE TELEFONE</span><h2>Confirme o código</h2>
      <p id="profilePhoneModalText">Enviamos um código de 6 dígitos.</p>
      <label><small>Código</small><input id="profilePhoneCodeV6" inputmode="numeric" maxlength="6" placeholder="000000"></label>
      <small class="profile-v6-dev-code" id="profilePhoneDevCodeV6" hidden></small>
      <button class="profile-v6-primary" id="profilePhoneConfirmV6" type="button">Confirmar telefone</button>
    </div>`;
    document.body.appendChild(modal);
    $(".profile-v6-modal-close", modal).addEventListener("click", () => { modal.hidden = true; });
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.hidden = true; });
    $("#profilePhoneConfirmV6", modal).addEventListener("click", confirmPhone);
    return modal;
  }

  function openPhoneModal(data) {
    const modal = ensurePhoneModal();
    $("#profilePhoneModalText", modal).textContent = `${data.mensagem || "Código enviado."} Número: ${data.telefone || ""}`;
    const dev = $("#profilePhoneDevCodeV6", modal);
    if (data.devCode) { dev.hidden = false; dev.textContent = `Código de desenvolvimento: ${data.devCode}`; }
    else dev.hidden = true;
    $("#profilePhoneCodeV6", modal).value = "";
    modal.hidden = false;
    setTimeout(() => $("#profilePhoneCodeV6", modal)?.focus(), 50);
  }

  async function confirmPhone() {
    const modal = ensurePhoneModal();
    const code = $("#profilePhoneCodeV6", modal).value.replace(/\D+/g, "").slice(0, 6);
    if (code.length !== 6) return notify("Digite os 6 números do código.", "error");
    const button = $("#profilePhoneConfirmV6", modal);
    button.disabled = true;
    button.textContent = "Confirmando…";
    try {
      const data = await api("/dashboard-premium/perfil/telefone/confirmar", { method: "POST", body: { verificationId: phoneVerificationId, codigo: code } });
      if ($("#profilePhone")) $("#profilePhone").value = data.usuario?.telefone || $("#profilePhone").value;
      document.dispatchEvent(new CustomEvent("turma:phone-verified", { detail: { telefone: data.usuario?.telefone || "" } }));
      modal.hidden = true;
      phoneVerificationId = "";
      notify("Telefone confirmado e atualizado.");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Confirmar telefone";
    }
  }

  function injectPasswordForm() {
    const panel = $('[data-profile-panel="security"]');
    if (!panel || $("#profilePasswordFormV6")) return;
    const section = document.createElement("section");
    section.className = "profile-card profile-v6-password-card";
    section.innerHTML = `<div class="profile-v6-section-title"><span>SENHA</span><h2>Alterar senha</h2><p>Confirme sua senha atual antes de definir uma nova.</p></div>
      <form id="profilePasswordFormV6">
        <label><span>Senha atual</span><div><input type="password" id="profileCurrentPasswordV6" autocomplete="current-password" required><button type="button" data-eye>◉</button></div></label>
        <label><span>Nova senha</span><div><input type="password" id="profileNewPasswordV6" autocomplete="new-password" required><button type="button" data-eye>◉</button></div></label>
        <label><span>Confirmar nova senha</span><div><input type="password" id="profileConfirmPasswordV6" autocomplete="new-password" required><button type="button" data-eye>◉</button></div></label>
        <footer><small>A troca de senha encerra as sessões antigas por segurança.</small><button class="profile-v6-primary" type="submit">Alterar senha</button></footer>
      </form>`;
    panel.appendChild(section);
    section.addEventListener("click", (event) => {
      const eye = event.target.closest("[data-eye]");
      if (!eye) return;
      const input = eye.parentElement.querySelector("input");
      input.type = input.type === "password" ? "text" : "password";
    });
    $("#profilePasswordFormV6", section).addEventListener("submit", changePassword);
  }

  async function changePassword(event) {
    event.preventDefault();
    const current = $("#profileCurrentPasswordV6").value;
    const next = $("#profileNewPasswordV6").value;
    const confirm = $("#profileConfirmPasswordV6").value;
    if (next !== confirm) return notify("A confirmação da nova senha não confere.", "error");
    const button = $('button[type="submit"]', event.currentTarget);
    button.disabled = true;
    button.textContent = "Alterando…";
    try {
      const data = await api("/dashboard-premium/seguranca/senha", { method: "POST", body: { senhaAtual: current, novaSenha: next } });
      notify(data.mensagem || "Senha atualizada.");
      setTimeout(() => {
        TOKEN_KEYS.forEach((key) => { try { sessionStorage.removeItem(key); localStorage.removeItem(key); } catch (_) {} });
        location.replace("/");
      }, 900);
    } catch (error) {
      notify(error.message, "error");
      button.disabled = false;
      button.textContent = "Alterar senha";
    }
  }

  function injectReportButton() {
    const actions = $(".profile-actions-card");
    if (!actions || $("#profileFullReportV6")) return;
    const button = document.createElement("button");
    button.id = "profileFullReportV6";
    button.type = "button";
    button.innerHTML = '<span class="gold">PDF</span><div><strong>Relatório completo da conta</strong><small>Conta, aprendizado, provas, gestão e suporte</small></div><b>↓</b>';
    actions.appendChild(button);
    button.addEventListener("click", downloadReport);
  }

  async function downloadReport() {
    const button = $("#profileFullReportV6");
    button.disabled = true;
    try {
      const response = await api("/dashboard-premium/perfil/relatorio.pdf", { raw: true });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.erro || "Não foi possível gerar o relatório.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "relatorio-turma-do-primo.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1600);
      notify("Relatório completo gerado.");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  function hideLegacyPhotoUrl() {
    const input = $("#profilePhoto");
    const label = input?.closest("label");
    if (label) label.classList.add("profile-v6-legacy-photo");
  }

  async function init() {
    injectPhotoControl();
    injectPhoneVerification();
    injectPasswordForm();
    injectReportButton();
    hideLegacyPhotoUrl();
    try {
      const me = await api("/me");
      const photo = me.usuario?.foto || me.foto || "";
      if (photo) applyAvatar(photo);
    } catch (_) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
