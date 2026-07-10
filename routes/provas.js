const express = require("express");
const mongoose = require("mongoose");

const Prova = require("../models/Prova");
const ProvaResultado = require("../models/ProvaResultado");
const Notificacao = require("../models/Notificacao");

const { auth } = require("../middleware/auth");
const { requirePermission, getCargo } = require("../middleware/permissions");

const router = express.Router();

/* ===============================
   HELPERS
=============================== */

function hojeISO() {
  return new Date().toISOString();
}

function validarId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizarPublico(publico) {
  const valor = String(publico || "").toLowerCase().trim();

  const permitidos = ["todos", "free", "premium", "admin"];

  if (permitidos.includes(valor)) return valor;

  return "premium";
}

function normalizarStatus(status) {
  const valor = String(status || "").toLowerCase().trim();

  const permitidos = ["rascunho", "ativa", "inativa", "arquivada"];

  if (permitidos.includes(valor)) return valor;

  return "rascunho";
}

function normalizarCategoria(categoria) {
  const valor = String(categoria || "").toLowerCase().trim();

  const permitidos = ["geral", "roleta", "gestao", "mentalidade", "estrategia", "outro"];

  if (permitidos.includes(valor)) return valor;

  return "geral";
}

function normalizarDificuldade(dificuldade) {
  const valor = String(dificuldade || "").toLowerCase().trim();

  const permitidos = ["facil", "media", "dificil", "extrema"];

  if (permitidos.includes(valor)) return valor;

  return "media";
}

function usuarioPodeVerProva(usuario, prova) {
  if (!usuario || !prova) return false;

  const cargo = getCargo(usuario);

  if (["superadmin", "admin", "moderador"].includes(cargo)) {
    return true;
  }

  if (prova.status !== "ativa") {
    return false;
  }

  if (prova.publico === "todos") return true;

  if (prova.publico === "free") {
    return usuario.plano === "free";
  }

  if (prova.publico === "premium") {
    return usuario.plano !== "free";
  }

  if (prova.publico === "admin") {
    return ["superadmin", "admin", "moderador", "suporte"].includes(cargo);
  }

  return false;
}

function esconderRespostasCorretas(prova) {
  if (!prova) return null;

  const obj = prova.toObject ? prova.toObject() : prova;

  return {
    id: String(obj._id || obj.id),
    _id: obj._id,

    titulo: obj.titulo || "",
    descricao: obj.descricao || "",
    modulo: obj.modulo || "",

    categoria: obj.categoria || "geral",
    dificuldade: obj.dificuldade || "media",
    publico: obj.publico || "premium",
    status: obj.status || "rascunho",

    notaMinima: Number(obj.notaMinima || 70),
    tentativasPermitidas: Number(obj.tentativasPermitidas || 3),
    tempoLimiteMinutos: Number(obj.tempoLimiteMinutos || 0),

    totalPerguntas: Array.isArray(obj.perguntas) ? obj.perguntas.length : 0,

    perguntas: Array.isArray(obj.perguntas)
      ? obj.perguntas.map((pergunta) => ({
          id: String(pergunta._id),
          _id: pergunta._id,
          enunciado: pergunta.enunciado || "",
          tipo: pergunta.tipo || "multipla_escolha",
          alternativas: Array.isArray(pergunta.alternativas)
            ? pergunta.alternativas.map((alt) => ({
                id: String(alt._id),
                _id: alt._id,
                texto: alt.texto || ""
              }))
            : [],
          peso: Number(pergunta.peso || 1),
          ordem: Number(pergunta.ordem || 0)
        }))
      : [],

    createdAt: obj.createdAt || "",
    updatedAt: obj.updatedAt || ""
  };
}

function formatarProvaAdmin(prova) {
  if (!prova) return null;

  const obj = prova.toObject ? prova.toObject() : prova;

  return {
    id: String(obj._id || obj.id),
    _id: obj._id,

    titulo: obj.titulo || "",
    descricao: obj.descricao || "",
    modulo: obj.modulo || "",

    categoria: obj.categoria || "geral",
    dificuldade: obj.dificuldade || "media",
    publico: obj.publico || "premium",
    status: obj.status || "rascunho",

    notaMinima: Number(obj.notaMinima || 70),
    tentativasPermitidas: Number(obj.tentativasPermitidas || 3),
    tempoLimiteMinutos: Number(obj.tempoLimiteMinutos || 0),

    perguntas: obj.perguntas || [],
    totalPerguntas: Array.isArray(obj.perguntas) ? obj.perguntas.length : 0,

    criadaPor: obj.criadaPor || "",
    atualizadoPor: obj.atualizadoPor || "",

    createdAt: obj.createdAt || "",
    updatedAt: obj.updatedAt || ""
  };
}

function formatarResultado(resultado) {
  if (!resultado) return null;

  const obj = resultado.toObject ? resultado.toObject() : resultado;

  return {
    id: String(obj._id || obj.id),
    _id: obj._id,

    provaId: obj.provaId || null,
    provaTitulo: obj.provaTitulo || "",

    usuarioId: obj.usuarioId || null,
    usuarioNome: obj.usuarioNome || "",
    usuarioEmail: obj.usuarioEmail || "",

    respostas: obj.respostas || [],

    totalPerguntas: Number(obj.totalPerguntas || 0),
    acertos: Number(obj.acertos || 0),
    erros: Number(obj.erros || 0),

    pontosObtidos: Number(obj.pontosObtidos || 0),
    pontosTotais: Number(obj.pontosTotais || 0),

    nota: Number(obj.nota || 0),
    notaMinima: Number(obj.notaMinima || 70),

    aprovado: Boolean(obj.aprovado),
    status: obj.status || "pendente",

    feedback: obj.feedback || "",
    avaliadoPor: obj.avaliadoPor || "",
    avaliadoEm: obj.avaliadoEm || "",

    iniciadoEm: obj.iniciadoEm || "",
    finalizadoEm: obj.finalizadoEm || "",

    createdAt: obj.createdAt || "",
    updatedAt: obj.updatedAt || ""
  };
}

async function buscarProvaPorId(id) {
  if (!validarId(id)) return null;

  return Prova.findById(id);
}

async function buscarResultadoPorId(id) {
  if (!validarId(id)) return null;

  return ProvaResultado.findById(id);
}

async function notificarResultado(resultado) {
  try {
    await Notificacao.create({
      titulo: "Resultado da prova",
      mensagem: resultado.aprovado
        ? `Parabéns! Você foi aprovado na prova "${resultado.provaTitulo}".`
        : `Sua prova "${resultado.provaTitulo}" foi avaliada. Confira o resultado.`,
      tipo: "prova",
      destino: "especifico",
      email: resultado.usuarioEmail,
      usuarioId: resultado.usuarioId || null,
      prioridade: resultado.aprovado ? "normal" : "alta",
      icone: resultado.aprovado ? "✅" : "📝",
      link: "/provas",
      ativa: true,
      enviadaPor: "sistema",
      criadoPor: "sistema"
    });
  } catch (error) {
    console.error("Erro ao notificar resultado:", error.message);
  }
}

/* ===============================
   STATUS
=============================== */

router.get("/provas/status", (req, res) => {
  res.json({
    status: "online",
    modulo: "provas",
    rotas: [
      "GET /provas",
      "GET /provas/:id",
      "POST /provas/:id/responder",
      "GET /minhas-provas",
      "GET /admin/provas",
      "GET /admin/provas/resumo",
      "POST /admin/provas",
      "PUT /admin/provas/:id",
      "POST /admin/provas/:id/status",
      "DELETE /admin/provas/:id",
      "GET /admin/provas/resultados",
      "GET /admin/provas/resultados/:id",
      "POST /admin/provas/resultados/:id/avaliar"
    ]
  });
});

/* ===============================
   LISTAR PROVAS PARA USUÁRIO
   GET /provas
=============================== */

router.get("/provas", auth, async (req, res) => {
  try {
    const provas = await Prova.find({
      status: "ativa"
    }).sort({ createdAt: -1 });

    const visiveis = provas.filter((prova) => usuarioPodeVerProva(req.usuario, prova));

    return res.json({
      sucesso: true,
      total: visiveis.length,
      provas: visiveis.map(esconderRespostasCorretas)
    });
  } catch (error) {
    console.error("Erro ao listar provas:", error);

    return res.status(500).json({
      erro: "Erro interno ao listar provas."
    });
  }
});

/* ===============================
   BUSCAR PROVA PARA USUÁRIO
   GET /provas/:id
=============================== */

router.get("/provas/:id", auth, async (req, res) => {
  try {
    const prova = await buscarProvaPorId(req.params.id);

    if (!prova) {
      return res.status(404).json({
        erro: "Prova não encontrada."
      });
    }

    if (!usuarioPodeVerProva(req.usuario, prova)) {
      return res.status(403).json({
        erro: "Você não tem permissão para acessar esta prova."
      });
    }

    return res.json({
      sucesso: true,
      prova: esconderRespostasCorretas(prova)
    });
  } catch (error) {
    console.error("Erro ao buscar prova:", error);

    return res.status(500).json({
      erro: "Erro interno ao buscar prova."
    });
  }
});

/* ===============================
   RESPONDER PROVA
   POST /provas/:id/responder
=============================== */

router.post("/provas/:id/responder", auth, async (req, res) => {
  try {
    const prova = await buscarProvaPorId(req.params.id);

    if (!prova) {
      return res.status(404).json({
        erro: "Prova não encontrada."
      });
    }

    if (!usuarioPodeVerProva(req.usuario, prova)) {
      return res.status(403).json({
        erro: "Você não tem permissão para responder esta prova."
      });
    }

    const tentativas = await ProvaResultado.countDocuments({
      provaId: prova._id,
      usuarioEmail: req.usuario.email
    });

    if (tentativas >= Number(prova.tentativasPermitidas || 3)) {
      return res.status(403).json({
        erro: "Você atingiu o limite de tentativas desta prova.",
        tentativas,
        tentativasPermitidas: prova.tentativasPermitidas
      });
    }

    const respostasUsuario = Array.isArray(req.body.respostas) ? req.body.respostas : [];

    let acertos = 0;
    let erros = 0;
    let pontosObtidos = 0;
    let pontosTotais = 0;
    let precisaAnaliseManual = false;

    const respostasCorrigidas = prova.perguntas.map((pergunta) => {
      const respostaUser = respostasUsuario.find((item) => {
        return String(item.perguntaId) === String(pergunta._id);
      });

      const peso = Number(pergunta.peso || 1);
      pontosTotais += peso;

      let correta = false;
      let pontos = 0;
      let resposta = "";
      let alternativaId = "";

      if (pergunta.tipo === "multipla_escolha") {
        alternativaId = String(
          respostaUser?.alternativaId || respostaUser?.resposta || ""
        );

        const alternativaCorreta = pergunta.alternativas.find((alt) => alt.correta);
        const alternativaEscolhida = pergunta.alternativas.find((alt) => {
          return String(alt._id) === alternativaId;
        });

        resposta = alternativaEscolhida?.texto || "";

        correta =
          alternativaCorreta &&
          String(alternativaCorreta._id) === String(alternativaEscolhida?._id);

        if (correta) {
          acertos++;
          pontos = peso;
          pontosObtidos += peso;
        } else {
          erros++;
        }
      }

      if (pergunta.tipo === "texto") {
        precisaAnaliseManual = true;
        resposta = String(respostaUser?.resposta || "");
        correta = false;
        pontos = 0;
      }

      return {
        perguntaId: String(pergunta._id),
        enunciado: pergunta.enunciado || "",
        tipo: pergunta.tipo || "multipla_escolha",
        resposta,
        alternativaId,
        correta,
        pontos,
        peso,
        comentario: pergunta.explicacao || ""
      };
    });

    const nota =
      pontosTotais > 0 ? Number(((pontosObtidos / pontosTotais) * 100).toFixed(2)) : 0;

    const aprovado = !precisaAnaliseManual && nota >= Number(prova.notaMinima || 70);

    const resultado = await ProvaResultado.create({
      provaId: prova._id,
      provaTitulo: prova.titulo,

      usuarioId: req.usuario._id || null,
      usuarioNome: req.usuario.nome || "",
      usuarioEmail: req.usuario.email,

      respostas: respostasCorrigidas,

      totalPerguntas: prova.perguntas.length,
      acertos,
      erros,

      pontosObtidos,
      pontosTotais,

      nota,
      notaMinima: Number(prova.notaMinima || 70),

      aprovado,
      status: precisaAnaliseManual ? "em_analise" : aprovado ? "aprovado" : "reprovado",

      feedback: precisaAnaliseManual
        ? "Sua prova possui resposta textual e será analisada pela equipe."
        : "",

      iniciadoEm: req.body.iniciadoEm || hojeISO(),
      finalizadoEm: hojeISO()
    });

    return res.status(201).json({
      sucesso: true,
      mensagem: precisaAnaliseManual
        ? "Prova enviada para análise da equipe."
        : "Prova corrigida com sucesso.",
      resultado: formatarResultado(resultado)
    });
  } catch (error) {
    console.error("Erro ao responder prova:", error);

    return res.status(500).json({
      erro: "Erro interno ao responder prova."
    });
  }
});

/* ===============================
   MEUS RESULTADOS
   GET /minhas-provas
=============================== */

router.get("/minhas-provas", auth, async (req, res) => {
  try {
    const resultados = await ProvaResultado.find({
      usuarioEmail: req.usuario.email
    })
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({
      sucesso: true,
      total: resultados.length,
      resultados: resultados.map(formatarResultado)
    });
  } catch (error) {
    console.error("Erro ao buscar minhas provas:", error);

    return res.status(500).json({
      erro: "Erro interno ao buscar resultados."
    });
  }
});

/* ===============================
   RESUMO ADMIN
   GET /admin/provas/resumo
=============================== */

router.get("/admin/provas/resumo", auth, requirePermission("provas"), async (req, res) => {
  try {
    const [
      totalProvas,
      ativas,
      rascunhos,
      inativas,
      resultados,
      aprovados,
      reprovados,
      emAnalise
    ] = await Promise.all([
      Prova.countDocuments(),
      Prova.countDocuments({ status: "ativa" }),
      Prova.countDocuments({ status: "rascunho" }),
      Prova.countDocuments({ status: "inativa" }),
      ProvaResultado.countDocuments(),
      ProvaResultado.countDocuments({ status: "aprovado" }),
      ProvaResultado.countDocuments({ status: "reprovado" }),
      ProvaResultado.countDocuments({ status: "em_analise" })
    ]);

    return res.json({
      sucesso: true,
      resumo: {
        totalProvas,
        ativas,
        rascunhos,
        inativas,
        resultados,
        aprovados,
        reprovados,
        emAnalise
      }
    });
  } catch (error) {
    console.error("Erro no resumo de provas:", error);

    return res.status(500).json({
      erro: "Erro interno ao gerar resumo de provas."
    });
  }
});

/* ===============================
   LISTAR PROVAS ADMIN
   GET /admin/provas
=============================== */

router.get("/admin/provas", auth, requirePermission("provas"), async (req, res) => {
  try {
    const {
      busca = "",
      status = "",
      publico = "",
      categoria = "",
      dificuldade = "",
      limite = 300
    } = req.query;

    const filtro = {};

    if (busca) {
      const termo = String(busca).trim();

      filtro.$or = [
        { titulo: { $regex: termo, $options: "i" } },
        { descricao: { $regex: termo, $options: "i" } },
        { modulo: { $regex: termo, $options: "i" } }
      ];
    }

    if (status) filtro.status = normalizarStatus(status);
    if (publico) filtro.publico = normalizarPublico(publico);
    if (categoria) filtro.categoria = normalizarCategoria(categoria);
    if (dificuldade) filtro.dificuldade = normalizarDificuldade(dificuldade);

    const provas = await Prova.find(filtro)
      .sort({ createdAt: -1 })
      .limit(Number(limite) || 300);

    return res.json({
      sucesso: true,
      total: provas.length,
      provas: provas.map(formatarProvaAdmin)
    });
  } catch (error) {
    console.error("Erro ao listar provas admin:", error);

    return res.status(500).json({
      erro: "Erro interno ao listar provas."
    });
  }
});

/* ===============================
   CRIAR PROVA
   POST /admin/provas
=============================== */

router.post("/admin/provas", auth, requirePermission("provas"), async (req, res) => {
  try {
    const {
      titulo,
      descricao = "",
      modulo = "",
      categoria = "geral",
      dificuldade = "media",
      publico = "premium",
      status = "rascunho",
      notaMinima = 70,
      tentativasPermitidas = 3,
      tempoLimiteMinutos = 0,
      perguntas = []
    } = req.body;

    if (!titulo) {
      return res.status(400).json({
        erro: "O título da prova é obrigatório."
      });
    }

    const prova = await Prova.create({
      titulo: String(titulo).trim(),
      descricao,
      modulo,

      categoria: normalizarCategoria(categoria),
      dificuldade: normalizarDificuldade(dificuldade),
      publico: normalizarPublico(publico),
      status: normalizarStatus(status),

      notaMinima: Number(notaMinima || 70),
      tentativasPermitidas: Number(tentativasPermitidas || 3),
      tempoLimiteMinutos: Number(tempoLimiteMinutos || 0),

      perguntas: Array.isArray(perguntas) ? perguntas : [],

      criadaPor: req.usuario?.email || "",
      atualizadoPor: req.usuario?.email || ""
    });

    return res.status(201).json({
      sucesso: true,
      mensagem: "Prova criada com sucesso.",
      prova: formatarProvaAdmin(prova)
    });
  } catch (error) {
    console.error("Erro ao criar prova:", error);

    return res.status(500).json({
      erro: "Erro interno ao criar prova."
    });
  }
});

/* ===============================
   ATUALIZAR PROVA
   PUT /admin/provas/:id
=============================== */

router.put("/admin/provas/:id", auth, requirePermission("provas"), async (req, res) => {
  try {
    const prova = await buscarProvaPorId(req.params.id);

    if (!prova) {
      return res.status(404).json({
        erro: "Prova não encontrada."
      });
    }

    const camposSimples = [
      "titulo",
      "descricao",
      "modulo",
      "notaMinima",
      "tentativasPermitidas",
      "tempoLimiteMinutos",
      "perguntas"
    ];

    camposSimples.forEach((campo) => {
      if (req.body[campo] !== undefined) {
        prova[campo] = req.body[campo];
      }
    });

    if (req.body.categoria !== undefined) {
      prova.categoria = normalizarCategoria(req.body.categoria);
    }

    if (req.body.dificuldade !== undefined) {
      prova.dificuldade = normalizarDificuldade(req.body.dificuldade);
    }

    if (req.body.publico !== undefined) {
      prova.publico = normalizarPublico(req.body.publico);
    }

    if (req.body.status !== undefined) {
      prova.status = normalizarStatus(req.body.status);
    }

    prova.atualizadoPor = req.usuario?.email || "";

    await prova.save();

    return res.json({
      sucesso: true,
      mensagem: "Prova atualizada com sucesso.",
      prova: formatarProvaAdmin(prova)
    });
  } catch (error) {
    console.error("Erro ao atualizar prova:", error);

    return res.status(500).json({
      erro: "Erro interno ao atualizar prova."
    });
  }
});

/* ===============================
   ALTERAR STATUS DA PROVA
   POST /admin/provas/:id/status
=============================== */

router.post("/admin/provas/:id/status", auth, requirePermission("provas"), async (req, res) => {
  try {
    const prova = await buscarProvaPorId(req.params.id);

    if (!prova) {
      return res.status(404).json({
        erro: "Prova não encontrada."
      });
    }

    prova.status = normalizarStatus(req.body.status);
    prova.atualizadoPor = req.usuario?.email || "";

    await prova.save();

    return res.json({
      sucesso: true,
      mensagem: "Status da prova atualizado com sucesso.",
      prova: formatarProvaAdmin(prova)
    });
  } catch (error) {
    console.error("Erro ao alterar status da prova:", error);

    return res.status(500).json({
      erro: "Erro interno ao alterar status da prova."
    });
  }
});

/* ===============================
   EXCLUIR PROVA
   DELETE /admin/provas/:id
=============================== */

router.delete("/admin/provas/:id", auth, requirePermission("provas"), async (req, res) => {
  try {
    const prova = await buscarProvaPorId(req.params.id);

    if (!prova) {
      return res.status(404).json({
        erro: "Prova não encontrada."
      });
    }

    await Prova.deleteOne({ _id: prova._id });

    return res.json({
      sucesso: true,
      mensagem: "Prova removida com sucesso."
    });
  } catch (error) {
    console.error("Erro ao remover prova:", error);

    return res.status(500).json({
      erro: "Erro interno ao remover prova."
    });
  }
});

/* ===============================
   LISTAR RESULTADOS ADMIN
   GET /admin/provas/resultados
=============================== */

router.get(
  "/admin/provas/resultados",
  auth,
  requirePermission("provas"),
  async (req, res) => {
    try {
      const {
        busca = "",
        status = "",
        provaId = "",
        limite = 300
      } = req.query;

      const filtro = {};

      if (busca) {
        const termo = String(busca).trim();

        filtro.$or = [
          { usuarioNome: { $regex: termo, $options: "i" } },
          { usuarioEmail: { $regex: termo, $options: "i" } },
          { provaTitulo: { $regex: termo, $options: "i" } }
        ];
      }

      if (status) filtro.status = status;

      if (provaId && validarId(provaId)) {
        filtro.provaId = provaId;
      }

      const resultados = await ProvaResultado.find(filtro)
        .sort({ createdAt: -1 })
        .limit(Number(limite) || 300);

      return res.json({
        sucesso: true,
        total: resultados.length,
        resultados: resultados.map(formatarResultado)
      });
    } catch (error) {
      console.error("Erro ao listar resultados:", error);

      return res.status(500).json({
        erro: "Erro interno ao listar resultados."
      });
    }
  }
);

/* ===============================
   BUSCAR RESULTADO ADMIN
   GET /admin/provas/resultados/:id
=============================== */

router.get(
  "/admin/provas/resultados/:id",
  auth,
  requirePermission("provas"),
  async (req, res) => {
    try {
      const resultado = await buscarResultadoPorId(req.params.id);

      if (!resultado) {
        return res.status(404).json({
          erro: "Resultado não encontrado."
        });
      }

      return res.json({
        sucesso: true,
        resultado: formatarResultado(resultado)
      });
    } catch (error) {
      console.error("Erro ao buscar resultado:", error);

      return res.status(500).json({
        erro: "Erro interno ao buscar resultado."
      });
    }
  }
);

/* ===============================
   AVALIAR RESULTADO
   POST /admin/provas/resultados/:id/avaliar
=============================== */

router.post(
  "/admin/provas/resultados/:id/avaliar",
  auth,
  requirePermission("provas"),
  async (req, res) => {
    try {
      const resultado = await buscarResultadoPorId(req.params.id);

      if (!resultado) {
        return res.status(404).json({
          erro: "Resultado não encontrado."
        });
      }

      const {
        nota,
        aprovado,
        feedback = "",
        respostas = null
      } = req.body;

      if (respostas && Array.isArray(respostas)) {
        resultado.respostas = respostas;
      }

      if (nota !== undefined) {
        resultado.nota = Number(nota || 0);
      }

      if (aprovado !== undefined) {
        resultado.aprovado = Boolean(aprovado);
      } else {
        resultado.aprovado = Number(resultado.nota || 0) >= Number(resultado.notaMinima || 70);
      }

      resultado.status = resultado.aprovado ? "aprovado" : "reprovado";
      resultado.feedback = feedback;
      resultado.avaliadoPor = req.usuario?.email || "";
      resultado.avaliadoEm = hojeISO();

      await resultado.save();

      await notificarResultado(resultado);

      return res.json({
        sucesso: true,
        mensagem: "Resultado avaliado com sucesso.",
        resultado: formatarResultado(resultado)
      });
    } catch (error) {
      console.error("Erro ao avaliar resultado:", error);

      return res.status(500).json({
        erro: "Erro interno ao avaliar resultado."
      });
    }
  }
);

module.exports = router;
