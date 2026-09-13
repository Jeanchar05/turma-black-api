"use strict";
// As regras e tabelas vêm dos módulos originais. São exercícios de identificação,
// não estimativas de probabilidade nem previsões do próximo giro.
(() => {
  const wheel = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
  ];
  const mirrors = {
    1: 10,
    2: 20,
    3: 30,
    6: 9,
    9: 6,
    10: 1,
    12: 21,
    21: 12,
    13: 31,
    31: 13,
    32: 23,
    23: 32,
    16: 19,
    19: 16,
    26: 29,
    29: 26,
    20: 2,
    30: 3,
  };
  const mirrorExtras = { 1: [11, 0], 2: [22], 3: [33] };
  const magnets = {
    0: [10, 20, 30],
    1: [17],
    2: [22],
    3: [33],
    4: [22],
    5: [25, 15, 35],
    6: [20],
    7: [17],
    8: [0, 20],
    9: [19],
    10: [0],
    11: [0, 20],
    12: [33, 15],
    13: [20],
    14: [17],
    15: [9, 35],
    16: [3],
    17: [20, 7],
    18: [2],
    19: [9],
    20: [17],
    21: [22],
    22: [2],
    23: [0],
    24: [35, 15, 25],
    25: [20, 22],
    26: [10],
    27: [20],
    28: [17],
    29: [17],
    30: [0, 20],
    31: [19],
    32: [10],
    33: [3],
    34: [20],
    35: [33, 15],
    36: [20],
  };
  const triangles = [
    { name: "Sequência", points: [3, 6, 9] },
    { name: "Equilíbrio", points: [4, 8, 12] },
    { name: "Progressão", points: [5, 10, 15] },
    { name: "Conexão", points: [1, 2, 5] },
    { name: "Distância", points: [3, 5, 34] },
    { name: "Race", points: [7, 24, 25] },
  ];
  const families = [
    [1, 4, 7],
    [2, 5, 8],
    [3, 6, 9],
  ];
  const unique = (values) => [...new Set(values)];
  const terminals = (t) =>
    wheel.filter((n) => n % 10 === t).sort((a, b) => a - b);
  function neighbors(n, k) {
    const i = wheel.indexOf(n);
    return i < 0
      ? []
      : Array.from(
          { length: 2 * k + 1 },
          (_, d) => wheel[(i + d - k + 37) % 37],
        );
  }
  function digitResults(n) {
    return n < 10
      ? [n]
      : unique([
          Math.floor(n / 10) + (n % 10),
          Math.abs(Math.floor(n / 10) - (n % 10)),
        ]);
  }
  function pairResults(a, b) {
    return unique([Math.abs(a - b), ...(a + b <= 36 ? [a + b] : [])]);
  }
  function familyOf(n) {
    return families.findIndex((f) => f.includes(n % 10));
  }
  function parseNumbers(raw, min, max = min) {
    const tokens = String(raw)
      .trim()
      .split(/[\s,;]+/);
    if (
      !String(raw).trim() ||
      tokens.length < min ||
      tokens.length > max ||
      tokens.some((t) => !/^\d{1,2}$/.test(t) || Number(t) > 36)
    )
      return null;
    return tokens.map(Number);
  }
  const modules = [
    {
      id: "gemeos",
      name: "Gêmeos",
      route: "gemeos",
      art: "gemeos",
      category: "Famílias",
      icon: "i-star",
      color: "#bea5ef",
      summary:
        "Reconheça o gatilho e encontre os outros dois membros da família.",
      focus: "11 · 22 · 33",
      intro:
        "A família dos Gêmeos reúne 11, 22 e 33. Neste método, o número apresentado é a origem da leitura e os outros dois são os alvos do exercício.",
      rules: [
        [
          "Reconheça a origem",
          "Um dos três gêmeos inicia o exemplo. Separe esse número dos dois restantes.",
        ],
        [
          "Monte as regiões",
          "Cada alvo recebe dois vizinhos de cada lado na roda. A origem recebe um vizinho de cada lado.",
        ],
        [
          "Acompanhe o ciclo",
          "O método prevê até duas entradas iniciais. Qualquer gêmeo no caminho encerra a leitura; o reset usa 12 rodadas sem gêmeos.",
        ],
      ],
      example:
        "Se a origem é 11, os alvos são 22 e 33. Na demonstração, compare a região desses alvos com a região da origem.",
      remember:
        "Vizinhos são posições na roda europeia, não números consecutivos na ordem numérica.",
    },
    {
      id: "espelhos",
      name: "Espelhos",
      route: "espelhos",
      art: "espelhos",
      category: "Conexões",
      icon: "i-layers",
      color: "#91c9e8",
      summary: "Explore os pares do módulo e visualize suas regiões na roda.",
      focus: "12 ↔ 21",
      intro:
        "Espelhos é uma tabela de pares usada pelo módulo. Ela inclui inversões como 12 e 21 e associações convencionais como 6 e 9. Consulte a tabela para aprender cada relação.",
      rules: [
        [
          "Consulte o par",
          "Localize o número de origem e seu espelho na tabela. Nem todo número de 0 a 36 possui um par cadastrado.",
        ],
        [
          "Compare as regiões",
          "O espelho recebe três vizinhos de cada lado; a origem recebe um. Esta é a regra da aula original.",
        ],
        [
          "Observe os extras",
          "As origens 1, 2 e 3 têm extras específicos: 1 adiciona 11 e 0; 2 adiciona 22; 3 adiciona 33.",
        ],
      ],
      example:
        "A origem 12 corresponde ao espelho 21. O exemplo interativo destaca 21 com três vizinhos e 12 com um vizinho.",
      remember:
        "Os pares 16 ↔ 19 e 26 ↔ 29 também fazem parte da tabela do módulo.",
    },
    {
      id: "fibonacci",
      name: "Fibonacci",
      route: "fibonacci",
      art: "fibonacci",
      category: "Cálculos",
      icon: "i-activity",
      color: "#eac086",
      summary:
        "Pratique soma, diferença e comparação de terminais sem pular etapas.",
      focus: "25 + 4 = 29",
      intro:
        "Neste módulo, o nome Fibonacci identifica a metodologia de soma e diferença entre pares. Compare os dois primeiros e os dois últimos números do histórico para encontrar resultados e terminais em comum.",
      rules: [
        [
          "Calcule cada par",
          "Some os dois números e subtraia o menor do maior. Considere os resultados entre 0 e 36.",
        ],
        [
          "Descarte somas acima de 36",
          "Uma soma 44 é descartada. Não transforme 44 em 8 nem reduza o resultado ao terminal.",
        ],
        [
          "Compare início e final",
          "Separe coincidências exatas de coincidências de terminal. O exemplo mostra os alvos válidos com dois vizinhos.",
        ],
      ],
      example:
        "No início, 15 e 14 produzem 29 e 1. No final, 25 e 4 produzem 29 e 21: há coincidência no 29 e nos terminais 9 e 1.",
      remember:
        "A coincidência descreve os números informados; não aumenta por si só a chance do próximo resultado.",
    },
    {
      id: "magneto",
      name: "Magneto",
      route: "magneto",
      art: "magneto",
      category: "Conexões",
      icon: "i-roulette",
      color: "#e5a3bc",
      summary: "Memorize as conexões cadastradas e diferencie origem e alvos.",
      focus: "14 → 17",
      intro:
        "Magneto usa um mapa específico de conexões. Cada origem pode ter um ou mais números associados. O exercício serve para consultar e memorizar esse mapa.",
      rules: [
        [
          "Localize a origem",
          "Escolha um número de 0 a 36 e consulte suas conexões cadastradas.",
        ],
        [
          "Identifique todos os alvos",
          "Algumas origens apontam para mais de um número. Por exemplo, 24 aponta para 35, 15 e 25.",
        ],
        [
          "Visualize a cobertura",
          "A regra base usa um vizinho na origem e nos alvos; a aula também prevê dois quando existe confirmação no histórico. O seletor permite comparar as duas coberturas.",
        ],
      ],
      example:
        "Para a origem 14, a conexão é 17. Observe as duas posições e depois altere a origem para 24 para comparar um caso com três conexões.",
      remember:
        "As conexões são regras do material. A palavra “atração” não representa uma força física nem uma previsão.",
    },
    {
      id: "camaleoes",
      name: "Camaleões",
      route: "camaleoes",
      art: "camaleoes",
      category: "Cálculos",
      icon: "i-book",
      color: "#a0d6b0",
      summary:
        "Some e subtraia os dígitos para descobrir famílias e integrantes ausentes.",
      focus: "16 → 7 e 5",
      intro:
        "Um número pode representar outros pela soma e pela diferença absoluta dos seus dígitos. Agrupe os resultados do histórico para identificar quais números apontam para o mesmo camuflado.",
      rules: [
        [
          "Separe os dígitos",
          "Para 16, calcule 1 + 6 = 7 e |1 − 6| = 5. Se os dois resultados forem iguais, marque apenas uma vez.",
        ],
        [
          "Agrupe o histórico",
          "16, 18 e 25 apontam para 7. A contagem informa quantas vezes uma relação apareceu na amostra.",
        ],
        [
          "Encontre as ausências",
          "Na família 7, 29 e 34 completam o grupo do exemplo. Os terminais 7, 17 e 27 também são destacados pelo método.",
        ],
      ],
      example:
        "Histórico: 16, 18, 25. Família observada: 7. Integrantes ainda ausentes: 29 e 34. Terminais: 7, 17 e 27.",
      remember:
        "Um integrante ausente não fica mais provável por ainda não ter aparecido.",
    },
    {
      id: "pitagoras",
      name: "Pitágoras",
      route: "triangulacao",
      art: "pitagoras",
      category: "Famílias",
      icon: "i-exam",
      color: "#b7b3f1",
      summary: "Conecte os pontos das famílias e encontre o vértice que falta.",
      focus: "3 · 6 · 9",
      intro:
        "Pitágoras apresenta um catálogo de famílias com três números. A visualização conecta esses pontos na ordem real da roda para ajudar a memorizar o terceiro integrante.",
      rules: [
        [
          "Escolha uma família",
          "Consulte as seis famílias cadastradas e os três números de cada uma.",
        ],
        [
          "Observe dois pontos",
          "O exercício apresenta dois integrantes e pede o terceiro da mesma família.",
        ],
        [
          "Feche o desenho",
          "As linhas ligam posições reais na roda. O formato depende dos pontos e não precisa ser um triângulo retângulo.",
        ],
      ],
      example:
        "Na família Sequência, os pontos são 3, 6 e 9. Se o desafio apresenta 3 e 6, o integrante que falta é 9.",
      remember:
        "Este é um mapa de memorização do módulo, não uma aplicação do teorema de Pitágoras para prever giros.",
    },
    {
      id: "cavalo",
      name: "Cavalo",
      route: "cavalos",
      art: "cavalo",
      category: "Famílias",
      icon: "i-game",
      color: "#d8b68d",
      summary:
        "Identifique terminais e organize os resultados em três famílias.",
      focus: "1 · 4 · 7",
      intro:
        "O Cavalo divide os terminais de 1 a 9 em três famílias. O último dígito do número determina a família: 14 termina em 4 e pertence à família 1, 4 e 7.",
      rules: [
        [
          "Encontre o terminal",
          "Use o último dígito de cada número. Para 28, o terminal é 8.",
        ],
        [
          "Classifique a família",
          "Cavalo 1: 1, 4 e 7. Cavalo 2: 2, 5 e 8. Cavalo 3: 3, 6 e 9.",
        ],
        [
          "Compare três resultados",
          "Observe quantos resultados pertencem à mesma família. Os terminais 0 (0, 10, 20 e 30) ficam fora dessas três famílias.",
        ],
      ],
      example:
        "14, 27 e 31 têm terminais 4, 7 e 1. Todos pertencem ao Cavalo 1.",
      remember:
        "A presença de uma família no histórico descreve a amostra e não determina o próximo giro.",
    },
    {
      id: "eclipse",
      name: "Eclipse Zero",
      route: "eclipse-zero",
      art: "eclipse-zero",
      category: "Famílias",
      icon: "i-moon",
      color: "#a8bde8",
      summary:
        "Visualize o terminal zero e memorize os números do terminal nove.",
      focus: "0 · 10 · 20 · 30",
      intro:
        "O Eclipse Zero organiza uma demonstração em torno de dois terminais: 0 como grupo principal e 9 como proteção do método.",
      rules: [
        [
          "Comece pelo zero",
          "O zero inicia o exemplo e representa o reinício do ciclo na aula.",
        ],
        [
          "Revele o terminal 0",
          "O grupo principal é formado por 0, 10, 20 e 30.",
        ],
        [
          "Acrescente o terminal 9",
          "O grupo complementar contém 9, 19 e 29. Os dois grupos juntos têm sete números distintos.",
        ],
      ],
      example:
        "Avance o exemplo para ver primeiro 0, depois 0, 10, 20 e 30 e, por fim, o grupo 9, 19 e 29.",
      remember:
        "“Proteção” é o nome usado no método; cobrir mais números não elimina o risco nem garante retorno.",
    },
  ];
  function reading(id, values, stage = 2) {
    let targets = [],
      origin = [],
      coverage = [],
      lines = [],
      triangle = [];
    if (id === "gemeos") {
      const n = values[0];
      const other = [11, 22, 33].filter((x) => x !== n);
      origin = [n];
      targets = stage > 0 ? other : [];
      coverage =
        stage === 2
          ? unique([
              ...other.flatMap((x) => neighbors(x, 2)),
              ...neighbors(n, 1),
            ])
          : [];
      lines = [
        `Origem: ${n}.`,
        `Outros gêmeos: ${other.join(" e ")}.`,
        `Alvos com 2 vizinhos; origem com 1. ${unique([...other.flatMap((x) => neighbors(x, 2)), ...neighbors(n, 1)]).length} números distintos na cobertura.`,
      ];
    }
    if (id === "espelhos") {
      const n = values[0],
        t = mirrors[n];
      origin = [n];
      targets = stage > 0 ? [t, ...(mirrorExtras[n] || [])] : [];
      coverage =
        stage === 2
          ? unique([
              ...neighbors(t, 3),
              ...neighbors(n, 1),
              ...(mirrorExtras[n] || []),
            ])
          : [];
      lines = [
        `Origem: ${n}. Espelho cadastrado: ${t}.`,
        `Extras: ${(mirrorExtras[n] || []).join(", ") || "nenhum para esta origem"}.`,
        "Espelho com 3 vizinhos de cada lado; origem com 1.",
      ];
    }
    if (id === "fibonacci") {
      const [a, b, c, d] = values,
        first = pairResults(a, b),
        last = pairResults(c, d);
      targets =
        stage === 0 ? first : stage === 1 ? last : unique([...first, ...last]);
      coverage =
        stage === 2 ? unique(targets.flatMap((n) => neighbors(n, 2))) : [];
      const exact = first.filter((n) => last.includes(n)),
        terms = unique(
          first
            .map((n) => n % 10)
            .filter((t) => last.some((n) => n % 10 === t)),
        );
      lines = [
        `Início: ${a} + ${b} = ${a + b}${a + b > 36 ? " (descartada)" : ""}; diferença = ${Math.abs(a - b)}.`,
        `Final: ${c} + ${d} = ${c + d}${c + d > 36 ? " (descartada)" : ""}; diferença = ${Math.abs(c - d)}.`,
        `Coincidência exata: ${exact.join(", ") || "nenhuma"}. Terminais em comum: ${terms.join(", ") || "nenhum"}.`,
      ];
    }
    if (id === "magneto") {
      const [n, k] = values;
      origin = [n];
      targets = stage > 0 ? magnets[n] : [];
      coverage =
        stage === 2
          ? unique([n, ...targets].flatMap((x) => neighbors(x, k)))
          : [];
      lines = [
        `Origem selecionada: ${n}.`,
        `Conexões cadastradas: ${magnets[n].join(", ")}.`,
        `Visualização com ${k} vizinho${k === 1 ? "" : "s"} de cada lado na origem e nos alvos.`,
      ];
    }
    if (id === "camaleoes") {
      const counts = {};
      values.forEach((n) =>
        digitResults(n).forEach((t) => (counts[t] = (counts[t] || 0) + 1)),
      );
      const t = Number(
          Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a - b)[0],
        ),
        family = Array.from({ length: 27 }, (_, i) => i + 10).filter((n) =>
          digitResults(n).includes(t),
        ),
        present = family.filter((n) => values.includes(n)),
        missing = family.filter((n) => !values.includes(n)),
        term = terminals(t % 10);
      origin = present;
      targets =
        stage === 0 ? [t] : stage === 1 ? term : unique([...term, ...missing]);
      lines = [
        `Camuflado mais representado: ${t} (${counts[t]} chamada${counts[t] === 1 ? "" : "s"} na amostra; empate resolvido pelo menor número).`,
        `Integrantes presentes: ${present.join(", ") || "nenhum de dois dígitos"}. Terminais: ${term.join(", ")}.`,
        `Integrantes ausentes: ${missing.join(", ") || "nenhum"}.`,
      ];
    }
    if (id === "pitagoras") {
      const t = triangles[values[0]];
      origin = t.points.slice(0, 2);
      targets = stage > 0 ? [t.points[2]] : [];
      triangle = stage === 2 ? t.points : origin;
      lines = [
        `Família ${t.name}: ${t.points.join(", ")}.`,
        `Pontos conhecidos: ${origin.join(" e ")}. Integrante que falta: ${t.points[2]}.`,
        "As linhas conectam as posições na roda; os pontos pertencem ao catálogo de treino.",
      ];
    }
    if (id === "cavalo") {
      const fs = values.map(familyOf),
        counts = families.map((_, i) => fs.filter((f) => f === i).length);
      origin = values;
      targets =
        stage > 0
          ? unique(fs.filter((f) => f >= 0).flatMap((f) => families[f]))
          : [];
      coverage = stage === 2 ? unique(targets.flatMap(terminals)) : [];
      lines = [
        `Resultados: ${values.join(", ")}. Terminais: ${values.map((n) => n % 10).join(", ")}.`,
        counts.map((c, i) => `Cavalo ${i + 1}: ${c}`).join(" · ") + ".",
        `${fs.filter((f) => f < 0).length} resultado(s) com terminal 0, fora das três famílias.`,
      ];
    }
    if (id === "eclipse") {
      origin = [0];
      targets = stage === 0 ? [] : [0, 10, 20, 30];
      coverage = stage === 2 ? [9, 19, 29] : [];
      lines = [
        "Zero: ponto inicial do exemplo.",
        "Terminal 0: 0, 10, 20 e 30.",
        "Terminal 9: 9, 19 e 29. Os dois grupos reúnem 7 números.",
      ];
    }
    return { targets, origin, coverage, lines, triangle };
  }
  function challenge(id, round = 0) {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const n = pick(wheel);
    let prompt = "",
      expected = [],
      explanation = "",
      shown = [];
    if (id === "gemeos") {
      const t = pick([11, 22, 33]);
      expected = [11, 22, 33].filter((x) => x !== t);
      shown = [t];
      prompt = `A origem é ${t}. Marque somente os outros dois gêmeos, sem os vizinhos.`;
      explanation = `A família é 11, 22 e 33. Retirando a origem ${t}, ficam ${expected.join(" e ")}. Na cobertura completa, cada alvo recebe dois vizinhos e a origem recebe um.`;
    }
    if (id === "espelhos") {
      const t = Number(pick(Object.keys(mirrors)));
      expected = [mirrors[t]];
      shown = [t];
      prompt = `Qual é o espelho de ${t}? Marque somente o par principal.`;
      explanation = `Na tabela do módulo, ${t} corresponde a ${expected[0]}. A cobertura do exemplo usa três vizinhos no espelho e um na origem.`;
    }
    if (id === "fibonacci") {
      const b = pick(wheel);
      expected = pairResults(n, b);
      shown = [n, b];
      prompt = `Para o par ${n} e ${b}, marque os resultados válidos da soma e da diferença absoluta.`;
      explanation = `${n} + ${b} = ${n + b}${n + b > 36 ? " (acima de 36, descartada)" : ""}. |${n} − ${b}| = ${Math.abs(n - b)}. Marque cada resultado válido apenas uma vez.`;
    }
    if (id === "magneto") {
      shown = [n];
      expected = magnets[n];
      prompt = `A origem é ${n}. Marque todas as conexões cadastradas, sem os vizinhos.`;
      explanation = `O mapa Magneto associa ${n} a ${expected.join(", ")}. A origem e os vizinhos não fazem parte da resposta deste desafio.`;
    }
    if (id === "camaleoes") {
      const t = 10 + Math.floor(Math.random() * 27),
        a = Math.floor(t / 10),
        b = t % 10;
      shown = [t];
      expected = digitResults(t);
      prompt = `Separe os dígitos de ${t}. Marque a soma e a diferença absoluta.`;
      explanation = `${a} + ${b} = ${a + b}; |${a} − ${b}| = ${Math.abs(a - b)}. Resultados iguais são marcados uma única vez.`;
    }
    if (id === "pitagoras") {
      const t = pick(triangles),
        i = Math.floor(Math.random() * 3);
      expected = [t.points[i]];
      shown = t.points.filter((_, j) => j !== i);
      prompt = `Na família ${t.name}, já temos ${shown.join(" e ")}. Marque o integrante que falta.`;
      explanation = `A família ${t.name} reúne ${t.points.join(", ")}. O número ausente é ${expected[0]}.`;
    }
    if (id === "cavalo") {
      const t = pick(wheel.filter((x) => x % 10 !== 0)),
        f = familyOf(t);
      shown = [t];
      expected = families[f];
      prompt = `O número é ${t}. Marque os três terminais da família dele (de 1 a 9).`;
      explanation = `${t} termina em ${t % 10} e pertence ao Cavalo ${f + 1}: ${expected.join(", ")}.`;
    }
    if (id === "eclipse") {
      const type = round % 3;
      expected =
        type === 0
          ? [0, 10, 20, 30]
          : type === 1
            ? [9, 19, 29]
            : [0, 10, 20, 30, 9, 19, 29];
      prompt =
        type === 0
          ? "Marque todos os números do terminal 0."
          : type === 1
            ? "Marque todos os números do terminal 9."
            : "Complete a órbita: marque o terminal 0 e o terminal 9.";
      explanation = `${type === 0 ? "Terminal 0" : type === 1 ? "Terminal 9" : "Órbita completa"}: ${expected.join(", ")}. O terminal é o último dígito do número.`;
    }
    return { prompt, expected, explanation, shown };
  }
  const curriculum = {
    modules,
    wheel,
    mirrors,
    magnets,
    triangles,
    families,
    neighbors,
    digitResults,
    pairResults,
    familyOf,
    parseNumbers,
    reading,
    challenge,
  };
  if (typeof module === "object" && module.exports) module.exports = curriculum;
  else window.TurmaStudy = curriculum;
})();
