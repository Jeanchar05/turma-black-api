const mongoose = require("mongoose");
const bootstrapDevAccount = require("../services/bootstrap-dev");

async function connectDatabase() {
  const MONGO_URL = process.env.MONGO_URL;

  if (!MONGO_URL) {
    throw new Error("MONGO_URL não configurada.");
  }

  await mongoose.connect(MONGO_URL, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000
  });

  console.log("MongoDB conectado com sucesso");

  await bootstrapDevAccount();
}

module.exports = connectDatabase;
