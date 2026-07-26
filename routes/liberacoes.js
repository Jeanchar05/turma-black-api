const express = require("express");
const crypto = require("crypto");

const SolicitacaoLiberacao = require("../models/SolicitacaoLiberacao");
const Configuracao = require("../models/Configuracao");
const { auth } = require("../middleware/auth");

const router = express.Router();

const PLANOS_VALIDOS = ["black30", "black90", "black180", "black360"];

function gerarCodigo() {
  const bloco = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `PRIMO-${bloco()}-${bloco()}`;
}

async function gerarCodigoUnico() {
  for (let tentativa = 0; tentativa < 10; tentativa += 1) {
    const codigo = gerarCodigo();
    const existe = await SolicitacaoLiberacao.exists({ codigo });
    if (!existe) return codigo;
  }

  throw new Error("Não foi possível gerar um código único.");
}

router.post("/liberacoes/solicitar", auth, async (req, res) => {
  try {
    const plano = PLANOS_VALIDOS.includes(req.body?.plano)
      ? req.body.plano
      : "black30";

    const pendente = await SolicitacaoLiberacao.findOne({
      usuarioId: req.usuario.id,
      status: "pendente"
    }).sort({ createdAt: -1 });

    if (pendente) {
      return res.json({
        sucesso: true,
        mensagem: "Você já possui uma solicitação aguardando análise.",
        solicitacao: pendente
      });
    }

    const configuracao = await Configuracao.obterConfiguracao();
    const dadosPlano = configuracao?.planos?.[plano] || {};

    const solicitacao = await SolicitacaoLiberacao.create({
      codigo: await gerarCodigoUnico(),
      usuarioId: req.usuario.id,
      nome: req.usuario.nome || "",
      email: req.usuario.email || "",
      telefone: req.usuario.telefone || "",
      plano,
      valor: Number(req.body?.valor ?? dadosPlano.valor ?? 0),
      referenciaPagamento: String(req.body?.referenciaPagamento || "").trim(),
      comprovante: String(req.body?.comprovante || "").trim(),
      observacao: String(req.body?.observacao || "").trim(),
      status: "pendente"
    });

    return res.status(201).json({
      sucesso: true,
      mensagem: "Código gerado. Agora aguarde a aprovação da equipe.",
      solicitacao
    });
  } catch (error) {
    console.error("Erro ao solicitar liberação:", error);
    return res.status(500).json({ erro: "Erro interno ao gerar código de liberação." });
  }
});

router.get("/liberacoes/minha", auth, async (req, res) => {
  try {
    const solicitacoes = await SolicitacaoLiberacao.find({
      usuarioId: req.usuario.id
    })
      .sort({ createdAt: -1 })
      .limit(20);

    return res.json({
      sucesso: true,
      solicitacoes
    });
  } catch (error) {
    console.error("Erro ao listar minhas liberações:", error);
    return res.status(500).json({ erro: "Erro interno ao carregar solicitações." });
  }
});

module.exports = router;
