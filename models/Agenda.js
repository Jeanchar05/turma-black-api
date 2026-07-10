const mongoose = require("mongoose");

function hojeISO() {
  return new Date().toISOString();
}

function hojeData() {
  return new Date().toISOString().split("T")[0];
}

function somarDias(dataBase, dias) {
  const data = new Date(`${dataBase}T00:00:00`);
  data.setDate(data.getDate() + Number(dias || 0));
  return data.toISOString().split("T")[0];
}

const agendaSchema = new mongoose.Schema(
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

    dataInicio: {
      type: String,
      required: true
    },

    horaInicio: {
      type: String,
      required: true
    },

    dataFinal: {
      type: String,
      required: true
    },

    horaFinal: {
      type: String,
      required: true
    },

    status: {
      type: String,
      enum: ["Agendar", "Agendado", "Concluído", "Cancelado", "Remarcar"],
      default: "Agendar"
    },

    tipo: {
      type: String,
      enum: ["live", "aula", "reuniao", "evento", "manutencao", "outro"],
      default: "evento"
    },

    prioridade: {
      type: String,
      enum: ["baixa", "media", "alta", "urgente"],
      default: "media"
    },

    publico: {
      type: String,
      enum: ["todos", "free", "premium", "admin", "vendedores", "especifico"],
      default: "todos"
    },

    emailUsuario: {
      type: String,
      default: "",
      lowercase: true,
      trim: true
    },

    link: {
      type: String,
      default: ""
    },

    local: {
      type: String,
      default: ""
    },

    googleEventId: {
      type: String,
      default: ""
    },

    enviadoGoogleEm: {
      type: String,
      default: ""
    },

    limparApos: {
      type: String,
      default: ""
    },

    notificar: {
      type: Boolean,
      default: true
    },

    notificadoEm: {
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

agendaSchema.methods.marcarComoAgendado = function () {
  this.status = "Agendado";
  this.enviadoGoogleEm = hojeISO();

  if (!this.limparApos) {
    this.limparApos = somarDias(hojeData(), 7);
  }

  return this.save();
};

agendaSchema.methods.concluir = function () {
  this.status = "Concluído";

  if (!this.limparApos) {
    this.limparApos = somarDias(hojeData(), 7);
  }

  return this.save();
};

agendaSchema.methods.cancelar = function () {
  this.status = "Cancelado";
  return this.save();
};

agendaSchema.methods.remarcar = function () {
  this.status = "Remarcar";
  return this.save();
};

/* ===============================
   INDEXES
=============================== */

agendaSchema.index({ dataInicio: 1 });
agendaSchema.index({ horaInicio: 1 });
agendaSchema.index({ status: 1 });
agendaSchema.index({ tipo: 1 });
agendaSchema.index({ publico: 1 });
agendaSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Agenda", agendaSchema);
