const express = require("express");
const mongoose = require("mongoose");

const Venda = require("../models/Venda");
const Aluno = require("../models/Aluno");
const Usuario = require("../models/Usuario");

const { auth } = require("../middleware/auth");
const {
  requirePermission,
  getCargo,
  temPermissao
} = require("../middleware/permissions");

const router = express.Router();

/* ===============================
   HELPERS
=============================== */

function hojeData() {
  return new Date().toISOString().split("T")[0];
}

function hojeISO() {
  return new Date().toISOString();
}

function somarDias(dataBase, dias) {
  const data = new Date(`${dataBase}T00:00:00`);
  data.setDate(data.getDate() + Number(dias || 0));
  return data.toISOString().split("T")[0];
}

function inicioDoMes() {
  const data = new Date();
  data.setDate(1);
  data.setHours(0, 0, 0, 0);
  return data;
}

function normalizarEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function normalizarPlano(plano) {
  const valor = String(plano || "").toLowerCase().trim();

  const mapa = {
    black: "black30",
    premium: "black30",
    mensal: "black30",
    black30: "black30",

    trimestral: "black90",
    black90: "black90",

    semestral: "black180",
    black180: "black180",

    anual: "black360",
    black360: "black360",

    particular: "particular",
    mentoria: "particular"
  };

  return mapa[valor] || "black30";
}

function diasPorPlano(plano) {
  const mapa = {
    black30: 30,
    black90: 90,
    black180: 180,
    black360: 360,
    particular: 30
  };

  return mapa[plano] || 30;
}

function calcularComissao(valor, porcentagem = 20) {
  const numero = Number(valor || 0);
  const taxa = Number(porcentagem || 20);

  return Number(((numero * taxa) / 100).toFixed(2));
}

function podeVerTodasVendas(usuario) {
  const cargo = getCargo(usuario);

  return (
    cargo === "superadmin" ||
    cargo === "admin" ||
    temPermissao(usuario, "relatorios") ||
    temPermissao(usuario, "vendedores")
  );
}

function formatarVenda(venda) {
  if (!venda) return null;

  const obj = venda.toObject ? venda.toObject() : venda;

  return {
    id: String(obj._id || obj.id),
    _id: obj._id,

    alunoId: obj.alunoId || null,
    alunoNome: obj.alunoNome || "",
    alunoTelefone: obj.alunoTelefone || "",
    alunoEmail: obj.alunoEmail || "",

    vendedorId: obj.vendedorId || null,
    vendedorNome: obj.vendedorNome || "",
    vendedorEmail: obj.vendedorEmail || "",

    plano: obj.plano || "black30",
    valor: Number(obj.valor || 0),
    formaPagamento: obj.formaPagamento || "PIX",

    status: obj.status || "pendente",

    porcentagemComissao: Number(obj.porcentagemComissao || 20),
    comissao: Number(obj.comissao || 0),

    dataVenda: obj.dataVenda || "",
    pagoEm: obj.pagoEm || "",
    canceladoEm: obj.canceladoEm || "",

    observacoes: obj.observacoes || "",
    origem: obj.origem || "painel-vendas",

    criadoPor: obj.criadoPor || "",
    atualizadoPor: obj.atualizadoPor || "",

    createdAt: obj.createdAt || "",
    updatedAt: obj.updatedAt || ""
  };
}

async function buscarVendaPorId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return Venda.findById(id);
}

async function buscarVendedor({ vendedorId, vendedorEmail, usuarioAtual }) {
  if (vendedorId && mongoose.Types.ObjectId.isValid(vendedorId)) {
    const vendedor = await Usuario.findById(vendedorId);

    if (vendedor) return vendedor;
  }

  const email = normalizarEmail(vendedorEmail);

  if (email) {
    const vendedor = await Usuario.findOne({ email });

    if (vendedor) return vendedor;
  }

  return usuarioAtual || null;
}

async function buscarOuCriarAluno({
  nome,
  email,
  telefone,
  cidade,
  estado,
  plano,
  diasPlano,
  valor,
  formaPagamento,
  statusVenda,
  vendedor,
  usuarioAtual,
  observacoes
}) {
  const emailNormalizado = normalizarEmail(email);
  const telefoneNormalizado = String(telefone || "").trim();

  let aluno = null;

  if (emailNormalizado) {
    aluno = await Aluno.findOne({ email: emailNormalizado });
  }

  if (!aluno && telefoneNormalizado) {
    aluno = await Aluno.findOne({ telefone: telefoneNormalizado });
  }

  const planoFinal = normalizarPlano(plano);
  const diasFinal = Number(diasPlano || diasPorPlano(planoFinal));
  const dataEntrada = hojeData();

  const statusPagamento = statusVenda === "pago" ? "pago" : "pendente";

  if (aluno) {
    aluno.nome = nome || aluno.nome;
    aluno.email = emailNormalizado || aluno.email;
    aluno.telefone = telefoneNormalizado || aluno.telefone;
    aluno.cidade = cidade || aluno.cidade;
    aluno.estado = estado || aluno.estado;

    aluno.plano = planoFinal;
    aluno.diasPlano = diasFinal;
    aluno.valor = Number(valor || aluno.valor || 0);
    aluno.formaPagamento = formaPagamento || aluno.formaPagamento || "PIX";
    aluno.statusPagamento = statusPagamento;

    aluno.status = "ativo";
    aluno.vencimento = somarDias(dataEntrada, diasFinal);

    aluno.vendedorId = vendedor?._id || aluno.vendedorId || null;
    aluno.vendedorNome = vendedor?.nome || aluno.vendedorNome || "";
    aluno.vendedorEmail = vendedor?.email || aluno.vendedorEmail || "";

    aluno.adminResponsavelId = usuarioAtual?._id || aluno.adminResponsavelId || null;
    aluno.adminResponsavelEmail = usuarioAtual?.email || aluno.adminResponsavelEmail || "";

    aluno.origem = "painel-vendas";
    aluno.atualizadoPor = usuarioAtual?.email || "";

    if (observacoes) {
      aluno.observacoes = aluno.observacoes
        ? `${aluno.observacoes}\n\nVenda: ${observacoes}`
        : `Venda: ${observacoes}`;
    }

    await aluno.save();

    return aluno;
  }

  if (!nome) {
    throw new Error("O nome do aluno é obrigatório.");
  }

  aluno = await Aluno.create({
    nome: String(nome || "").trim(),
    email: emailNormalizado,
    telefone: telefoneNormalizado,
    cidade: cidade || "",
    estado: estado || "",

    plano: planoFinal,
    diasPlano: diasFinal,
    valor: Number(valor || 0),
    formaPagamento: formaPagamento || "PIX",
    statusPagamento,

    status: "ativo",
    dataEntrada,
    vencimento: somarDias(dataEntrada, diasFinal),

    vendedorId: vendedor?._id || null,
    vendedorNome: vendedor?.nome || "",
    vendedorEmail: vendedor?.email || "",

    adminResponsavelId: usuarioAtual?._id || null,
    adminResponsavelEmail: usuarioAtual?.email || "",

    origem: "painel-vendas",
    observacoes: observacoes || "",

    criadoPor: usuarioAtual?.email || "",
    atualizadoPor: usuarioAtual?.email || ""
  });

  return aluno;
}

/* ===============================
   RESUMO DE VENDAS
   GET /vendas/resumo
=============================== */

router.get(
  "/vendas/resumo",
  auth,
  requirePermission("painelVendas"),
  async (req, res) => {
    try {
      const filtro = {};

      if (!podeVerTodasVendas(req.usuario)) {
        filtro.vendedorId = req.usuario._id;
      }

      const vendas = await Venda.find(filtro);

      const inicioMes = inicioDoMes();

      let totalVendas = 0;
      let vendasPagas = 0;
      let vendasPendentes = 0;
      let vendasCanceladas = 0;

      let faturamentoTotal = 0;
      let faturamentoMes = 0;
      let comissaoTotal = 0;
      let comissaoMes = 0;

      vendas.forEach((venda) => {
        totalVendas++;

        if (venda.status === "pago") {
          vendasPagas++;
          faturamentoTotal += Number(venda.valor || 0);
          comissaoTotal += Number(venda.comissao || 0);

          const criadaEm = new Date(venda.createdAt);

          if (criadaEm >= inicioMes) {
            faturamentoMes += Number(venda.valor || 0);
            comissaoMes += Number(venda.comissao || 0);
          }
        }

        if (venda.status === "pendente") vendasPendentes++;
        if (venda.status === "cancelado" || venda.status === "estornado") {
          vendasCanceladas++;
        }
      });

      return res.json({
        sucesso: true,
        resumo: {
          totalVendas,
          vendasPagas,
          vendasPendentes,
          vendasCanceladas,

          faturamentoTotal: Number(faturamentoTotal.toFixed(2)),
          faturamentoMes: Number(faturamentoMes.toFixed(2)),

          comissaoTotal: Number(comissaoTotal.toFixed(2)),
          comissaoMes: Number(comissaoMes.toFixed(2)),

          porcentagemComissao: 20
        }
      });
    } catch (error) {
      console.error("Erro no resumo de vendas:", error);

      return res.status(500).json({
        erro: "Erro interno ao gerar resumo de vendas."
      });
    }
  }
);

/* ===============================
   RANKING DE VENDEDORES
   GET /vendas/ranking
=============================== */

router.get(
  "/vendas/ranking",
  auth,
  requirePermission("painelVendas"),
  async (req, res) => {
    try {
      const { periodo = "mes", limite = 20 } = req.query;

      const filtro = {
        status: "pago"
      };

      if (periodo === "mes") {
        filtro.createdAt = {
          $gte: inicioDoMes()
        };
      }

      if (!podeVerTodasVendas(req.usuario)) {
        filtro.vendedorId = req.usuario._id;
      }

      const ranking = await Venda.aggregate([
        { $match: filtro },
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
        { $limit: Number(limite) || 20 }
      ]);

      return res.json({
        sucesso: true,
        periodo,
        total: ranking.length,
        ranking: ranking.map((item, index) => ({
          posicao: index + 1,
          vendedorId: item._id,
          vendedorNome: item.vendedorNome || "",
          vendedorEmail: item.vendedorEmail || "",
          totalVendas: Number(item.totalVendas || 0),
          faturamento: Number((item.faturamento || 0).toFixed(2)),
          comissao: Number((item.comissao || 0).toFixed(2))
        }))
      });
    } catch (error) {
      console.error("Erro ao gerar ranking:", error);

      return res.status(500).json({
        erro: "Erro interno ao gerar ranking."
      });
    }
  }
);

/* ===============================
   LISTAR VENDAS
   GET /vendas
=============================== */

router.get(
  "/vendas",
  auth,
  requirePermission("painelVendas"),
  async (req, res) => {
    try {
      const {
        busca = "",
        status = "",
        plano = "",
        vendedor = "",
        pagamento = "",
        dataInicio = "",
        dataFim = "",
        limite = 300
      } = req.query;

      const filtro = {};

      if (!podeVerTodasVendas(req.usuario)) {
        filtro.vendedorId = req.usuario._id;
      }

      if (busca) {
        const termo = String(busca).trim();

        filtro.$or = [
          { alunoNome: { $regex: termo, $options: "i" } },
          { alunoEmail: { $regex: termo, $options: "i" } },
          { alunoTelefone: { $regex: termo, $options: "i" } },
          { vendedorNome: { $regex: termo, $options: "i" } },
          { vendedorEmail: { $regex: termo, $options: "i" } }
        ];
      }

      if (status) {
        filtro.status = status;
      }

      if (plano) {
        filtro.plano = normalizarPlano(plano);
      }

      if (vendedor && podeVerTodasVendas(req.usuario)) {
        filtro.$or = [
          { vendedorNome: { $regex: vendedor, $options: "i" } },
          { vendedorEmail: { $regex: vendedor, $options: "i" } }
        ];
      }

      if (dataInicio || dataFim) {
        filtro.createdAt = {};

        if (dataInicio) {
          filtro.createdAt.$gte = new Date(`${dataInicio}T00:00:00`);
        }

        if (dataFim) {
          filtro.createdAt.$lte = new Date(`${dataFim}T23:59:59`);
        }
      }

      if (pagamento) {
        filtro.formaPagamento = pagamento;
      }

      const vendas = await Venda.find(filtro)
        .sort({ createdAt: -1 })
        .limit(Number(limite) || 300);

      return res.json({
        sucesso: true,
        total: vendas.length,
        vendas: vendas.map(formatarVenda)
      });
    } catch (error) {
      console.error("Erro ao listar vendas:", error);

      return res.status(500).json({
        erro: "Erro interno ao listar vendas."
      });
    }
  }
);

/* ===============================
   BUSCAR VENDA
   GET /vendas/:id
=============================== */

router.get(
  "/vendas/:id",
  auth,
  requirePermission("painelVendas"),
  async (req, res) => {
    try {
      const venda = await buscarVendaPorId(req.params.id);

      if (!venda) {
        return res.status(404).json({
          erro: "Venda não encontrada."
        });
      }

      if (!podeVerTodasVendas(req.usuario)) {
        if (String(venda.vendedorId) !== String(req.usuario._id)) {
          return res.status(403).json({
            erro: "Você não tem permissão para visualizar esta venda."
          });
        }
      }

      return res.json({
        sucesso: true,
        venda: formatarVenda(venda)
      });
    } catch (error) {
      console.error("Erro ao buscar venda:", error);

      return res.status(500).json({
        erro: "Erro interno ao buscar venda."
      });
    }
  }
);

/* ===============================
   CRIAR VENDA
   POST /vendas
=============================== */

router.post(
  "/vendas",
  auth,
  requirePermission("painelVendas"),
  async (req, res) => {
    try {
      const {
        alunoId = "",
        alunoNome = "",
        nome = "",
        alunoEmail = "",
        email = "",
        alunoTelefone = "",
        telefone = "",
        cidade = "",
        estado = "",

        vendedorId = "",
        vendedorEmail = "",

        plano = "black30",
        diasPlano,
        valor = 0,
        formaPagamento = "PIX",
        status = "pago",
        observacoes = ""
      } = req.body;

      const planoFinal = normalizarPlano(plano);
      const valorFinal = Number(valor || 0);

      if (valorFinal <= 0) {
        return res.status(400).json({
          erro: "O valor da venda precisa ser maior que zero."
        });
      }

      const vendedor = await buscarVendedor({
        vendedorId: podeVerTodasVendas(req.usuario) ? vendedorId : "",
        vendedorEmail: podeVerTodasVendas(req.usuario) ? vendedorEmail : "",
        usuarioAtual: req.usuarioDoc
      });

      if (!vendedor) {
        return res.status(400).json({
          erro: "Vendedor não encontrado."
        });
      }

      let aluno = null;

      if (alunoId && mongoose.Types.ObjectId.isValid(alunoId)) {
        aluno = await Aluno.findById(alunoId);
      }

      if (!aluno) {
        aluno = await buscarOuCriarAluno({
          nome: alunoNome || nome,
          email: alunoEmail || email,
          telefone: alunoTelefone || telefone,
          cidade,
          estado,
          plano: planoFinal,
          diasPlano,
          valor: valorFinal,
          formaPagamento,
          statusVenda: status,
          vendedor,
          usuarioAtual: req.usuarioDoc,
          observacoes
        });
      }

      const porcentagemComissao = Number(vendedor.comissao || 20);
      const comissao = calcularComissao(valorFinal, porcentagemComissao);

      const venda = await Venda.create({
        alunoId: aluno._id,
        alunoNome: aluno.nome || alunoNome || nome || "",
        alunoTelefone: aluno.telefone || alunoTelefone || telefone || "",
        alunoEmail: aluno.email || alunoEmail || email || "",

        vendedorId: vendedor._id,
        vendedorNome: vendedor.nome || "",
        vendedorEmail: vendedor.email || "",

        plano: planoFinal,
        valor: valorFinal,
        formaPagamento,

        status,

        porcentagemComissao,
        comissao,

        dataVenda: hojeData(),
        pagoEm: status === "pago" ? hojeISO() : "",
        canceladoEm: status === "cancelado" ? hojeISO() : "",

        observacoes,
        origem: "painel-vendas",

        criadoPor: req.usuario?.email || "",
        atualizadoPor: req.usuario?.email || ""
      });

      return res.status(201).json({
        sucesso: true,
        mensagem: "Venda registrada com sucesso.",
        venda: formatarVenda(venda),
        aluno: {
          id: String(aluno._id),
          nome: aluno.nome,
          email: aluno.email,
          telefone: aluno.telefone,
          plano: aluno.plano,
          vencimento: aluno.vencimento,
          status: aluno.status
        }
      });
    } catch (error) {
      console.error("Erro ao criar venda:", error);

      return res.status(500).json({
        erro: error.message || "Erro interno ao criar venda."
      });
    }
  }
);

/* ===============================
   ATUALIZAR VENDA
   PUT /vendas/:id
=============================== */

router.put(
  "/vendas/:id",
  auth,
  requirePermission("painelVendas"),
  async (req, res) => {
    try {
      const venda = await buscarVendaPorId(req.params.id);

      if (!venda) {
        return res.status(404).json({
          erro: "Venda não encontrada."
        });
      }

      if (!podeVerTodasVendas(req.usuario)) {
        if (String(venda.vendedorId) !== String(req.usuario._id)) {
          return res.status(403).json({
            erro: "Você não tem permissão para editar esta venda."
          });
        }
      }

      const camposPermitidos = [
        "alunoNome",
        "alunoTelefone",
        "alunoEmail",
        "formaPagamento",
        "status",
        "observacoes"
      ];

      camposPermitidos.forEach((campo) => {
        if (req.body[campo] !== undefined) {
          venda[campo] = req.body[campo];
        }
      });

      if (req.body.plano !== undefined) {
        venda.plano = normalizarPlano(req.body.plano);
      }

      if (req.body.valor !== undefined) {
        venda.valor = Number(req.body.valor || 0);
      }

      if (req.body.status === "pago" && !venda.pagoEm) {
        venda.pagoEm = hojeISO();
      }

      if (
        (req.body.status === "cancelado" || req.body.status === "estornado") &&
        !venda.canceladoEm
      ) {
        venda.canceladoEm = hojeISO();
      }

      venda.comissao = calcularComissao(venda.valor, venda.porcentagemComissao);
      venda.atualizadoPor = req.usuario?.email || "";

      await venda.save();

      return res.json({
        sucesso: true,
        mensagem: "Venda atualizada com sucesso.",
        venda: formatarVenda(venda)
      });
    } catch (error) {
      console.error("Erro ao atualizar venda:", error);

      return res.status(500).json({
        erro: "Erro interno ao atualizar venda."
      });
    }
  }
);

/* ===============================
   ALTERAR STATUS DA VENDA
   POST /vendas/:id/status
=============================== */

router.post(
  "/vendas/:id/status",
  auth,
  requirePermission("painelVendas"),
  async (req, res) => {
    try {
      const venda = await buscarVendaPorId(req.params.id);

      if (!venda) {
        return res.status(404).json({
          erro: "Venda não encontrada."
        });
      }

      if (!podeVerTodasVendas(req.usuario)) {
        if (String(venda.vendedorId) !== String(req.usuario._id)) {
          return res.status(403).json({
            erro: "Você não tem permissão para alterar esta venda."
          });
        }
      }

      const { status } = req.body;

      const permitidos = ["pendente", "pago", "cancelado", "estornado"];

      if (!permitidos.includes(status)) {
        return res.status(400).json({
          erro: "Status inválido.",
          permitidos
        });
      }

      venda.status = status;

      if (status === "pago") {
        venda.pagoEm = hojeISO();
      }

      if (status === "cancelado" || status === "estornado") {
        venda.canceladoEm = hojeISO();
      }

      venda.comissao = calcularComissao(venda.valor, venda.porcentagemComissao);
      venda.atualizadoPor = req.usuario?.email || "";

      await venda.save();

      if (venda.alunoId) {
        const aluno = await Aluno.findById(venda.alunoId);

        if (aluno) {
          aluno.statusPagamento = status === "pago" ? "pago" : "pendente";

          if (status === "cancelado" || status === "estornado") {
            aluno.statusPagamento = "cancelado";
          }

          aluno.atualizadoPor = req.usuario?.email || "";
          await aluno.save();
        }
      }

      return res.json({
        sucesso: true,
        mensagem: "Status da venda atualizado com sucesso.",
        venda: formatarVenda(venda)
      });
    } catch (error) {
      console.error("Erro ao alterar status da venda:", error);

      return res.status(500).json({
        erro: "Erro interno ao alterar status da venda."
      });
    }
  }
);

/* ===============================
   EXCLUIR VENDA
   DELETE /vendas/:id
=============================== */

router.delete(
  "/vendas/:id",
  auth,
  requirePermission("relatorios"),
  async (req, res) => {
    try {
      const venda = await buscarVendaPorId(req.params.id);

      if (!venda) {
        return res.status(404).json({
          erro: "Venda não encontrada."
        });
      }

      await Venda.deleteOne({ _id: venda._id });

      return res.json({
        sucesso: true,
        mensagem: "Venda removida com sucesso."
      });
    } catch (error) {
      console.error("Erro ao remover venda:", error);

      return res.status(500).json({
        erro: "Erro interno ao remover venda."
      });
    }
  }
);

/* ===============================
   ALIASES ADMIN
=============================== */

router.get(
  "/admin/vendas",
  auth,
  requirePermission("painelVendas"),
  async (req, res) => {
    req.url = "/vendas";
    router.handle(req, res);
  }
);

router.get(
  "/admin/vendas/resumo",
  auth,
  requirePermission("painelVendas"),
  async (req, res) => {
    req.url = "/vendas/resumo";
    router.handle(req, res);
  }
);

router.get(
  "/admin/vendas/ranking",
  auth,
  requirePermission("painelVendas"),
  async (req, res) => {
    req.url = "/vendas/ranking";
    router.handle(req, res);
  }
);

/* ===============================
   STATUS DO MÓDULO
=============================== */

router.get("/vendas/status", (req, res) => {
  res.json({
    status: "online",
    modulo: "vendas",
    rotas: [
      "GET /vendas",
      "GET /vendas/resumo",
      "GET /vendas/ranking",
      "GET /vendas/:id",
      "POST /vendas",
      "PUT /vendas/:id",
      "POST /vendas/:id/status",
      "DELETE /vendas/:id"
    ]
  });
});

module.exports = router;
