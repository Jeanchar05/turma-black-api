const mongoose = require("mongoose");

function hojeISO() {
  return new Date().toISOString();
}

const respostaSchema = new mongoose.Schema(
  {
    autorNome: {
      type: String,
      default: ""
    },

    autorEmail: {
      type: String,
      default: ""
    },

    autorCargo: {
      type: String,
      default: "aluno"
    },

    mensagem: {
      type: String,
      required: true
    },

    tipo: {
      type: String,
      enum: ["usuario", "equipe", "sistema"],
      default: "usuario"
    },

    criadoEm: {
      type: String,
      default: hojeISO
    }
  },
  { _id: true }
);

const chamadoSchema = new mongoose.Schema(
  {
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null
    },

    nome: {
      type: String,
      default: ""
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    assunto: {
      type: String,
      required: true,
      trim: true
    },

    mensagem: {
      type: String,
      required: true
    },

    categoria: {
      type: String,
      enum: [
        "duvida",
        "acesso",
        "pagamento",
        "prova",
        "plataforma",
        "vendas",
        "bug",
        "outro"
      ],
      default: "duvida"
    },

    prioridade: {
      type: String,
      enum: ["baixa", "normal", "alta", "urgente"],
      default: "normal"
    },

    status: {
      type: String,
      enum: ["aberto", "em_atendimento", "respondido", "resolvido", "fechado"],
      default: "aberto"
    },

    respostas: {
      type: [respostaSchema],
      default: []
    },

    ultimaRespostaEm: {
      type: String,
      default: ""
    },

    encerradoEm: {
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
    timestamps: true
  }
);

chamadoSchema.methods.adicionarResposta = function ({
  autorNome = "",
  autorEmail = "",
  autorCargo = "aluno",
  mensagem,
  tipo = "usuario"
}) {
  this.respostas.push({
    autorNome,
    autorEmail,
    autorCargo,
    mensagem,
    tipo,
    criadoEm: hojeISO()
  });

  this.ultimaRespostaEm = hojeISO();

  if (tipo === "equipe") {
    this.status = "respondido";
  }

  if (tipo === "usuario" && this.status !== "fechado") {
    this.status = "em_atendimento";
  }

  return this.save();
};

chamadoSchema.methods.alterarStatus = function (status, atualizadoPor = "") {
  this.status = status;
  this.atualizadoPor = atualizadoPor;

  if (status === "resolvido" || status === "fechado") {
    this.encerradoEm = hojeISO();
  }

  return this.save();
};

chamadoSchema.index({ email: 1 });
chamadoSchema.index({ usuarioId: 1 });
chamadoSchema.index({ status: 1 });
chamadoSchema.index({ categoria: 1 });
chamadoSchema.index({ prioridade: 1 });
chamadoSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Chamado", chamadoSchema);
