"use strict";

require("./password-model-guard");
const Usuario = require("../models/Usuario");
const PermissaoSistema = require("../models/PermissaoSistema");
const {
  verifyPassword,
  validatePasswordPolicy,
  MIN_STAFF_PASSWORD_LENGTH
} = require("./passwords");
const { revokeAllUserSessions } = require("./sessions");

const DEV_EMAIL = String(process.env.DEV_EMAIL || "dev@turmablack.com")
  .trim()
  .toLowerCase();

async function garantirMatrizOperacional() {
  const registro = await PermissaoSistema.obter();
  const matrizAtual = registro.matriz && typeof registro.matriz === "object" ? registro.matriz : {};

  // O bootstrap não concede privilégios adicionais a cargos comuns. Ele apenas
  // garante uma matriz existente. Permissões operacionais são alteradas pela
  // Central Dev auditável, não durante cada inicialização do servidor.
  if (!registro.matriz || typeof registro.matriz !== "object") {
    registro.matriz = { ...matrizAtual };
    registro.atualizadoPor = "bootstrap-permissoes-seguro";
    await registro.save();
  }
}

async function garantirContaDev() {
  const senhaDev = String(process.env.DEV_PASSWORD || "");
  const politica = validatePasswordPolicy(senhaDev, {
    minimumLength: MIN_STAFF_PASSWORD_LENGTH,
    email: DEV_EMAIL,
    name: "Dev Turma do Primo"
  });

  if (!politica.valid) {
    console.warn(`Conta Dev automática não criada/alterada: ${politica.reason || "configure DEV_PASSWORD forte e exclusiva."}`);
    return;
  }

  const atual = await Usuario.findOne({ email: DEV_EMAIL });
  const senhaAtualValida = atual
    ? (await verifyPassword(atual.senha, senhaDev)).valid
    : false;

  const eraDevValido = Boolean(atual?.contaDev === true && String(atual?.cargo || "").toLowerCase() === "dev");
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
    atualizadoPor: "bootstrap-dev-mysql-seguro"
  };

  if (!senhaAtualValida) dados.senha = senhaDev;

  if (atual) {
    Object.assign(atual, dados);
    await atual.save();

    // Se a identidade foi promovida a Dev ou a credencial Dev foi rotacionada,
    // nenhuma sessão anterior continua válida.
    if (!eraDevValido || !senhaAtualValida) {
      await revokeAllUserSessions(String(atual._id || atual.id || ""), "dev-bootstrap-security-change");
    }

    console.log(`Conta Dev MySQL validada: ${DEV_EMAIL}`);
    return;
  }

  const criada = await Usuario.create({ ...dados, senha: senhaDev });
  await revokeAllUserSessions(String(criada._id || criada.id || ""), "dev-account-created");
  console.log(`Conta Dev MySQL criada: ${DEV_EMAIL}`);
}

async function bootstrapDevAccount() {
  await garantirMatrizOperacional();
  await garantirContaDev();
}

module.exports = bootstrapDevAccount;
