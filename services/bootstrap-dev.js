"use strict";

const Usuario = require("../models/Usuario");
const PermissaoSistema = require("../models/PermissaoSistema");

const DEV_EMAIL = String(process.env.DEV_EMAIL || "dev@turmablack.com")
  .trim()
  .toLowerCase();

async function garantirMatrizOperacional() {
  const registro = await PermissaoSistema.obter();
  const matrizAtual =
    registro.matriz && typeof registro.matriz === "object"
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

  registro.atualizadoPor = "bootstrap-permissoes-mysql-v4.2";
  await registro.save();
}

async function garantirContaDev() {
  const senhaDev = String(
    process.env.DEV_PASSWORD ||
    process.env.SETUP_SECRET ||
    ""
  );

  if (!senhaDev) {
    console.warn(
      "Conta Dev automática não criada: configure DEV_PASSWORD ou SETUP_SECRET. " +
      "O cadastro normal e a rota /setup/superadmin continuam disponíveis."
    );
    return;
  }

  const atual = await Usuario.findOne({ email: DEV_EMAIL });

  const dados = {
    nome: atual?.nome || "Dev Turma do Primo",
    email: DEV_EMAIL,
    senha: senhaDev,
    telefone: atual?.telefone || "",
    tipo: "admin",
    cargo: "dev",
    contaDev: true,
    permissoesPersonalizadas: {},
    vendedor: true,
    comissao: Number(atual?.comissao || 20),
    aprovado: true,
    suspenso: false,
    status: "ativo",
    codigo: atual?.codigo || "TB-DEV-2026",
    plano: "admin",
    dataExpiracao: "",
    acessos: Number(atual?.acessos || 0),
    dispositivos: Array.isArray(atual?.dispositivos) ? atual.dispositivos : [],
    ultimoLogin: atual?.ultimoLogin || "",
    aprovadoEm: atual?.aprovadoEm || new Date().toISOString(),
    criadoPor: atual?.criadoPor || "bootstrap-dev-mysql",
    atualizadoPor: "bootstrap-dev-mysql"
  };

  if (atual) {
    Object.assign(atual, dados);
    await atual.save();
    console.log(`Conta Dev MySQL validada: ${DEV_EMAIL}`);
    return;
  }

  await Usuario.create(dados);
  console.log(`Conta Dev MySQL criada: ${DEV_EMAIL}`);
}

async function bootstrapDevAccount() {
  await garantirMatrizOperacional();
  await garantirContaDev();
}

module.exports = bootstrapDevAccount;
