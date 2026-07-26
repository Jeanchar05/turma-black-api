const express = require("express");

const Usuario = require("../models/Usuario");
const Venda = require("../models/Venda");
const SolicitacaoLiberacao = require("../models/SolicitacaoLiberacao");
const Notificacao = require("../models/Notificacao");
const Chamado = require("../models/Chamado");
const Prova = require("../models/Prova");
const ProvaResultado = require("../models/ProvaResultado");
const Configuracao = require("../models/Configuracao");

const { auth } = require("../middleware/auth");
const { requirePermission, getCargo } = require("../middleware/permissions");

const router = express.Router();

function inicioDia(data = new Date()) {
  const nova = new Date(data);
  nova.setHours(0, 0, 0, 0);
  return nova;
}

function fimDia(data = new Date()) {
  const nova = new Date(data);
  nova.setHours(23, 59, 59, 999);
  return nova;
}

function inicioMes(data = new Date()) {
  return new Date(data.getFullYear(), data.getMonth(), 1, 0, 0, 0, 0);
}

function fimMes(data = new Date()) {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0, 23, 59, 59, 999);
}

function arredondar(valor) {
  return Number(Number(valor || 0).toFixed(2));
}

function percentual(atual, anterior) {
  const a = Number(atual || 0);
  const b = Number(anterior || 0);
  if (!b) return a > 0 ? 100 : 0;
  return Number((((a - b) / b) * 100).toFixed(1));
}

function normalizarDias(valor, padrao = 7) {
  const numero = Number(valor || padrao);
  return Math.min(Math.max(numero, 7), 90);
}

function chaveData(data) {
  return new Date(data).toISOString().slice(0, 10);
}

function montarSerie(vendas, dias) {
  const mapa = new Map();
  const hoje = inicioDia();

  for (let i = dias - 1; i >= 0; i--) {
    const data = new Date(hoje);
    data.setDate(data.getDate() - i);
    mapa.set(chaveData(data), {
      data: chaveData(data),
      rotulo: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(data),
      vendas: 0,
      faturamento: 0
    });
  }

  vendas.forEach((venda) => {
    const data = venda.pagoEm || venda.createdAt || venda.dataVenda;
    if (!data) return;
    const chave = chaveData(data);
    const item = mapa.get(chave);
    if (!item) return;
    item.vendas += 1;
    item.faturamento += Number(venda.valor || 0);
  });

  return Array.from(mapa.values()).map((item) => ({
    ...item,
    faturamento: arredondar(item.faturamento)
  }));
}

function atividade(tipo, titulo, descricao, data, extra = {}) {
  const icones = {
    usuario: "♙",
    venda: "$",
    notificacao: "◉",
    suporte: "☏",
    liberacao: "✓",
    prova: "□"
  };

  return {
    tipo,
    icone: icones[tipo] || "•",
    titulo,
    descricao,
    createdAt: data || new Date(0),
    ...extra
  };
}

async function montarAtividades() {
  const [usuarios, vendas, notificacoes, chamados, liberacoes, resultados] = await Promise.all([
    Usuario.find({ contaDev: { $ne: true } }).sort({ createdAt: -1 }).limit(6).lean(),
    Venda.find().sort({ createdAt: -1 }).limit(6).lean(),
    Notificacao.find().sort({ createdAt: -1 }).limit(6).lean(),
    Chamado.find().sort({ updatedAt: -1 }).limit(6).lean(),
    SolicitacaoLiberacao.find().sort({ updatedAt: -1 }).limit(6).lean(),
    ProvaResultado.find().sort({ updatedAt: -1 }).limit(6).lean()
  ]);

  const lista = [
    ...usuarios.map((item) => atividade(
      "usuario",
      "Novo usuário cadastrado",
      `${item.nome || "Usuário"} • ${item.email || ""}`,
      item.createdAt,
      { status: item.status || "ativo" }
    )),
    ...vendas.map((item) => atividade(
      "venda",
      item.status === "pago" ? "Venda confirmada" : "Venda atualizada",
      `${item.alunoNome || "Aluno"} • R$ ${Number(item.valor || 0).toFixed(2).replace(".", ",")}`,
      item.updatedAt || item.createdAt,
      { status: item.status || "pendente" }
    )),
    ...notificacoes.map((item) => atividade(
      "notificacao",
      "Notificação enviada",
      `${item.titulo || "Aviso"} • ${item.destino || "todos"}`,
      item.createdAt,
      { status: item.ativa ? "ativa" : "inativa" }
    )),
    ...chamados.map((item) => atividade(
      "suporte",
      "Chamado de suporte",
      `${item.assunto || "Suporte"} • ${item.email || ""}`,
      item.updatedAt || item.createdAt,
      { status: item.status || "aberto" }
    )),
    ...liberacoes.map((item) => atividade(
      "liberacao",
      item.status === "pendente" ? "Código aguardando aprovação" : "Código analisado",
      `${item.codigo || "Código"} • ${item.nome || item.email || ""}`,
      item.updatedAt || item.createdAt,
      { status: item.status || "pendente" }
    )),
    ...resultados.map((item) => atividade(
      "prova",
      "Resultado de prova",
      `${item.provaTitulo || "Prova"} • ${item.usuarioNome || item.usuarioEmail || ""}`,
      item.updatedAt || item.createdAt,
      { status: item.status || "pendente" }
    ))
  ];

  return lista
    .filter((item) => item.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 14);
}

router.get(
  "/dashboard/visao-geral",
  auth,
  requirePermission("painelAdmin"),
  async (req, res) => {
    try {
      const dias = normalizarDias(req.query?.dias, 7);
      const agora = new Date();
      const inicioAtual = inicioMes(agora);
      const fimAtual = fimMes(agora);
      const mesAnteriorRef = new Date(agora.getFullYear(), agora.getMonth() - 1, 15);
      const inicioAnterior = inicioMes(mesAnteriorRef);
      const fimAnterior = fimMes(mesAnteriorRef);
      const inicioSerie = inicioDia(new Date(Date.now() - (dias - 1) * 86400000));
      const emSeteDias = fimDia(new Date(Date.now() + 7 * 86400000));

      const [
        totalUsuarios,
        usuariosMes,
        usuariosMesAnterior,
        freeAtivos,
        premiumAtivos,
        vendasMes,
        vendasMesAnterior,
        vendasSerie,
        codigosPendentes,
        vendasPendentes,
        chamadosAbertos,
        chamadosUrgentes,
        resultadosAnalise,
        provasAtivas,
        premiumExpirando,
        atividades,
        topPlanos
      ] = await Promise.all([
        Usuario.countDocuments({ contaDev: { $ne: true } }),
        Usuario.countDocuments({ contaDev: { $ne: true }, createdAt: { $gte: inicioAtual, $lte: fimAtual } }),
        Usuario.countDocuments({ contaDev: { $ne: true }, createdAt: { $gte: inicioAnterior, $lte: fimAnterior } }),
        Usuario.countDocuments({ cargo: "aluno", plano: "free", status: "ativo" }),
        Usuario.countDocuments({ cargo: "aluno", plano: { $nin: ["free", "admin"] }, status: "ativo" }),
        Venda.find({ status: "pago", createdAt: { $gte: inicioAtual, $lte: fimAtual } }).lean(),
        Venda.find({ status: "pago", createdAt: { $gte: inicioAnterior, $lte: fimAnterior } }).lean(),
        Venda.find({ status: "pago", createdAt: { $gte: inicioSerie } }).lean(),
        SolicitacaoLiberacao.countDocuments({ status: "pendente" }),
        Venda.countDocuments({ status: "pendente" }),
        Chamado.countDocuments({ status: { $in: ["aberto", "em_atendimento", "respondido"] } }),
        Chamado.countDocuments({ prioridade: "urgente", status: { $nin: ["resolvido", "fechado"] } }),
        ProvaResultado.countDocuments({ status: "em_analise" }),
        Prova.countDocuments({ status: "ativa" }),
        Usuario.countDocuments({
          cargo: "aluno",
          plano: { $nin: ["free", "admin"] },
          status: "ativo",
          dataExpiracao: {
            $ne: "",
            $gte: chaveData(agora),
            $lte: chaveData(emSeteDias)
          }
        }),
        montarAtividades(),
        Venda.aggregate([
          { $match: { status: "pago" } },
          {
            $group: {
              _id: "$plano",
              vendas: { $sum: 1 },
              faturamento: { $sum: "$valor" }
            }
          },
          { $sort: { faturamento: -1 } },
          { $limit: 5 }
        ])
      ]);

      const faturamentoMes = vendasMes.reduce((soma, item) => soma + Number(item.valor || 0), 0);
      const faturamentoAnterior = vendasMesAnterior.reduce((soma, item) => soma + Number(item.valor || 0), 0);
      const conversao = totalUsuarios > 0 ? (premiumAtivos / totalUsuarios) * 100 : 0;

      const alertas = [
        codigosPendentes > 0 && {
          tipo: "warning",
          titulo: `${codigosPendentes} código(s) aguardando aprovação`,
          descricao: "Confira os pagamentos e libere os acessos Premium.",
          destino: "approvals"
        },
        vendasPendentes > 0 && {
          tipo: "danger",
          titulo: `${vendasPendentes} venda(s) pendente(s)`,
          descricao: "Existem registros comerciais sem confirmação de pagamento.",
          destino: "finance"
        },
        chamadosUrgentes > 0 && {
          tipo: "danger",
          titulo: `${chamadosUrgentes} chamado(s) urgente(s)`,
          descricao: "A equipe precisa responder esses chamados prioritários.",
          destino: "support"
        },
        resultadosAnalise > 0 && {
          tipo: "info",
          titulo: `${resultadosAnalise} prova(s) aguardando avaliação`,
          descricao: "Há respostas discursivas que precisam de correção manual.",
          destino: "exams"
        },
        premiumExpirando > 0 && {
          tipo: "warning",
          titulo: `${premiumExpirando} acesso(s) vencem em até 7 dias`,
          descricao: "Entre em contato para renovação antes da expiração.",
          destino: "students"
        }
      ].filter(Boolean);

      return res.json({
        sucesso: true,
        periodo: { dias, inicio: inicioSerie, fim: agora },
        indicadores: {
          totalUsuarios,
          usuariosMes,
          crescimentoUsuarios: percentual(usuariosMes, usuariosMesAnterior),
          freeAtivos,
          premiumAtivos,
          vendasMes: vendasMes.length,
          crescimentoVendas: percentual(vendasMes.length, vendasMesAnterior.length),
          faturamentoMes: arredondar(faturamentoMes),
          crescimentoFaturamento: percentual(faturamentoMes, faturamentoAnterior),
          conversao: arredondar(conversao),
          codigosPendentes,
          chamadosAbertos,
          provasAtivas
        },
        serieVendas: montarSerie(vendasSerie, dias),
        atividades,
        alertas,
        topPlanos: topPlanos.map((item, index) => ({
          posicao: index + 1,
          plano: item._id || "black30",
          vendas: Number(item.vendas || 0),
          faturamento: arredondar(item.faturamento)
        })),
        funil: [
          { etapa: "Contas cadastradas", total: totalUsuarios },
          { etapa: "Usuários Free ativos", total: freeAtivos },
          { etapa: "Solicitações pendentes", total: codigosPendentes },
          { etapa: "Premium ativos", total: premiumAtivos }
        ]
      });
    } catch (error) {
      console.error("Erro na visão geral completa:", error);
      return res.status(500).json({ erro: "Erro interno ao carregar a visão geral." });
    }
  }
);

router.get(
  "/financeiro/resumo",
  auth,
  requirePermission("financas"),
  async (req, res) => {
    try {
      const dias = normalizarDias(req.query?.dias, 30);
      const inicio = inicioDia(new Date(Date.now() - (dias - 1) * 86400000));
      const filtro = { createdAt: { $gte: inicio } };

      const [vendas, ranking] = await Promise.all([
        Venda.find(filtro).sort({ createdAt: -1 }).limit(500).lean(),
        Venda.aggregate([
          { $match: { ...filtro, status: "pago" } },
          {
            $group: {
              _id: "$vendedorId",
              nome: { $first: "$vendedorNome" },
              email: { $first: "$vendedorEmail" },
              vendas: { $sum: 1 },
              faturamento: { $sum: "$valor" },
              comissao: { $sum: "$comissao" }
            }
          },
          { $sort: { faturamento: -1 } },
          { $limit: 10 }
        ])
      ]);

      const pagas = vendas.filter((item) => item.status === "pago");
      const pendentes = vendas.filter((item) => item.status === "pendente");
      const canceladas = vendas.filter((item) => ["cancelado", "estornado"].includes(item.status));

      return res.json({
        sucesso: true,
        periodo: { dias, inicio, fim: new Date() },
        resumo: {
          total: vendas.length,
          pagas: pagas.length,
          pendentes: pendentes.length,
          canceladas: canceladas.length,
          faturamento: arredondar(pagas.reduce((soma, item) => soma + Number(item.valor || 0), 0)),
          comissoes: arredondar(pagas.reduce((soma, item) => soma + Number(item.comissao || 0), 0)),
          ticketMedio: pagas.length
            ? arredondar(pagas.reduce((soma, item) => soma + Number(item.valor || 0), 0) / pagas.length)
            : 0
        },
        serie: montarSerie(pagas, dias),
        ranking: ranking.map((item, index) => ({
          posicao: index + 1,
          vendedorId: item._id,
          nome: item.nome || "Sem vendedor",
          email: item.email || "",
          vendas: Number(item.vendas || 0),
          faturamento: arredondar(item.faturamento),
          comissao: arredondar(item.comissao)
        })),
        ultimasVendas: vendas.slice(0, 50)
      });
    } catch (error) {
      console.error("Erro no financeiro do admin:", error);
      return res.status(500).json({ erro: "Erro interno ao carregar o financeiro." });
    }
  }
);

router.get(
  "/sistema/logs",
  auth,
  requirePermission("seguranca"),
  async (req, res) => {
    try {
      const atividades = await montarAtividades();
      return res.json({ sucesso: true, total: atividades.length, logs: atividades });
    } catch (error) {
      console.error("Erro ao gerar logs do sistema:", error);
      return res.status(500).json({ erro: "Erro interno ao carregar logs." });
    }
  }
);

router.get(
  "/configuracoes-painel",
  auth,
  requirePermission("configuracoes"),
  async (req, res) => {
    try {
      const config = await Configuracao.obterConfiguracao();
      return res.json({
        sucesso: true,
        configuracoes: {
          nomeSistema: config.nomeSistema,
          nomePremium: config.nomePremium,
          ambiente: config.ambiente,
          temaPadrao: config.temaPadrao,
          modoManutencao: config.modoManutencao,
          manutencaoTitulo: config.manutencaoTitulo,
          manutencaoMensagem: config.manutencaoMensagem,
          previsaoRetorno: config.previsaoRetorno,
          comissaoPadrao: config.comissaoPadrao,
          moeda: config.moeda,
          links: config.links || {}
        }
      });
    } catch (error) {
      console.error("Erro ao buscar configurações do painel:", error);
      return res.status(500).json({ erro: "Erro interno ao buscar configurações." });
    }
  }
);

router.put(
  "/configuracoes-painel",
  auth,
  requirePermission("configuracoes"),
  async (req, res) => {
    try {
      const config = await Configuracao.obterConfiguracao();
      const cargo = getCargo(req.usuarioDoc || req.usuario);
      const campos = [
        "nomeSistema",
        "nomePremium",
        "temaPadrao",
        "modoManutencao",
        "manutencaoTitulo",
        "manutencaoMensagem",
        "previsaoRetorno",
        "comissaoPadrao"
      ];

      campos.forEach((campo) => {
        if (req.body?.[campo] !== undefined) config[campo] = req.body[campo];
      });

      if (req.body?.links && typeof req.body.links === "object") {
        config.links = {
          ...(config.links?.toObject ? config.links.toObject() : config.links || {}),
          ...req.body.links
        };
      }

      config.ambiente = config.modoManutencao ? "manutencao" : "producao";
      config.atualizadoPor = req.usuario.email;
      await config.save();

      return res.json({
        sucesso: true,
        mensagem: cargo === "dev"
          ? "Configurações técnicas atualizadas."
          : "Configurações operacionais atualizadas.",
        configuracoes: config
      });
    } catch (error) {
      console.error("Erro ao atualizar configurações do painel:", error);
      return res.status(500).json({ erro: "Erro interno ao atualizar configurações." });
    }
  }
);

module.exports = router;
