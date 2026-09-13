"use strict";
(() => {
  if (window.TurmaStudySync) return;
  const M = window.TurmaStudyState;
  let userId = "",
    base = M.empty(),
    state = M.empty(),
    pending = [],
    ready,
    flight,
    timer,
    storageOK = true,
    online = false,
    lastError = "",
    offset = 0;
  const tab = crypto.randomUUID(),
    copy = (value) => JSON.parse(JSON.stringify(value));
  const prefix = () => `turma.study.pending.${userId}.`,
    cacheKey = () => `turma.study.account.${userId}`,
    queueKey = () => prefix() + tab;
  function headers() {
    const h = {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    };
    if (userId) h["X-Study-Account"] = userId;
    for (const storage of [sessionStorage, localStorage])
      for (const key of [
        "token",
        "authToken",
        "accessToken",
        "jwt",
        "adminToken",
      ])
        try {
          const token = storage.getItem(key);
          if (token && token !== "undefined" && token !== "null") {
            h.Authorization = `Bearer ${token}`;
            return h;
          }
        } catch {}
    return h;
  }
  async function request(url, operations) {
    const response = await fetch(url, {
      method: operations ? "POST" : "GET",
      headers: headers(),
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      ...(operations
        ? {
            body: JSON.stringify({ operations }),
            keepalive: JSON.stringify(operations).length < 50000,
          }
        : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw Object.assign(
        new Error(data.erro || "Não foi possível sincronizar agora."),
        { status: response.status, data },
      );
    return data;
  }
  function rebuild() {
    state = copy(base);
    for (const op of pending)
      try {
        M.apply(state, op, Date.now() + offset);
      } catch {}
    window.dispatchEvent(
      new CustomEvent("turma:study-change", {
        detail: { state, status: status() },
      }),
    );
  }
  function status() {
    return { pending: pending.length, online, storageOK, lastError, userId };
  }
  function store() {
    if (!userId) return;
    try {
      localStorage.setItem(cacheKey(), JSON.stringify({ state: base, offset }));
      if (pending.length)
        localStorage.setItem(queueKey(), JSON.stringify(pending));
      else localStorage.removeItem(queueKey());
      storageOK = true;
    } catch {
      storageOK = false;
    }
  }
  function collect() {
    try {
      const found = new Map(pending.map((op) => [op.id, op]));
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix())) {
          const values = JSON.parse(localStorage.getItem(key) || "[]");
          if (Array.isArray(values))
            for (const op of values) {
              try {
                M.validate(op);
                found.set(op.id, op);
              } catch {}
            }
        }
      }
      pending = [...found.values()];
    } catch {
      storageOK = false;
    }
  }
  function acknowledge(ids) {
    const done = new Set(ids);
    pending = pending.filter((op) => !done.has(op.id));
    try {
      const keys = Array.from({ length: localStorage.length }, (_, i) =>
        localStorage.key(i),
      ).filter((key) => key?.startsWith(prefix()));
      for (const key of keys) {
        const values = JSON.parse(localStorage.getItem(key) || "[]").filter(
          (op) => !done.has(op.id),
        );
        if (values.length) localStorage.setItem(key, JSON.stringify(values));
        else localStorage.removeItem(key);
      }
    } catch {
      storageOK = false;
    }
  }
  function accept(data) {
    if (!online || data.state.revision >= base.revision) {
      base = data.state;
      offset = data.serverNow - Date.now();
    }
    online = true;
    lastError = "";
    acknowledge(data.acknowledged || []);
    store();
    rebuild();
  }
  function failure(error) {
    online = false;
    lastError =
      error.status === 401 || error.status === 403
        ? "Entre novamente para sincronizar esta conta."
        : "Sem conexão com sua conta. As alterações aguardam sincronização.";
    store();
    rebuild();
  }
  function sync() {
    if (!userId) return Promise.resolve();
    if (flight) return flight;
    clearTimeout(timer);
    flight = (async () => {
      try {
        collect();
        do {
          const batch = pending.slice(0, 40);
          accept(
            await request("/study/state", batch.length ? batch : undefined),
          );
        } while (pending.length);
      } catch (error) {
        failure(error);
      } finally {
        flight = null;
      }
    })();
    return flight;
  }
  function enqueue(op) {
    if (!userId) throw new Error("Aguarde sua conta carregar.");
    const operation = { ...op, id: op.id || crypto.randomUUID() };
    M.validate(operation);
    collect();
    if (!pending.some((value) => value.id === operation.id))
      pending.push(operation);
    store();
    rebuild();
    clearTimeout(timer);
    timer = setTimeout(sync, 100);
    return true;
  }
  function flush() {
    if (!userId || !pending.length) return Promise.resolve();
    // Dispatch now, including when another request is pending and the page is closing.
    // Duplicate deliveries are acknowledged once by the account service.
    const batch = [];
    for (const op of pending.slice(0, 40)) {
      if (JSON.stringify([...batch, op]).length > 45000) break;
      batch.push(op);
    }
    if (!batch.length) return Promise.resolve();
    return request("/study/state", batch).then(accept).catch(failure);
  }
  function init(user) {
    if (ready) return ready;
    ready = (async () => {
      const usuario = user || (await request("/me")).usuario;
      if (!usuario?.acessoPremium)
        throw new Error("Acesso Premium necessário.");
      userId = String(usuario.id || usuario._id || "");
      if (!userId) throw new Error("Conta inválida.");
      try {
        const saved = JSON.parse(localStorage.getItem(cacheKey()) || "null");
        if (saved?.state?.modules && saved.state.focus) {
          base = saved.state;
          offset = Number(saved.offset) || 0;
        }
      } catch {
        storageOK = false;
      }
      collect();
      rebuild();
      await sync();
      return state;
    })().catch((error) => {
      ready = null;
      throw error;
    });
    return ready;
  }
  async function focus(action, duration) {
    await init();
    await sync();
    // Timer commands require acknowledgement. An existing deadline keeps ticking offline.
    if (!online)
      throw new Error(
        "Conecte-se para alterar o timer. Uma sessão iniciada continua contando.",
      );
    if (action === "toggle")
      action =
        state.focus.status === "running"
          ? "pause"
          : state.focus.status === "paused"
            ? "resume"
            : "start";
    const op = {
      id: crypto.randomUUID(),
      kind: "focus",
      action,
      revision: state.focus.revision,
      ...(duration ? { duration } : {}),
    };
    try {
      accept(await request("/study/state", [op]));
      return state.focus;
    } catch (error) {
      if (error.data?.state) accept(error.data);
      else failure(error);
      throw error;
    }
  }
  window.TurmaStudySync = {
    init,
    sync,
    flush,
    enqueue,
    focus,
    get state() {
      return state;
    },
    get status() {
      return status();
    },
    get now() {
      return Date.now() + offset;
    },
  };
  addEventListener("online", sync);
  addEventListener("focus", () => {
    if (userId) sync();
  });
  addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && userId) sync();
  });
  setInterval(() => {
    if (userId && !document.hidden) sync();
  }, 20000);
})();
