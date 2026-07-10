const mongoose = require("mongoose");

const alternativaSchema = new mongoose.Schema(
  {
    texto: {
      type: String,
      required: true
    },

    correta: {
      type: Boolean,
      default: false
    }
  },
  { _id: true }
);

const perguntaSchema = new mongoose.Schema(
  {
    enunciado: {
      type: String,
      required: true
    },

    tipo: {
      type: String,
      enum: ["multipla_escolha", "texto"],
      default: "multipla_escolha"
    },

    alternativas: {
      type: [alternativaSchema],
      default: []
    },

    respostaTextoEsperada: {
      type: String,
      default: ""
    },

    explicacao: {
      type: String,
      default: ""
    },

    peso: {
      type: Number,
      default: 1
    },

    ordem: {
      type: Number,
      default: 0
    }
  },
  { _id: true }
);

const provaSchema = new mongoose.Schema(
  {
    titulo: {
      type: String,
      required: true,
      trim: true
    },

    descricao: {
      type: String,
      default: ""
    },

    modulo: {
      type: String,
      default: ""
    },

    categoria: {
      type: String,
      enum: ["geral", "roleta", "gestao", "mentalidade", "estrategia", "outro"],
      default: "geral"
    },

    dificuldade: {
      type: String,
      enum: ["facil", "media", "dificil", "extrema"],
      default: "media"
    },

    publico: {
      type: String,
      enum: ["todos", "free", "premium", "admin"],
      default: "premium"
    },

    status: {
      type: String,
      enum: ["rascunho", "ativa", "inativa", "arquivada"],
      default: "rascunho"
    },

    notaMinima: {
      type: Number,
      default: 70
    },

    tentativasPermitidas: {
      type: Number,
      default: 3
    },

    tempoLimiteMinutos: {
      type: Number,
      default: 0
    },

    perguntas: {
      type: [perguntaSchema],
      default: []
    },

    criadaPor: {
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

provaSchema.index({ titulo: "text", descricao: "text", modulo: "text" });
provaSchema.index({ status: 1 });
provaSchema.index({ publico: 1 });
provaSchema.index({ categoria: 1 });
provaSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Prova", provaSchema);
