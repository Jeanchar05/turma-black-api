// ===============================
// SEGURANCA.JS - TURMA BLACK v2.1
// Proteção visual + bloqueios + logs
// Loader REMOVIDO (agora em modulos.js)
// CSS separado no seguranca.css
// ===============================

(function () {
  "use strict";

  // ── CONFIG ──────────────────────────────────────────────
  const CONFIG = {
    printBlockTime: 12000,
    popupTime: 1800,
    maxBloqueios: 12,
    maxTrocasAba: 8,
    devToolsLimit: 220,
    watermarkItems: 120,

    // Cache busting
    cacheVersion: "v2.1.0",
    cacheCheck: true,

    // Duplo clique
    bloquearDuploClique: true,
    duploCliqueDelay: 400,

    // Foco excessivo
    maxPerdaFoco: 5,
    janelaPerdaFoco: 30000,

    // Múltiplas abas
    detectarMultiplasAbas: true,

    // Print / gravação
    printShieldDelay: 80,        // ms de reação ao beforeprint
    gravarBloqueioTentativas: 3, // após N tentativas de gravação, faz logout
    printBloqueioTentativas: 5,  // após N tentativas de print, faz logout

    // Mobile
    bloquearZoomMobile: false,
    bloquearPressionarMobile: false,
    detectarDevToolsMobile: false,
    blurMobile: false
  };

  // ── ESTADO ──────────────────────────────────────────────
  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.innerWidth <= 768;

  const timers = {
    popup: null,
    print: null,
    watermark: null,
    tab: null,
    duploClique: null,
    focoTimer: null
  };

  let _duploCliqueAtivo   = false;
  let _perdaFocoCount     = 0;
  let _perdaFocoResetTimer = null;
  let _tabChannel         = null;
  let _tabId              = null;
  let _printTentativas    = 0;
  let _gravacaoTentativas = 0;
  let _printShieldAtivo   = false;

  // ── HELPERS ─────────────────────────────────────────────
  function emModulo() {
    return window.location.pathname.includes("/modules/");
  }

  function loginPath() {
    return emModulo() ? "../index.html" : "index.html";
  }

  function getUsuario() {
    try { return JSON.parse(sessionStorage.getItem("usuarioLogado") || "null"); }
    catch { return null; }
  }

  function getToken() {
    return sessionStorage.getItem("token");
  }

  function logoutSeguro(msg = "Acesso restrito. Faça login novamente.") {
    alert(msg);
    sessionStorage.removeItem("usuarioLogado");
    sessionStorage.removeItem("token");
    window.location.href = loginPath();
  }

  function gerarFingerprint() {
    const dados = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      navigator.platform,
      Intl.DateTimeFormat().resolvedOptions().timeZone || "tz"
    ].join("|");
    return btoa(unescape(encodeURIComponent(dados)));
  }

  function verificarAcesso() {
    const usuario = getUsuario();
    const token   = getToken();

    if (!usuario || !token) {
      logoutSeguro("Acesso restrito. Faça login para continuar.");
      return false;
    }

    const atual = gerarFingerprint();
    if (!usuario.fingerprint) {
      usuario.fingerprint = atual;
      sessionStorage.setItem("usuarioLogado", JSON.stringify(usuario));
      return true;
    }

    if (usuario.fingerprint !== atual) {
      logoutSeguro("Conta alterada ou aberta em outro dispositivo.");
      return false;
    }
    return true;
  }

  function usuarioId() {
    const u = getUsuario();
    return u?.email || u?.nome || "Aluno Turma Black";
  }

  function dadosMarca() {
    const u    = getUsuario() || {};
    const nome  = u.nome  || "Aluno";
    const email = u.email || "sem-email";
    const data  = new Date().toLocaleString("pt-BR");
    return `${nome} • ${email} • ${data}`;
  }

  function salvarLog(tipo, descricao) {
    try {
      const logs = JSON.parse(localStorage.getItem("security_logs") || "[]");
      logs.unshift({
        usuario: usuarioId(),
        tipo,
        descricao,
        data: new Date().toLocaleString("pt-BR"),
        pagina: location.pathname,
        navegador: navigator.userAgent
      });
      localStorage.setItem("security_logs", JSON.stringify(logs.slice(0, 300)));
    } catch {}
  }

  // ── CACHE BUSTING ────────────────────────────────────────
  function forcarAtualizacaoCache() {
    if (!CONFIG.cacheCheck) return;

    const chave  = "tb_cache_version";
    const versao = localStorage.getItem(chave);

    if (versao !== CONFIG.cacheVersion) {
      localStorage.setItem(chave, CONFIG.cacheVersion);
      if (versao !== null) {
        salvarLog("CACHE", `Cache atualizado de ${versao} para ${CONFIG.cacheVersion}`);
        window.location.reload(true);
        return;
      }
    }

    document.querySelectorAll('link[rel="stylesheet"], script[src]').forEach((el) => {
      const attr = el.tagName === "LINK" ? "href" : "src";
      const src  = el.getAttribute(attr);
      if (src && !src.includes("?v=") && !src.startsWith("http")) {
        el.setAttribute(attr, `${src}?v=${CONFIG.cacheVersion}`);
      }
    });
  }

  // ── CONTADOR DE BLOQUEIOS ────────────────────────────────
  function contarBloqueio(tipo) {
    const atual = Number(sessionStorage.getItem("bloqueiosSeguranca") || 0) + 1;
    sessionStorage.setItem("bloqueiosSeguranca", String(atual));
    salvarLog("BLOQUEIO", `${tipo} bloqueado. Total: ${atual}`);

    if (atual >= CONFIG.maxBloqueios && !isMobile) {
      mostrarPopup("Muitas tentativas");
      ativarOverlay("Muitas tentativas bloqueadas.");
    }
  }

  function permitirCampo(e) {
    const el  = e.target;
    const tag = el?.tagName?.toLowerCase();
    return (
      ["input", "textarea", "select", "button", "a"].includes(tag) ||
      el?.isContentEditable ||
      el?.closest?.("[data-security-allow]") ||
      el?.closest?.("button") ||
      el?.closest?.("a")
    );
  }

  // ── POPUP ────────────────────────────────────────────────
  function criarPopup() {
    if (document.getElementById("securityCommandPopup")) return;
    const popup = document.createElement("div");
    popup.id = "securityCommandPopup";
    popup.textContent = "Comando bloqueado";
    document.body.appendChild(popup);
  }

  function mostrarPopup(comando = "Comando") {
    criarPopup();
    const popup = document.getElementById("securityCommandPopup");
    if (!popup) return;
    popup.textContent = `${comando} bloqueado`;
    popup.classList.add("active");
    clearTimeout(timers.popup);
    timers.popup = setTimeout(() => popup.classList.remove("active"), CONFIG.popupTime);
  }

  // ── WATERMARK ────────────────────────────────────────────
  function criarWatermark() {
    if (document.getElementById("securityWatermark")) return;
    const wm = document.createElement("div");
    wm.id = "securityWatermark";
    wm.innerHTML = `
      <div class="security-watermark-grid">
        ${Array.from({ length: CONFIG.watermarkItems })
          .map(() => `<span>${dadosMarca()}</span>`)
          .join("")}
      </div>
    `;
    document.body.appendChild(wm);
  }

  function atualizarWatermark() {
    const wm = document.getElementById("securityWatermark");
    if (!wm) return;
    const texto = dadosMarca();
    wm.querySelectorAll("span").forEach((s) => { s.textContent = texto; });
  }

  function ativarWatermark() {
    criarWatermark();
    atualizarWatermark();
    document.getElementById("securityWatermark")?.classList.add("active");
  }

  function desativarWatermark() {
    document.getElementById("securityWatermark")?.classList.remove("active");
  }

  // ── OVERLAY ──────────────────────────────────────────────
  function criarOverlay() {
    if (document.getElementById("securityOverlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "securityOverlay";
    overlay.innerHTML = `
      <div class="security-overlay-card">
        <div class="security-lock">🔒</div>
        <h2>Conteúdo protegido</h2>
        <p id="securityOverlayText">Captura, impressão, cópia ou inspeção bloqueada.</p>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function ativarOverlay(texto = "Conteúdo protegido.") {
    criarOverlay();
    const overlay = document.getElementById("securityOverlay");
    const p       = document.getElementById("securityOverlayText");
    if (p) p.textContent = texto;
    overlay?.classList.add("active");
  }

  function desativarOverlay() {
    document.getElementById("securityOverlay")?.classList.remove("active");
  }

  // ── PRINT SHIELD ─────────────────────────────────────────
  function criarPrintShield() {
    if (document.getElementById("printShield")) return;
    const shield = document.createElement("div");
    shield.id = "printShield";
    shield.innerHTML = `
      <div class="print-shield-card">
        <div class="print-shield-icon">🚫</div>
        <h2>Impressão bloqueada</h2>
        <p id="printShieldMsg">Este conteúdo é protegido e não pode ser impresso ou capturado.</p>
        <small>Turma Black • Acesso registrado</small>
      </div>
    `;
    document.body.appendChild(shield);
  }

  function ativarPrintShield(msg) {
    criarPrintShield();
    if (msg) {
      const el = document.getElementById("printShieldMsg");
      if (el) el.textContent = msg;
    }
    document.getElementById("printShield")?.classList.add("active");
    _printShieldAtivo = true;
  }

  function desativarPrintShield() {
    document.getElementById("printShield")?.classList.remove("active");
    _printShieldAtivo = false;
  }

  // ── LIMPEZA VISUAL ───────────────────────────────────────
  function limparVisualSeguranca() {
    clearTimeout(timers.print);
    clearTimeout(timers.watermark);
    clearTimeout(timers.tab);

    desativarOverlay();
    desativarWatermark();
    desativarPrintShield();

    document.body.classList.remove(
      "security-print-block",
      "security-print-hide",
      "security-tab-hidden",
      "security-devtools-detected",
      "security-recording-detected",
      "security-capturing"
    );
  }

  // ── PROTEÇÃO CONTRA PRINT / CAPTURA ──────────────────────
  function bloquearPrint(tipo = "Print") {
    _printTentativas++;
    salvarLog("PRINT", `Tentativa de ${tipo}. Total: ${_printTentativas}`);

    // Esconde TODO o conteúdo imediatamente via CSS
    document.body.classList.add("security-print-block", "security-capturing");

    // Limpa clipboard imediatamente
    try { navigator.clipboard?.writeText(""); } catch {}

    // Ativa marca d'água densa com dados do usuário
    ativarWatermark();

    // Ativa print shield com mensagem personalizada
    ativarPrintShield(
      `Tentativa de captura registrada. ${dadosMarca()}`
    );

    mostrarPopup(tipo);
    contarBloqueio(tipo);

    // Logout automático após excesso de tentativas
    if (_printTentativas >= CONFIG.printBloqueioTentativas) {
      salvarLog("PRINT_EXCESSO", `${_printTentativas} tentativas de print. Logout forçado.`);
      setTimeout(() => {
        logoutSeguro("Número excessivo de tentativas de captura. Sessão encerrada.");
      }, 1800);
      return;
    }

    clearTimeout(timers.print);
    timers.print = setTimeout(() => limparVisualSeguranca(), CONFIG.printBlockTime);
  }

  function bloquearRapido(tipo = "Comando") {
    ativarWatermark();
    mostrarPopup(tipo);
    contarBloqueio(tipo);
    clearTimeout(timers.watermark);
    timers.watermark = setTimeout(
      () => desativarWatermark(),
      isMobile ? 1800 : 4000
    );
  }

  // ── PROTEÇÃO DE PRINT AVANÇADA ────────────────────────────
  function protegerContraPrint() {
    // 1. beforeprint — dispara ANTES do diálogo de impressão
    window.addEventListener("beforeprint", () => {
      bloquearPrint("Imprimir");
    });

    // 2. afterprint — limpa após fechar o diálogo
    window.addEventListener("afterprint", () => {
      setTimeout(limparVisualSeguranca, 400);
    });

    // 3. CSS media print já bloqueia via stylesheet

    // 4. Intercepta matchMedia para print
    try {
      const mq = window.matchMedia("print");
      const handler = (e) => {
        if (e.matches) bloquearPrint("Print via media");
      };
      if (mq.addEventListener) mq.addEventListener("change", handler);
      else mq.addListener?.(handler); // fallback legado
    } catch {}

    // 5. PrintScreen — limpa clipboard e ativa watermark
    // (capturado no bloquearAcoes via keydown)

    // 6. Detecta foco perdido durante impressão (atalho do sistema)
    window.addEventListener("focus", () => {
      if (_printShieldAtivo) {
        setTimeout(limparVisualSeguranca, 500);
      }
    });
  }

  // ── PROTEÇÃO CONTRA GRAVAÇÃO / SCREEN SHARE ──────────────
  function protegerContraGravacao() {
    if (isMobile) return;

    // 1. Bloqueia getDisplayMedia (compartilhamento de tela)
    if (navigator.mediaDevices?.getDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = async function () {
        _gravacaoTentativas++;
        salvarLog("GRAVACAO", `Tentativa de compartilhamento/gravação. Total: ${_gravacaoTentativas}`);

        document.body.classList.add("security-recording-detected", "security-capturing");
        ativarWatermark();
        ativarPrintShield("Tentativa de gravação de tela bloqueada e registrada.");
        mostrarPopup("Gravação de tela");
        contarBloqueio("Gravação");

        // Logout após excesso
        if (_gravacaoTentativas >= CONFIG.gravarBloqueioTentativas) {
          salvarLog("GRAVACAO_EXCESSO", `${_gravacaoTentativas} tentativas de gravação. Logout forçado.`);
          setTimeout(() => {
            logoutSeguro("Tentativa de gravação de tela detectada. Sessão encerrada.");
          }, 1800);
        }

        throw new DOMException(
          "Compartilhamento de tela bloqueado pela proteção Turma Black.",
          "NotAllowedError"
        );
      };
    }

    // 2. Bloqueia getUserMedia para captura de tela via video
    if (navigator.mediaDevices?.getUserMedia) {
      const _origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async function (constraints) {
        // Bloqueia se tiver displaySurface (captura de tela)
        const temTela =
          constraints?.video?.displaySurface ||
          JSON.stringify(constraints || "").toLowerCase().includes("screen");

        if (temTela) {
          salvarLog("GRAVACAO", "getUserMedia com captura de tela bloqueado.");
          throw new DOMException("Bloqueado pela proteção Turma Black.", "NotAllowedError");
        }
        return _origGetUserMedia(constraints);
      };
    }

    // 3. Detecta Visibility API — quando alt+tab para OBS/gravador
    let _focusPerdidoHora = 0;
    window.addEventListener("blur", () => {
      _focusPerdidoHora = Date.now();
    });
    window.addEventListener("focus", () => {
      const delta = Date.now() - _focusPerdidoHora;
      // Se voltou em menos de 300ms, provavelmente foi alt+tab de gravador
      if (_focusPerdidoHora > 0 && delta < 300) {
        salvarLog("GRAVACAO_SUSPEITA", `Foco perdido/retomado em ${delta}ms — possível gravador.`);
      }
      _focusPerdidoHora = 0;
    });

    // 4. Detecta Picture-in-Picture (indica gravação externa)
    document.addEventListener("enterpictureinpicture", () => {
      salvarLog("PIP", "Modo Picture-in-Picture detectado.");
      bloquearRapido("Picture-in-Picture");
    });

    // 5. Detecta extensões de captura via performance entries
    try {
      const obs = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.name?.toLowerCase().includes("capture") ||
              entry.name?.toLowerCase().includes("screenshot")) {
            salvarLog("EXTENSAO_CAPTURA", `Entry suspeita: ${entry.name}`);
          }
        });
      });
      obs.observe({ entryTypes: ["resource"] });
    } catch {}
  }

  // ── PROTEÇÃO ANTI-SCREENSHOT CSS ─────────────────────────
  function injetarCssAntiCaptura() {
    // Injeta um estilo que força repaint constante durante print
    // dificultando captura de frame limpo
    const style = document.createElement("style");
    style.id = "tb-anti-capture-style";
    style.textContent = `
      @media print {
        * { visibility: hidden !important; display: none !important; }
        body::before {
          content: "⛔ CONTEÚDO PROTEGIDO — TURMA BLACK — ${usuarioId()}";
          visibility: visible !important;
          display: flex !important;
          position: fixed; inset: 0;
          align-items: center; justify-content: center;
          background: #fff; color: #000;
          font-size: 22px; font-weight: 900;
          text-align: center; font-family: Arial, sans-serif;
          z-index: 9999999;
        }
      }

      @media screen {
        body.security-capturing > *:not(#printShield):not(#securityWatermark):not(#securityCommandPopup):not(#securityOverlay) {
          filter: blur(30px) brightness(.1) !important;
          pointer-events: none !important;
          user-select: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ── BLOQUEIO DE DUPLO CLIQUE ─────────────────────────────
  function protegerDuploClique() {
    if (!CONFIG.bloquearDuploClique) return;

    document.addEventListener("dblclick", (e) => {
      if (permitirCampo(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!_duploCliqueAtivo) {
        _duploCliqueAtivo = true;
        bloquearRapido("Duplo clique");
        clearTimeout(timers.duploClique);
        timers.duploClique = setTimeout(() => { _duploCliqueAtivo = false; }, CONFIG.duploCliqueDelay);
      }
      return false;
    }, true);

    document.addEventListener("click", (e) => {
      const btn = e.target?.closest("button, .btn, .primary-btn, [data-action]");
      if (!btn) return;
      if (btn.dataset.locked === "1") { e.preventDefault(); e.stopPropagation(); return false; }
      btn.dataset.locked = "1";
      clearTimeout(timers.duploClique);
      timers.duploClique = setTimeout(() => { delete btn.dataset.locked; }, CONFIG.duploCliqueDelay);
    }, true);
  }

  // ── MÚLTIPLAS ABAS ───────────────────────────────────────
  function detectarMultiplasAbas() {
    if (!CONFIG.detectarMultiplasAbas) return;
    _tabId = `tb_tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    try {
      _tabChannel = new BroadcastChannel("tb_security_tabs");
      _tabChannel.postMessage({ tipo: "tb_ping", id: _tabId });

      _tabChannel.addEventListener("message", (e) => {
        if (!e.data) return;
        if (e.data.tipo === "tb_ping" && e.data.id !== _tabId) {
          _tabChannel.postMessage({ tipo: "tb_pong", id: _tabId });
          salvarLog("MULTIPLAS_ABAS", "Detectada outra aba com o site aberto.");
        }
        if (e.data.tipo === "tb_pong" && e.data.id !== _tabId) {
          ativarOverlay("Site aberto em outra aba. Feche as outras janelas para continuar.");
          mostrarPopup("Múltiplas abas");
          salvarLog("MULTIPLAS_ABAS", "Bloqueio por múltiplas abas ativas.");
          contarBloqueio("Múltiplas abas");
        }
      });
    } catch {
      const chave = "tb_tab_active";
      window.addEventListener("storage", (e) => {
        if (e.key === chave && e.newValue && e.newValue !== _tabId) {
          ativarOverlay("Site aberto em outra aba. Feche as outras janelas para continuar.");
          mostrarPopup("Múltiplas abas");
          salvarLog("MULTIPLAS_ABAS", "Bloqueio por múltiplas abas (fallback).");
        }
      });
      localStorage.setItem(chave, _tabId);
      window.addEventListener("beforeunload", () => {
        if (localStorage.getItem(chave) === _tabId) localStorage.removeItem(chave);
      });
    }
  }

  // ── PERDA DE FOCO EXCESSIVO ──────────────────────────────
  function detectarPerdaFocoExcessivo() {
    window.addEventListener("blur", () => {
      _perdaFocoCount++;
      clearTimeout(_perdaFocoResetTimer);
      _perdaFocoResetTimer = setTimeout(() => { _perdaFocoCount = 0; }, CONFIG.janelaPerdaFoco);

      if (_perdaFocoCount >= CONFIG.maxPerdaFoco && !isMobile) {
        salvarLog("PERDA_FOCO", `Perda de foco excessiva: ${_perdaFocoCount}x em ${CONFIG.janelaPerdaFoco / 1000}s`);
        ativarOverlay("Atividade suspeita detectada. Retorne ao conteúdo.");
        mostrarPopup("Foco perdido");
        contarBloqueio("Perda de foco");
      }
    });

    window.addEventListener("focus", () => {
      if (_perdaFocoCount >= CONFIG.maxPerdaFoco) {
        setTimeout(limparVisualSeguranca, 450);
        _perdaFocoCount = 0;
      }
    });
  }

  // ── CONTROLE DE HISTÓRICO ────────────────────────────────
  function controlarHistorico() {
    history.pushState(null, "", location.href);
    window.addEventListener("popstate", () => {
      history.pushState(null, "", location.href);
      setTimeout(limparVisualSeguranca, 300);
    });
  }

  // ── BLOQUEIOS DE AÇÃO ────────────────────────────────────
  function bloquearAcoes() {
    document.addEventListener("contextmenu", (e) => {
      if (permitirCampo(e)) return;
      e.preventDefault();
      if (isMobile) { mostrarPopup("Menu"); return; }
      bloquearRapido("Botão direito");
    });

    document.addEventListener("selectstart", (e) => {
      if (permitirCampo(e)) return;
      if (isMobile) return;
      e.preventDefault();
    });

    document.addEventListener("dragstart", (e) => {
      if (permitirCampo(e)) return;
      e.preventDefault();
      if (!isMobile) bloquearRapido("Arrastar");
    });

    ["copy", "cut", "paste"].forEach((acao) => {
      document.addEventListener(acao, (e) => {
        if (permitirCampo(e)) return;
        e.preventDefault();
        const nomes = { copy: "Copiar", cut: "Recortar", paste: "Colar" };
        bloquearRapido(nomes[acao]);
      });
    });

    document.addEventListener("keydown", (e) => {
      const tecla = String(e.key || "").toLowerCase();
      const ctrl  = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt   = e.altKey;

      if (permitirCampo(e)) return;

      if (e.key === "PrintScreen") {
        e.preventDefault();
        try { navigator.clipboard?.writeText(""); } catch {}
        bloquearPrint("PrintScreen");
        return false;
      }

      // Captura de tela no Mac (Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5)
      if (e.metaKey && shift && ["3","4","5","6"].includes(e.key)) {
        e.preventDefault();
        bloquearPrint("Screenshot Mac");
        return false;
      }

      if (ctrl && tecla === "p") { e.preventDefault(); bloquearPrint("Imprimir"); return false; }
      if (ctrl && tecla === "s") { e.preventDefault(); bloquearRapido("Salvar página"); return false; }
      if (ctrl && tecla === "u") { e.preventDefault(); bloquearRapido("Código-fonte"); return false; }
      if (ctrl && tecla === "r") { e.preventDefault(); bloquearRapido("Recarregar"); return false; }

      // Windows Snipping Tool (Win+Shift+S não é bloqueável, mas Win+G é)
      if (e.key === "F1" && e.getModifierState?.("OS")) {
        e.preventDefault();
        bloquearPrint("Captura Windows");
        return false;
      }

      if (
        e.key === "F12" ||
        (ctrl && shift && ["i","j","c","k"].includes(tecla)) ||
        (ctrl && alt   && ["i","j","c","k"].includes(tecla))
      ) {
        e.preventDefault();
        bloquearRapido("Inspecionar");
        return false;
      }

      if (ctrl && ["c","x","a"].includes(tecla)) {
        e.preventDefault();
        const nomes = { c: "Copiar", x: "Recortar", a: "Selecionar tudo" };
        bloquearRapido(nomes[tecla]);
        return false;
      }
    }, true);
  }

  // ── PROTEÇÃO MOBILE ──────────────────────────────────────
  function protegerMobile() {
    if (!isMobile) return;

    if (CONFIG.bloquearZoomMobile) {
      document.addEventListener("touchstart", (e) => {
        if (e.touches.length > 1) { e.preventDefault(); bloquearRapido("Multitoque"); }
      }, { passive: false });
      document.addEventListener("touchmove", (e) => {
        if (e.touches.length > 1) e.preventDefault();
      }, { passive: false });
    }

    if (CONFIG.bloquearPressionarMobile) {
      let toqueLongoTimer = null;
      document.addEventListener("touchstart", (e) => {
        if (permitirCampo(e)) return;
        toqueLongoTimer = setTimeout(() => bloquearRapido("Pressionar"), 1200);
      }, { passive: true });
      document.addEventListener("touchend",    () => clearTimeout(toqueLongoTimer));
      document.addEventListener("touchcancel", () => clearTimeout(toqueLongoTimer));
      document.addEventListener("touchmove",   () => clearTimeout(toqueLongoTimer));
    }
  }

  // ── PROTEÇÃO DE ABA ──────────────────────────────────────
  function protegerAba() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearTimeout(timers.tab);
        timers.tab = setTimeout(() => {
          if (!document.hidden) return;
          const trocas = Number(sessionStorage.getItem("trocasAba") || 0) + 1;
          sessionStorage.setItem("trocasAba", String(trocas));
          salvarLog("TROCA_ABA", `Saiu da aba ${trocas} vez(es).`);

          if (!isMobile || CONFIG.blurMobile) {
            document.body.classList.add("security-tab-hidden");
            ativarWatermark();
          }

          if (trocas >= CONFIG.maxTrocasAba && !isMobile) {
            ativarOverlay("Muitas trocas de aba detectadas.");
            mostrarPopup("Troca de aba");
          }
        }, isMobile ? 2500 : 700);
      } else {
        limparVisualSeguranca();
      }
    });

    if (!isMobile) {
      window.addEventListener("blur",  () => { document.body.classList.add("security-tab-hidden"); ativarWatermark(); });
      window.addEventListener("focus", () => { setTimeout(limparVisualSeguranca, 450); });
    }

    window.addEventListener("pageshow", () => { setTimeout(limparVisualSeguranca, 300); });
    window.addEventListener("popstate",  () => { setTimeout(limparVisualSeguranca, 300); });
  }

  // ── DEVTOOLS ─────────────────────────────────────────────
  function detectarDevTools() {
    if (isMobile && !CONFIG.detectarDevToolsMobile) return;
    let ativo = false;

    setInterval(() => {
      const largura  = window.outerWidth  - window.innerWidth;
      const altura   = window.outerHeight - window.innerHeight;
      const suspeito = largura > CONFIG.devToolsLimit || altura > CONFIG.devToolsLimit;

      if (suspeito && !ativo) {
        ativo = true;
        document.body.classList.add("security-devtools-detected");
        ativarOverlay("Inspeção detectada. Conteúdo protegido.");
        bloquearRapido("DevTools");
        salvarLog("DEVTOOLS", "Possível DevTools aberto.");
      }
      if (!suspeito && ativo) { ativo = false; limparVisualSeguranca(); }
    }, 1200);
  }

  // ── IFRAME ───────────────────────────────────────────────
  function protegerIframe() {
    try {
      if (window.top !== window.self) {
        salvarLog("IFRAME", "Tentativa de abrir dentro de iframe.");
        window.top.location = window.self.location;
      }
    } catch {
      location.href = loginPath();
    }
  }

  // ── IMAGENS ──────────────────────────────────────────────
  function protegerImagens() {
    document.querySelectorAll("img").forEach((img) => {
      img.setAttribute("draggable", "false");
      img.setAttribute("loading", "lazy");
      img.addEventListener("dragstart", (e) => e.preventDefault());
    });
  }

  function observarImagensNovas() {
    const obs = new MutationObserver(() => protegerImagens());
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // ── CLASSES BASE ─────────────────────────────────────────
  function aplicarClassesBase() {
    document.documentElement.classList.add("security-html");
    document.body.classList.add("security-enabled");
    document.body.classList.add(isMobile ? "security-mobile" : "security-desktop");
  }

  // ── PRÉ-CARREGAMENTO ─────────────────────────────────────
  function preCarregarPaginas() {
    document.querySelectorAll("a[href][data-preload]").forEach((link) => {
      const url = link.getAttribute("href");
      if (!url || url.startsWith("#") || url.startsWith("mailto")) return;
      const prefetch = document.createElement("link");
      prefetch.rel  = "prefetch";
      prefetch.href = url;
      document.head.appendChild(prefetch);
    });
  }

  // ── LIMPEZA DE SESSÃO ────────────────────────────────────
  function limpezaAutomatica() {
    try {
      const logs   = JSON.parse(localStorage.getItem("security_logs") || "[]");
      const limite = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const filtrados = logs.filter((l) => {
        try { return new Date(l.data).getTime() > limite; } catch { return true; }
      });
      localStorage.setItem("security_logs", JSON.stringify(filtrados));
    } catch {}

    window.addEventListener("beforeunload", () => {
      try { _tabChannel?.close(); } catch {}
    });
  }

  // ── INICIALIZAÇÃO ────────────────────────────────────────
  function iniciar() {
    protegerIframe();
    if (!verificarAcesso()) return;

    forcarAtualizacaoCache();
    aplicarClassesBase();
    injetarCssAntiCaptura();

    criarPopup();
    criarWatermark();
    criarOverlay();
    criarPrintShield();

    bloquearAcoes();
    protegerDuploClique();
    protegerMobile();
    protegerAba();
    detectarDevTools();
    protegerContraPrint();
    protegerContraGravacao();
    detectarMultiplasAbas();
    detectarPerdaFocoExcessivo();
    controlarHistorico();
    preCarregarPaginas();
    protegerImagens();
    observarImagensNovas();
    limpezaAutomatica();

    setInterval(atualizarWatermark, 20000);
    setTimeout(limparVisualSeguranca, 500);

    salvarLog("SESSAO", "Segurança v2.1 iniciada.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

})();
