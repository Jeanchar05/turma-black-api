"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];

  const cover = (title, sub, symbol) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">
      <defs>
        <radialGradient id="b" cx="78%" cy="36%"><stop stop-color="#41156f"/><stop offset=".58" stop-color="#1a0b27"/><stop offset="1" stop-color="#08040d"/></radialGradient>
        <linearGradient id="g"><stop stop-color="#fff1b1"/><stop offset=".48" stop-color="#d99cff"/><stop offset="1" stop-color="#8d35e8"/></linearGradient>
        <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#fff" stroke-opacity=".025"/></pattern>
      </defs>
      <rect width="1200" height="675" rx="32" fill="url(#b)"/>
      <rect width="1200" height="675" rx="32" fill="url(#grid)"/>
      <circle cx="940" cy="326" r="176" fill="#09040e" fill-opacity=".84" stroke="#a44be5" stroke-opacity=".72" stroke-width="6"/>
      <circle cx="940" cy="326" r="216" fill="none" stroke="#d99cff" stroke-opacity=".08" stroke-width="2"/>
      <text x="940" y="382" text-anchor="middle" fill="url(#g)" font-size="158" font-family="Georgia">${symbol}</text>
      <text x="74" y="274" fill="#fff" font-family="Arial" font-size="70" font-weight="900">${title}</text>
      <text x="78" y="338" fill="#d7a8e8" font-family="Arial" font-size="24" letter-spacing="4">${sub}</text>
      <rect x="76" y="385" width="170" height="5" rx="3" fill="#a855f7" fill-opacity=".72"/>
    </svg>`);

  const covers = {
    gemeos: cover("GÊMEOS", "11 · 22 · 33", "11"),
    espelhos: cover("ESPELHOS", "INVERSÃO", "69"),
    fibonacci: cover("FIBONACCI", "SEQUÊNCIA", "Φ"),
    magneto: cover("MAGNETO", "CONEXÃO", "M"),
    camaleoes: cover("CAMALEÕES", "ADAPTAÇÃO", "C"),
    pitagoras: cover("PITÁGORAS", "TRIANGULAÇÃO", "△"),
    cavalo: cover("CAVALO", "TERMINAIS", "♞"),
    "eclipse-zero": cover("ECLIPSE ZERO", "TERMINAIS 0 E 9", "0")
  };

  const modules = [
    ["Gêmeos", "gemeos"], ["Espelhos", "espelhos"], ["Fibonacci", "fibonacci"],
    ["Magneto", "magneto"], ["Camaleões", "camaleoes"], ["Pitágoras", "pitagoras"],
    ["Cavalo", "cavalo"], ["Eclipse Zero", "eclipse-zero"]
  ];

  function token() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of TOKEN_KEYS) {
        try {
          const value = storage.getItem(key);
          if (value) return value;
        } catch (_) {}
      }
    }
    return "";
  }

  async function api(endpoint, options = {}) {
    const response = await fetch(endpoint, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token()}`,
        ...(options.body ? { "Content-Type": "application/json" } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}`);
    return data;
  }

  function renderModules() {
    const host = $("freeModuleGrid");
    if (!host) return;
    host.innerHTML = modules.map(([name, slug]) => `
      <article class="free-module" aria-label="${name} — conteúdo Premium">
        <img src="${covers[slug]}" alt="Módulo ${name}" loading="lazy" />
        <div class="free-lock"><span aria-hidden="true">🔒</span></div>
        <div class="free-module-copy"><strong>${name}</strong><small>Disponível no Premium</small></div>
      </article>`).join("");
  }

  function showMessage(text, type = "sucesso") {
    const box = $("premiumRequestMessage");
    if (!box) return;
    box.textContent = text;
    box.className = `auth-message ${type} active`;
  }

  function firstName(name) {
    return String(name || "Aluno").trim().split(/\s+/)[0] || "Aluno";
  }

  function greeting(name) {
    const hour = new Date().getHours();
    const period = hour < 12 ? "BOM DIA" : hour < 18 ? "BOA TARDE" : "BOA NOITE";
    return `${period}, ${String(name || "ALUNO").toUpperCase()}`;
  }

  function applyUser(user) {
    const name = firstName(user?.nome);
    $$('[data-user-name]').forEach((el) => { el.textContent = name; });
    $$('[data-user-avatar]').forEach((el) => {
      el.textContent = name.charAt(0).toUpperCase();
      const photo = String(user?.foto || "").trim();
      if (photo) {
        el.style.backgroundImage = `url("${photo.replaceAll('"', '%22')}")`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
        el.textContent = "";
      }
    });
    if ($("freeGreeting")) $("freeGreeting").textContent = greeting(name);
  }

  async function loadUser() {
    try {
      const data = await api("/me");
      const user = data.usuario || data.user || {};
      applyUser(user);

      const role = String(user.cargo || user.tipo || "aluno").toLowerCase();
      if (role === "aluno" && user.acessoPremium === true) {
        window.location.replace("/dashboard");
        return;
      }
    } catch (_) {}
  }

  function planLabel(value) {
    return {
      monthly: "Mensal — R$ 99,99",
      six_months: "6 meses — R$ 249,99",
      annual: "Anual — R$ 397,00"
    }[value] || value;
  }

  function syncPlanSummary() {
    const radio = document.querySelector('input[name="plan"]:checked');
    const summary = $("selectedPlanSummary");
    if (summary && radio) summary.textContent = planLabel(radio.value);
  }

  function submit(event) {
    event.preventDefault();
    const button = $("generatePremiumCode");
    const radio = document.querySelector('input[name="plan"]:checked');
    const checkout = radio?.dataset.checkout;

    if (!checkout) return showMessage("Não foi possível localizar o checkout deste plano.", "erro");

    if (button) {
      button.disabled = true;
      button.textContent = "Abrindo checkout seguro…";
    }
    showMessage("Redirecionando para o checkout oficial da Bestfy…", "sucesso");
    window.location.assign(checkout);
  }

  function closeMobileMenu() {
    $("freeSidebar")?.classList.remove("open");
    if ($("freeOverlay")) $("freeOverlay").hidden = true;
  }

  function bind() {
    $("freeMenu")?.addEventListener("click", () => {
      $("freeSidebar")?.classList.add("open");
      if ($("freeOverlay")) $("freeOverlay").hidden = false;
    });
    $("freeOverlay")?.addEventListener("click", closeMobileMenu);
    $("premiumRequestForm")?.addEventListener("submit", submit);
    $$('input[name="plan"]').forEach((radio) => radio.addEventListener("change", syncPlanSummary));
    $$('a[href^="#"]').forEach((anchor) => anchor.addEventListener("click", closeMobileMenu));
  }

  async function init() {
    renderModules();
    bind();
    syncPlanSummary();
    await Promise.allSettled([loadUser()]);
    $("freeLoading")?.remove();
    document.body.classList.add("protected-ready");
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();
})();
