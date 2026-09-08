"use strict";

const database = require("../config/database");
const Usuario = require("../models/Usuario");

const BESTFY_API_BASE = "https://api.bestfy.io";
const API_TIMEOUT_MS = 3500;
const COMPANY_CACHE_MS = 10 * 60 * 1000;

const PLANOS = {
  black30: { dias: 30, valorCentavos: 9999 },
  black180: { dias: 180, valorCentavos: 24999 },
  black360: { dias: 365, valorCentavos: 39700 }
};

const STATUS_REVOGAM = new Set([
  "REFUNDED",
  "CHARGEBACK",
  "MED",
  "DISPUTE_ACCEPTED"
]);

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
  if (!apiKey) {
    throw erro(
      "BESTFY_NOT_CONFIGURED",
      "BESTFY_API_KEY não configurada no servidor."
    );
  }
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
        "User-Agent": "turma-do-primo/4.5",
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
    if (error?.name === "AbortError") {
      throw erro("BESTFY_API_TIMEOUT", "Tempo limite ao consultar a Bestfy.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function obterCompanyIdEsperado() {
  const configurado = String(process.env.BESTFY_COMPANY_ID || "").trim();
  if (configurado) return configurado;

  if (companyCache.id && Date.now() - companyCache.carregadoEm < COMPANY_CACHE_MS) {
    return companyCache.id;
  }

  const data = await bestfyRequest("/company/validate-api-key");
  const id = String(data?.company?.id || "").trim();

  if (!id) {
    throw erro("BESTFY_COMPANY_INVALID", "A API Key da Bestfy não retornou company.id.");
  }

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

function calcularValorCentavos(transaction) {
  const cart = Array.isArray(transaction?.cart) ? transaction.cart : [];

  if (cart.length) {
    const total = cart.reduce((soma, item) => {
      const preco = Number(item?.price || 0);
      const quantidade = Math.max(1, Number(item?.quantity || 1));
      return soma + Math.round(preco) * quantidade;
    }, 0);

    if (total > 0) return total;
  }

  const valor = Number(transaction?.value ?? transaction?.paymentMetadata?.value ?? 0);
  return Number.isFinite(valor) ? Math.round(valor * 100) : 0;
}

function identificarPlano(transaction) {
  const cart = Array.isArray(transaction?.cart) ? transaction.cart : [];
  const titulos = normalizarTexto(cart.map((item) => item?.title || "").join(" | "));
  const valorCentavos = calcularValorCentavos(transaction);

  if (/\banual\b|12 meses|360 dias|365 dias/.test(titulos)) {
    return { chave: "black360", ...PLANOS.black360, valorCentavos };
  }

  if (/6 meses|180 dias|semestral/.test(titulos)) {
    return { chave: "black180", ...PLANOS.black180, valorCentavos };
  }

  if (/\bmensal\b|30 dias|1 mes/.test(titulos)) {
    return { chave: "black30", ...PLANOS.black30, valorCentavos };
  }

  const porValor = Object.entries(PLANOS).find(([, plano]) => plano.valorCentavos === valorCentavos);
  if (porValor) {
    return { chave: porValor[0], ...porValor[1], valorCentavos };
  }

  throw erro(
    "BESTFY_PLAN_NOT_FOUND",
    `Não foi possível identificar o plano da transação (${valorCentavos} centavos).`
  );
}

function dataBaseParaExtensao(usuario) {
  const agora = new Date();
  const atual = new Date(usuario?.dataExpiracao || "");

  if (!Number.isNaN(atual.getTime()) && atual.getTime() > agora.getTime()) {
    return atual;
  }

  return agora;
}

function adicionarDias(data, dias) {
  const resultado = new Date(data);
  resultado.setUTCDate(resultado.getUTCDate() + Number(dias || 0));
  return resultado;
}

async function obterRegistro(transactionId) {
  const rows = await database.query(
    "SELECT * FROM bestfy_transactions WHERE transaction_id = ? LIMIT 1",
    [String(transactionId)]
  );
  return rows[0] || null;
}

async function salvarEventoBase(payload) {
  const transactionId = String(payload.transactionId || "").trim();
  const companyId = String(payload.companyId || "").trim();
  const status = normalizarStatus(payload.status);
  const confirmedAt = String(payload.paymentConfirmedAt || "").trim();

  await database.query(
    `INSERT INTO bestfy_transactions
      (transaction_id, company_id, status, raw_json, payment_confirmed_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       company_id = VALUES(company_id),
       status = VALUES(status),
       raw_json = VALUES(raw_json),
       payment_confirmed_at = CASE
         WHEN VALUES(payment_confirmed_at) <> '' THEN VALUES(payment_confirmed_at)
         ELSE payment_confirmed_at
       END,
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
    `UPDATE bestfy_transactions
        SET status = ?, customer_email = ?, customer_name = ?, customer_phone = ?,
            plan = ?, amount_cents = ?, cart_json = ?, payment_confirmed_at = ?,
            verified_at = CURRENT_TIMESTAMP, last_error = NULL
      WHERE transaction_id = ?`,
    [
      status,
      email,
      nome,
      telefone,
      plano.chave,
      plano.valorCentavos,
      JSON.stringify(cart),
      confirmedAt,
      String(transaction.transactionId)
    ]
  );

  return { email, nome, telefone, status };
}

async function reivindicarAplicacao(transactionId) {
  const result = await database.query(
    `UPDATE bestfy_transactions
        SET processing = 1, processing_started_at = CURRENT_TIMESTAMP
      WHERE transaction_id = ?
        AND applied_at IS NULL
        AND (processing = 0 OR processing_started_at < (CURRENT_TIMESTAMP - INTERVAL 2 MINUTE))`,
    [String(transactionId)]
  );

  return Number(result?.affectedRows || 0) > 0;
}

async function liberarClaim(transactionId, mensagem = "") {
  await database.query(
    `UPDATE bestfy_transactions
        SET processing = 0, processing_started_at = NULL, last_error = ?
      WHERE transaction_id = ?`,
    [String(mensagem || ""), String(transactionId)]
  );
}

async function aplicarRegistroAoUsuario(registro, usuario) {
  if (!registro || !usuario) return { aplicado: false };
  if (registro.applied_at) return { aplicado: false, duplicado: true };

  const plano = PLANOS[registro.plan];
  if (!plano) {
    throw erro("BESTFY_PLAN_INVALID", `Plano interno inválido: ${registro.plan || "vazio"}.`);
  }

  const claimed = await reivindicarAplicacao(registro.transaction_id);
  if (!claimed) {
    return { aplicado: false, processando: true };
  }

  try {
    const base = dataBaseParaExtensao(usuario);
    const expiraEm = adicionarDias(base, plano.dias);

    usuario.plano = registro.plan;
    usuario.dataExpiracao = expiraEm.toISOString();
    usuario.aprovado = true;
    usuario.suspenso = false;
    usuario.status = "ativo";
    usuario.aprovadoEm = usuario.aprovadoEm || new Date().toISOString();
    usuario.atualizadoPor = "bestfy-webhook";
    usuario.bestfyTransactionId = String(registro.transaction_id);
    usuario.bestfyStatus = "PAID";
    usuario.bestfyPaidAt = registro.payment_confirmed_at || new Date().toISOString();
    await usuario.save();

    await database.query(
      `UPDATE bestfy_transactions
          SET user_id = ?, applied_at = CURRENT_TIMESTAMP, access_expires_at = ?,
              processing = 0, processing_started_at = NULL, last_error = NULL
        WHERE transaction_id = ?`,
      [String(usuario.id || usuario._id), expiraEm.toISOString(), String(registro.transaction_id)]
    );

    return {
      aplicado: true,
      plano: registro.plan,
      expiraEm: expiraEm.toISOString(),
      usuarioId: String(usuario.id || usuario._id)
    };
  } catch (error) {
    await liberarClaim(registro.transaction_id, error.message).catch(() => {});
    throw error;
  }
}

async function aplicarPagamentoVerificado(transaction, plano) {
  const registro = await obterRegistro(transaction.transactionId);
  if (!registro) throw erro("BESTFY_ROW_NOT_FOUND", "Registro da transação não encontrado.");
  if (registro.applied_at) return { aplicado: false, duplicado: true };

  const email = normalizarEmail(transaction?.customer?.email || registro.customer_email);
  if (!email) {
    await liberarClaim(transaction.transactionId, "Cliente sem e-mail na transação.").catch(() => {});
    throw erro("BESTFY_CUSTOMER_EMAIL_MISSING", "A transação paga não possui e-mail do cliente.");
  }

  const usuario = await Usuario.findOne({ email });

  if (!usuario) {
    await database.query(
      `UPDATE bestfy_transactions
          SET last_error = 'AGUARDANDO_CADASTRO'
        WHERE transaction_id = ?`,
      [String(transaction.transactionId)]
    );

    return {
      aplicado: false,
      aguardandoCadastro: true,
      email,
      plano: plano.chave
    };
  }

  return aplicarRegistroAoUsuario(registro, usuario);
}

async function restaurarAcessoAnterior(usuario, transactionId, status) {
  const anteriores = await database.query(
    `SELECT * FROM bestfy_transactions
      WHERE user_id = ?
        AND transaction_id <> ?
        AND applied_at IS NOT NULL
        AND revoked_at IS NULL
        AND status = 'PAID'
        AND access_expires_at <> ''
      ORDER BY access_expires_at DESC
      LIMIT 1`,
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

  await database.query(
    `UPDATE bestfy_transactions
        SET status = ?, revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE transaction_id = ?`,
    [status, String(transactionId)]
  );

  let usuario = null;
  if (registro.user_id) usuario = await Usuario.findById(registro.user_id);
  if (!usuario && registro.customer_email) {
    usuario = await Usuario.findOne({ email: normalizarEmail(registro.customer_email) });
  }

  if (!usuario) return { revogado: true, usuarioEncontrado: false };

  if (String(usuario.bestfyTransactionId || "") === String(transactionId)) {
    await restaurarAcessoAnterior(usuario, transactionId, status);
  }

  return { revogado: true, usuarioEncontrado: true };
}

async function processarWebhookBestfy(payload = {}) {
  await garantirTabela();

  const transactionId = String(payload?.transactionId || "").trim();
  const companyId = String(payload?.companyId || "").trim();
  const status = normalizarStatus(payload?.status);

  if (!transactionId || !companyId || !status) {
    throw erro("BESTFY_WEBHOOK_INVALID", "Webhook sem companyId, transactionId ou status.");
  }

  const expectedCompanyId = await obterCompanyIdEsperado();
  if (companyId !== expectedCompanyId) {
    throw erro("BESTFY_COMPANY_MISMATCH", "companyId do webhook não pertence à conta configurada.");
  }

  await salvarEventoBase({ ...payload, status });

  if (status === "PAID") {
    const transaction = await buscarTransacao(transactionId);
    const statusApi = normalizarStatus(transaction.status);

    if (statusApi !== "PAID") {
      throw erro("BESTFY_STATUS_MISMATCH", `A API da Bestfy retornou status ${statusApi || "vazio"}.`);
    }

    const plano = identificarPlano(transaction);
    await salvarDetalhesVerificados(transaction, plano);
    const aplicacao = await aplicarPagamentoVerificado(transaction, plano);

    return {
      recebido: true,
      transactionId,
      status,
      ...aplicacao
    };
  }

  if (STATUS_REVOGAM.has(status)) {
    const revogacao = await processarRevogacao(transactionId, status);
    return { recebido: true, transactionId, status, ...revogacao };
  }

  if (status === "CANCELED") {
    const registro = await obterRegistro(transactionId);
    if (registro?.applied_at) {
      const revogacao = await processarRevogacao(transactionId, status);
      return { recebido: true, transactionId, status, ...revogacao };
    }
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
    `SELECT * FROM bestfy_transactions
      WHERE customer_email = ?
        AND status = 'PAID'
        AND applied_at IS NULL
        AND verified_at IS NOT NULL
      ORDER BY payment_confirmed_at ASC, created_at ASC
      LIMIT 5`,
    [email]
  );

  const aplicados = [];

  for (const registro of rows) {
    const resultado = await aplicarRegistroAoUsuario(registro, usuario);
    if (resultado.aplicado) aplicados.push(resultado);
  }

  return {
    aplicado: aplicados.length > 0,
    total: aplicados.length,
    ultimaAplicacao: aplicados[aplicados.length - 1] || null
  };
}

function statusConfiguracaoBestfy() {
  return {
    apiKeyConfigurada: Boolean(String(process.env.BESTFY_API_KEY || "").trim()),
    companyIdConfiguradoManual: Boolean(String(process.env.BESTFY_COMPANY_ID || "").trim()),
    endpoint: "/webhooks/bestfy",
    evento: "TRANSACTION_CREATED_OR_UPDATED"
  };
}

module.exports = {
  processarWebhookBestfy,
  aplicarCompraPendentePorEmail,
  statusConfiguracaoBestfy
};
