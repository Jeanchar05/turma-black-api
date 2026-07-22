const express = require("express");
const mongoose = require("mongoose");

const Chamado = require("../models/Chamado");
const { auth } = require("../middleware/auth");
const { requireSuporte } = require("../middleware/permissions");

const router = express.Router();

const STATUS_VALIDOS = [
  "aberto",
  "em_atendimento",
  "respondido",
  "resolvido",
  "fechado"
];

const CATEGORIAS_VALIDAS = [
  "duvida",
  "acesso",
  "pagamento",
  "prova",
  "plataforma",
  "vendas",
  "bug",
  "outro"
];

const PRIORIDADES_VALIDAS = ["baixa", "normal", "alta", "urgente"];

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function limitarTexto(valor, limite) {
  return String(valor || "").trim().slice(0, limite);
}

function escaparRegex(valor) {
  return String(valor || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizarCategoria(valor) {
  const normalizado = normalizarTexto(valor).replace(/[\s_-]+/g, " ");

  if (CATEGORIAS_VALIDAS.includes(normalizado)) {
    return normalizado;
  }

  const aliases = {
    "problema tecnico": "bug",
    "duvida de conteudo": "duvida",
    "conta e acesso": "acesso",
    financeiro: "pagamento",
    geral: "outro"
  };

  return aliases[normalizado] || "outro";
}

function normalizarPrioridade(valor) {
  const normalizado = normalizarTexto(valor);

  if (normalizado === "media" || normalizado === "medio") {
    return "normal";
  }

  if (PRIORIDADES_VALIDAS.includes(normalizado)) {
    return normalizado;
  }

  return "normal";
}

function normalizarStatus(valor) {
  const normalizado = normalizarTexto(valor).replace(/[\s-]+/g, "_");

  if (normalizado === "analise" || normalizado === "em_analise") {
    return "em_atendimento";
  }

  return STATUS_VALIDOS.includes(normalizado) ? normalizado : "";
}

function formatarChamado(chamado) {
  if (!chamado) return null;

  const obj = chamado.toObject ? chamado.toObject() : chamado;
  const respostas = Array.isArray(obj.respostas) ? obj.respostas : [];
  const respostaEquipe = [...respostas]
    .reverse()
    .find((item) => item?.tipo === "equipe");

  return {
    id: String(obj._id || obj.id),
    _id: obj._id || obj.id,
    usuarioId: obj.usuarioId || null,
    nome: obj.nome || "",
    aluno: obj.nome || "",
    email: obj.email || "",
    assunto: obj.assunto || "",
    mensagem: obj.mensagem || "",
    categoria: obj.categoria || "outro",
    tipo: obj.categoria || "outro",
    prioridade: obj.prioridade || "normal",
    status: obj.status || "aberto",
    respostas,
    resposta: respostaEquipe?.mensagem || "",
    respondidoEm: respostaEquipe?.criadoEm || obj.ultimaRespostaEm || "",
    ultimaRespostaEm: obj.ultimaRespostaEm || "",
    encerradoEm: obj.encerradoEm || "",
    criadoEm: obj.createdAt || obj.criadoEm || "",
    createdAt: obj.createdAt || "",
    updatedAt: obj.updatedAt || ""
  };
}

function idValido(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

async function buscarChamado(id) {
  if (!idValido(id)) return null;
  return Chamado.findById(id);
}

/* ===============================
   ÁREA DO USUÁRIO
=============================== */

router.get("/suporte/status", (req, res) => {
  res.json({
    status: "online",
    modulo: "suporte",
    rotas: [
      "POST /suporte",
      "GET /meus-chamados",
      "GET /suporte/:id",
      "POST /suporte/:id/responder",
      "GET /admin/suporte/resumo",
      "GET /admin/suporte",
      "GET /admin/suporte/:id",
      "POST /admin/suporte/:id/responder",
      "POST /admin/suporte/:id/status"
    ]
  });
});

router.post("/suporte", auth, async (req, res) => {
  try {
    const assunto = limitarTexto(req.body.assunto, 160);
    const mensagem = limitarTexto(req.body.mensagem, 4000);

    if (!assunto || !mensagem) {
      return res.status(400).json({
        erro: "Assunto e mensagem são obrigatórios."
      });
    }

    const chamado = await Chamado.create({
      usuarioId: idValido(req.usuario.id) ? req.usuario.id : null,
      nome: limitarTexto(req.usuario.nome || req.body.aluno, 120),
      email: String(req.usuario.email || "").toLowerCase().trim(),
      assunto,
      mensagem,
      categoria: normalizarCategoria(req.body.categoria || req.body.tipo),
      prioridade: normalizarPrioridade(req.body.prioridade),
      status: "aberto",
      criadoPor: req.usuario.email || ""
    });

    return res.status(201).json({
      sucesso: true,
      mensagem: "Chamado aberto com sucesso.",
      chamado: formatarChamado(chamado)
    });
  } catch (error) {
    console.error("Erro ao abrir chamado:", error);

    return res.status(500).json({
      erro: "Erro interno ao abrir chamado."
    });
  }
});

router.get("/meus-chamados", auth, async (req, res) => {
  try {
    const filtros = [{ email: req.usuario.email }];

    if (idValido(req.usuario.id)) {
      filtros.push({ usuarioId: req.usuario.id });
    }

    const chamados = await Chamado.find({ $or: filtros })
      .sort({ createdAt: -1 })
      .limit(200);

    return res.json({
      sucesso: true,
      total: chamados.length,
      chamados: chamados.map(formatarChamado)
    });
  } catch (error) {
    console.error("Erro ao listar chamados do usuário:", error);

    return res.status(500).json({
      erro: "Erro interno ao listar chamados."
    });
  }
});

router.get("/suporte/:id", auth, async (req, res) => {
  try {
    const chamado = await buscarChamado(req.params.id);

    if (!chamado) {
      return res.status(404).json({ erro: "Chamado não encontrado." });
    }

    const pertenceAoUsuario =
      String(chamado.usuarioId || "") === String(req.usuario.id || "") ||
      chamado.email === req.usuario.email;

    if (!pertenceAoUsuario) {
      return res.status(403).json({
        erro: "Você não tem acesso a este chamado."
      });
    }

    return res.json({
      sucesso: true,
      chamado: formatarChamado(chamado)
    });
  } catch (error) {
    console.error("Erro ao buscar chamado:", error);

    return res.status(500).json({
      erro: "Erro interno ao buscar chamado."
    });
  }
});

router.post("/suporte/:id/responder", auth, async (req, res) => {
  try {
    const chamado = await buscarChamado(req.params.id);
    const mensagem = limitarTexto(req.body.mensagem, 4000);

    if (!chamado) {
      return res.status(404).json({ erro: "Chamado não encontrado." });
    }

    const pertenceAoUsuario =
      String(chamado.usuarioId || "") === String(req.usuario.id || "") ||
      chamado.email === req.usuario.email;

    if (!pertenceAoUsuario) {
      return res.status(403).json({
        erro: "Você não tem acesso a este chamado."
      });
    }

    if (!mensagem) {
      return res.status(400).json({ erro: "Digite uma mensagem." });
    }

    if (chamado.status === "fechado") {
      return res.status(409).json({
        erro: "Este chamado já está fechado."
      });
    }

    await chamado.adicionarResposta({
      autorNome: req.usuario.nome,
      autorEmail: req.usuario.email,
      autorCargo: req.usuario.cargo,
      mensagem,
      tipo: "usuario"
    });

    return res.json({
      sucesso: true,
      mensagem: "Resposta enviada com sucesso.",
      chamado: formatarChamado(chamado)
    });
  } catch (error) {
    console.error("Erro ao responder chamado:", error);

    return res.status(500).json({
      erro: "Erro interno ao responder chamado."
    });
  }
});

/* ===============================
   ÁREA ADMINISTRATIVA
=============================== */

router.get("/admin/suporte/resumo", auth, requireSuporte, async (req, res) => {
  try {
    const [
      total,
      abertos,
      emAtendimento,
      respondidos,
      resolvidos,
      fechados,
      urgentes
    ] = await Promise.all([
      Chamado.countDocuments(),
      Chamado.countDocuments({ status: "aberto" }),
      Chamado.countDocuments({ status: "em_atendimento" }),
      Chamado.countDocuments({ status: "respondido" }),
      Chamado.countDocuments({ status: "resolvido" }),
      Chamado.countDocuments({ status: "fechado" }),
      Chamado.countDocuments({ prioridade: "urgente" })
    ]);

    return res.json({
      sucesso: true,
      resumo: {
        total,
        abertos,
        emAtendimento,
        respondidos,
        resolvidos,
        fechados,
        urgentes
      }
    });
  } catch (error) {
    console.error("Erro ao gerar resumo de suporte:", error);

    return res.status(500).json({
      erro: "Erro interno ao gerar resumo de suporte."
    });
  }
});

router.get("/admin/suporte", auth, requireSuporte, async (req, res) => {
  try {
    const {
      busca = "",
      status = "",
      prioridade = "",
      categoria = "",
      limite = 300
    } = req.query;

    const filtro = {};

    if (busca) {
      const termo = escaparRegex(limitarTexto(busca, 120));

      filtro.$or = [
        { nome: { $regex: termo, $options: "i" } },
        { email: { $regex: termo, $options: "i" } },
        { assunto: { $regex: termo, $options: "i" } },
        { mensagem: { $regex: termo, $options: "i" } }
      ];
    }

    if (status) {
      const statusFinal = normalizarStatus(status);
      if (statusFinal) filtro.status = statusFinal;
    }

    if (prioridade) {
      filtro.prioridade = normalizarPrioridade(prioridade);
    }

    if (categoria) {
      filtro.categoria = normalizarCategoria(categoria);
    }

    const limiteFinal = Math.min(Math.max(Number(limite) || 300, 1), 500);

    const chamados = await Chamado.find(filtro)
      .sort({ createdAt: -1 })
      .limit(limiteFinal);

    return res.json({
      sucesso: true,
      total: chamados.length,
      chamados: chamados.map(formatarChamado)
    });
  } catch (error) {
    console.error("Erro ao listar suporte admin:", error);

    return res.status(500).json({
      erro: "Erro interno ao listar chamados."
    });
  }
});

router.get("/admin/suporte/:id", auth, requireSuporte, async (req, res) => {
  try {
    const chamado = await buscarChamado(req.params.id);

    if (!chamado) {
      return res.status(404).json({ erro: "Chamado não encontrado." });
    }

    return res.json({
      sucesso: true,
      chamado: formatarChamado(chamado)
    });
  } catch (error) {
    console.error("Erro ao buscar chamado no admin:", error);

    return res.status(500).json({
      erro: "Erro interno ao buscar chamado."
    });
  }
});

router.post(
  "/admin/suporte/:id/responder",
  auth,
  requireSuporte,
  async (req, res) => {
    try {
      const chamado = await buscarChamado(req.params.id);
      const mensagem = limitarTexto(req.body.mensagem, 4000);
      const status = normalizarStatus(req.body.status);

      if (!chamado) {
        return res.status(404).json({ erro: "Chamado não encontrado." });
      }

      if (!mensagem) {
        return res.status(400).json({ erro: "Digite uma resposta." });
      }

      await chamado.adicionarResposta({
        autorNome: req.usuario.nome,
        autorEmail: req.usuario.email,
        autorCargo: req.usuario.cargo,
        mensagem,
        tipo: "equipe"
      });

      if (status && status !== chamado.status) {
        await chamado.alterarStatus(status, req.usuario.email);
      }

      return res.json({
        sucesso: true,
        mensagem: "Resposta enviada com sucesso.",
        chamado: formatarChamado(chamado)
      });
    } catch (error) {
      console.error("Erro ao responder suporte no admin:", error);

      return res.status(500).json({
        erro: "Erro interno ao responder chamado."
      });
    }
  }
);

router.post(
  "/admin/suporte/:id/status",
  auth,
  requireSuporte,
  async (req, res) => {
    try {
      const chamado = await buscarChamado(req.params.id);
      const status = normalizarStatus(req.body.status);

      if (!chamado) {
        return res.status(404).json({ erro: "Chamado não encontrado." });
      }

      if (!status) {
        return res.status(400).json({ erro: "Status inválido." });
      }

      await chamado.alterarStatus(status, req.usuario.email);

      return res.json({
        sucesso: true,
        mensagem: "Status atualizado com sucesso.",
        chamado: formatarChamado(chamado)
      });
    } catch (error) {
      console.error("Erro ao atualizar status do suporte:", error);

      return res.status(500).json({
        erro: "Erro interno ao atualizar status."
      });
    }
  }
);

module.exports = router;
