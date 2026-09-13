"use strict";
const assert = require("node:assert/strict"),
  { randomUUID } = require("node:crypto");
const { installStore } = require("./helpers/study-memory-store.cjs");
const store = installStore(),
  service = require("../services/study-state"),
  M = require("../public/study-state-model"),
  G = require("../public/study-games");
const alpha = "1".repeat(24),
  beta = "2".repeat(24);
const patch = (module, fields) => ({
  id: randomUUID(),
  kind: "patch",
  module,
  fields,
});
(async () => {
  for (const id of M.ids)
    for (let seed = 0; seed < 25; seed++)
      for (let round = 0; round < 5; round++) {
        const q = G.task(id, seed, round);
        assert(G.grade(q, q.expected), id);
        assert(!G.grade(q, []));
        assert(!G.grade(q, [...q.expected, "extra"]));
        assert.deepEqual(q, G.task(id, seed, round));
        if (q.ordered && new Set(q.expected).size > 1)
          assert(
            !G.grade(q, [...q.expected].reverse()) ||
              q.expected.join() === [...q.expected].reverse().join(),
          );
      }
  const first = patch("gemeos", {
    note: "Minha anotação",
    steps: ["explicacao"],
    favorite: true,
  });
  await service.update(alpha, [first]);
  await service.update(alpha, [first]);
  assert.equal((await service.update(beta)).state.modules.gemeos.note, "");
  assert.equal(store.events(), 1);
  await Promise.all([
    service.update(alpha, [patch("gemeos", { steps: ["exemplo"] })]),
    service.update(alpha, [patch("espelhos", { note: "Segundo módulo" })]),
  ]);
  assert.deepEqual(store.get(alpha).modules.gemeos.steps, [
    "explicacao",
    "exemplo",
  ]);
  assert.equal(store.get(alpha).modules.espelhos.note, "Segundo módulo");
  const game = { id: randomUUID(), seed: 11, answers: [], draft: [] };
  for (let i = 0; i < 5; i++)
    game.answers.push(G.task("gemeos", game.seed, i).expected);
  const finish = {
    id: `game:${game.id}:finish`,
    kind: "game",
    module: "gemeos",
    game,
  };
  await Promise.all([
    service.update(alpha, [finish]),
    service.update(alpha, [finish]),
  ]);
  assert.equal(store.get(alpha).modules.gemeos.sessions, 1);
  assert.equal(store.get(alpha).modules.gemeos.bestScore, 5);
  assert.equal(M.summary(store.get(alpha)).modulosConcluidos, 1);
  await assert.rejects(
    service.update(alpha, [patch("gemeos", { bestScore: 5 })]),
    /Campo/,
  );
  await assert.rejects(
    service.update(alpha, [patch("gemeos", { steps: ["minigame"] })]),
    /Etapa/,
  );
  await assert.rejects(
    service.update(alpha, [patch("__proto__", { note: "x" })]),
    /Módulo/,
  );
  await assert.rejects(
    service.update(alpha, [patch("gemeos", { note: "x".repeat(1001) })]),
    /Anotação/,
  );
  await assert.rejects(service.update("other-owner", []), /Conta/);
  let f = (await service.update(alpha)).state.focus;
  const start = {
    id: randomUUID(),
    kind: "focus",
    action: "start",
    revision: f.revision,
    duration: 900,
  };
  f = (await service.update(alpha, [start])).state.focus;
  const deadline = f.deadline;
  assert.equal(
    (await service.update(alpha, [start])).state.focus.deadline,
    deadline,
  );
  await assert.rejects(
    service.update(alpha, [{ ...start, id: randomUUID(), action: "pause" }]),
    (error) => error.status === 409,
  );
  const snapshot = store.get(alpha);
  snapshot.focus.deadline = Date.now() - 500;
  store.set(alpha, snapshot);
  f = (await service.update(alpha)).state.focus;
  assert.equal(f.status, "completed");
  assert.equal(f.remaining, 0);
  const days = store.get(alpha).focusDays.length;
  await service.update(alpha);
  assert.equal(store.get(alpha).focusDays.length, days);
  assert.equal((await service.update(beta)).state.focus.status, "idle");
  const before = store.get(alpha).modules.magneto.note;
  await assert.rejects(
    service.update(alpha, [
      patch("magneto", { note: "Rollback" }),
      { id: randomUUID(), kind: "focus", action: "pause", revision: 0 },
    ]),
    (error) => error.status === 409,
  );
  assert.equal(store.get(alpha).modules.magneto.note, before);
  console.log(
    "Contas OK: oito jogos determinísticos, pontuação validada, isolamento, concorrência, idempotência, rollback e timer após fechar a página.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
