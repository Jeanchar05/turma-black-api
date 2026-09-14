"use strict";
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./study-curriculum"));
  else root.TurmaStudyGuides = factory(root.TurmaStudy);
})(typeof window !== "undefined" ? window : globalThis, function (C) {
  const guides = {
    gemeos: {
      goal: "Distinguir a origem, os outros dois gêmeos e os vizinhos de cada região.",
      steps: [
        ["O que apareceu?", "11 é a origem. A família completa é 11, 22 e 33."],
        [
          "O que falta na família?",
          "Retire o 11. Restam 22 e 33: esses são os dois alvos do exemplo.",
        ],
        [
          "Como ampliar a leitura?",
          "No 22, dois vizinhos por lado são 31, 9, 18 e 29. No 33, são 24, 16, 1 e 20. No 11, um vizinho por lado é 36 e 30.",
        ],
      ],
      mistake:
        "Não marque 10 e 12 como vizinhos de 11. Vizinhança é posição na pista, e não a sequência 10, 11, 12.",
      check: {
        question: "Se a origem mudar para 22, quais serão os alvos principais?",
        options: ["11 e 33", "21 e 23", "11, 22 e 33"],
        answer: 0,
        why: "A origem sai da lista de alvos: na família 11, 22 e 33, retiramos o 22.",
      },
    },
    espelhos: {
      goal: "Encontrar o par correto na tabela e separar o espelho dos extras.",
      steps: [
        [
          "Identifique a origem",
          "Comece com 12. Procure 12 na tabela de pares do módulo.",
        ],
        [
          "Encontre a relação",
          "O par cadastrado de 12 é 21. O 21 é o alvo principal; o 12 continua sendo a origem.",
        ],
        [
          "Leia os vizinhos",
          "O 21 recebe três vizinhos por lado: 15, 19, 4 e 2, 25, 17. O 12 recebe apenas 28 e 35. Não há extras para a origem 12.",
        ],
      ],
      mistake:
        "Não inverta qualquer número automaticamente. O módulo também usa associações da tabela, como 16 e 19; o 15, por exemplo, não tem espelho cadastrado.",
      check: {
        question: "O que muda quando a origem é 2?",
        options: [
          "O espelho é 20 e há o extra 22",
          "O espelho é 22",
          "Todos os pares recebem o zero",
        ],
        answer: 0,
        why: "2 se conecta a 20 na tabela. O 22 é um extra específico dessa origem.",
      },
    },
    fibonacci: {
      goal: "Calcular cada par e reconhecer a diferença entre um número igual e um terminal igual.",
      steps: [
        [
          "Resolva o início: 15 e 14",
          "Soma: 15 + 14 = 29. Diferença: 15 − 14 = 1. Guarde os resultados 29 e 1.",
        ],
        [
          "Resolva o final: 25 e 4",
          "Soma: 25 + 4 = 29. Diferença: 25 − 4 = 21. Guarde os resultados 29 e 21.",
        ],
        [
          "Compare os resultados",
          "29 aparece nos dois pares: coincidência exata. 1 e 21 terminam em 1: coincidência de terminal. O 29 também repete o terminal 9.",
        ],
      ],
      mistake:
        "Se a soma for 44, descarte a soma. Não use 4, 8 ou 44 na mesa. A diferença ainda pode ser um resultado válido.",
      check: {
        question: "No par 25 e 19, quais resultados entram no exercício?",
        options: ["Somente 6", "44 e 6", "8 e 6"],
        answer: 0,
        why: "25 + 19 = 44 fica fora de 0 a 36. A diferença 25 − 19 = 6 continua válida.",
      },
    },
    magneto: {
      goal: "Consultar todas as conexões de uma origem e comparar a cobertura com um ou dois vizinhos.",
      steps: [
        [
          "Escolha uma origem",
          "Use 24. A consulta é feita a partir do 24, seguindo a direção da tabela.",
        ],
        [
          "Leia todos os destinos",
          "A linha do 24 contém 35, 15 e 25. É preciso incluir os três para representar a relação completa.",
        ],
        [
          "Compare as regiões",
          "Com um vizinho por lado, o 24 inclui 5 e 16; o 35 inclui 12 e 3; o 15 inclui 32 e 19; o 25 inclui 2 e 17.",
        ],
      ],
      mistake:
        "A tabela é direcional. Saber que 24 aponta para 35 não permite concluir que 35 aponta para 24.",
      check: {
        question: "A origem 14 tem quantos destinos principais?",
        options: ["Um: 17", "Dois: 13 e 15", "Três: 35, 15 e 25"],
        answer: 0,
        why: "Na tabela, a relação é 14 → 17. Os vizinhos ampliam a região, mas não são novos destinos principais.",
      },
    },
    camaleoes: {
      goal: "Fazer as contas com os dígitos e explicar por que vários números representam o mesmo resultado.",
      steps: [
        [
          "Faça as contas separadamente",
          "16: 1 + 6 = 7 e 6 − 1 = 5. 18: 1 + 8 = 9 e 8 − 1 = 7. 25: 2 + 5 = 7 e 5 − 2 = 3.",
        ],
        [
          "Procure o resultado comum",
          "O resultado 7 aparece nos três cálculos. Por isso, ele é o camuflado mais representado nessa amostra.",
        ],
        [
          "Complete a família",
          "29 também gera 7 pela diferença; 34 gera 7 pela soma. Eles ainda não aparecem no histórico. A família de dois dígitos é 16, 18, 25, 29 e 34.",
        ],
      ],
      mistake:
        "Terminal e resultado dos dígitos são ideias diferentes. 16 termina em 6, mas a soma dos dígitos é 7.",
      check: {
        question: "Por que 29 pertence à família do resultado 7?",
        options: [
          "Porque 9 − 2 = 7",
          "Porque termina em 7",
          "Porque 2 + 9 = 7",
        ],
        answer: 0,
        why: "Usamos a diferença absoluta dos dígitos. 29 termina em 9 e sua soma é 11.",
      },
    },
    pitagoras: {
      goal: "Reconhecer uma família de três pontos e encontrar o integrante ausente.",
      steps: [
        [
          "Consulte a família",
          "A família Sequência contém 3, 6 e 9. Esses três números fazem parte do catálogo do módulo.",
        ],
        [
          "Separe os conhecidos",
          "Se o exemplo informa 3 e 6, compare esses dois números com a família completa. Só o 9 está faltando.",
        ],
        [
          "Feche o desenho",
          "Localize 3, 6 e 9 na Race. As três linhas ajudam a memorizar a família. Na mesa numérica, observe os mesmos destaques em outra organização.",
        ],
      ],
      mistake:
        "Não calcule a distância do desenho nem use a² + b². Aqui, a resposta vem do catálogo de famílias.",
      check: {
        question: "Na família 4, 8 e 12, aparecem 4 e 12. Qual ponto falta?",
        options: ["8", "16", "6"],
        answer: 0,
        why: "Comparando os conhecidos 4 e 12 com a família completa, resta somente o 8.",
      },
    },
    cavalo: {
      goal: "Ler o último dígito e classificar o número em uma das três famílias.",
      steps: [
        [
          "Separe os terminais",
          "No histórico 14, 27 e 31, os últimos dígitos são 4, 7 e 1.",
        ],
        [
          "Consulte as três famílias",
          "1, 4 e 7 formam o Cavalo 1; 2, 5 e 8 formam o Cavalo 2; 3, 6 e 9 formam o Cavalo 3.",
        ],
        [
          "Conte os integrantes",
          "Os três resultados do exemplo pertencem ao Cavalo 1. Troque o 31 por 20: agora são dois no Cavalo 1 e um fora das famílias.",
        ],
      ],
      mistake:
        "Não some os dígitos neste módulo. Para classificar 27, use o terminal 7, e não 2 + 7 = 9.",
      check: {
        question: "O número 28 pertence a qual família?",
        options: [
          "Cavalo 2: 2, 5 e 8",
          "Cavalo 1: 1, 4 e 7",
          "Fora das famílias",
        ],
        answer: 0,
        why: "28 termina em 8. O terminal 8 pertence ao Cavalo 2.",
      },
    },
    eclipse: {
      goal: "Separar o grupo do terminal zero do grupo complementar do terminal nove.",
      steps: [
        [
          "Comece pelo terminal 0",
          "O terminal é o último dígito. De 0 a 36, terminam em zero: 0, 10, 20 e 30.",
        ],
        [
          "Monte o complemento",
          "Terminam em nove: 9, 19 e 29. São três números diferentes do grupo principal.",
        ],
        [
          "Confira a órbita completa",
          "Junte os quatro números do terminal 0 aos três do terminal 9. Ao todo são sete, sem repetições.",
        ],
      ],
      mistake:
        "O 36 não entra por somar 9. Aqui observamos o último dígito: 36 termina em 6.",
      check: {
        question: "Qual número pertence ao complemento de terminal 9?",
        options: ["19", "18", "36"],
        answer: 0,
        why: "O último dígito de 19 é 9. Não usamos soma dos dígitos para formar esse grupo.",
      },
    },
  };
  function trace(id, values, stage) {
    const r = C.reading(id, values, stage);
    if (id === "fibonacci")
      return [
        [
          `${values[0]} e ${values[1]}`,
          "Soma / diferença",
          `${values[0] + values[1]}${values[0] + values[1] > 36 ? " (descartada)" : ""} / ${Math.abs(values[0] - values[1])}`,
        ],
        ...(stage
          ? [
              [
                `${values[2]} e ${values[3]}`,
                "Soma / diferença",
                `${values[2] + values[3]}${values[2] + values[3] > 36 ? " (descartada)" : ""} / ${Math.abs(values[2] - values[3])}`,
              ],
            ]
          : []),
      ];
    if (id === "camaleoes")
      return values.map((n) => [
        String(n),
        n < 10
          ? "Um único dígito"
          : `${Math.floor(n / 10)} + ${n % 10} / |${Math.floor(n / 10)} − ${n % 10}|`,
        C.digitResults(n).join(" / "),
      ]);
    if (id === "cavalo")
      return values.map((n) => [
        String(n),
        `Terminal ${n % 10}`,
        C.familyOf(n) < 0 ? "Fora das famílias" : `Cavalo ${C.familyOf(n) + 1}`,
      ]);
    return [
      [
        r.origin.join(", ") || "—",
        "Origem / conhecidos",
        stage ? "Compare com os alvos" : "Localize na Race",
      ],
      ...(stage
        ? [
            [
              r.targets.join(", ") || "—",
              id === "pitagoras" ? "Ponto que faltava" : "Alvos principais",
              "Destaque dourado",
            ],
          ]
        : []),
      ...(stage === 2 && r.coverage.length
        ? [
            [
              String(new Set([...r.origin, ...r.targets, ...r.coverage]).size),
              "Números distintos",
              "Veja o complemento no mapa",
            ],
          ]
        : []),
    ];
  }
  return { guides, trace };
});
