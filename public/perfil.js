"use strict";

const PROFILE_TOKEN_KEYS = ["token", "adminToken", "authToken", "accessToken", "jwt"];
const profileState = { user: null, home: null, theme: "dark" };
const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function getToken() {
  for (const key of PROFILE_TOKEN_KEYS) {
    try {
      const sessionValue = sessionStorage.getItem(key);
      if (sessionValue) return sessionValue;
      const localValue = localStorage.getItem(key);
      if (localValue) return localValue;
    } catch (_) {}
  }
  return "";
}

async function profileApi(endpoint, options = {}) {
  const token = getToken();
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  const response = await fetch(`${location.origin}${endpoint}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {})
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.erro) throw new Error(data.erro || data.mensagem || `Erro ${response.status}.`);
  return data;
}

function toast(message, type = "success") {
  const stack = $("profileToastStack");
  if (!stack) return;
  const item = document.createElement("div");
  item.className = `profile-toast ${type}`;
  item.textContent = message;
  stack.appendChild(item);
  requestAnimationFrame(() => item.classList.add("show"));
  setTimeout(() => {
    item.classList.remove("show");
    setTimeout(() => item.remove(), 220);
  }, 3200);
}

function firstName(name) {
  return String(name || "Primo").trim().split(/\s+/)[0] || "Primo";
}

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function resolveTheme(value) {
  if (value === "system") return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  return value === "light" ? "light" : "dark";
}

function applyTheme(value) {
  profileState.theme = value;
  const resolved = resolveTheme(value);
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#07030d" : "#eef0f5");
  const iconUse = $("profileThemeToggle")?.querySelector("use");
  if (iconUse) iconUse.setAttribute("href", `assets/dashboard-icons.svg#${resolved === "dark" ? "i-moon" : "i-sun"}`);
  $$('[data-set-theme]').forEach((button) => button.classList.toggle("active", button.dataset.setTheme === value));
}

async function saveTheme(value) {
  applyTheme(value);
  try {
    await profileApi("/dashboard-premium/preferencias", { method: "PUT", body: { tema: value } });
    toast("Preferência de aparência salva.");
  } catch (error) {
    toast(`Tema aplicado nesta sessão. ${error.message}`, "error");
  }
}

function setAvatar(user) {
  const name = String(user?.nome || "Primo").trim();
  const initial = (name.charAt(0) || "P").toUpperCase();
  $$('[data-profile-avatar]').forEach((avatar) => {
    avatar.textContent = initial;
    avatar.style.backgroundImage = "";
    if (user?.foto && /^https?:\/\//i.test(user.foto)) {
      avatar.textContent = "";
      avatar.style.backgroundImage = `url("${String(user.foto).replaceAll('"', "%22")}")`;
    }
  });
}

function statusLabel(user) {
  const status = String(user?.status || "ativo").toLowerCase();
  if (user?.suspenso || status === "suspenso") return "Suspensa";
  if (status === "bloqueado") return "Bloqueada";
  if (status === "pendente") return "Pendente";
  return "Ativa";
}

function fillProfile() {
  const home = profileState.home || {};
  const user = profileState.user || {};
  const plan = home.plano || {};
  const stats = home.estatisticas || {};
  const fullName = user.nome || "Usuário";
  const planName = plan.nome || "Turma do Primo";
  const planLabel = plan.rotulo || "Aluno";
  const planProgress = Math.max(3, Math.min(100, Number(plan.percentualValidade || 100)));
  const accountStatus = statusLabel(user);

  $$('[data-profile-fullname]').forEach((element) => element.textContent = fullName);
  $$('[data-profile-firstname]').forEach((element) => element.textContent = firstName(fullName));
  $$('[data-profile-email]').forEach((element) => element.textContent = user.email || "—");
  $$('[data-profile-plan]').forEach((element) => element.textContent = planLabel);
  $("profileRoleLabel").textContent = planLabel === "Equipe" ? "Equipe Turma do Primo" : "Aluno Turma do Primo";

  $("profileName").value = user.nome || "";
  $("profileEmail").value = user.email || "";
  $("profilePhone").value = user.telefone || "";
  $("profilePhoto").value = user.foto || "";
  $("profileStatus").value = accountStatus;
  $("accountStateText").textContent = `Conta ${accountStatus.toLowerCase()}`;
  $("lastAccessText").textContent = "Sessão atual autenticada";

  $("profilePlanName").textContent = planName;
  $("profilePlanExpiry").textContent = plan.validadeTexto || "Acesso ativo";
  $("profilePlanProgress").style.width = `${planProgress}%`;
  $("sidePlanName").textContent = planName;
  $("sidePlanLabel").textContent = planLabel;
  $("sidePlanExpiry").textContent = plan.validadeTexto || "Acesso ativo";
  $("sidePlanProgress").style.width = `${planProgress}%`;

  $("profileStatModules").textContent = String(stats.modulosConcluidos || 0);
  $("profileStatModulesTotal").textContent = `de ${stats.totalModulos || 0}`;
  $("profileStatAverage").textContent = Number(stats.mediaGeral || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  $("profileStatProgress").textContent = `${Math.round(Number(stats.progressoGeral || 0))}%`;
  $("profileStatFocus").textContent = String(stats.diasFoco || 0);

  setAvatar(user);
  renderDevice();
  renderActivities();
}

function getDeviceInfo() {
  const ua = navigator.userAgent || "";
  let browser = "Navegador";
  if (/Edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Google Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Mozilla Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  let os = "Dispositivo";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  return { browser, os, mobile: /Android|iPhone|iPad|iPod|Mobile/i.test(ua) };
}

function renderDevice() {
  const container = $("profileDeviceList");
  if (!container) return;
  const device = getDeviceInfo();
  container.innerHTML = `<div class="profile-device"><span class="profile-device-icon"><svg><use href="assets/dashboard-icons.svg#i-monitor"></use></svg></span><div><strong>${escapeHtml(device.browser)} • ${escapeHtml(device.os)}</strong><small>${device.mobile ? "Dispositivo móvel" : "Computador"} • sessão protegida</small></div><span class="profile-device-status">Ativo agora</span></div>`;
}

function activityIcon(type) {
  const map = { nota: "i-note", suporte: "i-support", modulo: "i-layers", prova: "i-exam", perfil: "i-user", minigame: "i-game", roleta: "i-roulette" };
  return map[String(type || "").toLowerCase()] || "i-activity";
}

function renderActivities() {
  const container = $("profileActivityList");
  if (!container) return;
  const activities = Array.isArray(profileState.home?.atividades) ? profileState.home.atividades : [];
  container.innerHTML = activities.length
    ? activities.slice(0, 20).map((item) => `<div class="profile-activity-row"><span class="profile-activity-icon"><svg><use href="assets/dashboard-icons.svg#${activityIcon(item.tipo)}"></use></svg></span><div><strong>${escapeHtml(item.titulo || "Atividade")}</strong><small>${escapeHtml(item.descricao || "Movimentação registrada na plataforma.")}</small></div><small>${escapeHtml(formatDate(item.createdAt, true))}</small></div>`).join("")
    : `<div class="profile-empty">Suas próximas atividades aparecerão aqui automaticamente.</div>`;
}

function selectTab(name) {
  $$('[data-profile-tab]').forEach((button) => button.classList.toggle("active", button.dataset.profileTab === name));
  $$('[data-profile-panel]').forEach((panel) => panel.classList.toggle("active", panel.dataset.profilePanel === name));
  scrollTo({ top: 0, behavior: "smooth" });
}

async function saveProfile(event) {
  event.preventDefault();
  const name = $("profileName").value.trim();
  if (!name) return toast("Informe seu nome.", "error");
  const button = event.currentTarget.querySelector('button[type="submit"]');
  if (button) { button.disabled = true; button.textContent = "Salvando…"; }
  try {
    const response = await profileApi("/dashboard-premium/perfil", {
      method: "PUT",
      body: {
        nome: name,
        telefone: $("profilePhone").value.trim(),
        foto: $("profilePhoto").value.trim()
      }
    });
    profileState.user = response.usuario;
    if (profileState.home) profileState.home.usuario = response.usuario;
    fillProfile();
    $("profileSaveStatus").textContent = "Alterações sincronizadas com sua conta.";
    toast("Perfil atualizado com sucesso.");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    if (button) { button.disabled = false; button.textContent = "Salvar alterações"; }
  }
}

function logout() {
  PROFILE_TOKEN_KEYS.forEach((key) => {
    try { sessionStorage.removeItem(key); localStorage.removeItem(key); } catch (_) {}
  });
  location.replace("/");
}

function bindEvents() {
  $("profileForm")?.addEventListener("submit", saveProfile);
  $("profileMenuToggle")?.addEventListener("click", () => {
    $("profileSidebar")?.classList.add("open");
    if ($("profileMobileOverlay")) $("profileMobileOverlay").hidden = false;
  });
  $("profileMobileOverlay")?.addEventListener("click", () => {
    $("profileSidebar")?.classList.remove("open");
    $("profileMobileOverlay").hidden = true;
  });
  $("profileSearchTrigger")?.addEventListener("click", () => location.assign("/dashboard"));
  $("profileThemeToggle")?.addEventListener("click", () => saveTheme(resolveTheme(profileState.theme) === "dark" ? "light" : "dark"));
  $("profileLogout")?.addEventListener("click", logout);
  $("generateProfilePdf")?.addEventListener("click", generateProfilePdf);

  $$('[data-profile-tab]').forEach((button) => button.addEventListener("click", () => selectTab(button.dataset.profileTab)));
  $$('[data-set-theme]').forEach((button) => button.addEventListener("click", () => saveTheme(button.dataset.setTheme)));
  $$('[data-action="open-security"]').forEach((button) => button.addEventListener("click", () => selectTab("security")));
  $$('[data-action="open-preferences"]').forEach((button) => button.addEventListener("click", () => selectTab("preferences")));

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      location.assign("/dashboard");
    }
    if (event.key === "Escape") {
      $("profileSidebar")?.classList.remove("open");
      if ($("profileMobileOverlay")) $("profileMobileOverlay").hidden = true;
    }
  });

  matchMedia?.("(prefers-color-scheme: light)")?.addEventListener?.("change", () => {
    if (profileState.theme === "system") applyTheme("system");
  });
}

function pdfEscapeText(value) {
  const replacements = { "–": "-", "—": "-", "“": '"', "”": '"', "‘": "'", "’": "'", "•": "-", "…": "..." };
  let output = "";
  for (const original of String(value ?? "")) {
    let char = replacements[original] || original;
    let code = char.charCodeAt(0);
    if (code > 255) {
      char = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0) || "?";
      code = char.charCodeAt(0);
    }
    if (char === "\\" || char === "(" || char === ")") output += `\\${char}`;
    else if (code < 32 || code > 126) output += `\\${Math.min(code, 255).toString(8).padStart(3, "0")}`;
    else output += char;
  }
  return output;
}

function buildProfilePdf() {
  const pageHeight = 842;
  const home = profileState.home || {};
  const user = profileState.user || {};
  const plan = home.plano || {};
  const stats = home.estatisticas || {};
  const device = getDeviceInfo();
  const status = statusLabel(user);
  const now = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  const content = [];

  const rgb = (hex) => {
    const normalized = hex.replace("#", "");
    return [0, 2, 4].map((index) => (parseInt(normalized.slice(index, index + 2), 16) / 255).toFixed(3)).join(" ");
  };
  const y = (top) => pageHeight - top;
  const rect = (x, top, width, height, fill, stroke = null, radius = 0) => {
    const bottom = pageHeight - top - height;
    if (radius > 0) {
      const r = Math.min(radius, width / 2, height / 2);
      content.push(`${rgb(fill)} rg ${stroke ? `${rgb(stroke)} RG ` : ""}${x + r} ${bottom} m ${x + width - r} ${bottom} l ${x + width} ${bottom} ${x + width} ${bottom + r} ${x + width} ${bottom + r} c ${x + width} ${bottom + height - r} l ${x + width} ${bottom + height} ${x + width - r} ${bottom + height} ${x + width - r} ${bottom + height} c ${x + r} ${bottom + height} l ${x} ${bottom + height} ${x} ${bottom + height - r} ${x} ${bottom + height - r} c ${x} ${bottom + r} l ${x} ${bottom} ${x + r} ${bottom} ${x + r} ${bottom} c h ${stroke ? "B" : "f"}\n`);
    } else content.push(`${rgb(fill)} rg ${stroke ? `${rgb(stroke)} RG ` : ""}${x} ${bottom} ${width} ${height} re ${stroke ? "B" : "f"}\n`);
  };
  const text = (x, top, size, value, options = {}) => {
    const color = options.color || "#17111f";
    const font = options.bold ? "F2" : "F1";
    content.push(`${rgb(color)} rg BT /${font} ${size} Tf 1 0 0 1 ${x} ${y(top)} Tm (${pdfEscapeText(value)}) Tj ET\n`);
  };
  const line = (x1, top1, x2, top2, color = "#e0d8e6", width = 1) => content.push(`${rgb(color)} RG ${width} w ${x1} ${y(top1)} m ${x2} ${y(top2)} l S\n`);

  content.push("1 1 1 rg 0 0 595 842 re f\n");

  // Marca vetorial inspirada no monograma oficial: coroa + escudo + P.
  content.push(`q ${rgb("#f3b52f")} rg 42 786 m 50 800 l 58 792 l 66 803 l 74 792 l 82 800 l 79 783 l 45 783 l h f Q\n`);
  content.push(`q ${rgb("#f3b52f")} rg 46 780 m 78 780 l 76 756 l 62 746 l 48 756 l h f Q\n`);
  text(56, 82, 18, "P", { bold: true, color: "#22142e" });
  text(92, 55, 13, "TURMA DO", { bold: true, color: "#17111f" });
  text(92, 72, 18, "PRIMO", { bold: true, color: "#17111f" });
  text(425, 56, 8, "DATA DE GERACAO", { bold: true, color: "#7d35b8" });
  text(425, 70, 9, now, { color: "#5f5668" });
  line(42, 102, 553, 102, "#f3b52f", 1.2);

  text(42, 142, 25, "RELATORIO DE DADOS DO PERFIL", { bold: true, color: "#6f29a9" });
  text(42, 163, 9, "Documento gerado automaticamente pela plataforma Turma do Primo.", { color: "#6c6474" });

  rect(42, 188, 511, 135, "#faf8fc", "#ded6e4", 8);
  text(62, 214, 17, user.nome || "Usuario", { bold: true, color: "#17111f" });
  text(62, 233, 10, plan.rotulo || "Aluno", { bold: true, color: "#7d35b8" });
  text(62, 254, 9, user.email || "—", { color: "#5f5668" });
  text(62, 273, 9, user.telefone || "Telefone nao informado", { color: "#5f5668" });
  text(62, 292, 9, `Status da conta: ${status}`, { color: "#2c9a61" });

  line(350, 207, 350, 306, "#e5dce9", .8);
  text(373, 214, 8, "PLANO ATUAL", { bold: true, color: "#7d35b8" });
  rect(373, 227, 150, 34, "#17111f", "#d8a62f", 5);
  text(391, 249, 11, plan.nome || "Turma do Primo", { bold: true, color: "#f3b52f" });
  text(373, 280, 9, plan.validadeTexto || "Acesso ativo", { color: "#5f5668" });

  const cardTop = 345;
  const cardW = 160;
  const gap = 15;
  [42, 42 + cardW + gap, 42 + (cardW + gap) * 2].forEach((x) => rect(x, cardTop, cardW, 165, "#ffffff", "#ded6e4", 7));

  text(57, 369, 9, "INFORMACOES DA CONTA", { bold: true, color: "#7d35b8" });
  text(57, 394, 8, "Nome completo", { color: "#8b8293" });
  text(57, 409, 10, user.nome || "—", { bold: true });
  text(57, 434, 8, "Status", { color: "#8b8293" });
  text(57, 449, 10, status, { bold: true, color: "#2c9a61" });
  text(57, 474, 8, "Perfil", { color: "#8b8293" });
  text(57, 489, 10, plan.rotulo || "Aluno", { bold: true });

  text(232, 369, 9, "DADOS DE CONTATO", { bold: true, color: "#7d35b8" });
  text(232, 394, 8, "E-mail", { color: "#8b8293" });
  text(232, 409, 8.5, String(user.email || "—").slice(0, 28), { bold: true });
  text(232, 434, 8, "Telefone", { color: "#8b8293" });
  text(232, 449, 10, user.telefone || "Nao informado", { bold: true });
  text(232, 474, 8, "Dispositivo atual", { color: "#8b8293" });
  text(232, 489, 8.5, `${device.browser} / ${device.os}`.slice(0, 28), { bold: true });

  text(407, 369, 9, "RESUMO DE ATIVIDADE", { bold: true, color: "#7d35b8" });
  text(407, 394, 8, "Modulos concluidos", { color: "#8b8293" });
  text(407, 414, 20, `${stats.modulosConcluidos || 0}`, { bold: true, color: "#7d35b8" });
  text(442, 414, 9, `de ${stats.totalModulos || 0}`, { color: "#8b8293" });
  text(407, 440, 8, "Progresso geral", { color: "#8b8293" });
  text(407, 460, 20, `${Math.round(Number(stats.progressoGeral || 0))}%`, { bold: true, color: "#7d35b8" });
  text(407, 485, 8, "Dias de foco", { color: "#8b8293" });
  text(475, 485, 10, `${stats.diasFoco || 0}`, { bold: true, color: "#d79e21" });

  rect(42, 535, 511, 102, "#faf8fc", "#ded6e4", 7);
  text(57, 558, 9, "SEGURANCA E SESSAO", { bold: true, color: "#7d35b8" });
  text(57, 582, 10, "Sessao autenticada", { bold: true, color: "#17111f" });
  text(57, 599, 8.5, "Acesso validado pela plataforma e vinculado a esta conta.", { color: "#6c6474" });
  text(57, 620, 8.5, `Dispositivo atual: ${device.browser} - ${device.os}`, { color: "#6c6474" });

  line(42, 676, 553, 676, "#f3b52f", 1.1);
  text(42, 705, 10, "TURMA DO PRIMO", { bold: true, color: "#17111f" });
  text(42, 722, 8, "Relatorio pessoal e confidencial. Gerado automaticamente pela plataforma.", { color: "#746b7c" });
  text(455, 721, 8, "Documento oficial", { bold: true, color: "#7d35b8" });

  const stream = content.join("");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`
  ];

  let pdf = "%PDF-1.4\n% Turma do Primo\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function generateProfilePdf() {
  if (!profileState.user) return toast("Os dados do perfil ainda estão carregando.", "error");
  try {
    const pdf = buildProfilePdf();
    const blob = new Blob([pdf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeName = firstName(profileState.user.nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    anchor.href = url;
    anchor.download = `turma-do-primo-dados-${safeName || "perfil"}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("PDF gerado com sucesso.");
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    toast("Não foi possível gerar o PDF agora.", "error");
  }
}

async function initProfile() {
  bindEvents();
  try {
    const home = await profileApi("/dashboard-premium/home");
    profileState.home = home;
    profileState.user = home.usuario || null;
    profileState.theme = home.preferencias?.tema || "dark";
    applyTheme(profileState.theme);
    fillProfile();
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
    toast(error.message, "error");
  } finally {
    setTimeout(() => $("profileLoading")?.remove(), 160);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initProfile, { once: true });
else initProfile();
