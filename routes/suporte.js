const express = require("express");
const mongoose = require("mongoose");

const Chamado = require("../models/Chamado");
const Notificacao = require("../models/Notificacao");

const { auth } = require("../middleware/auth");
const { requirePermission, getCargo } = require("../middleware/permissions");

const router = express.Router();

const STATUS_VALIDOS = ["aberto", "em_atendimento", "respondido", "resolvido", "fechado"];
const PRIORIDADES_VALIDAS = ["baixa", "normal", "alta", "urgente"];
const CATEGORIAS_VALIDAS = ["duvida", "acesso", "pagamento", "prova", "plataforma", "vendas", "bug", "outro"];

function validarId(id) {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
}

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizarStatus(status) {
  const valor = String(status || "").trim().toLowerCase();
  return STATUS_VALIDOS.includes(valor) ? valor : "aberto";
}

function normalizarPrioridade(prioridade) {
  const valor = String(prioridade || "").trim().toLowerCase();
  return PRIORIDADES_VALIDAS.includes(valor) ? valor : "normal";
}

function normalizarCategoria(categoria) {
  const valor = String(categoria || "").trim().toLowerCase();
  return CATEGORIAS_VALIDAS.includes(valor) ? valor : "duvida";
}

function formatarChamado(chamado) {
  const obj = chamado?.toObject ? chamado.toObject() : chamado;
  if (!obj) return null;

  return {
    id: String(obj._id || obj.id),
    _id: obj._id,
    usuarioId: obj.usuarioId || null,
    nome: obj.nome || "",
    email: obj.email || "",
    assunto: obj.assunto || "",
    mensagem: obj.mensagem || "",
    categoria: obj.categoria || "duvida",
    prioridade: obj.prioridade || "normal",
    status: obj.status || "aberto",
    respostas: Array.isArray(obj.respostas) ? obj.respostas : [],
    ultimaRespostaEm: obj.ultimaRespostaEm || "",
    encerradoEm: obj.encerradoEm || "",
    criadoPor: obj.criadoPor || "",
    atualizadoPor: obj.atualizadoPor || "",
    createdAt: obj.createdAt || "",
    updatedAt: obj.updatedAt || ""
  };
}

async function buscarChamado(id) {
  if (!validarId(id)) return null;
  return Chamado.findById(id);
}

async function notificarUsuario(chamado, mensagem) {
  try {
    await Notificacao.create({
      titulo: `Atualização no chamado: ${chamado.assunto}`,
      mensagem,
      tipo: "suporte",
      destino: "especifico",
      email: chamado.email,
      usuarioId: chamado.usuarioId || null,
      prioridade: chamado.prioridade === "urgente" ? "alta" : "normal",
      icone: "💬",
      link: "/suporte",
      ativa: true,
      enviadaPor: "equipe-suporte",
      criadoPor: "equipe-suporte"
    });
  } catch (error) {
    console.error("Falha ao notificar resposta do suporte:", error.message);
  }
}

router.get("/suporte/status", (req, res) => {
  res.json({ status: "online", modulo: "suporte" });
});

router.post("/suporte", auth, async (req, res) => {
  try {
    const assunto = String(req.body?.assunto || "").trim();
    const mensagem = String(req.body?.mensagem || "").trim();

    if (!assunto || !mensagem) {
      return res.status(400).json({ erro: "Assunto e mensagem são obrigatórios." });
    }

    const chamado = await Chamado.create({
      usuarioId: req.usuarioDoc?._id || null,
      nome: req.usuario?.nome || "",
      email: normalizarEmail(req.usuario?.email),
      assunto,
      mensagem,
      categoria: normalizarCategoria(req.body?.categoria),
      prioridade: normalizarPrioridade(req.body?.prioridade),
      status: "aberto",
      criadoPor: req.usuario?.email || "",
      atualizadoPor: req.usuario?.email || ""
    });

    return res.status(201).json({
      sucesso: true,
      mensagem: "Chamado aberto com sucesso.",
      chamado: formatarChamado(chamado)
    });
  } catch (error) {
    console.error("Erro ao abrir chamado:", error);
    return res.status(500).json({ erro: "Erro interno ao abrir chamado." });
  }
});

router.get("/meus-chamados", auth, async (req, res) => {
  try {
    const chamados = await Chamado.find({ email: normalizarEmail(req.usuario.email) })
      .sort({ updatedAt: -1 })
      .limit(100);

    return res.json({
      sucesso: true,
      total: chamados.length,
      chamados: chamados.map(formatarChamado)
    });
  } catch (error) {
    console.error("Erro ao listar chamados do usuário:", error);
    return res.status(500).json({ erro: "Erro interno ao listar chamados." });
  }
});

router.get("/suporte/:id", auth, async (req, res) => {
  try {
    const chamado = await buscarChamado(req.params.id);
    if (!chamado) return res.status(404).json({ erro: "Chamado não encontrado." });

    const cargo = getCargo(req.usuarioDoc || req.usuario);
    const equipe = ["dev", "dono", "superadmin", "admin", "suporte"].includes(cargo);

    if (!equipe && normalizarEmail(chamado.email) !== normalizarEmail(req.usuario.email)) {
      return res.status(403).json({ erro: "Você não pode visualizar este chamado." });
    }

    return res.json({ sucesso: true, chamado: formatarChamado(chamado) });
  } catch (error) {
    console.error("Erro ao buscar chamado:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar chamado." });
  }
});

router.post("/suporte/:id/responder", auth, async (req, res) => {
  try {
    const chamado = await buscarChamado(req.params.id);
    if (!chamado) return res.status(404).json({ erro: "Chamado não encontrado." });

    if (normalizarEmail(chamado.email) !== normalizarEmail(req.usuario.email)) {
      return res.status(403).json({ erro: "Você não pode responder este chamado." });
    }

    const mensagem = String(req.body?.mensagem || "").trim();
    if (!mensagem) return res.status(400).json({ erro: "Digite uma resposta." });

    await chamado.adicionarResposta({
      autorNome: req.usuario.nome || "",
      autorEmail: req.usuario.email,
      autorCargo: getCargo(req.usuarioDoc || req.usuario),
      mensagem,
      tipo: "usuario"
    });

    return res.json({ sucesso: true, mensagem: "Resposta enviada.", chamado: formatarChamado(chamado) });
  } catch (error) {
    console.error("Erro ao responder chamado:", error);
    return res.status(500).json({ erro: "Erro interno ao responder chamado." });
  }
});

router.get("/admin/suporte/resumo", auth, requirePermission("suporte"), async (req, res) => {
  try {
    const [total, abertos, atendimento, respondidos, resolvidos, urgentes] = await Promise.all([
      Chamado.countDocuments(),
      Chamado.countDocuments({ status: "aberto" }),
      Chamado.countDocuments({ status: "em_atendimento" }),
      Chamado.countDocuments({ status: "respondido" }),
      Chamado.countDocuments({ status: { $in: ["resolvido", "fechado"] } }),
      Chamado.countDocuments({ prioridade: "urgente", status: { $nin: ["resolvido", "fechado"] } })
    ]);

    return res.json({
      sucesso: true,
      resumo: { total, abertos, atendimento, respondidos, resolvidos, urgentes }
    });
  } catch (error) {
    console.error("Erro no resumo de suporte:", error);
    return res.status(500).json({ erro: "Erro interno ao gerar resumo de suporte." });
  }
});

router.get("/admin/suporte", auth, requirePermission("suporte"), async (req, res) => {
  try {
    const { busca = "", status = "", prioridade = "", categoria = "", limite = 200 } = req.query;
    const filtro = {};

    if (busca) {
      const termo = String(busca).trim();
      filtro.$or = [
        { nome: { $regex: termo, $options: "i" } },
        { email: { $regex: termo, $options: "i" } },
        { assunto: { $regex: termo, $options: "i" } },
        { mensagem: { $regex: termo, $options: "i" } }
      ];
    }

    if (STATUS_VALIDOS.includes(status)) filtro.status = status;
    if (PRIORIDADES_VALIDAS.includes(prioridade)) filtro.prioridade = prioridade;
    if (CATEGORIAS_VALIDAS.includes(categoria)) filtro.categoria = categoria;

    const chamados = await Chamado.find(filtro)
      .sort({ prioridade: -1, updatedAt: -1 })
      .limit(Math.min(Number(limite) || 200, 500));

    return res.json({ sucesso: true, total: chamados.length, chamados: chamados.map(formatarChamado) });
  } catch (error) {
    console.error("Erro ao listar chamados admin:", error);
    return res.status(500).json({ erro: "Erro interno ao listar chamados." });
  }
});

router.get("/admin/suporte/:id", auth, requirePermission("suporte"), async (req, res) => {
  try {
    const chamado = await buscarChamado(req.params.id);
    if (!chamado) return res.status(404).json({ erro: "Chamado não encontrado." });
    return res.json({ sucesso: true, chamado: formatarChamado(chamado) });
  } catch (error) {
    console.error("Erro ao buscar chamado admin:", error);
    return res.status(500).json({ erro: "Erro interno ao buscar chamado." });
  }
});

router.post("/admin/suporte/:id/responder", auth, requirePermission("suporte"), async (req, res) => {
  try {
    const chamado = await buscarChamado(req.params.id);
    if (!chamado) return res.status(404).json({ erro: "Chamado não encontrado." });

    const mensagem = String(req.body?.mensagem || "").trim();
    if (!mensagem) return res.status(400).json({ erro: "Digite uma resposta." });

    await chamado.adicionarResposta({
      autorNome: req.usuario.nome || "Equipe",
      autorEmail: req.usuario.email,
      autorCargo: getCargo(req.usuarioDoc || req.usuario),
      mensagem,
      tipo: "equipe"
    });

    chamado.atualizadoPor = req.usuario.email;
    await chamado.save();
    await notificarUsuario(chamado, mensagem);

    return res.json({ sucesso: true, mensagem: "Resposta enviada ao usuário.", chamado: formatarChamado(chamado) });
  } catch (error) {
    console.error("Erro ao responder chamado admin:", error);
    return res.status(500).json({ erro: "Erro interno ao responder chamado." });
  }
});

router.post("/admin/suporte/:id/status", auth, requirePermission("suporte"), async (req, res) => {
  try {
    const chamado = await buscarChamado(req.params.id);
    if (!chamado) return res.status(404).json({ erro: "Chamado não encontrado." });

    const status = normalizarStatus(req.body?.status);
    await chamado.alterarStatus(status, req.usuario.email);

    return res.json({ sucesso: true, mensagem: "Status atualizado.", chamado: formatarChamado(chamado) });
  } catch (error) {
    console.error("Erro ao alterar status do chamado:", error);
    return res.status(500).json({ erro: "Erro interno ao alterar status do chamado." });
  }
});

module.exports = router;
