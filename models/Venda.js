const mongoose = require("mongoose");

function hojeISO() {
  return new Date().toISOString();
}

function hojeData() {
  return new Date().toISOString().split("T")[0];
}

function calcularComissao(valor, porcentagem = 20) {
  const numero = Number(valor || 0);
  const taxa = Number(porcentagem || 20);

  return Number(((numero * taxa) / 100).toFixed(2));
}

const vendaSchema = new mongoose.Schema(
  {
    alunoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Aluno",
      required: true
    },

    alunoNome: {
      type: String,
      default: ""
    },

    alunoTelefone: {
      type: String,
      default: ""
    },

    alunoEmail: {
      type: String,
      default: ""
    },

    vendedorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true
    },

    vendedorNome: {
      type: String,
      default: ""
    },

    vendedorEmail: {
      type: String,
      default: ""
    },

    plano: {
      type: String,
      enum: ["black30", "black90", "black180", "black360", "particular"],
      default: "black30"
    },

    valor: {
      type: Number,
      required: true,
      default: 0
    },

    formaPagamento: {
      type: String,
      enum: ["PIX", "Cartão Crédito", "Cartão Débito", "Dinheiro", "Transferência", "Outro"],
      default: "PIX"
    },

    status: {
      type: String,
      enum: ["pendente", "pago", "cancelado", "estornado"],
      default: "pendente"
    },

    porcentagemComissao: {
      type: Number,
      default: 20
    },

    comissao: {
      type: Number,
      default: 0
    },

    dataVenda: {
      type: String,
      default: hojeData
    },

    pagoEm: {
      type: String,
      default: ""
    },

    canceladoEm: {
      type: String,
      default: ""
    },

    observacoes: {
      type: String,
      default: ""
    },

    origem: {
      type: String,
      enum: ["painel-vendas", "painel-admin", "manual", "renovacao"],
      default: "painel-vendas"
    },

    criadoPor: {
      type: String,
      default: ""
    },

    atualizadoPor: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

/* ===============================
   MIDDLEWARES
=============================== */

vendaSchema.pre("validate", function (next) {
  if (!this.porcentagemComissao) {
    this.porcentagemComissao = 20;
  }

  this.comissao = calcularComissao(this.valor, this.porcentagemComissao);

  if (this.status === "pago" && !this.pagoEm) {
    this.pagoEm = hojeISO();
  }

  if (this.status === "cancelado" && !this.canceladoEm) {
    this.canceladoEm = hojeISO();
  }

  next();
});

vendaSchema.pre("save", function (next) {
  this.comissao = calcularComissao(this.valor, this.porcentagemComissao);
  next();
});

/* ===============================
   MÉTODOS
=============================== */

vendaSchema.methods.marcarComoPago = function () {
  this.status = "pago";
  this.pagoEm = hojeISO();
  this.comissao = calcularComissao(this.valor, this.porcentagemComissao);
  return this.save();
};

vendaSchema.methods.cancelar = function () {
  this.status = "cancelado";
  this.canceladoEm = hojeISO();
  return this.save();
};

/* ===============================
   INDEXES
=============================== */

vendaSchema.index({ alunoId: 1 });
vendaSchema.index({ vendedorId: 1 });
vendaSchema.index({ vendedorEmail: 1 });
vendaSchema.index({ status: 1 });
vendaSchema.index({ dataVenda: 1 });
vendaSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Venda", vendaSchema);
