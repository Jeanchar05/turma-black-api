const mongoose = require("mongoose");

function hojeISO() {
  return new Date().toISOString();
}

const respostaSchema = new mongoose.Schema(
  {
    perguntaId: {
      type: String,
      default: ""
    },

    enunciado: {
      type: String,
      default: ""
    },

    tipo: {
      type: String,
      enum: ["multipla_escolha", "texto"],
      default: "multipla_escolha"
    },

    resposta: {
      type: String,
      default: ""
    },

    alternativaId: {
      type: String,
      default: ""
    },

    correta: {
      type: Boolean,
      default: false
    },

    pontos: {
      type: Number,
      default: 0
    },

    peso: {
      type: Number,
      default: 1
    },

    comentario: {
      type: String,
      default: ""
    }
  },
  { _id: false }
);

const provaResultadoSchema = new mongoose.Schema(
  {
    provaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prova",
      required: true
    },

    provaTitulo: {
      type: String,
      default: ""
    },

    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null
    },

    usuarioNome: {
      type: String,
      default: ""
    },

    usuarioEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    respostas: {
      type: [respostaSchema],
      default: []
    },

    totalPerguntas: {
      type: Number,
      default: 0
    },

    acertos: {
      type: Number,
      default: 0
    },

    erros: {
      type: Number,
      default: 0
    },

    pontosObtidos: {
      type: Number,
      default: 0
    },

    pontosTotais: {
      type: Number,
      default: 0
    },

    nota: {
      type: Number,
      default: 0
    },

    notaMinima: {
      type: Number,
      default: 70
    },

    aprovado: {
      type: Boolean,
      default: false
    },

    status: {
      type: String,
      enum: ["pendente", "aprovado", "reprovado", "em_analise"],
      default: "pendente"
    },

    feedback: {
      type: String,
      default: ""
    },

    avaliadoPor: {
      type: String,
      default: ""
    },

    avaliadoEm: {
      type: String,
      default: ""
    },

    iniciadoEm: {
      type: String,
      default: hojeISO
    },

    finalizadoEm: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

provaResultadoSchema.index({ provaId: 1 });
provaResultadoSchema.index({ usuarioId: 1 });
provaResultadoSchema.index({ usuarioEmail: 1 });
provaResultadoSchema.index({ status: 1 });
provaResultadoSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ProvaResultado", provaResultadoSchema);
