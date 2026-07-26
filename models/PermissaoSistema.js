const mongoose = require("mongoose");

const permissaoSistemaSchema = new mongoose.Schema(
  {
    chave: {
      type: String,
      unique: true,
      default: "matriz-principal"
    },
    matriz: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    historico: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    atualizadoPor: {
      type: String,
      default: ""
    }
  },
  { timestamps: true, minimize: false }
);

permissaoSistemaSchema.statics.obter = async function () {
  let registro = await this.findOne({ chave: "matriz-principal" });

  if (!registro) {
    registro = await this.create({
      chave: "matriz-principal",
      matriz: {},
      historico: []
    });
  }

  return registro;
};

module.exports = mongoose.model("PermissaoSistema", permissaoSistemaSchema);
