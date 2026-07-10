const express = require("express");

const Usuario = require("../models/Usuario");
const Aluno = require("../models/Aluno");
const Venda = require("../models/Venda");
const Agenda = require("../models/Agenda");
const Notificacao = require("../models/Notificacao");

const { auth } = require("../middleware/auth");
const {
  requirePermission,
  getCargo,
  getPermissoes,
  temPermissao
} = require("../middleware/permissions");

const router = express.Router();

/* ===============================
   HELPERS
=============================== */

function hojeData() {
  return new Date().toISOString().split("T")[0];
}

function inicioDoDia() {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  return data;
}

function inicioDoMes() {
  const data = new Date();
  data.setDate(1);
  data.setHours(0, 0, 0, 0);
  return data;
}

function inicioDaSemana() {
  const data = new Date();
  const dia = data.getDay();
  const diferenca = data.getDate() - dia;

  data.setDate(diferenca);
  data.setHours(0, 0, 0, 0);

  return data;
}

function diferencaDias(dataFinal) {
  if (!dataFinal) return null;

  const hoje = new Date();
  const fim = new Date(`${dataFinal}T00:00:00`);

  hoje.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);

  return Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function calcularStatusAluno(aluno) {
  if (!aluno) return "ativo";

  if (["cancelado", "inativo"].includes(aluno.status)) {
    return aluno.status;
  }

  const dias = diferencaDias(aluno.vencimento);

  if (dias === null) return aluno.status || "ativo";
  if (dias < 0) return "vencido";
  if (dias <= 7) return "vencendo";

  return "ativo";
}

function podeVerTudo(usuario) {
  const cargo = getCargo(usuario);

  return (
    cargo === "superadmin" ||
    cargo === "admin" ||
    temPermissao(usuario, "relatorios") ||
    temPermissao(usuario, "vendedores")
  );
}

function montarFiltroVendas(usuario, extras = {}) {
  const filtro = { ...extras };

  if (!podeVerTudo(usuario)) {
    filtro.vendedorId = usuario._id;
  }

  return filtro;
}

function formatarDinheiro(valor) {
  return Number(Number(valor || 0).toFixed(2));
}

function formatarVenda(venda) {
  if (!venda) return null;

  const obj = venda.toObject ? venda.toObject() : venda;

  return {
    id: String(obj._id || obj.id),
    alunoNome: obj.alunoNome || "",
    alunoTelefone: obj.alunoTelefone || "",
    alunoEmail: obj.alunoEmail || "",

    vendedorNome: obj.vendedorNome || "",
    vendedorEmail: obj.vendedorEmail || "",

    plano: obj.plano || "black30",
    valor: formatarDinheiro(obj.valor),
    comissao: formatarDinheiro(obj.comissao),
    porcentagemComissao: Number(obj.porcentagemComissao || 20),

    formaPagamento: obj.formaPagamento || "PIX",
    status: obj.status || "pendente",
    dataVenda: obj.dataVenda || "",
    createdAt: obj.createdAt || ""
  };
}

function formatarAluno(aluno) {
  if (!aluno) return null;

  const obj = aluno.toObject ? aluno.toObject({ virtuals: true }) : aluno;

  return {
    id: String(obj._id || obj.id),
    nome: obj.nome || "",
    email: obj.email || "",
    telefone: obj.telefone || "",
    plano: obj.plano || "black30",
    status: calcularStatusAluno(obj),
    vencimento: obj.vencimento || "",
    diasRestantes: diferencaDias(obj.vencimento),
    vendedorNome: obj.vendedorNome || "",
    vendedorEmail: obj.vendedorEmail || "",
    createdAt: obj.createdAt || ""
  };
}

function formatarUsuario(usuario) {
  if (!usuario) return null;

  return {
    id: String(usuario._id),
    nome: usuario.nome || "",
    email: usuario.email || "",
    cargo: usuario.cargo || "aluno",
    tipo: usuario.tipo || "aluno",
    plano: usuario.plano || "free",
    aprovado: Boolean(usuario.aprovado),
    status: usuario.status || "pendente",
    vendedor: Boolean(usuario.vendedor),
    createdAt: usuario.createdAt || ""
  };
}

/* ===============================
   DASHBOARD GERAL
   GET /dashboard
=============================== */

router.get("/dashboard", auth, requirePermission("dashboard"), async (req, res) => {
  try {
    const usuario = req.usuario;
    const permissoes = getPermissoes(usuario);

    const notificacoesNaoLidas = await Notificacao.countDocuments({
      ativa: true,
      $or: [
        { destino: "todos" },
        { destino: usuario.plano === "free" ? "free" : "premium" },
        { destino: usuario.cargo },
        { destino: "especifico", email: usuario.email }
      ],
      "lidaPor.email": { $ne: usuario.email }
    });

    return res.json({
      sucesso: true,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cargo: usuario.cargo,
        plano: usuario.plano,
        vendedor: usuario.vendedor,
        aprovado: usuario.aprovado,
        status: usuario.status
      },
      permissoes,
      acessosRapidos: {
        dashboard: true,
        painelAdmin: Boolean(permissoes.painelAdmin),
        painelVendas: Boolean(permissoes.painelVendas),
        suporte: Boolean(permissoes.suporte),
        provas: Boolean(permissoes.provas)
      },
      notificacoesNaoLidas
    });
  } catch (error) {
    console.error("Erro no dashboard geral:", error);

    return res.status(500).json({
      erro: "Erro interno ao carregar dashboard."
    });
  }
});

/* ===============================
   DASHBOARD ADMIN
   GET /dashboard/admin
   GET /admin/dashboard
=============================== */

async function dashboardAdmin(req, res) {
  try {
    const hoje = inicioDoDia();
    const mes = inicioDoMes();

    const [
      totalUsuarios,
      usuariosAprovados,
      usuariosPendentes,
      usuariosSuspensos,
      usuariosBloqueados,
      totalAdmins,
      totalVendedores,
      totalSuporte,
      totalModeradores,
      ultimosUsuarios
    ] = await Promise.all([
      Usuario.countDocuments(),
      Usuario.countDocuments({ aprovado: true }),
      Usuario.countDocuments({ status: "pendente" }),
      Usuario.countDocuments({ status: "suspenso" }),
      Usuario.countDocuments({ status: "bloqueado" }),
      Usuario.countDocuments({ cargo: { $in: ["admin", "superadmin"] } }),
      Usuario.countDocuments({ $or: [{ vendedor: true }, { cargo: "vendedor" }] }),
      Usuario.countDocuments({ cargo: "suporte" }),
      Usuario.countDocuments({ cargo: "moderador" }),
      Usuario.find().sort({ createdAt: -1 }).limit(8)
    ]);

    const alunos = await Aluno.find();

    let alunosAtivos = 0;
    let alunosVencendo = 0;
    let alunosVencidos = 0;
    let alunosCancelados = 0;

    alunos.forEach((aluno) => {
      const status = calcularStatusAluno(aluno);

      if (status === "ativo") alunosAtivos++;
      if (status === "vencendo") alunosVencendo++;
      if (status === "vencido") alunosVencidos++;
      if (status === "cancelado" || status === "inativo") alunosCancelados++;
    });

    const [
      vendasTotal,
      vendasPagas,
      vendasPendentes,
      vendasCanceladas,
      vendasHoje,
      vendasMes,
      faturamentoTotal,
      faturamentoMes,
      comissaoTotal,
      ultimasVendas,
      agendaResumo,
      notificacoesAtivas
    ] = await Promise.all([
      Venda.countDocuments(),
      Venda.countDocuments({ status: "pago" }),
      Venda.countDocuments({ status: "pendente" }),
      Venda.countDocuments({ status: { $in: ["cancelado", "estornado"] } }),
      Venda.countDocuments({ createdAt: { $gte: hoje } }),
      Venda.countDocuments({ createdAt: { $gte: mes } }),

      Venda.aggregate([
        { $match: { status: "pago" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$valor" }
          }
        }
      ]),

      Venda.aggregate([
        {
          $match: {
            status: "pago",
            createdAt: { $gte: mes }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$valor" }
          }
        }
      ]),

      Venda.aggregate([
        { $match: { status: "pago" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$comissao" }
          }
        }
      ]),

      Venda.find().sort({ createdAt: -1 }).limit(8),

      Agenda.aggregate([
        {
          $group: {
            _id: "$status",
            total: { $sum: 1 }
          }
        }
      ]),

      Notificacao.countDocuments({ ativa: true })
    ]);

    const agenda = {
      Agendar: 0,
      Agendado: 0,
      Concluído: 0,
      Cancelado: 0,
      Remarcar: 0
    };

    agendaResumo.forEach((item) => {
      agenda[item._id] = item.total;
    });

    return res.json({
      sucesso: true,
      dashboard: {
        usuarios: {
          total: totalUsuarios,
          aprovados: usuariosAprovados,
          pendentes: usuariosPendentes,
          suspensos: usuariosSuspensos,
          bloqueados: usuariosBloqueados,
          admins: totalAdmins,
          vendedores: totalVendedores,
          suporte: totalSuporte,
          moderadores: totalModeradores
        },

        alunos: {
          total: alunos.length,
          ativos: alunosAtivos,
          vencendo: alunosVencendo,
          vencidos: alunosVencidos,
          cancelados: alunosCancelados
        },

        vendas: {
          total: vendasTotal,
          pagas: vendasPagas,
          pendentes: vendasPendentes,
          canceladas: vendasCanceladas,
          hoje: vendasHoje,
          mes: vendasMes,
          faturamentoTotal: formatarDinheiro(faturamentoTotal[0]?.total || 0),
          faturamentoMes: formatarDinheiro(faturamentoMes[0]?.total || 0),
          comissaoTotal: formatarDinheiro(comissaoTotal[0]?.total || 0)
        },

        agenda,

        notificacoes: {
          ativas: notificacoesAtivas
        },

        listas: {
          ultimosUsuarios: ultimosUsuarios.map(formatarUsuario),
          ultimasVendas: ultimasVendas.map(formatarVenda)
        }
      }
    });
  } catch (error) {
    console.error("Erro no dashboard admin:", error);

    return res.status(500).json({
      erro: "Erro interno ao carregar dashboard admin."
    });
  }
}

router.get("/dashboard/admin", auth, requirePermission("painelAdmin"), dashboardAdmin);
router.get("/admin/dashboard", auth, requirePermission("painelAdmin"), dashboardAdmin);

/* ===============================
   DASHBOARD COMERCIAL
   GET /dashboard/comercial
   GET /comercial/dashboard
=============================== */

async function dashboardComercial(req, res) {
  try {
    const hoje = inicioDoDia();
    const semana = inicioDaSemana();
    const mes = inicioDoMes();

    const filtroBase = montarFiltroVendas(req.usuario);
    const filtroPago = montarFiltroVendas(req.usuario, { status: "pago" });

    const [
      totalVendas,
      vendasPagas,
      vendasPendentes,
      vendasCanceladas,
      vendasHoje,
      vendasSemana,
      vendasMes,
      faturamentoTotal,
      faturamentoMes,
      comissaoTotal,
      comissaoMes,
      ultimasVendas,
      ranking
    ] = await Promise.all([
      Venda.countDocuments(filtroBase),

      Venda.countDocuments(filtroPago),

      Venda.countDocuments({
        ...filtroBase,
        status: "pendente"
      }),

      Venda.countDocuments({
        ...filtroBase,
        status: { $in: ["cancelado", "estornado"] }
      }),

      Venda.countDocuments({
        ...filtroBase,
        createdAt: { $gte: hoje }
      }),

      Venda.countDocuments({
        ...filtroBase,
        createdAt: { $gte: semana }
      }),

      Venda.countDocuments({
        ...filtroBase,
        createdAt: { $gte: mes }
      }),

      Venda.aggregate([
        { $match: filtroPago },
        {
          $group: {
            _id: null,
            total: { $sum: "$valor" }
          }
        }
      ]),

      Venda.aggregate([
        {
          $match: {
            ...filtroPago,
            createdAt: { $gte: mes }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$valor" }
          }
        }
      ]),

      Venda.aggregate([
        { $match: filtroPago },
        {
          $group: {
            _id: null,
            total: { $sum: "$comissao" }
          }
        }
      ]),

      Venda.aggregate([
        {
          $match: {
            ...filtroPago,
            createdAt: { $gte: mes }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$comissao" }
          }
        }
      ]),

      Venda.find(filtroBase).sort({ createdAt: -1 }).limit(10),

      Venda.aggregate([
        {
          $match: {
            status: "pago",
            createdAt: { $gte: mes }
          }
        },
        {
          $group: {
            _id: "$vendedorId",
            vendedorNome: { $first: "$vendedorNome" },
            vendedorEmail: { $first: "$vendedorEmail" },
            totalVendas: { $sum: 1 },
            faturamento: { $sum: "$valor" },
            comissao: { $sum: "$comissao" }
          }
        },
        { $sort: { faturamento: -1, totalVendas: -1 } },
        { $limit: 10 }
      ])
    ]);

    let minhaPosicao = null;

    if (req.usuario?._id) {
      const idUsuario = String(req.usuario._id);

      const posicao = ranking.findIndex((item) => {
        return String(item._id) === idUsuario;
      });

      if (posicao >= 0) {
        minhaPosicao = posicao + 1;
      }
    }

    return res.json({
      sucesso: true,
      dashboard: {
        permissaoGeral: podeVerTudo(req.usuario),

        resumo: {
          totalVendas,
          vendasPagas,
          vendasPendentes,
          vendasCanceladas,
          vendasHoje,
          vendasSemana,
          vendasMes,

          faturamentoTotal: formatarDinheiro(faturamentoTotal[0]?.total || 0),
          faturamentoMes: formatarDinheiro(faturamentoMes[0]?.total || 0),

          comissaoTotal: formatarDinheiro(comissaoTotal[0]?.total || 0),
          comissaoMes: formatarDinheiro(comissaoMes[0]?.total || 0),

          porcentagemComissao: Number(req.usuario?.comissao || 20),
          minhaPosicao
        },

        ultimasVendas: ultimasVendas.map(formatarVenda),

        ranking: ranking.map((item, index) => ({
          posicao: index + 1,
          vendedorId: item._id,
          vendedorNome: item.vendedorNome || "",
          vendedorEmail: item.vendedorEmail || "",
          totalVendas: Number(item.totalVendas || 0),
          faturamento: formatarDinheiro(item.faturamento || 0),
          comissao: formatarDinheiro(item.comissao || 0)
        }))
      }
    });
  } catch (error) {
    console.error("Erro no dashboard comercial:", error);

    return res.status(500).json({
      erro: "Erro interno ao carregar dashboard comercial."
    });
  }
}

router.get(
  "/dashboard/comercial",
  auth,
  requirePermission("painelVendas"),
  dashboardComercial
);

router.get(
  "/comercial/dashboard",
  auth,
  requirePermission("painelVendas"),
  dashboardComercial
);

router.get(
  "/dashboard/vendas",
  auth,
  requirePermission("painelVendas"),
  dashboardComercial
);

/* ===============================
   DASHBOARD DE ALERTAS
   GET /dashboard/alertas
=============================== */

router.get("/dashboard/alertas", auth, requirePermission("dashboard"), async (req, res) => {
  try {
    const alunos = await Aluno.find();

    const vencendo = [];
    const vencidos = [];

    alunos.forEach((aluno) => {
      const dias = diferencaDias(aluno.vencimento);
      const item = formatarAluno(aluno);

      if (dias !== null && dias >= 0 && dias <= 7) {
        vencendo.push(item);
      }

      if (dias !== null && dias < 0) {
        vencidos.push(item);
      }
    });

    const usuariosPendentes = await Usuario.find({ status: "pendente" })
      .sort({ createdAt: -1 })
      .limit(10);

    const agendaHoje = await Agenda.find({
      dataInicio: hojeData()
    }).sort({ horaInicio: 1 });

    return res.json({
      sucesso: true,
      alertas: {
        alunosVencendo: vencendo.slice(0, 10),
        alunosVencidos: vencidos.slice(0, 10),
        usuariosPendentes: usuariosPendentes.map(formatarUsuario),
        agendaHoje
      }
    });
  } catch (error) {
    console.error("Erro ao carregar alertas:", error);

    return res.status(500).json({
      erro: "Erro interno ao carregar alertas."
    });
  }
});

/* ===============================
   STATUS DO MÓDULO
=============================== */

router.get("/dashboard/status", (req, res) => {
  res.json({
    status: "online",
    modulo: "dashboard",
    rotas: [
      "GET /dashboard",
      "GET /dashboard/admin",
      "GET /admin/dashboard",
      "GET /dashboard/comercial",
      "GET /comercial/dashboard",
      "GET /dashboard/vendas",
      "GET /dashboard/alertas"
    ]
  });
});

module.exports = router;
