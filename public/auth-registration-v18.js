"use strict";
(() => {
  if (window.__TURMA_AUTH_REGISTRATION_V18__) return;
  window.__TURMA_AUTH_REGISTRATION_V18__ = true;

  const $ = (id) => document.getElementById(id);
  const emailOk = (value) => value.length <= 190 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  function message(text, type = "erro") {
    const box = $("mensagem");
    if (!box) return;
    box.textContent = String(text || "");
    box.className = `auth-message ${type} active`;
    clearTimeout(box._v18Timer);
    box._v18Timer = setTimeout(() => box.classList.remove("active"), 6000);
  }

  function loading(active, text = "Criando sua conta gratuita…") {
    const overlay = $("authLoadingOverlay");
    if (!overlay) return;
    const label = $("authLoadingTexto");
    if (label) label.textContent = text;
    overlay.hidden = !active;
    overlay.setAttribute("aria-hidden", String(!active));
    overlay.classList.toggle("active", active);
    overlay.classList.toggle("open", active);
  }

  function switchToLogin(email) {
    $("tabLogin")?.click();
    const loginEmail = $("loginEmail");
    if (loginEmail) loginEmail.value = email;
  }

  async function submit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "formCadastro") return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (form.dataset.v18Submitting === "1") return;

    const nome = String($("cadastroNome")?.value || "").trim();
    const email = String($("cadastroEmail")?.value || "").trim().toLowerCase();
    const telefone = String($("cadastroTelefone")?.value || "").trim();
    const senha = String($("cadastroSenha")?.value || "");
    const phoneDigits = telefone.replace(/\D/g, "");

    if (nome.length < 3) return message("Digite seu nome completo.");
    if (!emailOk(email)) return message("Digite um e-mail válido.");
    if (phoneDigits && phoneDigits.length < 10) return message("Digite o WhatsApp corretamente.");
    if (senha.length < 10) return message("A senha precisa ter pelo menos 10 caracteres.");

    const button = form.querySelector(".auth-submit");
    const original = button?.innerHTML || "";
    form.dataset.v18Submitting = "1";
    if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); }
    loading(true);

    try {
      const response = await fetch("/criar", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, telefone, senha })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Não foi possível criar a conta (erro ${response.status}).`);

      const created = data.sucesso === true || data.success === true || Boolean(data.usuario);
      if (!created) throw new Error(data.mensagem || "O servidor não confirmou a criação da conta.");

      form.reset();
      loading(false);
      switchToLogin(email);
      message(data.premiumLiberado
        ? "Conta criada com sucesso e acesso Premium localizado. Faça seu login."
        : "Conta criada com sucesso. Agora faça seu login.", "sucesso");
    } catch (error) {
      loading(false);
      message(error?.message || "Não foi possível criar a conta.");
    } finally {
      delete form.dataset.v18Submitting;
      if (button) { button.disabled = false; button.removeAttribute("aria-busy"); if (original) button.innerHTML = original; }
    }
  }

  document.addEventListener("submit", submit, true);
})();
