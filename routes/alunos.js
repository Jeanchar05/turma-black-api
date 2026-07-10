const express = require("express");
const mongoose = require("mongoose");

const Aluno = require("../models/Aluno");
const Usuario = require("../models/Usuario");

const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

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

function diferencaDias(dataFinal) {
  if (!dataFinal) return null;

  const hoje = new Date();
  const fim = new Date(`${dataFinal}T00:00:00`);

  hoje.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);

  return Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function diasPorPlano(plano) {
  const mapa = {
    black: 30,
    black30: 30,
    black90: 90,
    black180: 180,
    black360: 360,
    particular: 30
  };

  return mapa[plano] || 30;
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

function calcularStatus(vencimento, statusAtual = "ativo") {
  if (["cancelado", "inativo"].includes(statusAtual)) {
    return statusAtual;
  }

  const dias = diferencaDias(vencimento);

  if (dias === null) return statusAtual;
  if (dias < 0) return "vencido";
  if (dias <= 7) return "vencendo";

  return "ativo";
}

function formatarAluno(aluno) {
  if (!aluno) return null;

  const obj = aluno.toObject ? aluno.toObject({ virtuals: true }) : aluno;

  const diasRestantes = diferencaDias(obj.vencimento);
  const statusCalculado = calcularStatus(obj.vencimento, obj.status);

  return {
    id: String(obj._id || obj.id),
    _id: obj._id,

    nome: obj.nome || "",
    email: obj.email || "",
    telefone: obj.telefone || "",
    cidade: obj.cidade || "",
    estado: obj.estado || "",

    plano: obj.plano || "black30",
    diasPlano: Number(obj.diasPlano || 30),
    valor: Number(obj.valor || 0),

    formaPagamento: obj.formaPagamento || "PIX",
    statusPagamento: obj.statusPagamento || "pendente",

    status: statusCalculado,
    statusManual: obj.status || "ativo",

    dataEntrada: obj.dataEntrada || "",
    vencimento: obj.vencimento || "",
    diasRestantes,

    vendedorId: obj.vendedorId || null,
    vendedorNome: obj.vendedorNome || "",
    vendedorEmail: obj.vendedorEmail || "",

    adminResponsavelId: obj.adminResponsavelId || null,
    adminResponsavelEmail: obj.adminResponsavelEmail || "",

    origem: obj.origem || "manual",
    observacoes: obj.observacoes || "",

    renovacoes: Number(obj.renovacoes || 0),
    ultimaRenovacao: obj.ultimaRenovacao || "",

    criadoPor: obj.criadoPor || "",
    atualizadoPor: obj.atualizadoPor || "",

    createdAt: obj.createdAt || "",
    updatedAt: obj.updatedAt || ""
  };
}

async function buscarAlunoPorId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return Aluno.findById(id);
}

async function buscarVendedor({ vendedorId, vendedorEmail }) {
  if (vendedorId && mongoose.Types.ObjectId.isValid(vendedorId)) {
    const vendedor = await Usuario.findById(vendedorId);

    if (vendedor) return vendedor;
  }

  const email = String(vendedorEmail || "").toLowerCase().trim();

  if (email) {
    const vendedor = await Usuario.findOne({ email });

    if (vendedor) return vendedor;
  }

  return null;
}

/* ===============================
   RESUMO
   GET /admin/controle-alunos/resumo
=============================== */

router.get(
  "/admin/controle-alunos/resumo",
  auth,
  requirePermission("controleAlunos"),
  async (req, res) => {
    try {
      const alunos = await Aluno.find();

      let ativos = 0;
      let vencendo = 0;
      let vencidos = 0;
      let cancelados = 0;
      let pendentesPagamento = 0;
      let pagos = 0;

      alunos.forEach((aluno) => {
        const status = calcularStatus(aluno.vencimento, aluno.status);

        if (status === "ativo") ativos++;
        if (status === "vencendo") vencendo++;
        if (status === "vencido") vencidos++;
        if (status === "cancelado" || status === "inativo") cancelados++;

        if (aluno.statusPagamento === "pendente") pendentesPagamento++;
        if (aluno.statusPagamento === "pago") pagos++;
      });

      return res.json({
        sucesso: true,
        resumo: {
          total: alunos.length,
          ativos,
          vencendo,
          vencidos,
          cancelados,
          pendentesPagamento,
          pagos
        }
      });
    } catch (error) {
      console.error("Erro no resumo de alunos:", error);

      return res.status(500).json({
        erro: "Erro interno ao gerar resumo de alunos."
      });
    }
  }
);

/* ===============================
   LISTAR ALUNOS
   GET /admin/controle-alunos
=============================== */

router.get(
  "/admin/controle-alunos",
  auth,
  requirePermission("controleAlunos"),
  async (req, res) => {
    try {
      const {
        busca = "",
        status = "",
        plano = "",
        vendedor = "",
        pagamento = "",
        limite = 300
      } = req.query;

      const filtro = {};

      if (busca) {
        const termo = String(busca).trim();

        filtro.$or = [
          { nome: { $regex: termo, $options: "i" } },
          { email: { $regex: termo, $options: "i" } },
          { telefone: { $regex: termo, $options: "i" } },
          { cidade: { $regex: termo, $options: "i" } },
          { vendedorNome: { $regex: termo, $options: "i" } },
          { vendedorEmail: { $regex: termo, $options: "i" } }
        ];
      }

      if (plano) {
        filtro.plano = normalizarPlano(plano);
      }

      if (pagamento) {
        filtro.statusPagamento = pagamento;
      }

      if (vendedor) {
        filtro.$or = [
          { vendedorNome: { $regex: vendedor, $options: "i" } },
          { vendedorEmail: { $regex: vendedor, $options: "i" } }
        ];
      }

      if (status && !["ativo", "vencendo", "vencido"].includes(status)) {
        filtro.status = status;
      }

      let alunos = await Aluno.find(filtro)
        .sort({ createdAt: -1 })
        .limit(Number(limite) || 300);

      if (status && ["ativo", "vencendo", "vencido"].includes(status)) {
        alunos = alunos.filter((aluno) => {
          return calcularStatus(aluno.vencimento, aluno.status) === status;
        });
      }

      return res.json({
        sucesso: true,
        total: alunos.length,
        alunos: alunos.map(formatarAluno)
      });
    } catch (error) {
      console.error("Erro ao listar alunos:", error);

      return res.status(500).json({
        erro: "Erro interno ao listar alunos."
      });
    }
  }
);

/* ===============================
   BUSCAR ALUNO
   GET /admin/controle-alunos/:id
=============================== */

router.get(
  "/admin/controle-alunos/:id",
  auth,
  requirePermission("controleAlunos"),
  async (req, res) => {
    try {
      const aluno = await buscarAlunoPorId(req.params.id);

      if (!aluno) {
        return res.status(404).json({
          erro: "Aluno não encontrado."
        });
      }

      return res.json({
        sucesso: true,
        aluno: formatarAluno(aluno)
      });
    } catch (error) {
      console.error("Erro ao buscar aluno:", error);

      return res.status(500).json({
        erro: "Erro interno ao buscar aluno."
      });
    }
  }
);

/* ===============================
   CRIAR ALUNO
   POST /admin/controle-alunos
=============================== */

router.post(
  "/admin/controle-alunos",
  auth,
  requirePermission("controleAlunos"),
  async (req, res) => {
    try {
      const {
        nome,
        email = "",
        telefone = "",
        cidade = "",
        estado = "",
        plano = "black30",
        diasPlano,
        valor = 0,
        formaPagamento = "PIX",
        statusPagamento = "pendente",
        dataEntrada = hojeData(),
        vendedorId = "",
        vendedorEmail = "",
        observacoes = "",
        origem = "painel-admin"
      } = req.body;

      if (!nome) {
        return res.status(400).json({
          erro: "O nome do aluno é obrigatório."
        });
      }

      const planoFinal = normalizarPlano(plano);
      const diasFinal = Number(diasPlano || diasPorPlano(planoFinal));

      let vendedor = await buscarVendedor({ vendedorId, vendedorEmail });

      if (!vendedor && req.usuario?.vendedor) {
        vendedor = req.usuarioDoc;
      }

      const aluno = await Aluno.create({
        nome: String(nome).trim(),
        email: String(email || "").toLowerCase().trim(),
        telefone,
        cidade,
        estado,

        plano: planoFinal,
        diasPlano: diasFinal,
        valor: Number(valor || 0),
        formaPagamento,
        statusPagamento,

        status: "ativo",
        dataEntrada,
        vencimento: somarDias(dataEntrada, diasFinal),

        vendedorId: vendedor?._id || null,
        vendedorNome: vendedor?.nome || "",
        vendedorEmail: vendedor?.email || "",

        adminResponsavelId: req.usuario?._id || null,
        adminResponsavelEmail: req.usuario?.email || "",

        origem,
        observacoes,

        criadoPor: req.usuario?.email || "",
        atualizadoPor: req.usuario?.email || ""
      });

      return res.status(201).json({
        sucesso: true,
        mensagem: "Aluno cadastrado com sucesso.",
        aluno: formatarAluno(aluno)
      });
    } catch (error) {
      console.error("Erro ao criar aluno:", error);

      return res.status(500).json({
        erro: "Erro interno ao criar aluno."
      });
    }
  }
);

/* ===============================
   ATUALIZAR ALUNO
   PUT /admin/controle-alunos/:id
=============================== */

router.put(
  "/admin/controle-alunos/:id",
  auth,
  requirePermission("controleAlunos"),
  async (req, res) => {
    try {
      const aluno = await buscarAlunoPorId(req.params.id);

      if (!aluno) {
        return res.status(404).json({
          erro: "Aluno não encontrado."
        });
      }

      const camposSimples = [
        "nome",
        "email",
        "telefone",
        "cidade",
        "estado",
        "valor",
        "formaPagamento",
        "statusPagamento",
        "status",
        "dataEntrada",
        "vencimento",
        "observacoes"
      ];

      camposSimples.forEach((campo) => {
        if (req.body[campo] !== undefined) {
          aluno[campo] = req.body[campo];
        }
      });

      if (req.body.plano !== undefined) {
        aluno.plano = normalizarPlano(req.body.plano);
      }

      if (req.body.diasPlano !== undefined) {
        aluno.diasPlano = Number(req.body.diasPlano || 30);
      }

      if (req.body.vendedorId || req.body.vendedorEmail) {
        const vendedor = await buscarVendedor({
          vendedorId: req.body.vendedorId,
          vendedorEmail: req.body.vendedorEmail
        });

        if (vendedor) {
          aluno.vendedorId = vendedor._id;
          aluno.vendedorNome = vendedor.nome || "";
          aluno.vendedorEmail = vendedor.email || "";
        }
      }

      aluno.atualizadoPor = req.usuario?.email || "";

      await aluno.save();

      return res.json({
        sucesso: true,
        mensagem: "Aluno atualizado com sucesso.",
        aluno: formatarAluno(aluno)
      });
    } catch (error) {
      console.error("Erro ao atualizar aluno:", error);

      return res.status(500).json({
        erro: "Erro interno ao atualizar aluno."
      });
    }
  }
);

/* ===============================
   RENOVAR ALUNO
   POST /admin/controle-alunos/:id/renovar
=============================== */

router.post(
  "/admin/controle-alunos/:id/renovar",
  auth,
  requirePermission("controleAlunos"),
  async (req, res) => {
    try {
      const aluno = await buscarAlunoPorId(req.params.id);

      if (!aluno) {
        return res.status(404).json({
          erro: "Aluno não encontrado."
        });
      }

      const {
        plano = aluno.plano,
        dias,
        valor,
        formaPagamento,
        statusPagamento = "pago",
        observacoes
      } = req.body;

      const planoFinal = normalizarPlano(plano);
      const diasFinal = Number(dias || diasPorPlano(planoFinal));

      const statusAtual = calcularStatus(aluno.vencimento, aluno.status);
      const baseRenovacao =
        statusAtual === "vencido" || !aluno.vencimento ? hojeData() : aluno.vencimento;

      aluno.plano = planoFinal;
      aluno.diasPlano = diasFinal;
      aluno.vencimento = somarDias(baseRenovacao, diasFinal);
      aluno.status = "ativo";
      aluno.statusPagamento = statusPagamento;
      aluno.renovacoes = Number(aluno.renovacoes || 0) + 1;
      aluno.ultimaRenovacao = hojeISO();

      if (valor !== undefined) {
        aluno.valor = Number(valor || 0);
      }

      if (formaPagamento) {
        aluno.formaPagamento = formaPagamento;
      }

      if (observacoes) {
        aluno.observacoes = aluno.observacoes
          ? `${aluno.observacoes}\n\nRenovação: ${observacoes}`
          : `Renovação: ${observacoes}`;
      }

      aluno.atualizadoPor = req.usuario?.email || "";

      await aluno.save();

      return res.json({
        sucesso: true,
        mensagem: "Aluno renovado com sucesso.",
        aluno: formatarAluno(aluno)
      });
    } catch (error) {
      console.error("Erro ao renovar aluno:", error);

      return res.status(500).json({
        erro: "Erro interno ao renovar aluno."
      });
    }
  }
);

/* ===============================
   ALTERAR STATUS
   POST /admin/controle-alunos/:id/status
=============================== */

router.post(
  "/admin/controle-alunos/:id/status",
  auth,
  requirePermission("controleAlunos"),
  async (req, res) => {
    try {
      const aluno = await buscarAlunoPorId(req.params.id);

      if (!aluno) {
        return res.status(404).json({
          erro: "Aluno não encontrado."
        });
      }

      const { status } = req.body;

      const permitidos = ["ativo", "pendente", "vencendo", "vencido", "cancelado", "inativo"];

      if (!permitidos.includes(status)) {
        return res.status(400).json({
          erro: "Status inválido.",
          permitidos
        });
      }

      aluno.status = status;
      aluno.atualizadoPor = req.usuario?.email || "";

      await aluno.save();

      return res.json({
        sucesso: true,
        mensagem: "Status atualizado com sucesso.",
        aluno: formatarAluno(aluno)
      });
    } catch (error) {
      console.error("Erro ao alterar status do aluno:", error);

      return res.status(500).json({
        erro: "Erro interno ao alterar status do aluno."
      });
    }
  }
);

/* ===============================
   EXCLUIR ALUNO
   DELETE /admin/controle-alunos/:id
=============================== */

router.delete(
  "/admin/controle-alunos/:id",
  auth,
  requirePermission("controleAlunos"),
  async (req, res) => {
    try {
      const aluno = await buscarAlunoPorId(req.params.id);

      if (!aluno) {
        return res.status(404).json({
          erro: "Aluno não encontrado."
        });
      }

      await Aluno.deleteOne({ _id: aluno._id });

      return res.json({
        sucesso: true,
        mensagem: "Aluno removido com sucesso."
      });
    } catch (error) {
      console.error("Erro ao remover aluno:", error);

      return res.status(500).json({
        erro: "Erro interno ao remover aluno."
      });
    }
  }
);

/* ===============================
   ALIASES SIMPLES
=============================== */

router.get("/alunos", auth, requirePermission("controleAlunos"), async (req, res) => {
  req.url = "/admin/controle-alunos";
  router.handle(req, res);
});

router.post("/alunos", auth, requirePermission("controleAlunos"), async (req, res) => {
  req.url = "/admin/controle-alunos";
  router.handle(req, res);
});

/* ===============================
   STATUS DO MÓDULO
=============================== */

router.get("/alunos/status", (req, res) => {
  res.json({
    status: "online",
    modulo: "alunos",
    rotas: [
      "GET /admin/controle-alunos",
      "GET /admin/controle-alunos/resumo",
      "GET /admin/controle-alunos/:id",
      "POST /admin/controle-alunos",
      "PUT /admin/controle-alunos/:id",
      "POST /admin/controle-alunos/:id/renovar",
      "POST /admin/controle-alunos/:id/status",
      "DELETE /admin/controle-alunos/:id"
    ]
  });
});

module.exports = router;
