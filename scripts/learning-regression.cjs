"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { finished } = require("node:stream/promises");
require("./helpers/study-memory-store.cjs").installStore();
const content = require("../services/learning-content"),
  pdf = require("../services/learning-pdf"),
  C = require("../public/study-curriculum"),
  M = require("../public/study-state-model"),
  Board = require("../public/study-board"),
  Media = require("../public/study-media");
(async () => {
  const user = "1".repeat(24),
    base = {
      title: "Aula de Gêmeos",
      description: "Conceitos",
      url: "https://youtu.be/M7lc1UVf-VE",
      summary: "Primeiro conceito.\n\nSegundo conceito.",
      duration: "12 min",
      published: false,
      revision: 0,
    };
  assert.equal((await content.list()).modules.length, 8);
  await content.save("gemeos", base, user);
  assert.equal((await content.list()).modules[0].url, "");
  assert.equal((await content.list()).modules[0].summary, "");
  assert.equal((await content.list(true)).modules[0].revision, 1);
  await content.save("gemeos", { ...base, revision: 1, published: true }, user);
  assert.equal((await content.list()).modules[0].published, true);
  const concurrent = await Promise.allSettled([
    content.save("gemeos", { ...base, revision: 2 }, user),
    content.save("gemeos", { ...base, revision: 2 }, user),
  ]);
  assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    concurrent.find((r) => r.status === "rejected").reason.status,
    409,
  );
  assert.equal((await content.list()).modules[0].url, "");
  for (const url of [
    "javascript:alert(1)",
    "http://youtube.com/watch?v=M7lc1UVf-VE",
    "https://youtube.com.evil.test/watch?v=M7lc1UVf-VE",
    "https://youtu.be@evil.test/M7lc1UVf-VE",
    "https://www.youtube.com:8443/watch?v=M7lc1UVf-VE",
    "https://example.com/a.html",
  ]) {
    assert.equal(Media.parse(url), null, url);
    assert.throws(() =>
      content.validate("gemeos", { ...base, url, published: true }),
    );
  }
  assert.equal(
    Media.parse("https://instagram.com/reel/ABCdef12345/", "instagram").embed,
    "https://www.instagram.com/reel/ABCdef12345/embed/",
  );
  assert.equal(
    Media.parse(
      "https://instagram.com.evil.test/reel/ABCdef12345/",
      "instagram",
    ),
    null,
  );
  const state = M.empty(),
    now = Date.now(),
    op = {
      id: "video-test-01",
      kind: "video",
      module: "gemeos",
      source: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      position: 31,
      duration: 120,
      completed: false,
      observedAt: now,
    };
  M.apply(state, op, now);
  M.apply(
    state,
    { ...op, id: "video-test-02", position: 70, observedAt: now + 1000 },
    now + 1000,
  );
  M.apply(
    state,
    { ...op, id: "video-test-03", position: 10, observedAt: now + 100 },
    now + 2000,
  );
  assert.equal(state.videos.gemeos.position, 70);
  M.apply(
    state,
    { ...op, id: "video-test-04", completed: true, observedAt: now + 3000 },
    now + 3000,
  );
  M.apply(
    state,
    { ...op, id: "video-test-05", observedAt: now + 4000 },
    now + 4000,
  );
  assert.equal(state.videos.gemeos.completed, true);
  assert.equal(state.modules.gemeos.steps.length, 0);
  assert.throws(() => M.validate({ ...op, position: 121 }));
  assert.throws(() => M.validate({ ...op, module: "__proto__" }));
  for (const [w, h, size] of [
    [212, 680, 32],
    [262, 680, 32],
    [360, 680, 32],
    [550, 680, 32],
    [570, 320, 32],
    [700, 320, 32],
    [1000, 380, 32],
  ]) {
    const { points } = Board.geometry(w, h);
    assert.equal(new Set(points.map((p) => p.n)).size, 37);
    for (const p of points) {
      assert(
        p.x >= size / 2 &&
          p.y >= size / 2 &&
          p.x + size / 2 <= w &&
          p.y + size / 2 <= h,
        `clipped ${w}: ${p.n}`,
      );
      for (const q of points) {
        if (p === q) continue;
        assert(
          Math.abs(p.x - q.x) >= size || Math.abs(p.y - q.y) >= size,
          `collision at ${w}x${h}: ${p.n}/${q.n}`,
        );
      }
    }
  }
  const out = process.env.LEARNING_PDF_DIR || "/tmp/turma-learning-pdfs";
  fs.mkdirSync(out, { recursive: true });
  for (const m of C.modules) {
    const doc = pdf.create({ id: m.id, summary: "" });
    const stream = fs.createWriteStream(path.join(out, `${m.id}.pdf`));
    doc.pipe(stream);
    doc.end();
    await finished(stream);
    assert(fs.statSync(path.join(out, `${m.id}.pdf`)).size > 3000);
  }
  const long = pdf.create({
      id: "fibonacci",
      summary:
        "Um parágrafo publicado no resumo da aula, com acentos e números: 15 + 14 = 29.\n\n".repeat(
          180,
        ),
    }),
    stream = fs.createWriteStream(path.join(out, "resumo-longo.pdf"));
  long.pipe(stream);
  long.end();
  await finished(stream);
  console.log(
    "Aulas OK: publicação/rascunhos, conflitos, URLs, progresso monotônico, 37 posições sem cortes ou sobreposição e oito PDFs.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
