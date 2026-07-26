const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema(
  {
    nome: { type: String, default: "" },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    senha: { type: String, required: true },

    tipo: {
      type: String,
      enum: ["aluno", "admin"],
      default: "aluno"
    },

    cargo: {
      type: String,
      enum: [
        "aluno",
        "vendedor",
        "financeiro",
        "admin",
        "dono",
        "dev",
        "suporte",
        "moderador",
        "superadmin"
      ],
      default: "aluno"
    },

    contaDev: {
      type: Boolean,
      default: false,
      index: true
    },

    permissoesPersonalizadas: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },

    vendedor: { type: Boolean, default: false },
    comissao: { type: Number, default: 20 },
    aprovado: { type: Boolean, default: false },
    suspenso: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["pendente", "ativo", "suspenso", "bloqueado"],
      default: "pendente"
    },

    codigo: { type: String, default: "" },

    plano: {
      type: String,
      enum: ["free", "black30", "black90", "black180", "black360", "admin"],
      default: "free"
    },

    dataExpiracao: { type: String, default: "" },
    telefone: { type: String, default: "" },
    foto: { type: String, default: "" },
    acessos: { type: Number, default: 0 },
    dispositivos: { type: Array, default: [] },
    ultimoLogin: { type: String, default: "" },
    aprovadoEm: { type: String, default: "" },
    criadoPor: { type: String, default: "" },
    atualizadoPor: { type: String, default: "" }
  },
  { timestamps: true, minimize: false }
);

module.exports = mongoose.model("Usuario", usuarioSchema);
