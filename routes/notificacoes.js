const express = require("express");
const mongoose = require("mongoose");

const Notificacao = require("../models/Notificacao");

const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

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

function normalizarEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function normalizarTipo(tipo) {
  const valor = String(tipo || "").toLowerCase().trim();

  const permitidos = [
    "geral",
    "atualizacao",
    "manutencao",
    "premium",
    "seguranca",
    "venda",
    "plano",
    "agenda",
    "prova",
    "suporte"
  ];

  if (permitidos.includes(valor)) return valor;

  return "geral";
}

function normalizarDestino(destino) {
  const valor = String(destino || "").toLowerCase().trim();

  const permitidos = [
    "todos",
    "premium",
    "free",
    "admin",
    "vendedores",
    "suporte",
    "moderadores",
    "superadmin",
    "especifico"
  ];

  if (permitidos.includes(valor)) return valor;

  return "todos";
}

function normalizarPrioridade(prioridade) {
  const valor = String(prioridade || "").toLowerCase().trim();

  const permitidos = ["baixa", "normal", "alta", "urgente"];

  if (permitidos.includes(valor)) return valor;

  return "normal";
}

function destinosDoUsuario(usuario) {
  const destinos = ["todos"];

  if (!usuario) return destinos;

  if (usuario.plano === "free") {
    destinos.push("free");
  } else {
    destinos.push("premium");
  }

  if (usuario.cargo === "superadmin") {
    destinos.push("superadmin");
    destinos.push("admin");
  }

  if (usuario.cargo === "admin") {
    destinos.push("admin");
  }

  if (usuario.cargo === "moderador") {
    destinos.push("moderadores");
  }

  if (usuario.cargo === "suporte") {
    destinos.push("suporte");
  }

  if (usuario.vendedor || usuario.cargo === "vendedor") {
    destinos.push("vendedores");
  }

  return destinos;
}

function notificacaoExpirada(notificacao) {
  if (!notificacao.expiraEm) return false;

  return String(notificacao.expiraEm) < hojeISO();
}

function usuarioJaLeu(notificacao, usuario) {
  if (!notificacao || !usuario) return false;

  const email = normalizarEmail(usuario.email);
  const id = String(usuario.id || usuario._id || "");

  return Boolean(
    notificacao.lidaPor?.some((item) => {
      if (email && item.email === email) return true;
      if (id && String(item.usuarioId) === id) return true;
      return false;
    })
  );
}

function formatarNotificacao(notificacao, usuario = null) {
  if (!notificacao) return null;

  const obj = notificacao.toObject ? notificacao.toObject() : notificacao;

  return {
    id: String(obj._id || obj.id),
    _id: obj._id,

    titulo: obj.titulo || "",
    mensagem: obj.mensagem || "",

    tipo: obj.tipo || "geral",
    destino: obj.destino || "todos",
    email: obj.email || "",
    usuarioId: obj.usuarioId || null,

    prioridade: obj.prioridade || "normal",
    link: obj.link || "",
    icone: obj.icone || "🔔",

    ativa: Boolean(obj.ativa),
    fixada: Boolean(obj.fixada),
    expiraEm: obj.expiraEm || "",

    lida: usuario ? usuarioJaLeu(obj, usuario) : false,
    totalLidas: Array.isArray(obj.lidaPor) ? obj.lidaPor.length : 0,

    enviadaPor: obj.enviadaPor || "",
    criadoPor: obj.criadoPor || "",
    atualizadoPor: obj.atualizadoPor || "",

    createdAt: obj.createdAt || "",
    updatedAt: obj.updatedAt || ""
  };
}

async function buscarNotificacaoPorId(id) {
  if (!validarId(id)) {
    return null;
  }

  return Notificacao.findById(id);
}

/* ===============================
   MINHAS NOTIFICAÇÕES
   GET /minhas-notificacoes
   GET /notificacoes/minhas
=============================== */

async function minhasNotificacoes(req, res) {
  try {
    const usuario = req.usuario;
    const destinos = destinosDoUsuario(usuario);

    const filtro = {
      ativa: true,
      $and: [
        {
          $or: [
            { expiraEm: "" },
            { expiraEm: { $gte: hojeISO() } }
          ]
        },
        {
          $or: [
            { destino: { $in: destinos } },
            { destino: "especifico", email: usuario.email },
            { usuarioId: usuario._id }
          ]
        }
      ]
    };

    const notificacoes = await Notificacao.find(filtro)
      .sort({ fixada: -1, createdAt: -1 })
      .limit(50);

    const formatadas = notificacoes.map((item) => {
      return formatarNotificacao(item, usuario);
    });

    const naoLidas = formatadas.filter((item) => !item.lida).length;

    return res.json({
      sucesso: true,
      total: formatadas.length,
      naoLidas,
      notificacoes: formatadas
    });
  } catch (error) {
    console.error("Erro ao buscar minhas notificações:", error);

    return res.status(500).json({
      erro: "Erro interno ao buscar notificações."
    });
  }
}

router.get("/minhas-notificacoes", auth, minhasNotificacoes);
router.get("/notificacoes/minhas", auth, minhasNotificacoes);

/* ===============================
   MARCAR COMO LIDA
   POST /notificacoes/:id/lida
   POST /minhas-notificacoes/:id/lida
=============================== */

async function marcarComoLida(req, res) {
  try {
    const notificacao = await buscarNotificacaoPorId(req.params.id);

    if (!notificacao) {
      return res.status(404).json({
        erro: "Notificação não encontrada."
      });
    }

    if (!notificacao.ativa) {
      return res.status(400).json({
        erro: "Esta notificação está desativada."
      });
    }

    if (notificacaoExpirada(notificacao)) {
      return res.status(400).json({
        erro: "Esta notificação expirou."
      });
    }

    await notificacao.marcarComoLida(req.usuario);

    return res.json({
      sucesso: true,
      mensagem: "Notificação marcada como lida.",
      notificacao: formatarNotificacao(notificacao, req.usuario)
    });
  } catch (error) {
    console.error("Erro ao marcar notificação como lida:", error);

    return res.status(500).json({
      erro: "Erro interno ao marcar notificação como lida."
    });
  }
}

router.post("/notificacoes/:id/lida", auth, marcarComoLida);
router.post("/minhas-notificacoes/:id/lida", auth, marcarComoLida);

/* ===============================
   MARCAR TODAS COMO LIDAS
   POST /notificacoes/marcar-todas-lidas
=============================== */

router.post("/notificacoes/marcar-todas-lidas", auth, async (req, res) => {
  try {
    const usuario = req.usuario;
    const destinos = destinosDoUsuario(usuario);

    const notificacoes = await Notificacao.find({
      ativa: true,
      $and: [
        {
          $or: [
            { expiraEm: "" },
            { expiraEm: { $gte: hojeISO() } }
          ]
        },
        {
          $or: [
            { destino: { $in: destinos } },
            { destino: "especifico", email: usuario.email },
            { usuarioId: usuario._id }
          ]
        },
        {
          "lidaPor.email": { $ne: usuario.email }
        }
      ]
    });

    for (const notificacao of notificacoes) {
      await notificacao.marcarComoLida(usuario);
    }

    return res.json({
      sucesso: true,
      mensagem: "Todas as notificações foram marcadas como lidas.",
      total: notificacoes.length
    });
  } catch (error) {
    console.error("Erro ao marcar todas como lidas:", error);

    return res.status(500).json({
      erro: "Erro interno ao marcar notificações como lidas."
    });
  }
});

/* ===============================
   RESUMO ADMIN
   GET /admin/notificacoes/resumo
=============================== */

router.get(
  "/admin/notificacoes/resumo",
  auth,
  requirePermission("notificacoes"),
  async (req, res) => {
    try {
      const [
        total,
        ativas,
        inativas,
        fixadas,
        expiradas,
        gerais,
        especificas,
        urgentes
      ] = await Promise.all([
        Notificacao.countDocuments(),
        Notificacao.countDocuments({ ativa: true }),
        Notificacao.countDocuments({ ativa: false }),
        Notificacao.countDocuments({ fixada: true }),
        Notificacao.countDocuments({
          expiraEm: { $ne: "", $lt: hojeISO() }
        }),
        Notificacao.countDocuments({ destino: "todos" }),
        Notificacao.countDocuments({ destino: "especifico" }),
        Notificacao.countDocuments({ prioridade: "urgente" })
      ]);

      return res.json({
        sucesso: true,
        resumo: {
          total,
          ativas,
          inativas,
          fixadas,
          expiradas,
          gerais,
          especificas,
          urgentes
        }
      });
    } catch (error) {
      console.error("Erro no resumo de notificações:", error);

      return res.status(500).json({
        erro: "Erro interno ao gerar resumo de notificações."
      });
    }
  }
);

/* ===============================
   LISTAR ADMIN
   GET /admin/notificacoes
=============================== */

router.get(
  "/admin/notificacoes",
  auth,
  requirePermission("notificacoes"),
  async (req, res) => {
    try {
      const {
        busca = "",
        tipo = "",
        destino = "",
        prioridade = "",
        ativa = "",
        fixada = "",
        limite = 300
      } = req.query;

      const filtro = {};

      if (busca) {
        const termo = String(busca).trim();

        filtro.$or = [
          { titulo: { $regex: termo, $options: "i" } },
          { mensagem: { $regex: termo, $options: "i" } },
          { email: { $regex: termo, $options: "i" } },
          { enviadaPor: { $regex: termo, $options: "i" } }
        ];
      }

      if (tipo) {
        filtro.tipo = normalizarTipo(tipo);
      }

      if (destino) {
        filtro.destino = normalizarDestino(destino);
      }

      if (prioridade) {
        filtro.prioridade = normalizarPrioridade(prioridade);
      }

      if (ativa === "true") filtro.ativa = true;
      if (ativa === "false") filtro.ativa = false;

      if (fixada === "true") filtro.fixada = true;
      if (fixada === "false") filtro.fixada = false;

      const notificacoes = await Notificacao.find(filtro)
        .sort({ fixada: -1, createdAt: -1 })
        .limit(Number(limite) || 300);

      return res.json({
        sucesso: true,
        total: notificacoes.length,
        notificacoes: notificacoes.map((item) => formatarNotificacao(item))
      });
    } catch (error) {
      console.error("Erro ao listar notificações:", error);

      return res.status(500).json({
        erro: "Erro interno ao listar notificações."
      });
    }
  }
);

/* ===============================
   BUSCAR UMA NOTIFICAÇÃO
   GET /admin/notificacoes/:id
=============================== */

router.get(
  "/admin/notificacoes/:id",
  auth,
  requirePermission("notificacoes"),
  async (req, res) => {
    try {
      const notificacao = await buscarNotificacaoPorId(req.params.id);

      if (!notificacao) {
        return res.status(404).json({
          erro: "Notificação não encontrada."
        });
      }

      return res.json({
        sucesso: true,
        notificacao: formatarNotificacao(notificacao)
      });
    } catch (error) {
      console.error("Erro ao buscar notificação:", error);

      return res.status(500).json({
        erro: "Erro interno ao buscar notificação."
      });
    }
  }
);

/* ===============================
   CRIAR NOTIFICAÇÃO
   POST /admin/notificacoes
=============================== */

router.post(
  "/admin/notificacoes",
  auth,
  requirePermission("notificacoes"),
  async (req, res) => {
    try {
      const {
        titulo,
        mensagem,
        tipo = "geral",
        destino = "todos",
        email = "",
        usuarioId = null,
        prioridade = "normal",
        link = "",
        icone = "🔔",
        fixada = false,
        expiraEm = ""
      } = req.body;

      if (!titulo || !mensagem) {
        return res.status(400).json({
          erro: "Título e mensagem são obrigatórios."
        });
      }

      const destinoFinal = normalizarDestino(destino);
      const emailFinal = normalizarEmail(email);

      if (destinoFinal === "especifico" && !emailFinal && !usuarioId) {
        return res.status(400).json({
          erro: "Para notificação específica, informe o e-mail ou ID do usuário."
        });
      }

      const notificacao = await Notificacao.create({
        titulo: String(titulo).trim(),
        mensagem: String(mensagem).trim(),

        tipo: normalizarTipo(tipo),
        destino: destinoFinal,

        email: emailFinal,
        usuarioId: usuarioId && validarId(usuarioId) ? usuarioId : null,

        prioridade: normalizarPrioridade(prioridade),
        link,
        icone: icone || "🔔",

        ativa: true,
        fixada: Boolean(fixada),
        expiraEm,

        enviadaPor: req.usuario?.email || "",
        criadoPor: req.usuario?.email || "",
        atualizadoPor: req.usuario?.email || ""
      });

      return res.status(201).json({
        sucesso: true,
        mensagem: "Notificação criada com sucesso.",
        notificacao: formatarNotificacao(notificacao)
      });
    } catch (error) {
      console.error("Erro ao criar notificação:", error);

      return res.status(500).json({
        erro: "Erro interno ao criar notificação."
      });
    }
  }
);

/* ===============================
   ATUALIZAR NOTIFICAÇÃO
   PUT /admin/notificacoes/:id
=============================== */

router.put(
  "/admin/notificacoes/:id",
  auth,
  requirePermission("notificacoes"),
  async (req, res) => {
    try {
      const notificacao = await buscarNotificacaoPorId(req.params.id);

      if (!notificacao) {
        return res.status(404).json({
          erro: "Notificação não encontrada."
        });
      }

      const camposSimples = [
        "titulo",
        "mensagem",
        "link",
        "icone",
        "ativa",
        "fixada",
        "expiraEm"
      ];

      camposSimples.forEach((campo) => {
        if (req.body[campo] !== undefined) {
          notificacao[campo] = req.body[campo];
        }
      });

      if (req.body.tipo !== undefined) {
        notificacao.tipo = normalizarTipo(req.body.tipo);
      }

      if (req.body.destino !== undefined) {
        notificacao.destino = normalizarDestino(req.body.destino);
      }

      if (req.body.prioridade !== undefined) {
        notificacao.prioridade = normalizarPrioridade(req.body.prioridade);
      }

      if (req.body.email !== undefined) {
        notificacao.email = normalizarEmail(req.body.email);
      }

      if (req.body.usuarioId !== undefined) {
        notificacao.usuarioId =
          req.body.usuarioId && validarId(req.body.usuarioId)
            ? req.body.usuarioId
            : null;
      }

      notificacao.atualizadoPor = req.usuario?.email || "";

      await notificacao.save();

      return res.json({
        sucesso: true,
        mensagem: "Notificação atualizada com sucesso.",
        notificacao: formatarNotificacao(notificacao)
      });
    } catch (error) {
      console.error("Erro ao atualizar notificação:", error);

      return res.status(500).json({
        erro: "Erro interno ao atualizar notificação."
      });
    }
  }
);

/* ===============================
   ATIVAR / DESATIVAR
   POST /admin/notificacoes/:id/status
=============================== */

router.post(
  "/admin/notificacoes/:id/status",
  auth,
  requirePermission("notificacoes"),
  async (req, res) => {
    try {
      const notificacao = await buscarNotificacaoPorId(req.params.id);

      if (!notificacao) {
        return res.status(404).json({
          erro: "Notificação não encontrada."
        });
      }

      const { ativa } = req.body;

      notificacao.ativa = Boolean(ativa);
      notificacao.atualizadoPor = req.usuario?.email || "";

      await notificacao.save();

      return res.json({
        sucesso: true,
        mensagem: notificacao.ativa
          ? "Notificação ativada com sucesso."
          : "Notificação desativada com sucesso.",
        notificacao: formatarNotificacao(notificacao)
      });
    } catch (error) {
      console.error("Erro ao alterar status da notificação:", error);

      return res.status(500).json({
        erro: "Erro interno ao alterar status da notificação."
      });
    }
  }
);

router.post(
  "/admin/notificacoes/:id/desativar",
  auth,
  requirePermission("notificacoes"),
  async (req, res) => {
    try {
      const notificacao = await buscarNotificacaoPorId(req.params.id);

      if (!notificacao) {
        return res.status(404).json({
          erro: "Notificação não encontrada."
        });
      }

      notificacao.ativa = false;
      notificacao.atualizadoPor = req.usuario?.email || "";

      await notificacao.save();

      return res.json({
        sucesso: true,
        mensagem: "Notificação desativada com sucesso.",
        notificacao: formatarNotificacao(notificacao)
      });
    } catch (error) {
      console.error("Erro ao desativar notificação:", error);

      return res.status(500).json({
        erro: "Erro interno ao desativar notificação."
      });
    }
  }
);

/* ===============================
   FIXAR / DESFIXAR
=============================== */

router.post(
  "/admin/notificacoes/:id/fixar",
  auth,
  requirePermission("notificacoes"),
  async (req, res) => {
    try {
      const notificacao = await buscarNotificacaoPorId(req.params.id);

      if (!notificacao) {
        return res.status(404).json({
          erro: "Notificação não encontrada."
        });
      }

      notificacao.fixada = true;
      notificacao.atualizadoPor = req.usuario?.email || "";

      await notificacao.save();

      return res.json({
        sucesso: true,
        mensagem: "Notificação fixada com sucesso.",
        notificacao: formatarNotificacao(notificacao)
      });
    } catch (error) {
      console.error("Erro ao fixar notificação:", error);

      return res.status(500).json({
        erro: "Erro interno ao fixar notificação."
      });
    }
  }
);

router.post(
  "/admin/notificacoes/:id/desfixar",
  auth,
  requirePermission("notificacoes"),
  async (req, res) => {
    try {
      const notificacao = await buscarNotificacaoPorId(req.params.id);

      if (!notificacao) {
        return res.status(404).json({
          erro: "Notificação não encontrada."
        });
      }

      notificacao.fixada = false;
      notificacao.atualizadoPor = req.usuario?.email || "";

      await notificacao.save();

      return res.json({
        sucesso: true,
        mensagem: "Notificação desfixada com sucesso.",
        notificacao: formatarNotificacao(notificacao)
      });
    } catch (error) {
      console.error("Erro ao desfixar notificação:", error);

      return res.status(500).json({
        erro: "Erro interno ao desfixar notificação."
      });
    }
  }
);

/* ===============================
   REENVIAR NOTIFICAÇÃO
   POST /admin/notificacoes/:id/reenviar
=============================== */

router.post(
  "/admin/notificacoes/:id/reenviar",
  auth,
  requirePermission("notificacoes"),
  async (req, res) => {
    try {
      const original = await buscarNotificacaoPorId(req.params.id);

      if (!original) {
        return res.status(404).json({
          erro: "Notificação não encontrada."
        });
      }

      const nova = await Notificacao.create({
        titulo: original.titulo,
        mensagem: original.mensagem,
        tipo: original.tipo,
        destino: original.destino,
        email: original.email,
        usuarioId: original.usuarioId,
        prioridade: original.prioridade,
        link: original.link,
        icone: original.icone,
        ativa: true,
        fixada: original.fixada,
        expiraEm: original.expiraEm,

        enviadaPor: req.usuario?.email || "",
        criadoPor: req.usuario?.email || "",
        atualizadoPor: req.usuario?.email || ""
      });

      return res.status(201).json({
        sucesso: true,
        mensagem: "Notificação reenviada com sucesso.",
        notificacao: formatarNotificacao(nova)
      });
    } catch (error) {
      console.error("Erro ao reenviar notificação:", error);

      return res.status(500).json({
        erro: "Erro interno ao reenviar notificação."
      });
    }
  }
);

/* ===============================
   EXCLUIR NOTIFICAÇÃO
   DELETE /admin/notificacoes/:id
=============================== */

router.delete(
  "/admin/notificacoes/:id",
  auth,
  requirePermission("notificacoes"),
  async (req, res) => {
    try {
      const notificacao = await buscarNotificacaoPorId(req.params.id);

      if (!notificacao) {
        return res.status(404).json({
          erro: "Notificação não encontrada."
        });
      }

      await Notificacao.deleteOne({ _id: notificacao._id });

      return res.json({
        sucesso: true,
        mensagem: "Notificação removida com sucesso."
      });
    } catch (error) {
      console.error("Erro ao remover notificação:", error);

      return res.status(500).json({
        erro: "Erro interno ao remover notificação."
      });
    }
  }
);

/* ===============================
   STATUS DO MÓDULO
=============================== */

router.get("/notificacoes/status", (req, res) => {
  res.json({
    status: "online",
    modulo: "notificacoes",
    rotas: [
      "GET /minhas-notificacoes",
      "GET /notificacoes/minhas",
      "POST /notificacoes/:id/lida",
      "POST /notificacoes/marcar-todas-lidas",
      "GET /admin/notificacoes",
      "GET /admin/notificacoes/resumo",
      "GET /admin/notificacoes/:id",
      "POST /admin/notificacoes",
      "PUT /admin/notificacoes/:id",
      "POST /admin/notificacoes/:id/status",
      "POST /admin/notificacoes/:id/desativar",
      "POST /admin/notificacoes/:id/fixar",
      "POST /admin/notificacoes/:id/desfixar",
      "POST /admin/notificacoes/:id/reenviar",
      "DELETE /admin/notificacoes/:id"
    ]
  });
});

module.exports = router;
