"use strict";
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./study-games"));
  else root.TurmaStudyState = factory(root.TurmaStudyGames);
})(typeof window !== "undefined" ? window : globalThis, function (G) {
  const ids = Object.keys(G.catalog),
    steps = ["explicacao", "exemplo", "minigame"];
  const emptyEntry = () => ({
    steps: [],
    favorite: false,
    note: "",
    bestScore: 0,
    sessions: 0,
    visitedAt: 0,
    lastStep: "explicacao",
    demo: null,
    game: null,
  });
  const empty = () => ({
    revision: 0,
    modules: Object.fromEntries(ids.map((id) => [id, emptyEntry()])),
    lastModule: "",
    focus: {
      revision: 0,
      status: "idle",
      duration: 1500,
      remaining: 1500,
      deadline: 0,
      completedAt: 0,
    },
    focusDays: [],
  });
  function reject(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }
  function validate(op) {
    if (
      !op ||
      typeof op.id !== "string" ||
      !/^[a-zA-Z0-9:_-]{8,100}$/.test(op.id)
    )
      reject("Identificador da alteração inválido.");
    if (op.kind === "focus") {
      if (
        !["start", "pause", "resume", "reset"].includes(op.action) ||
        !Number.isInteger(op.revision) ||
        op.revision < 0
      )
        reject("Ação do timer inválida.");
      if (op.duration !== undefined && ![900, 1500, 2700].includes(op.duration))
        reject("Duração inválida.");
      return;
    }
    if (!ids.includes(op.module)) reject("Módulo inválido.");
    if (op.kind === "game") {
      if (!G.validGame(op.game)) reject("Sessão inválida.");
      if (op.game.answers.length === 5 && op.id !== `game:${op.game.id}:finish`)
        reject("Conclusão inválida.");
      return;
    }
    if (
      op.kind !== "patch" ||
      !op.fields ||
      typeof op.fields !== "object" ||
      Array.isArray(op.fields)
    )
      reject("Alteração inválida.");
    for (const [key, value] of Object.entries(op.fields)) {
      if (
        ![
          "steps",
          "note",
          "favorite",
          "lastStep",
          "visitedAt",
          "demo",
        ].includes(key)
      )
        reject("Campo não permitido.");
      if (
        key === "steps" &&
        (!Array.isArray(value) ||
          value.some((s) => !["explicacao", "exemplo"].includes(s)))
      )
        reject("Etapa inválida.");
      if (key === "note" && (typeof value !== "string" || value.length > 1000))
        reject("Anotação inválida.");
      if (key === "favorite" && typeof value !== "boolean")
        reject("Favorito inválido.");
      if (key === "lastStep" && !steps.includes(value))
        reject("Etapa inválida.");
      if (key === "visitedAt" && (!Number.isFinite(value) || value < 0))
        reject("Data inválida.");
      if (key === "demo" && value !== null && !G.validDemo(op.module, value))
        reject("Exemplo inválido.");
    }
  }
  function settle(state, now) {
    const f = state.focus;
    if (f.status === "running" && f.deadline <= now) {
      f.status = "completed";
      f.remaining = 0;
      f.completedAt = f.deadline;
      f.revision++;
      const day = new Date(f.deadline).toISOString().slice(0, 10);
      state.focusDays = [...new Set([...state.focusDays, day])]
        .sort()
        .slice(-366);
      state.revision++;
    }
    return state;
  }
  function apply(state, op, now = Date.now()) {
    validate(op);
    settle(state, now);
    if (op.kind === "focus") {
      const f = state.focus;
      if (op.revision !== f.revision)
        reject(
          "O timer mudou em outro dispositivo. O estado atual foi atualizado; tente a ação novamente.",
          409,
        );
      if (op.action === "pause" && f.status === "running") {
        f.remaining = Math.max(0, Math.ceil((f.deadline - now) / 1000));
        f.deadline = 0;
        f.status = "paused";
      } else if (op.action === "resume" && f.status === "paused") {
        f.deadline = now + f.remaining * 1000;
        f.status = "running";
      } else if (
        op.action === "start" &&
        ["idle", "completed"].includes(f.status)
      ) {
        f.duration = op.duration || f.duration;
        f.remaining = f.duration;
        f.deadline = now + f.duration * 1000;
        f.completedAt = 0;
        f.status = "running";
      } else if (op.action === "reset") {
        f.duration = op.duration || f.duration;
        f.remaining = f.duration;
        f.deadline = 0;
        f.status = "idle";
        f.completedAt = 0;
      } else reject("Esta ação não se aplica ao estado atual do timer.", 409);
      f.revision++;
    } else {
      const e = (state.modules[op.module] ??= emptyEntry());
      if (op.kind === "game" || op.fields?.lastStep) {
        state.lastModule = op.module;
        e.visitedAt = now;
      }
      if (op.kind === "patch") {
        for (const [key, value] of Object.entries(op.fields)) {
          if (key === "steps")
            e.steps = steps.filter(
              (s) => e.steps.includes(s) || value.includes(s),
            );
          else if (key === "visitedAt") {
            e.visitedAt = now;
            state.lastModule = op.module;
          } else
            e[key] =
              key === "demo" && value
                ? { values: [...value.values], stage: value.stage }
                : JSON.parse(JSON.stringify(value));
        }
      } else {
        const game = {
          id: op.game.id,
          seed: op.game.seed,
          answers: op.game.answers.map((answer) => [...answer]),
          draft: [...op.game.draft],
        };
        // A delayed checkpoint from the same session cannot erase answered rounds.
        if (
          e.game?.id === game.id &&
          e.game.answers.length > game.answers.length
        )
          return state;
        e.game = game;
        if (game.answers.length === 5) {
          const score = game.answers.reduce(
            (sum, answer, i) =>
              sum + Number(G.grade(G.task(op.module, game.seed, i), answer)),
            0,
          );
          e.bestScore = Math.max(e.bestScore, score);
          e.sessions++;
          if (score >= 3 && !e.steps.includes("minigame"))
            e.steps.push("minigame");
        }
      }
    }
    state.revision++;
    return state;
  }
  function summary(state) {
    const completed = ids.filter(
      (id) => state.modules[id]?.steps.length === 3,
    ).length;
    const done = ids.reduce(
      (sum, id) => sum + (state.modules[id]?.steps.length || 0),
      0,
    );
    return {
      modulosConcluidos: completed,
      totalModulos: ids.length,
      progressoGeral: Math.round((done / (ids.length * 3)) * 100),
      etapasConcluidas: done,
      diasFoco: state.focusDays.filter(
        (day) => Date.parse(day) >= Date.now() - 30 * 86400000,
      ).length,
    };
  }
  return { ids, steps, empty, emptyEntry, validate, apply, settle, summary };
});
