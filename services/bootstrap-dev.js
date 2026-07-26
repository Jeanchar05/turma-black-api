const mongoose = require("mongoose");
const Usuario = require("../models/Usuario");

const MIGRATION_ID = "reset-contas-dev-2026-07-26-v1";
const DEV_EMAIL = String(process.env.DEV_EMAIL || "dev@turmablack.com")
  .trim()
  .toLowerCase();

function montarUsuarioDev(senhaDev) {
  return {
    nome: "Dev Turma do Primo",
    email: DEV_EMAIL,
    senha: senhaDev,
    telefone: "",
    tipo: "admin",
    cargo: "dev",
    contaDev: true,
    permissoesPersonalizadas: {},
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
  };
}

async function garantirPerfilDev(senhaDev = "") {
  const existente = await Usuario.findOne({ email: DEV_EMAIL });

  if (!existente) {
    if (!senhaDev) {
      throw new Error("Conta Dev não encontrada e nenhuma senha inicial foi informada.");
    }

    await Usuario.create(montarUsuarioDev(senhaDev));
    return;
  }

  existente.tipo = "admin";
  existente.cargo = "dev";
  existente.contaDev = true;
  existente.vendedor = true;
  existente.aprovado = true;
  existente.suspenso = false;
  existente.status = "ativo";
  existente.plano = "admin";
  existente.codigo = existente.codigo || "TB-DEV-2026";
  existente.permissoesPersonalizadas = {};
  existente.atualizadoPor = "bootstrap-dev";

  await existente.save({ validateModifiedOnly: true });
}

async function executarReset({ migrations, senhaDev, session = null }) {
  const opcoes = session ? { session } : {};
  const resultado = await Usuario.deleteMany({}, opcoes);

  await Usuario.create(
    [montarUsuarioDev(senhaDev)],
    session ? { session } : undefined
  );

  await migrations.insertOne(
    {
      _id: MIGRATION_ID,
      executadaEm: new Date(),
      contasRemovidas: Number(resultado.deletedCount || 0),
      devEmail: DEV_EMAIL
    },
    opcoes
  );
}

async function bootstrapDevAccount() {
  const migrations = mongoose.connection.collection("system_migrations");
  const executada = await migrations.findOne({ _id: MIGRATION_ID });
  const senhaDev = String(
    process.env.DEV_PASSWORD ||
    process.env.SETUP_SECRET ||
    ""
  );

  if (executada) {
    await garantirPerfilDev(senhaDev);
    console.log(`Conta Dev garantida: ${DEV_EMAIL}`);
    return;
  }

  if (!senhaDev) {
    throw new Error(
      "Não foi possível criar o login Dev: configure SETUP_SECRET ou DEV_PASSWORD."
    );
  }

  const session = await mongoose.startSession();

  try {
    try {
      await session.withTransaction(async () => {
        await executarReset({ migrations, senhaDev, session });
      });
    } catch (error) {
      const mensagem = String(error?.message || "");
      const semTransacao =
        error?.code === 20 ||
        /transaction numbers are only allowed|replica set|transactions are not supported/i.test(
          mensagem
        );

      if (!semTransacao) throw error;

      console.warn("Cluster sem transação. Executando reset Dev em modo compatível.");

      const jaExecutada = await migrations.findOne({ _id: MIGRATION_ID });
      if (!jaExecutada) {
        await executarReset({ migrations, senhaDev });
      }
    }

    await garantirPerfilDev(senhaDev);
    console.log(`Contas redefinidas. Login Dev criado: ${DEV_EMAIL}`);
  } finally {
    await session.endSession();
  }
}

module.exports = bootstrapDevAccount;
