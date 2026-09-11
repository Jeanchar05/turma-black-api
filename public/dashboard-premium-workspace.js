"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const modules = [
    ["Gêmeos", "Famílias e conexões", "gemeos", "i-star", "#b8a0f6"],
    ["Espelhos", "Inversões e regiões", "espelhos", "i-layers", "#87bfde"],
    ["Fibonacci", "Somas e terminais", "fibonacci", "i-activity", "#e6b471"],
    ["Magneto", "Atração e padrões", "magneto", "i-roulette", "#db96b4"],
    ["Camaleões", "Adaptação e leitura", "camaleoes", "i-book", "#98cba6"],
    ["Pitágoras", "Geometria na Race", "triangulacao", "i-exam", "#b7aff2"],
    ["Cavalos", "Movimentos e combinações", "cavalos", "i-game", "#d5b391"],
    ["Eclipse Zero", "Terminal zero e proteção", "eclipse-zero", "i-moon", "#a2b4db"]
  ];
  const nav = window.TurmaWorkspaceNav;
  const icon = name => `<svg aria-hidden="true"><use href="/assets/dashboard-icons.svg#${name}"></use></svg>`;
  $("mainNav").innerHTML = nav.map(([label, route, symbol]) => `<a href="/${route}" title="${label}" ${route === "dashboard" ? 'class="active" aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span></a>`).join("");
  const artwork = ["gemeos", "espelhos", "fibonacci", "magneto", "camaleoes", "pitagoras", "cavalo", "eclipse-zero"];
  const cover = index => `/assets/modules-v4/${artwork[index]}-${document.documentElement.dataset.theme === "light" ? "light" : "dark"}.webp`;
  window.addEventListener("turma:theme", () => {
    document.querySelectorAll(".module-cover img").forEach((image,index) => image.src = cover(index));
    const index = Math.max(0, modules.findIndex(item => `/estudo-${item[2]}` === new URL($("resumeLink").href).pathname));
    $("resumeImage").src = cover(index);
  });
  $("moduleGrid").innerHTML = modules.map(([name, description, route, symbol, color], index) => `<a class="module-card" href="/estudo-${route}" style="--accent:${color}" data-name="${name}" data-module="${route}"><div class="module-cover"><img src="${cover(index)}" alt="" width="480" height="270" loading="${index < 4 ? "eager" : "lazy"}"><span class="module-access">ACESSO PREMIUM</span><span class="module-number">${String(index+1).padStart(2,"0")}</span></div><div class="module-copy"><div class="module-title-line"><h3>${name}</h3>${icon(symbol)}</div><p>${description}</p><div class="module-bottom"><span>Estudo + prática</span><span>Explorar <b>↗</b></span></div></div></a>`).join("");
  $("today").textContent = new Intl.DateTimeFormat("pt-BR", { weekday:"long", day:"numeric", month:"long" }).format(new Date()).toLocaleUpperCase("pt-BR");
  const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let selectedFilter = "all", visited = [], memberId = "";
  function filterModules() {
    let count = 0;
    const query = normalize($("moduleSearch").value.trim());
    document.querySelectorAll(".module-card").forEach(card => {
      card.hidden = !normalize(card.dataset.name).includes(query) || (selectedFilter === "recent" && !visited.includes(card.dataset.module));
      if (!card.hidden) count++;
    });
    $("emptySearch").textContent = selectedFilter === "recent" && !visited.length ? "Os módulos que você abrir por aqui aparecerão nesta seleção." : "Nenhum módulo encontrado. Tente outro nome.";
    $("emptySearch").hidden = count > 0;
  }
  $("moduleSearch").addEventListener("input", filterModules);
  document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
    selectedFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(item => { const active = item === button; item.classList.toggle("selected", active); item.setAttribute("aria-pressed", String(active)); });
    filterModules();
  }));
  const focusSearch = () => {
    $("librarySection").scrollIntoView({ behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block:"start" });
    $("moduleSearch").focus({ preventScroll:true });
  };
  $("globalSearch").addEventListener("click", focusSearch);
  document.addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); focusSearch(); } });
  function restoreRecent(user) {
    memberId = String(user.id || user._id || "");
    visited = [];
    if (memberId) try { const saved = JSON.parse(localStorage.getItem(`turma.workspace.visited.${memberId}`) || "[]"); if (Array.isArray(saved)) visited = saved.filter(route => modules.some(item => item[2] === route)).slice(0, 8); } catch {}
    const index = modules.findIndex(item => item[2] === visited[0]);
    if (index >= 0) {
      $("resumeTitle").textContent = `Módulo ${modules[index][0]}`;
      $("resumeDescription").textContent = "Último módulo aberto por esta conta neste dispositivo.";
      $("resumeImage").src = cover(index);
      $("resumeLink").href = `/estudo-${modules[index][2]}`;
      $("resumeLabel").textContent = "RETOME SUA EXPLORAÇÃO";
    }
    filterModules();
  }
  document.addEventListener("click", event => {
    const link = event.target.closest("a[data-module],#resumeLink");
    if (!link || !memberId) return;
    const route = link.dataset.module || new URL(link.href).pathname.replace("/estudo-", "");
    if (!modules.some(item => item[2] === route)) return;
    visited = [route, ...visited.filter(item => item !== route)].slice(0, 8);
    try { localStorage.setItem(`turma.workspace.visited.${memberId}`, JSON.stringify(visited)); } catch {}
  });
  const closeMenu = () => { $("sidebar").classList.remove("open"); $("menuToggle").setAttribute("aria-expanded", "false"); $("menuBackdrop").hidden = true; document.body.classList.remove("menu-open"); };
  $("menuToggle").addEventListener("click", () => { const open = $("sidebar").classList.toggle("open"); $("menuToggle").setAttribute("aria-expanded", String(open)); $("menuBackdrop").hidden = !open; document.body.classList.toggle("menu-open",open); if(open) $("sidebar").querySelector("a").focus(); });
  $("menuBackdrop").addEventListener("click", () => { closeMenu(); $("menuToggle").focus(); });
  matchMedia("(min-width:721px)").addEventListener("change",closeMenu);
  document.addEventListener("keydown", event => {
    if (!$("sidebar").classList.contains("open")) return;
    if(event.key === "Escape") $("menuToggle").focus();
    if(event.key === "Tab") {
      const items = [$("menuToggle"), ...$("sidebar").querySelectorAll("a,button")].filter(el => el.getClientRects().length);
      const first=items[0], last=items.at(-1);
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });
  document.querySelector("main").addEventListener("click", closeMenu);
  const notificationButton = $("notificationButton"), notificationPanel = $("notificationPanel");
  notificationButton.addEventListener("click", () => {
    notificationPanel.hidden = !notificationPanel.hidden;
    notificationButton.setAttribute("aria-expanded", String(!notificationPanel.hidden));
  });
  document.addEventListener("click", event => {
    if (!notificationPanel.contains(event.target) && !notificationButton.contains(event.target)) {
      notificationPanel.hidden = true; notificationButton.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { notificationPanel.hidden = true; notificationButton.setAttribute("aria-expanded", "false"); }
  });
  function headers() {
    const result = { Accept:"application/json" };
    try { const token = sessionStorage.getItem("token"); if (token) result.Authorization = `Bearer ${token}`; } catch {}
    return result;
  }
  async function api(url, method = "GET") {
    const response = await fetch(url, { method, headers:headers(), credentials:"same-origin", cache:"no-store", signal:AbortSignal.timeout(15000) });
    if (response.status === 401) { location.replace("/"); throw new Error("Entre novamente para continuar."); }
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || "Não foi possível carregar seus dados.");
    return data;
  }
  function activity(items) {
    const list = $("activityList"); list.replaceChildren();
    if (!items.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = "Seus próximos registros aparecerão aqui conforme você usar a plataforma."; list.append(p); return; }
    items.slice(0, 5).forEach(item => {
      const row = document.createElement("article"); row.className = "activity-row"; row.innerHTML = `${icon("i-activity")}<div><strong></strong><p></p></div><time></time>`;
      row.querySelector("strong").textContent = item.titulo || "Atividade";
      row.querySelector("p").textContent = item.descricao || "";
      const date = new Date(item.createdAt); const time = row.querySelector("time");
      if (!Number.isNaN(date.getTime())) { time.dateTime = date.toISOString(); time.textContent = date.toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }); }
      list.append(row);
    });
  }
  async function load() {
    $("retry").hidden = true; $("loadStatus").textContent = "Carregando seus dados…";
    try {
      const { usuario } = await api("/me");
      if (!usuario?.acessoPremium) { location.replace("/dashboard-free"); return; }
      restoreRecent(usuario);
      const name = String(usuario.nome || "Primo").trim().split(/\s+/)[0];
      $("firstName").textContent = name; $("accountName").textContent = name; $("avatar").textContent = name.charAt(0).toUpperCase();
      const data = await api("/dashboard-premium/home");
      const stats = data.estatisticas || {};
      $("notesStat").textContent = Number.isFinite(stats.totalNotas) ? stats.totalNotas.toLocaleString("pt-BR") : "—";
      $("averageStat").textContent = stats.totalAvaliacoes > 0 && Number.isFinite(stats.mediaGeral) ? stats.mediaGeral.toLocaleString("pt-BR", { minimumFractionDigits:1, maximumFractionDigits:1 }) : "—";
      $("examLabel").textContent = stats.totalAvaliacoes > 0 ? `${stats.totalAvaliacoes} avaliação(ões) registrada(s)` : "Você ainda não tem resultados";
      $("focusStat").textContent = Number.isFinite(stats.diasFoco) ? String(stats.diasFoco) : "—";
      $("planStat").textContent = data.plano?.nome || data.plano?.titulo || "Premium";
      $("planLabel").textContent = data.plano?.validadeTexto || "Acesso ativo";
      activity(Array.isArray(data.atividades) ? data.atividades : []);
      $("loadStatus").textContent = "";
    } catch {
      $("loadStatus").textContent = "Não foi possível atualizar seu resumo. Seus atalhos continuam disponíveis.";
      $("retry").hidden = false;
      $("activityList").replaceChildren(); const p = document.createElement("p"); p.className = "empty"; p.textContent = "Atividades indisponíveis no momento."; $("activityList").append(p);
    }
  }
  $("retry").addEventListener("click", load);
  $("logout").addEventListener("click", async () => {
    $("logout").disabled = true;
    try { await api("/logout", "POST"); for (const storage of [sessionStorage,localStorage]) for (const key of ["token","adminToken","authToken","accessToken","jwt"]) { try { storage.removeItem(key); } catch {} } location.replace("/"); }
    catch { $("loadStatus").textContent = "Não foi possível encerrar sua sessão. Tente sair novamente."; $("logout").disabled = false; }
  });
  window.dispatchEvent(new Event("turma:theme"));
  load();
})();
