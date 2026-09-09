"use strict";

require("./password-model-guard");
const Usuario = require("../models/Usuario");
const PermissaoSistema = require("../models/PermissaoSistema");
const { verifyPassword } = require("./passwords");

const DEV_EMAIL = String(process.env.DEV_EMAIL || "dev@turmablack.com")
  .trim()
  .toLowerCase();

async function garantirMatrizOperacional() {
  const registro = await PermissaoSistema.obter();
  const matrizAtual = registro.matriz && typeof registro.matriz === "object" ? registro.matriz : {};

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
  const senhaDev = String(process.env.DEV_PASSWORD || "");

  if (!senhaDev || senhaDev.length < 12) {
    console.warn("Conta Dev automática não criada/alterada: configure DEV_PASSWORD com pelo menos 12 caracteres.");
    return;
  }

  const atual = await Usuario.findOne({ email: DEV_EMAIL });
  const senhaAtualValida = atual
    ? (await verifyPassword(atual.senha, senhaDev)).valid
    : false;

  const dados = {
    nome: atual?.nome || "Dev Turma do Primo",
    email: DEV_EMAIL,
    telefone: atual?.telefone || "",
    tipo: "admin",
    cargo: "dev",
    contaDev: true,
    permissoesPersonalizadas: {},
    vendedor: true,
    comissao: Number(atual?.comissao || 20),
    aprovado: true,
    suspenso: Boolean(atual?.suspenso),
    status: atual?.status === "suspenso" || atual?.status === "bloqueado" ? atual.status : "ativo",
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

  if (!senhaAtualValida) dados.senha = senhaDev;

  if (atual) {
    Object.assign(atual, dados);
    await atual.save();
    console.log(`Conta Dev MySQL validada: ${DEV_EMAIL}`);
    return;
  }

  await Usuario.create({ ...dados, senha: senhaDev });
  console.log(`Conta Dev MySQL criada: ${DEV_EMAIL}`);
}

async function bootstrapDevAccount() {
  await garantirMatrizOperacional();
  await garantirContaDev();
}

module.exports = bootstrapDevAccount;
