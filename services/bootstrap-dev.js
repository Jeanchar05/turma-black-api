const mongoose = require("mongoose");
const Usuario = require("../models/Usuario");
const PermissaoSistema = require("../models/PermissaoSistema");

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

async function garantirMatrizOperacional() {
  const registro = await PermissaoSistema.obter();
  const matrizAtual = registro.matriz && typeof registro.matriz === "object"
    ? registro.matriz
    : {};

  registro.matriz = {
    ...matrizAtual,
    financeiro: {
      ...(matrizAtual.financeiro || {}),
      dashboard: true,
      painelAdmin: true,
      painelVendas: true,
      financas: true,
      relatorios: true
    }
  };
  registro.atualizadoPor = "bootstrap-permissoes-v4.1";
  registro.markModified("matriz");
  await registro.save();
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
  await garantirMatrizOperacional();

  const migrations = mongoose.connection.collection("system_migrations");
  const executada = await migrations.findOne({ _id: MIGRATION_ID });

  if (executada) {
    await Usuario.updateOne(
      { email: DEV_EMAIL },
      {
        $set: {
          cargo: "dev",
          tipo: "admin",
          contaDev: true,
          aprovado: true,
          suspenso: false,
          status: "ativo",
          plano: "admin",
          vendedor: true,
          atualizadoPor: "bootstrap-dev-v4"
        }
      }
    );
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
      if (!jaExecutada) await executarReset({ migrations, senhaDev });
    }

    console.log(`Contas redefinidas. Login Dev criado: ${DEV_EMAIL}`);
  } finally {
    await session.endSession();
  }
}

module.exports = bootstrapDevAccount;
