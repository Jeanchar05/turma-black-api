"use strict";
const assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { pipeline } = require("node:stream/promises");
const store = require("./helpers/notes-memory-store.cjs").installNotesStore(),
  service = require("../services/notes"),
  content = require("../services/note-content"),
  pdf = require("../services/notes-pdf"),
  a = "1".repeat(24),
  b = "2".repeat(24),
  id = "a".repeat(24);
const sample = {
  titulo: "Meu raciocínio, passo a passo",
  conteudo:
    "<h2>O que aprendi hoje</h2><p>Uma boa anotação conecta <strong>observação</strong> e <u>revisão</u>. A prática ajuda a reconhecer o que precisa ser estudado novamente.</p><p><mark>Revisar o exemplo com calma.</mark></p><ol><li>Ler a explicação.</li><li>Alterar o exemplo interativo.</li><li>Registrar o que ficou claro e as dúvidas.</li></ol><blockquote>Quero compreender o processo e conferir cada etapa.</blockquote><p>Minha próxima revisão: amanhã, no mesmo módulo.</p>",
  categoria: "Minha revisão",
  cor: "gold",
  favorita: true,
  fixada: true,
  tags: ["estudo", "revisão"],
  checklist: [
    { id: "c1", texto: "Rever as três etapas do exemplo", concluido: true },
    {
      id: "c2",
      texto: "Anotar uma dúvida para a próxima aula",
      concluido: false,
    },
  ],
  anexos: [
    { id: "l1", nome: "Meus estudos", url: "https://turmablack.com.br/estudo" },
  ],
  revision: 0,
  mutationId: crypto.randomUUID(),
};
(async () => {
  const n = await service.save(a, id, sample);
  assert.equal(n.revision, 1);
  assert.equal((await service.save(a, id, sample)).revision, 1);
  assert.deepEqual(await service.list(b), []);
  await assert.rejects(service.get(b, id), (e) => e.status === 404);
  await assert.rejects(
    service.save(b, id, { ...sample, mutationId: crypto.randomUUID() }),
    (e) => e.status === 404,
  );
  await assert.rejects(service.remove(b, id, 1), (e) => e.status === 404);
  const result = await Promise.allSettled([
    service.save(a, id, {
      ...n,
      titulo: "Dispositivo A",
      mutationId: crypto.randomUUID(),
    }),
    service.save(a, id, {
      ...n,
      titulo: "Dispositivo B",
      mutationId: crypto.randomUUID(),
    }),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(result.find((r) => r.status === "rejected").reason.status, 409);
  await assert.rejects(service.remove(a, id, 2), (e) => e.status === 400);
  let v = await service.save(a, id, {
    ...(await service.get(a, id)),
    excluida: true,
    mutationId: crypto.randomUUID(),
  });
  assert(v.excluida);
  v = await service.save(a, id, {
    ...v,
    excluida: false,
    mutationId: crypto.randomUUID(),
  });
  assert(!v.excluida);
  v = await service.save(a, id, {
    ...v,
    excluida: true,
    mutationId: crypto.randomUUID(),
  });
  await assert.rejects(service.remove(a, id, 3), (e) => e.status === 409);
  await service.remove(a, id, v.revision);
  await assert.rejects(
    service.save(a, id, { ...v, mutationId: crypto.randomUUID() }),
    (e) => e.status === 404,
  );
  const dirty =
      '<svg><textarea><img src=x onerror=alert(1)></textarea></svg><script>alert(1)</script><math><xmp><img src=x onerror=alert(1)></xmp></math><a href="javascript:alert(1)">bad</a><span style="position:fixed;inset:0;background-image:url(https://evil.invalid);background-color:#fff2b3">highlight</span><iframe src="https://evil.invalid"></iframe>',
    safe = content.html(dirty);
  assert(
    !/<script|<img|<svg|<math|<iframe|javascript:|position:|background-image:/.test(
      safe,
    ),
  );
  assert.match(safe, /background-color:#fff2b3/);
  assert.equal(
    content.normalize({ ...sample, anexos: [{ url: "javascript:alert(1)" }] })
      .anexos.length,
    0,
  );
  await assert.rejects(
    service.save(a, id, { ...sample, conteudo: "x".repeat(60001) }),
    (e) => e.status === 400,
  );
  store.seedNote({
    id: "c".repeat(24),
    usuario_id: a,
    titulo: "Minha nota anterior",
    conteudo: "<p>Conteúdo preservado.</p>",
    categoria: "Geral",
    cor: "purple",
    favorita: 1,
    tags: '["antiga"]',
    fixada: 0,
    arquivada: 1,
    excluida: 0,
    checklist: "[]",
    anexos: "[]",
    revisao: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  assert((await service.list(a))[0].arquivada);
  const out = path.join(os.tmpdir(), "turma-notes-pdf");
  fs.mkdirSync(out, { recursive: true });
  for (const [name, body] of [
    ["anotacao-aluno.pdf", sample.conteudo],
    ["anotacao-longa.pdf", sample.conteudo.repeat(32)],
  ]) {
    const d = pdf.create(
        { ...sample, id, conteudo: body },
        "Ana Júlia Ferreira",
      ),
      p = pipeline(d, fs.createWriteStream(path.join(out, name)));
    d.end();
    await p;
  }
  console.log(
    "Notas OK: legado, contas isoladas, conflitos, replay, lixeira/restauração, exclusão, sanitização e PDFs.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
