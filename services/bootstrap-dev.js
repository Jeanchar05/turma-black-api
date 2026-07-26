const mongoose = require("mongoose");
const Usuario = require("../models/Usuario");

const MIGRATION_ID = "reset-contas-dev-2026-07-26-v1";
const DEV_EMAIL = String(process.env.DEV_EMAIL || "dev@turmablack.com")
  .trim()
  .toLowerCase();

async function bootstrapDevAccount() {
  const migrations = mongoose.connection.collection("system_migrations");
  const executada = await migrations.findOne({ _id: MIGRATION_ID });

  if (executada) {
    console.log(`Bootstrap Dev já executado: ${DEV_EMAIL}`);
    return;
  }

  const senhaDev = String(
    process.env.DEV_PASSWORD ||
    process.env.SETUP_SECRET ||
    ""
  );

  if (!senhaDev) {
    throw new Error(
      "Não foi possível criar o login Dev: configure SETUP_SECRET ou DEV_PASSWORD."
    );
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const resultado = await Usuario.deleteMany({}, { session });

      await Usuario.create(
        [
          {
            nome: "Dev Turma do Primo",
            email: DEV_EMAIL,
            senha: senhaDev,
            telefone: "",
            tipo: "admin",
            cargo: "superadmin",
            vendedor: true,
            comissao: 20,
            aprovado: true,
            suspenso: false,
            status: "ativo",
            codigo: "TB-DEV-2026",
            plano: "admin",
            dataExpiracao: "",
            acessos: 0,
            dispositivos: [],
            ultimoLogin: "",
            aprovadoEm: new Date().toISOString(),
            criadoPor: "bootstrap-dev",
            atualizadoPor: "bootstrap-dev"
          }
        ],
        { session }
      );

      await migrations.insertOne(
        {
          _id: MIGRATION_ID,
          executadaEm: new Date(),
          contasRemovidas: Number(resultado.deletedCount || 0),
          devEmail: DEV_EMAIL
        },
        { session }
      );
    });

    console.log(`Contas redefinidas. Login Dev criado: ${DEV_EMAIL}`);
  } finally {
    await session.endSession();
  }
}

module.exports = bootstrapDevAccount;
