const mongoose = require("mongoose");

function hojeISO() {
  return new Date().toISOString();
}

const notificacaoSchema = new mongoose.Schema(
  {
    titulo: {
      type: String,
      required: true,
      trim: true
    },

    mensagem: {
      type: String,
      required: true
    },

    tipo: {
      type: String,
      enum: [
        "geral",
        "atualizacao",
        "manutencao",
        "premium",
        "seguranca",
        "venda",
        "plano",
        "agenda",
        "prova",
        "suporte"
      ],
      default: "geral"
    },

    destino: {
      type: String,
      enum: [
        "todos",
        "premium",
        "free",
        "admin",
        "vendedores",
        "suporte",
        "moderadores",
        "superadmin",
        "especifico"
      ],
      default: "todos"
    },

    email: {
      type: String,
      default: "",
      lowercase: true,
      trim: true
    },

    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null
    },

    prioridade: {
      type: String,
      enum: ["baixa", "normal", "alta", "urgente"],
      default: "normal"
    },

    link: {
      type: String,
      default: ""
    },

    icone: {
      type: String,
      default: "🔔"
    },

    lidaPor: [
      {
        usuarioId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Usuario"
        },

        email: {
          type: String,
          default: ""
        },

        lidaEm: {
          type: String,
          default: hojeISO
        }
      }
    ],

    ativa: {
      type: Boolean,
      default: true
    },

    fixada: {
      type: Boolean,
      default: false
    },

    expiraEm: {
      type: String,
      default: ""
    },

    enviadaPor: {
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

/* ===============================
   MÉTODOS
=============================== */

notificacaoSchema.methods.marcarComoLida = function (usuario) {
  const email = String(usuario?.email || "").toLowerCase();
  const usuarioId = usuario?.id || usuario?._id || null;

  const jaLida = this.lidaPor.some((item) => {
    if (email && item.email === email) return true;
    if (usuarioId && String(item.usuarioId) === String(usuarioId)) return true;
    return false;
  });

  if (!jaLida) {
    this.lidaPor.push({
      usuarioId,
      email,
      lidaEm: hojeISO()
    });
  }

  return this.save();
};

notificacaoSchema.methods.desativar = function () {
  this.ativa = false;
  return this.save();
};

notificacaoSchema.methods.fixar = function () {
  this.fixada = true;
  return this.save();
};

notificacaoSchema.methods.desfixar = function () {
  this.fixada = false;
  return this.save();
};

/* ===============================
   STATICS
=============================== */

notificacaoSchema.statics.criarNotificacao = function ({
  titulo,
  mensagem,
  tipo = "geral",
  destino = "todos",
  email = "",
  usuarioId = null,
  prioridade = "normal",
  link = "",
  icone = "🔔",
  enviadaPor = "",
  criadoPor = ""
}) {
  return this.create({
    titulo,
    mensagem,
    tipo,
    destino,
    email,
    usuarioId,
    prioridade,
    link,
    icone,
    enviadaPor,
    criadoPor
  });
};

/* ===============================
   INDEXES
=============================== */

notificacaoSchema.index({ destino: 1 });
notificacaoSchema.index({ email: 1 });
notificacaoSchema.index({ usuarioId: 1 });
notificacaoSchema.index({ tipo: 1 });
notificacaoSchema.index({ ativa: 1 });
notificacaoSchema.index({ fixada: 1 });
notificacaoSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Notificacao", notificacaoSchema);
