"use strict";
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./study-curriculum"));
  else root.TurmaStudyGames = factory(root.TurmaStudy);
})(typeof window !== "undefined" ? window : globalThis, function (C) {
  const catalog = {
    gemeos: {
      name: "Guardião do ciclo",
      level: 1,
      difficulty: "Inicial",
      mechanic: "Tome decisões",
      description:
        "Reconheça os gêmeos e decida quando continuar, encerrar ou resetar uma leitura.",
    },
    espelhos: {
      name: "Sala dos reflexos",
      level: 2,
      difficulty: "Inicial +",
      mechanic: "Conecte os pares",
      description:
        "Ligue cada número ao seu reflexo. O painel cresce a cada rodada.",
    },
    fibonacci: {
      name: "Oficina de códigos",
      level: 3,
      difficulty: "Intermediário",
      mechanic: "Resolva os cálculos",
      description:
        "Preencha somas e diferenças para abrir os códigos. Fique atento ao limite de 36.",
    },
    magneto: {
      name: "Circuito magnético",
      level: 4,
      difficulty: "Intermediário +",
      mechanic: "Ative as conexões",
      description:
        "Ligue os destinos do número central e feche o circuito sem incluir distrações.",
    },
    camaleoes: {
      name: "Detetive dos dígitos",
      level: 5,
      difficulty: "Avançado",
      mechanic: "Investigue as pistas",
      description:
        "Descubra o resultado comum aos dígitos e encontre os representantes que faltam.",
    },
    pitagoras: {
      name: "Arquiteto da Race",
      level: 6,
      difficulty: "Avançado +",
      mechanic: "Construa a figura",
      description:
        "Complete as famílias diretamente na roda. Os últimos desafios oferecem menos pontos conhecidos.",
    },
    cavalo: {
      name: "Corrida das famílias",
      level: 7,
      difficulty: "Especialista",
      mechanic: "Classifique em sequência",
      description:
        "Envie cada número para a família correta. A fila cresce e os terminais zero também entram no desafio.",
    },
    eclipse: {
      name: "Órbita em sequência",
      level: 8,
      difficulty: "Desafio final",
      mechanic: "Observe e reconstrua",
      description:
        "Observe uma sequência e reconstrua, na ordem, somente os números dos terminais 0 e 9.",
    },
  };
  function random(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let t = Math.imul(value ^ (value >>> 15), 1 | value);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function task(id, seed, round) {
    const rng = random((seed + round * 7919) >>> 0);
    const pick = (values) => values[Math.floor(rng() * values.length)];
    const shuffle = (values) => {
      const result = [...values];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };
    const unique = (values) => [...new Set(values)];
    let q = { kind: id, shown: [], expected: [], ordered: false };
    if (id === "gemeos") {
      if (round < 2) {
        const origin = pick([11, 22, 33]),
          targets = [11, 22, 33].filter((n) => n !== origin);
        q = {
          ...q,
          shown: [origin],
          prompt: "Qual par completa a família sem repetir a origem?",
          choices: [
            ["11-22", "11 + 22"],
            ["11-33", "11 + 33"],
            ["22-33", "22 + 33"],
          ],
          expected: [targets.join("-")],
          explanation: `Com origem ${origin}, os outros gêmeos são ${targets.join(" e ")}.`,
        };
      } else {
        const ended = round === 3,
          count = round === 4 ? 12 : 3 + Math.floor(rng() * 6);
        q.shown = Array.from({ length: count }, () =>
          pick(C.wheel.filter((n) => ![11, 22, 33].includes(n))),
        );
        if (ended) q.shown[q.shown.length - 1] = pick([11, 22, 33]);
        q.prompt =
          "Após as duas entradas iniciais, estes foram os resultados. O que acontece com a leitura?";
        q.choices = [
          ["continuar", "Continuar acompanhando"],
          ["encerrar", "Encerrar: apareceu um gêmeo"],
          ["resetar", "Resetar: 12 rodadas sem gêmeos"],
        ];
        q.expected = [
          ended ? "encerrar" : count === 12 ? "resetar" : "continuar",
        ];
        q.explanation = ended
          ? "Qualquer gêmeo encerra a leitura, mesmo antes do reset."
          : count === 12
            ? "Doze rodadas sem gêmeos completam o reset da regra estudada."
            : `São ${count} rodadas sem gêmeos. O reset ainda não chegou a 12.`;
      }
    }
    if (id === "espelhos") {
      const pairs = shuffle(
        Object.entries(C.mirrors).filter(([a, b]) => Number(a) < b),
      ).slice(0, 2 + Math.floor(round / 2));
      q.left = shuffle(pairs.map(([a]) => Number(a)));
      q.right = shuffle(pairs.map(([, b]) => b));
      q.expected = pairs.map(([a, b]) => `${a}:${b}`);
      q.prompt =
        "Escolha um número à esquerda e conecte ao seu espelho à direita.";
      q.explanation =
        pairs.map(([a, b]) => `${a} ↔ ${b}`).join(" · ") +
        ". Cada destino recebe uma conexão.";
    }
    if (id === "fibonacci") {
      q.shown = Array.from({ length: 4 }, () =>
        Math.floor(rng() * (round < 2 ? 18 : 37)),
      );
      if (round === 4) {
        q.shown[0] = 25;
        q.shown[1] = 19;
      }
      const [a, b, c, d] = q.shown;
      q.expected = [
        a + b > 36 ? "fora" : String(a + b),
        String(Math.abs(a - b)),
        c + d > 36 ? "fora" : String(c + d),
        String(Math.abs(c - d)),
      ];
      q.ordered = true;
      q.prompt =
        "Complete o laboratório: soma e diferença absoluta de cada par. Se a soma passar de 36, marque Fora da roda.";
      q.explanation = `${a} + ${b} = ${a + b}${a + b > 36 ? " (fora da roda)" : ""}; diferença ${Math.abs(a - b)}. ${c} + ${d} = ${c + d}${c + d > 36 ? " (fora da roda)" : ""}; diferença ${Math.abs(c - d)}. Não se reduz uma soma acima de 36.`;
    }
    if (id === "magneto") {
      const candidates = Object.keys(C.magnets)
        .map(Number)
        .filter((n) => C.magnets[n].length >= (round < 2 ? 1 : 2));
      const n = pick(candidates);
      q.shown = [n];
      q.expected = C.magnets[n].map(String);
      q.nodes = shuffle(
        unique([
          ...C.magnets[n],
          ...shuffle(
            C.wheel.filter((x) => x !== n && !C.magnets[n].includes(x)),
          ).slice(0, 4 + round),
        ]),
      );
      q.prompt = `Ative todos os destinos de ${n} na tabela Magneto. Deixe os demais desligados.`;
      q.explanation = `As conexões de ${n} são ${C.magnets[n].join(", ")}. Vizinhos são uma camada adicional do exemplo, não destinos diretos.`;
    }
    if (id === "camaleoes") {
      const cases = [];
      for (let t = 1; t <= 9; t++) {
        const reps = C.wheel.filter(
          (n) => n >= 10 && C.digitResults(n).includes(t),
        );
        for (let a = 0; a < reps.length; a++)
          for (let b = a + 1; b < reps.length; b++)
            for (let c = b + 1; c < reps.length; c++) {
              const clues = [reps[a], reps[b], reps[c]];
              if (
                C.digitResults(clues[0]).filter((x) =>
                  clues.every((n) => C.digitResults(n).includes(x)),
                ).length === 1
              )
                cases.push({ t, reps, clues });
            }
      }
      const found = pick(cases);
      q.shown = shuffle(found.clues);
      q.terminal = found.t;
      q.missing = found.reps.filter((n) => !q.shown.includes(n));
      q.expected = [`t:${found.t}`, ...q.missing.map((n) => `n:${n}`)];
      q.prompt =
        "Qual resultado aparece na soma ou na diferença dos dígitos das três pistas? Depois, marque todos os representantes de dois dígitos que faltam.";
      q.explanation = `O resultado comum é ${found.t}. Representantes de dois dígitos: ${found.reps
        .slice()
        .sort((a, b) => a - b)
        .join(", ")}. Faltam ${q.missing.join(", ") || "nenhum"}.`;
    }
    if (id === "pitagoras") {
      const family = pick(C.triangles),
        points = shuffle(family.points);
      q.shown = points.slice(0, round < 3 ? 2 : 1);
      q.expected = points.slice(q.shown.length).map(String);
      q.prompt = `Família ${family.name}: complete os ${3 - q.shown.length} vértice(s) restantes na Race.`;
      q.explanation = `A família ${family.name} reúne ${family.points.join(", ")}. A linha liga essas posições reais na roda.`;
    }
    if (id === "cavalo") {
      q.shown = shuffle(C.wheel).slice(0, 4 + round);
      if (round > 1 && !q.shown.some((n) => n % 10 === 0))
        q.shown[q.shown.length - 1] = pick([0, 10, 20, 30]);
      q.expected = q.shown.map((n) => String(C.familyOf(n)));
      q.ordered = true;
      q.prompt =
        "Classifique cada cartão pela família do seu terminal. Terminais zero ficam fora dos três cavalos.";
      q.explanation =
        q.shown
          .map(
            (n, i) =>
              `${n} → ${q.expected[i] === "-1" ? "fora das famílias" : `Cavalo ${Number(q.expected[i]) + 1}`}`,
          )
          .join(" · ") + ".";
    }
    if (id === "eclipse") {
      const orbit = [0, 10, 20, 30, 9, 19, 29];
      const sequence = Array.from({ length: 3 + round }, () => pick(orbit));
      q.shown = [...sequence];
      for (let i = 0; i < 1 + Math.floor(round / 2); i++)
        q.shown.splice(
          Math.floor(rng() * (q.shown.length + 1)),
          0,
          pick(C.wheel.filter((n) => !orbit.includes(n))),
        );
      q.expected = sequence.map(String);
      q.ordered = true;
      q.orbit = orbit;
      q.prompt =
        "Observe a sequência. Depois reconstrua apenas os terminais 0 e 9, mantendo a ordem e as repetições.";
      q.explanation = `A sequência filtrada é ${sequence.join(" → ")}. Os demais terminais são descartados.`;
    }
    if (!catalog[id]) throw new Error("Módulo inválido.");
    return q;
  }
  function grade(question, answer) {
    if (!Array.isArray(answer)) return false;
    const values = answer.map(String),
      expected = question.expected.map(String);
    return (
      values.length === expected.length &&
      (question.ordered
        ? values.every((value, i) => value === expected[i])
        : new Set(values).size === values.length &&
          values.every((value) => expected.includes(value)))
    );
  }
  function validGame(game) {
    return (
      !!game &&
      typeof game.id === "string" &&
      /^[a-zA-Z0-9-]{8,64}$/.test(game.id) &&
      Number.isInteger(game.seed) &&
      game.seed >= 0 &&
      game.seed <= 4294967295 &&
      Array.isArray(game.answers) &&
      game.answers.length <= 5 &&
      game.answers.every(
        (a) =>
          Array.isArray(a) &&
          a.length <= 37 &&
          a.every((v) => typeof v === "string" && v.length <= 16),
      ) &&
      Array.isArray(game.draft) &&
      game.draft.length <= 37 &&
      game.draft.every((v) => typeof v === "string" && v.length <= 16)
    );
  }
  function validDemo(id, value) {
    if (
      !value ||
      !Array.isArray(value.values) ||
      ![0, 1, 2].includes(value.stage) ||
      value.values.some((n) => !Number.isInteger(n) || n < 0 || n > 36)
    )
      return false;
    const v = value.values;
    if (id === "gemeos") return v.length === 1 && [11, 22, 33].includes(v[0]);
    if (id === "espelhos")
      return v.length === 1 && Object.hasOwn(C.mirrors, v[0]);
    if (id === "fibonacci") return v.length === 4;
    if (id === "magneto") return v.length === 2 && [1, 2].includes(v[1]);
    if (id === "camaleoes") return v.length >= 1 && v.length <= 12;
    if (id === "pitagoras") return v.length === 1 && !!C.triangles[v[0]];
    if (id === "cavalo") return v.length === 3;
    return id === "eclipse" && v.length === 1 && v[0] === 0;
  }
  function answerText(q, answer) {
    if (q.kind === "gemeos")
      return answer
        .map((value) => q.choices.find(([id]) => id === value)?.[1] || value)
        .join("; ");
    if (q.kind === "espelhos")
      return answer.map((value) => value.replace(":", " ↔ ")).join("; ");
    if (q.kind === "fibonacci")
      return answer
        .map(
          (value, i) =>
            `${i % 2 ? "Diferença" : "Soma"} do par ${Math.floor(i / 2) + 1}: ${value === "fora" ? "fora da roda" : value}`,
        )
        .join("; ");
    if (q.kind === "camaleoes")
      return answer
        .map((value) =>
          value
            .replace("t:", "Resultado comum: ")
            .replace("n:", "Representante "),
        )
        .join("; ");
    if (q.kind === "cavalo")
      return answer
        .map(
          (value, i) =>
            `${q.shown[i]} → ${value === "-1" ? "fora das famílias" : "Cavalo " + (Number(value) + 1)}`,
        )
        .join("; ");
    return answer.join(q.kind === "eclipse" ? " → " : ", ");
  }
  return { catalog, task, grade, validGame, validDemo, answerText };
});
