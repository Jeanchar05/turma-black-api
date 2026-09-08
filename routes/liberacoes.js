const express = require("express");
const crypto = require("crypto");

const SolicitacaoLiberacao = require("../models/SolicitacaoLiberacao");
const Configuracao = require("../models/Configuracao");
const { auth } = require("../middleware/auth");

const router = express.Router();

const PLANOS_VALIDOS = new Set(["black30", "black90", "black180", "black360"]);

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

function textoLimitado(valor, limite) {
  return String(valor || "").trim().slice(0, limite);
}

router.post("/liberacoes/solicitar", auth, async (req, res) => {
  try {
    const plano = String(req.body?.plano || "").trim().toLowerCase();

    if (!PLANOS_VALIDOS.has(plano)) {
      return res.status(400).json({
        erro: "Plano inválido para solicitação de liberação.",
        codigo: "PLANO_LIBERACAO_INVALIDO"
      });
    }

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
    const dadosPlano = configuracao?.planos?.[plano] || null;
    const valorOficial = Number(dadosPlano?.valor);

    if (!dadosPlano || !Number.isFinite(valorOficial) || valorOficial <= 0) {
      return res.status(503).json({
        erro: "Este plano ainda não possui valor oficial configurado.",
        codigo: "PLANO_SEM_VALOR_OFICIAL"
      });
    }

    const solicitacao = await SolicitacaoLiberacao.create({
      codigo: await gerarCodigoUnico(),
      usuarioId: req.usuario.id,
      nome: textoLimitado(req.usuario.nome, 160),
      email: textoLimitado(req.usuario.email, 190).toLowerCase(),
      telefone: textoLimitado(req.usuario.telefone, 60),
      plano,
      valor: valorOficial,
      referenciaPagamento: textoLimitado(req.body?.referenciaPagamento, 190),
      comprovante: textoLimitado(req.body?.comprovante, 2000),
      observacao: textoLimitado(req.body?.observacao, 1000),
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