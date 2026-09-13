"use strict";
(() => {
  const S = window.TurmaStudySync;
  if (!S || document.getElementById("floatingFocus")) return;
  const $ = (id) => document.getElementById(id);
  let busy = false,
    minimized = false,
    position = null,
    drag = null,
    mounted = false,
    message = "";
  const key = (name) => `turma.focus.${name}.${S.status.userId}`;
  const read = (name) => {
    try {
      return JSON.parse(localStorage.getItem(key(name)) || "null");
    } catch {
      return null;
    }
  };
  const save = (name, value) => {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
    } catch {}
  };
  function place() {
    const panel = $("floatingFocus");
    if (!panel || panel.hidden) return;
    const rect = panel.getBoundingClientRect(),
      maxX = Math.max(8, innerWidth - rect.width - 8),
      maxY = Math.max(
        8,
        innerHeight - rect.height - (innerWidth < 700 ? 88 : 16),
      );
    const x = position
      ? Math.min(maxX, Math.max(8, position.x * innerWidth))
      : maxX;
    const y = position
      ? Math.min(maxY, Math.max(8, position.y * innerHeight))
      : maxY;
    panel.style.left = x + "px";
    panel.style.top = y + "px";
  }
  function timeText(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function render() {
    if (!mounted) return;
    const f = S.state.focus,
      remaining =
        f.status === "running"
          ? Math.max(0, Math.ceil((f.deadline - S.now) / 1000))
          : f.remaining;
    const running = f.status === "running" && remaining > 0,
      completed =
        f.status === "completed" || (f.status === "running" && remaining === 0);
    const label = running
      ? "Pausar"
      : f.status === "paused"
        ? "Continuar"
        : completed
          ? "Nova sessão"
          : "Iniciar foco";
    const status =
      message ||
      (completed
        ? "Sessão concluída. Hora de uma pausa."
        : running
          ? "Seu foco continua ao sair ou atualizar a página."
          : f.status === "paused"
            ? "Sessão pausada. Continue quando quiser."
            : "Inicie uma sessão e acompanhe o tempo em qualquer página.");
    for (const id of ["focusTimer", "floatingFocusTime", "focusBubbleTime"])
      if ($(id)) $(id).textContent = timeText(remaining);
    for (const id of ["focusStart", "floatingFocusAction"])
      if ($(id)) {
        $(id).textContent = label;
        $(id).disabled = busy;
      }
    for (const id of ["focusProgress", "floatingFocusProgress"])
      if ($(id)) {
        $(id).max = f.duration;
        $(id).value = f.duration - remaining;
      }
    if ($("focusReset")) $("focusReset").disabled = busy;
    if ($("focusDuration")) {
      $("focusDuration").value = String(f.duration / 60);
      $("focusDuration").disabled = busy || running || f.status === "paused";
    }
    if ($("focusStatus")) $("focusStatus").textContent = status;
    $("floatingFocusStatus").textContent = completed
      ? "Concluído"
      : running
        ? "Em andamento"
        : f.status === "paused"
          ? "Pausado"
          : "Pronto para começar";
    $("floatingFocusMessage").textContent = message;
    $("floatingFocusMessage").hidden = !message;
    document
      .querySelector(".focus-section")
      ?.classList.toggle("is-running", running);
    const active = f.status !== "idle";
    $("floatingFocus").hidden = !active || minimized;
    $("focusBubble").hidden = !active || !minimized;
    $("focusBubble").setAttribute(
      "aria-label",
      `Abrir timer de foco: ${timeText(remaining)}, ${$("floatingFocusStatus").textContent}`,
    );
    place();
  }
  async function command(action, duration) {
    if (busy) return;
    busy = true;
    message = "";
    render();
    try {
      await S.focus(action, duration);
      if (S.state.focus.status === "running") {
        minimized = false;
        save("minimized", false);
      }
    } catch (error) {
      message = error.message;
    } finally {
      busy = false;
      render();
    }
  }
  function start() {
    command("toggle", S.state.focus.duration);
  }
  async function init() {
    try {
      await S.init();
    } catch {
      if ($("focusStatus"))
        $("focusStatus").textContent =
          "Não foi possível carregar o timer da sua conta. Tente atualizar o resumo.";
      return;
    }
    if (mounted) return;
    position = read("position");
    if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y))
      position = null;
    minimized = read("minimized") === true;
    document.body.insertAdjacentHTML(
      "beforeend",
      `<aside id="floatingFocus" class="floating-focus" aria-label="Timer de foco" hidden><header><button class="floating-focus-handle" id="focusDrag" type="button" aria-label="Mover timer. Arraste ou use as setas do teclado."><span aria-hidden="true">⠿</span> TEMPO DE FOCO</button><button class="floating-focus-close" id="focusMinimize" type="button" aria-label="Minimizar timer; a contagem continua">×</button></header><div class="floating-focus-clock"><strong id="floatingFocusTime" role="timer">25:00</strong><span id="floatingFocusStatus"></span></div><progress id="floatingFocusProgress" max="1500" value="0" aria-label="Tempo da sessão de foco"></progress><div class="floating-focus-actions"><button id="floatingFocusAction" type="button">Pausar</button><a href="/dashboard#focusHeading">Ver no dashboard ↗</a></div><p id="floatingFocusMessage" role="status" hidden></p></aside><button class="focus-bubble" id="focusBubble" type="button" hidden><span aria-hidden="true">◷</span><strong id="focusBubbleTime">25:00</strong><span>Foco</span></button>`,
    );
    mounted = true;
    $("focusStart")?.addEventListener("click", start);
    $("floatingFocusAction").addEventListener("click", start);
    $("focusReset")?.addEventListener("click", () =>
      command("reset", Number($("focusDuration").value) * 60),
    );
    $("focusDuration")?.addEventListener("change", () =>
      command("reset", Number($("focusDuration").value) * 60),
    );
    $("focusMinimize").addEventListener("click", () => {
      minimized = true;
      save("minimized", true);
      render();
      $("focusBubble").focus();
    });
    $("focusBubble").addEventListener("click", () => {
      minimized = false;
      save("minimized", false);
      render();
      $("focusDrag").focus();
    });
    const handle = $("focusDrag");
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const r = $("floatingFocus").getBoundingClientRect();
      drag = { x: event.clientX - r.x, y: event.clientY - r.y };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag) return;
      position = {
        x: (event.clientX - drag.x) / innerWidth,
        y: (event.clientY - drag.y) / innerHeight,
      };
      place();
    });
    const stop = () => {
      if (!drag) return;
      drag = null;
      const r = $("floatingFocus").getBoundingClientRect();
      position = { x: r.x / innerWidth, y: r.y / innerHeight };
      save("position", position);
    };
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
    handle.addEventListener("lostpointercapture", stop);
    handle.addEventListener("keydown", (event) => {
      const direction = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[event.key];
      if (!direction) return;
      event.preventDefault();
      const r = $("floatingFocus").getBoundingClientRect(),
        step = event.shiftKey ? 40 : 12;
      position = {
        x: (r.x + direction[0] * step) / innerWidth,
        y: (r.y + direction[1] * step) / innerHeight,
      };
      place();
      save("position", position);
    });
    addEventListener("resize", place);
    addEventListener("turma:study-change", render);
    setInterval(render, 250);
    render();
  }
  $("retry")?.addEventListener("click", init);
  $("studyRetry")?.addEventListener("click", init);
  addEventListener("online", () => {
    if (!mounted) init();
  });
  init();
})();
