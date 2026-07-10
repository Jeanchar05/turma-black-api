const mongoose = require("mongoose");

async function connectDatabase() {
  const MONGO_URL = process.env.MONGO_URL;

  if (!MONGO_URL) {
    console.error("ERRO: MONGO_URL não configurada.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URL);

    console.log("MongoDB conectado com sucesso");
  } catch (error) {
    console.error("Erro ao conectar no MongoDB:", error.message);
    process.exit(1);
  }
}

module.exports = connectDatabase;
