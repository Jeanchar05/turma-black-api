const mongoose = require("mongoose");

const solicitacaoLiberacaoSchema = new mongoose.Schema(
  {
    codigo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
      index: true
    },
    nome: { type: String, default: "" },
    email: { type: String, default: "", lowercase: true, trim: true },
    telefone: { type: String, default: "" },
    plano: {
      type: String,
      enum: ["black30", "black90", "black180", "black360"],
      default: "black30"
    },
    valor: { type: Number, default: 0 },
    referenciaPagamento: { type: String, default: "" },
    comprovante: { type: String, default: "" },
    observacao: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pendente", "aprovado", "recusado", "cancelado"],
      default: "pendente",
      index: true
    },
    criadoEm: { type: Date, default: Date.now },
    analisadoEm: { type: Date, default: null },
    analisadoPor: { type: String, default: "" },
    motivoRecusa: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SolicitacaoLiberacao", solicitacaoLiberacaoSchema);
