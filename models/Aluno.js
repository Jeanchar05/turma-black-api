const mongoose = require("mongoose");

function hojeData() {
  return new Date().toISOString().split("T")[0];
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
    black30: 30,
    black90: 90,
    black180: 180,
    black360: 360,
    particular: 30
  };

  return mapa[plano] || 30;
}

const alunoSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      default: "",
      lowercase: true,
      trim: true
    },

    telefone: {
      type: String,
      default: ""
    },

    cidade: {
      type: String,
      default: ""
    },

    estado: {
      type: String,
      default: ""
    },

    plano: {
      type: String,
      enum: ["black30", "black90", "black180", "black360", "particular"],
      default: "black30"
    },

    diasPlano: {
      type: Number,
      default: 30
    },

    valor: {
      type: Number,
      default: 0
    },

    formaPagamento: {
      type: String,
      enum: ["PIX", "Cartão Crédito", "Cartão Débito", "Dinheiro", "Transferência", "Outro"],
      default: "PIX"
    },

    statusPagamento: {
      type: String,
      enum: ["pendente", "pago", "cancelado"],
      default: "pendente"
    },

    status: {
      type: String,
      enum: ["ativo", "pendente", "vencendo", "vencido", "cancelado", "inativo"],
      default: "ativo"
    },

    dataEntrada: {
      type: String,
      default: hojeData
    },

    vencimento: {
      type: String,
      default: ""
    },

    vendedorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null
    },

    vendedorNome: {
      type: String,
      default: ""
    },

    vendedorEmail: {
      type: String,
      default: ""
    },

    adminResponsavelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null
    },

    adminResponsavelEmail: {
      type: String,
      default: ""
    },

    origem: {
      type: String,
      enum: ["painel-vendas", "painel-admin", "manual", "importacao"],
      default: "painel-vendas"
    },

    observacoes: {
      type: String,
      default: ""
    },

    renovacoes: {
      type: Number,
      default: 0
    },

    ultimaRenovacao: {
      type: String,
      default: ""
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/* ===============================
   VIRTUALS
=============================== */

alunoSchema.virtual("diasRestantes").get(function () {
  return diferencaDias(this.vencimento);
});

alunoSchema.virtual("statusCalculado").get(function () {
  if (this.status === "cancelado" || this.status === "inativo") {
    return this.status;
  }

  const dias = diferencaDias(this.vencimento);

  if (dias === null) return this.status;
  if (dias < 0) return "vencido";
  if (dias <= 7) return "vencendo";

  return "ativo";
});

/* ===============================
   MIDDLEWARES
=============================== */

alunoSchema.pre("validate", function (next) {
  if (!this.diasPlano) {
    this.diasPlano = diasPorPlano(this.plano);
  }

  if (!this.vencimento) {
    this.vencimento = somarDias(this.dataEntrada || hojeData(), this.diasPlano);
  }

  next();
});

alunoSchema.pre("save", function (next) {
  const statusCalculado = this.statusCalculado;

  if (!["cancelado", "inativo"].includes(this.status)) {
    this.status = statusCalculado;
  }

  next();
});

/* ===============================
   INDEXES
=============================== */

alunoSchema.index({ nome: "text", email: "text", telefone: "text" });
alunoSchema.index({ vendedorId: 1 });
alunoSchema.index({ status: 1 });
alunoSchema.index({ vencimento: 1 });
alunoSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Aluno", alunoSchema);
