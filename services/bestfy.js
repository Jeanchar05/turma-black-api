"use strict";

const database = require("../config/database");
const Usuario = require("../models/Usuario");
const { withTransaction } = require("./db-transaction");

const BESTFY_API_BASE = "https://api.bestfy.io";
const API_TIMEOUT_MS = 3500;
const COMPANY_CACHE_MS = 10 * 60 * 1000;
const MAX_PAYMENT_FUTURE_SKEW_MS = 10 * 60 * 1000;

const PLANOS = {
  black30: { dias: 30, valorCentavos: 9999 },
  black180: { dias: 180, valorCentavos: 24999 },
  black360: { dias: 365, valorCentavos: 39700 }
};

let tabelaGarantida = false;
let companyCache = { id: "", carregadoEm: 0 };

function erro(codigo, mensagem) {
  const error = new Error(mensagem);
  error.code = codigo;
  return error;
}

function normalizarEmail(valor) {
  return String(valor || "").trim().toLowerCase();
}

function emailValido(valor) {
  const email = normalizarEmail(valor);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarStatus(valor) {
  const status = String(valor || "").trim().toUpperCase();
  const aliases = {
    CANCELLED: "CANCELED",
    CANCELADO: "CANCELED",
    PAGO: "PAID",
    ESTORNADO: "REFUNDED",
    RECUSADO: "REJECTED"
  };
  return aliases[status] || status;
}

function quantidadeItem(item) {
  const raw = item?.quantity;
  return raw === undefined || raw === null || raw === "" ? 1 : Number(raw);
}

function parseExtras(value) {
  if (!value) return {};
  if (typeof value === "object" && !Buffer.isBuffer(value)) return { ...value };
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

async function garantirTabela() {
  if (tabelaGarantida) return;

  await database.query(`
    CREATE TABLE IF NOT EXISTS bestfy_transactions (
      transaction_id VARCHAR(96) NOT NULL PRIMARY KEY,
      company_id VARCHAR(96) NOT NULL DEFAULT '',
      status VARCHAR(40) NOT NULL DEFAULT '',
      customer_email VARCHAR(190) NOT NULL DEFAULT '',
      customer_name VARCHAR(180) NOT NULL DEFAULT '',
      customer_phone VARCHAR(60) NOT NULL DEFAULT '',
      user_id CHAR(24) NOT NULL DEFAULT '',
      plan VARCHAR(32) NOT NULL DEFAULT '',
      amount_cents INT NOT NULL DEFAULT 0,
      cart_json LONGTEXT NULL,
      raw_json LONGTEXT NULL,
      payment_confirmed_at VARCHAR(48) NOT NULL DEFAULT '',
      verified_at DATETIME NULL,
      applied_at DATETIME NULL,
      access_expires_at VARCHAR(48) NOT NULL DEFAULT '',
      revoked_at DATETIME NULL,
      processing TINYINT(1) NOT NULL DEFAULT 0,
      processing_started_at DATETIME NULL,
      last_error TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_bestfy_email (customer_email),
      KEY idx_bestfy_status (status),
      KEY idx_bestfy_user (user_id),
      KEY idx_bestfy_applied (applied_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  tabelaGarantida = true;
}

function getApiKey() {
  const apiKey = String(process.env.BESTFY_API_KEY || "").trim();
  if (!apiKey) throw erro("BESTFY_NOT_CONFIGURED", "BESTFY_API_KEY não configurada no servidor.");
  return apiKey;
}

async function bestfyRequest(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${BESTFY_API_BASE}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "turma-do-primo/4.6",
        "x-api-key": getApiKey()
      },
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const mensagem = data?.message || data?.erro || `Bestfy respondeu HTTP ${response.status}.`;
      throw erro("BESTFY_API_ERROR", mensagem);
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw erro("BESTFY_API_TIMEOUT", "Tempo limite ao consultar a Bestfy.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function obterCompanyIdEsperado() {
  const configurado = String(process.env.BESTFY_COMPANY_ID || "").trim();
  if (configurado) return configurado;

  if (companyCache.id && Date.now() - companyCache.carregadoEm < COMPANY_CACHE_MS) return companyCache.id;

  const data = await bestfyRequest("/company/validate-api-key");
  const id = String(data?.company?.id || "").trim();
  if (!id) throw erro("BESTFY_COMPANY_INVALID", "A API Key da Bestfy não retornou company.id.");

  companyCache = { id, carregadoEm: Date.now() };
  return id;
}

async function buscarTransacao(transactionId) {
  const data = await bestfyRequest(`/transaction/${encodeURIComponent(transactionId)}`);
  const transaction = data?.transaction;

  if (!transaction || String(transaction.transactionId || "") !== String(transactionId)) {
    throw erro("BESTFY_TRANSACTION_INVALID", "A transação retornada pela Bestfy é inválida.");
  }
  return transaction;
}

function calcularTotalCarrinhoCentavos(transaction) {
  const cart = Array.isArray(transaction?.cart) ? transaction.cart : [];
  if (!cart.length) return 0;

  return cart.reduce((soma, item) => {
    const preco = Number(item?.price);
    const quantidade = quantidadeItem(item);

    if (!Number.isFinite(preco) || preco <= 0) throw erro("BESTFY_CART_PRICE_INVALID", "O carrinho possui preço inválido.");
    if (!Number.isInteger(quantidade) || quantidade <= 0) throw erro("BESTFY_CART_QUANTITY_INVALID", "O carrinho possui quantidade inválida.");

    return soma + Math.round(preco) * quantidade;
  }, 0);
}

function calcularValorCentavos(transaction) {
  const candidatos = [];
  const valor = Number(transaction?.value);
  if (Number.isFinite(valor) && valor > 0) candidatos.push({ origem: "transaction.value", centavos: Math.round(valor * 100) });

  const metadataValue = Number(transaction?.paymentMetadata?.value);
  if (Number.isFinite(metadataValue) && metadataValue > 0) candidatos.push({ origem: "paymentMetadata.value", centavos: Math.round(metadataValue * 100) });

  const finalAmountInCents = Number(transaction?.finalAmountInCents);
  if (Number.isFinite(finalAmountInCents) && finalAmountInCents > 0) candidatos.push({ origem: "finalAmountInCents", centavos: Math.round(finalAmountInCents) });

  if (!candidatos.length) throw erro("BESTFY_AMOUNT_MISSING", "A Bestfy não retornou um valor efetivamente cobrado que possa ser validado.");

  const referencia = candidatos[0].centavos;
  if (candidatos.some((item) => item.centavos !== referencia)) {
    throw erro("BESTFY_AMOUNT_INCONSISTENT", `A Bestfy retornou valores divergentes para a mesma transação: ${candidatos.map((item) => `${item.origem}=${item.centavos}`).join(", ")}.`);
  }
  return referencia;
}

function identificarPlano(transaction) {
  const cart = Array.isArray(transaction?.cart) ? transaction.cart : [];
  if (cart.length !== 1) throw erro("BESTFY_CART_INVALID", "A compra Premium precisa conter exatamente um produto elegível.");

  const item = cart[0] || {};
  const quantidade = quantidadeItem(item);
  if (!Number.isInteger(quantidade) || quantidade !== 1) {
    throw erro("BESTFY_CART_QUANTITY_INVALID", "A compra Premium precisa ter quantidade igual a 1.");
  }

  const titulo = normalizarTexto(item.title || "");
  const valorCobradoCentavos = calcularValorCentavos(transaction);
  const valorCarrinhoCentavos = calcularTotalCarrinhoCentavos(transaction);

  let chave = "";
  if (/\banual\b|\b12 meses?\b|\b360 dias?\b|\b365 dias?\b/.test(titulo)) chave = "black360";
  else if (/\b6 meses?\b|\b180 dias?\b|\bsemestral\b/.test(titulo)) chave = "black180";
  else if (/\bmensal\b|\b30 dias?\b|\b1 mes\b/.test(titulo)) chave = "black30";

  if (!chave || !PLANOS[chave]) throw erro("BESTFY_PLAN_NOT_FOUND", "O produto pago não corresponde a um plano Premium autorizado.");

  const plano = PLANOS[chave];
  if (valorCarrinhoCentavos !== plano.valorCentavos) {
    throw erro("BESTFY_CART_PRICE_MISMATCH", `Preço do produto incompatível com o plano ${chave}. Esperado ${plano.valorCentavos} centavos e recebido ${valorCarrinhoCentavos}.`);
  }
  if (valorCobradoCentavos !== plano.valorCentavos) {
    throw erro("BESTFY_PLAN_PRICE_MISMATCH", `Valor efetivamente pago incompatível com o plano ${chave}. Esperado ${plano.valorCentavos} centavos e recebido ${valorCobradoCentavos}.`);
  }

  return { chave, dias: plano.dias, valorCentavos: plano.valorCentavos };
}

function validarTransacaoPaga(transaction, expectedCompanyId = "") {
  const status = normalizarStatus(transaction?.status);
  if (status !== "PAID") throw erro("BESTFY_STATUS_MISMATCH", `A API da Bestfy retornou status ${status || "vazio"}.`);

  const transactionCompanyId = String(transaction?.companyId || transaction?.company?.id || "").trim();
  if (transactionCompanyId && expectedCompanyId && transactionCompanyId !== expectedCompanyId) {
    throw erro("BESTFY_COMPANY_MISMATCH", "A transação consultada não pertence à empresa configurada.");
  }

  const email = normalizarEmail(transaction?.customer?.email);
  if (!emailValido(email)) throw erro("BESTFY_CUSTOMER_EMAIL_INVALID", "A transação paga não possui um e-mail de cliente válido.");

  const confirmedAtRaw = String(transaction?.paymentConfirmedAt || "").trim();
  const confirmedAtMs = new Date(confirmedAtRaw).getTime();
  if (!confirmedAtRaw || !Number.isFinite(confirmedAtMs)) throw erro("BESTFY_PAYMENT_DATE_INVALID", "A confirmação de pagamento da Bestfy é inválida.");
  if (confirmedAtMs > Date.now() + MAX_PAYMENT_FUTURE_SKEW_MS) throw erro("BESTFY_PAYMENT_DATE_FUTURE", "A confirmação de pagamento possui data futura incompatível.");

  return { email, status, confirmedAt: confirmedAtRaw };
}

function dataBaseParaExtensao(usuario) {
  const agora = new Date();
  const atual = new Date(usuario?.dataExpiracao || usuario?.data_expiracao || "");
  return !Number.isNaN(atual.getTime()) && atual.getTime() > agora.getTime() ? atual : agora;
}

function adicionarDias(data, dias) {
  const diasPermitidos = new Set(Object.values(PLANOS).map((plano) => plano.dias));
  const quantidade = Number(dias);
  if (!Number.isInteger(quantidade) || !diasPermitidos.has(quantidade)) throw erro("BESTFY_GRANT_DAYS_INVALID", "Quantidade de dias não autorizada para liberação automática.");

  const resultado = new Date(data);
  if (Number.isNaN(resultado.getTime())) throw erro("BESTFY_GRANT_BASE_INVALID", "Data base inválida para liberação do acesso.");
  resultado.setUTCDate(resultado.getUTCDate() + quantidade);
  return resultado;
}

async function obterRegistro(transactionId) {
  const rows = await database.query("SELECT * FROM bestfy_transactions WHERE transaction_id = ? LIMIT 1", [String(transactionId)]);
  return rows[0] || null;
}

async function salvarEventoBase(payload) {
  const transactionId = String(payload.transactionId || "").trim();
  const companyId = String(payload.companyId || "").trim();
  const status = normalizarStatus(payload.status);
  const confirmedAt = String(payload.paymentConfirmedAt || "").trim();

  await database.query(
    `INSERT INTO bestfy_transactions (transaction_id, company_id, status, raw_json, payment_confirmed_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       company_id = VALUES(company_id),
       status = CASE WHEN applied_at IS NULL THEN VALUES(status) ELSE status END,
       raw_json = VALUES(raw_json),
       payment_confirmed_at = CASE WHEN VALUES(payment_confirmed_at) <> '' THEN VALUES(payment_confirmed_at) ELSE payment_confirmed_at END,
       updated_at = CURRENT_TIMESTAMP`,
    [transactionId, companyId, status, JSON.stringify(payload || {}), confirmedAt]
  );
}

async function salvarDetalhesVerificados(transaction, plano) {
  const customer = transaction?.customer || {};
  const email = normalizarEmail(customer.email);
  const nome = String(customer.name || "").trim();
  const telefone = String(customer.phone || "").trim();
  const status = normalizarStatus(transaction.status);
  const confirmedAt = String(transaction.paymentConfirmedAt || "").trim();
  const cart = Array.isArray(transaction.cart) ? transaction.cart : [];

  await database.query(
    `UPDATE bestfy_transactions SET status = ?, customer_email = ?, customer_name = ?, customer_phone = ?, plan = ?, amount_cents = ?, cart_json = ?, payment_confirmed_at = ?, verified_at = CURRENT_TIMESTAMP, last_error = NULL WHERE transaction_id = ?`,
    [status, email, nome, telefone, plano.chave, plano.valorCentavos, JSON.stringify(cart), confirmedAt, String(transaction.transactionId)]
  );

  return { email, nome, telefone, status };
}

async function liberarClaim(transactionId, mensagem = "") {
  await database.query(
    `UPDATE bestfy_transactions SET processing = 0, processing_started_at = NULL, last_error = ? WHERE transaction_id = ?`,
    [String(mensagem || "").slice(0, 2000), String(transactionId)]
  );
}

async function aplicarRegistroAoUsuario(registro, usuario) {
  if (!registro || !usuario) return { aplicado: false };
  const userId = String(usuario.id || usuario._id || "").trim();
  if (!userId) throw erro("BESTFY_USER_INVALID", "Usuário inválido para aplicação do pagamento.");

  const resultado = await withTransaction(async (tx) => {
    const registros = await tx.query("SELECT * FROM bestfy_transactions WHERE transaction_id = ? LIMIT 1 FOR UPDATE", [String(registro.transaction_id)]);
    const atual = registros[0] || null;
    if (!atual) throw erro("BESTFY_ROW_NOT_FOUND", "Registro da transação não encontrado.");
    if (atual.applied_at) return { aplicado: false, duplicado: true };

    const plano = PLANOS[atual.plan];
    if (!plano) throw erro("BESTFY_PLAN_INVALID", `Plano interno inválido: ${atual.plan || "vazio"}.`);
    if (normalizarStatus(atual.status) !== "PAID") throw erro("BESTFY_GRANT_STATUS_INVALID", "Acesso não pode ser liberado sem status PAID.");
    if (!atual.verified_at || atual.revoked_at) throw erro("BESTFY_GRANT_VERIFICATION_INVALID", "A transação não possui verificação válida para liberação.");
    if (Number(atual.amount_cents || 0) !== plano.valorCentavos) throw erro("BESTFY_GRANT_AMOUNT_INVALID", "O valor verificado não corresponde ao plano que seria liberado.");

    const usuarios = await tx.query("SELECT id,email,plano,data_expiracao,suspenso,status,extras FROM usuarios WHERE id=? LIMIT 1 FOR UPDATE", [userId]);
    const userRow = usuarios[0] || null;
    if (!userRow) throw erro("BESTFY_USER_NOT_FOUND", "Conta que receberia o acesso não foi encontrada.");

    const emailRegistro = normalizarEmail(atual.customer_email);
    const emailUsuario = normalizarEmail(userRow.email);
    if (!emailRegistro || emailRegistro !== emailUsuario) throw erro("BESTFY_GRANT_EMAIL_MISMATCH", "O e-mail do pagamento não corresponde à conta que receberia o acesso.");

    const base = dataBaseParaExtensao({ dataExpiracao: userRow.data_expiracao });
    const expiraEm = adicionarDias(base, plano.dias);
    const extras = parseExtras(userRow.extras);
    extras.bestfyTransactionId = String(atual.transaction_id);
    extras.bestfyStatus = "PAID";
    extras.bestfyPaidAt = atual.payment_confirmed_at || new Date().toISOString();

    const userUpdate = await tx.query(
      `UPDATE usuarios SET plano=?, data_expiracao=?, extras=?, atualizado_por='bestfy-webhook', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [atual.plan, expiraEm.toISOString(), JSON.stringify(extras), userId]
    );
    if (Number(userUpdate?.affectedRows || 0) !== 1) throw erro("BESTFY_USER_UPDATE_FAILED", "Falha ao atualizar a assinatura do usuário.");

    const paymentUpdate = await tx.query(
      `UPDATE bestfy_transactions SET user_id=?, applied_at=CURRENT_TIMESTAMP, access_expires_at=?, processing=0, processing_started_at=NULL, last_error=NULL WHERE transaction_id=? AND applied_at IS NULL AND revoked_at IS NULL AND status='PAID'`,
      [userId, expiraEm.toISOString(), String(atual.transaction_id)]
    );
    if (Number(paymentUpdate?.affectedRows || 0) !== 1) throw erro("BESTFY_ATOMIC_APPLY_FAILED", "A transação mudou durante a aplicação e foi revertida.");

    return { aplicado: true, plano: atual.plan, diasLiberados: plano.dias, expiraEm: expiraEm.toISOString(), usuarioId: userId, extras };
  });

  if (resultado.aplicado) {
    usuario.plano = resultado.plano;
    usuario.dataExpiracao = resultado.expiraEm;
    usuario.bestfyTransactionId = resultado.extras.bestfyTransactionId;
    usuario.bestfyStatus = resultado.extras.bestfyStatus;
    usuario.bestfyPaidAt = resultado.extras.bestfyPaidAt;
    usuario.atualizadoPor = "bestfy-webhook";
  }

  return resultado;
}

async function aplicarPagamentoVerificado(transaction, plano) {
  const registro = await obterRegistro(transaction.transactionId);
  if (!registro) throw erro("BESTFY_ROW_NOT_FOUND", "Registro da transação não encontrado.");
  if (registro.applied_at) return { aplicado: false, duplicado: true };

  const email = normalizarEmail(transaction?.customer?.email || registro.customer_email);
  if (!emailValido(email)) {
    await liberarClaim(transaction.transactionId, "Cliente sem e-mail válido na transação.").catch(() => {});
    throw erro("BESTFY_CUSTOMER_EMAIL_MISSING", "A transação paga não possui e-mail válido do cliente.");
  }

  const usuario = await Usuario.findOne({ email });
  if (!usuario) {
    await database.query(`UPDATE bestfy_transactions SET last_error = 'AGUARDANDO_CADASTRO' WHERE transaction_id = ?`, [String(transaction.transactionId)]);
    return { aplicado: false, aguardandoCadastro: true, email, plano: plano.chave };
  }

  return aplicarRegistroAoUsuario(registro, usuario);
}

async function restaurarAcessoAnterior(usuario, transactionId, status) {
  const anteriores = await database.query(
    `SELECT * FROM bestfy_transactions WHERE user_id = ? AND transaction_id <> ? AND applied_at IS NOT NULL AND revoked_at IS NULL AND status = 'PAID' AND access_expires_at <> '' ORDER BY access_expires_at DESC LIMIT 1`,
    [String(usuario.id || usuario._id), String(transactionId)]
  );

  const anterior = anteriores[0] || null;
  const agora = Date.now();
  const validadeAnterior = anterior ? new Date(anterior.access_expires_at).getTime() : 0;

  if (anterior && validadeAnterior > agora) {
    usuario.plano = anterior.plan || "free";
    usuario.dataExpiracao = anterior.access_expires_at || "";
    usuario.bestfyTransactionId = anterior.transaction_id || "";
    usuario.bestfyStatus = "PAID";
  } else {
    usuario.plano = "free";
    usuario.dataExpiracao = "";
    usuario.bestfyTransactionId = "";
    usuario.bestfyStatus = status;
  }

  usuario.atualizadoPor = "bestfy-webhook";
  usuario.bestfyRevokedAt = new Date().toISOString();
  await usuario.save();
}

async function processarRevogacao(transactionId, status) {
  const registro = await obterRegistro(transactionId);
  if (!registro || !registro.applied_at) return { revogado: false };
  if (registro.revoked_at) return { revogado: false, duplicado: true };

  await database.query(`UPDATE bestfy_transactions SET status = ?, revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE transaction_id = ?`, [status, String(transactionId)]);

  let usuario = null;
  if (registro.user_id) usuario = await Usuario.findById(registro.user_id);
  if (!usuario && registro.customer_email) usuario = await Usuario.findOne({ email: normalizarEmail(registro.customer_email) });
  if (!usuario) return { revogado: true, usuarioEncontrado: false };

  if (String(usuario.bestfyTransactionId || "") === String(transactionId)) await restaurarAcessoAnterior(usuario, transactionId, status);
  return { revogado: true, usuarioEncontrado: true };
}

async function processarWebhookBestfy(payload = {}) {
  await garantirTabela();

  const transactionId = String(payload?.transactionId || "").trim();
  const companyId = String(payload?.companyId || "").trim();
  const status = normalizarStatus(payload?.status);

  if (!transactionId || !companyId || !status) throw erro("BESTFY_WEBHOOK_INVALID", "Webhook sem companyId, transactionId ou status.");

  const expectedCompanyId = await obterCompanyIdEsperado();
  if (companyId !== expectedCompanyId) throw erro("BESTFY_COMPANY_MISMATCH", "companyId do webhook não pertence à conta configurada.");

  await salvarEventoBase({ ...payload, status });

  if (status === "PAID") {
    const transaction = await buscarTransacao(transactionId);
    validarTransacaoPaga(transaction, expectedCompanyId);
    const plano = identificarPlano(transaction);
    await salvarDetalhesVerificados(transaction, plano);
    const aplicacao = await aplicarPagamentoVerificado(transaction, plano);

    return { recebido: true, transactionId, status, planoValidado: plano.chave, valorValidadoCentavos: plano.valorCentavos, diasAutorizados: plano.dias, ...aplicacao };
  }

  const registro = await obterRegistro(transactionId);
  if (registro?.applied_at && !registro.revoked_at) {
    const transaction = await buscarTransacao(transactionId);
    const statusApi = normalizarStatus(transaction?.status);

    if (statusApi === "PAID") {
      return { recebido: true, transactionId, status, statusVerificado: statusApi, alteracaoAcesso: false, eventoDesatualizado: true };
    }

    const revogacao = await processarRevogacao(transactionId, statusApi || status);
    return { recebido: true, transactionId, status, statusVerificado: statusApi || status, ...revogacao };
  }

  return { recebido: true, transactionId, status, alteracaoAcesso: false };
}

async function aplicarCompraPendentePorEmail(usuario) {
  if (!usuario?.email) return { aplicado: false };

  try {
    await garantirTabela();
  } catch (error) {
    if (/não inicializado/i.test(String(error?.message || ""))) return { aplicado: false };
    throw error;
  }

  const email = normalizarEmail(usuario.email);
  const rows = await database.query(
    `SELECT * FROM bestfy_transactions WHERE customer_email = ? AND status = 'PAID' AND applied_at IS NULL AND revoked_at IS NULL AND verified_at IS NOT NULL ORDER BY payment_confirmed_at ASC, created_at ASC LIMIT 5`,
    [email]
  );

  const aplicados = [];
  const expectedCompanyId = await obterCompanyIdEsperado();

  for (const registro of rows) {
    try {
      const transaction = await buscarTransacao(registro.transaction_id);
      const statusApi = normalizarStatus(transaction.status);

      if (statusApi !== "PAID") {
        await database.query(`UPDATE bestfy_transactions SET status = ?, processing = 0, processing_started_at = NULL, last_error = 'REVALIDACAO_NAO_PAGA', updated_at = CURRENT_TIMESTAMP WHERE transaction_id = ?`, [statusApi || "UNKNOWN", String(registro.transaction_id)]);
        continue;
      }

      validarTransacaoPaga(transaction, expectedCompanyId);
      const plano = identificarPlano(transaction);
      if (plano.chave !== String(registro.plan || "") || plano.valorCentavos !== Number(registro.amount_cents || 0)) {
        throw erro("BESTFY_PENDING_MISMATCH", "A revalidação da compra pendente não corresponde ao plano salvo.");
      }

      await salvarDetalhesVerificados(transaction, plano);
      const registroAtualizado = await obterRegistro(registro.transaction_id);
      const resultado = await aplicarRegistroAoUsuario(registroAtualizado, usuario);
      if (resultado.aplicado) aplicados.push(resultado);
    } catch (error) {
      await database.query(`UPDATE bestfy_transactions SET processing = 0, processing_started_at = NULL, last_error = ? WHERE transaction_id = ?`, [String(error?.code || error?.message || "REVALIDACAO_FALHOU").slice(0, 2000), String(registro.transaction_id)]).catch(() => {});
    }
  }

  return { aplicado: aplicados.length > 0, total: aplicados.length, ultimaAplicacao: aplicados[aplicados.length - 1] || null };
}

function statusConfiguracaoBestfy() {
  return {
    apiKeyConfigurada: Boolean(String(process.env.BESTFY_API_KEY || "").trim()),
    companyIdConfiguradoManual: Boolean(String(process.env.BESTFY_COMPANY_ID || "").trim()),
    endpoint: "/webhooks/bestfy",
    evento: "TRANSACTION_CREATED_OR_UPDATED",
    validacaoEstrita: true,
    planosAutomaticos: Object.fromEntries(Object.entries(PLANOS).map(([chave, plano]) => [chave, { dias: plano.dias, valorCentavos: plano.valorCentavos }]))
  };
}

module.exports = { processarWebhookBestfy, aplicarCompraPendentePorEmail, statusConfiguracaoBestfy };
