"use strict";

const crypto = require("crypto");
const database = require("../config/database");

let prepared = false;
let syncRunning = null;
let lastSyncAt = 0;
const SYNC_INTERVAL_MS = 60 * 1000;

function id24() {
  return crypto.randomBytes(12).toString("hex");
}

function safeDate(value) {
  const d = new Date(value || "");
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function mysqlDateTime(value) {
  return safeDate(value).toISOString().slice(0, 19).replace("T", " ");
}

function mysqlDate(value) {
  return safeDate(value).toISOString().slice(0, 10);
}

function planName(plan) {
  return ({
    black30: "Turma do Primo — 30 dias",
    black180: "Turma do Primo — 6 meses",
    black360: "Turma do Primo — 1 ano"
  })[String(plan || "").toLowerCase()] || String(plan || "Turma do Primo Premium");
}

function saleStatus(transaction) {
  const status = String(transaction?.status || "").trim().toUpperCase();
  if (transaction?.revoked_at || ["REFUNDED", "CHARGEBACK", "REVERSED", "CANCELED", "CANCELLED"].includes(status)) return "estornado";
  return status === "PAID" && transaction?.applied_at ? "pago" : "pendente";
}

async function ensureSalesStructure() {
  if (prepared) return;

  await database.query(`
    CREATE TABLE IF NOT EXISTS vendas (
      id CHAR(24) NOT NULL PRIMARY KEY,
      cliente_id CHAR(24) NOT NULL DEFAULT '',
      cliente_nome VARCHAR(160) NOT NULL DEFAULT '',
      cliente_email VARCHAR(190) NOT NULL DEFAULT '',
      cliente_telefone VARCHAR(40) NOT NULL DEFAULT '',
      vendedor_id CHAR(24) NOT NULL DEFAULT '',
      vendedor_nome VARCHAR(160) NOT NULL DEFAULT '',
      vendedor_email VARCHAR(190) NOT NULL DEFAULT '',
      produto_id CHAR(24) NOT NULL DEFAULT '',
      produto_codigo VARCHAR(60) NOT NULL DEFAULT '',
      produto_nome VARCHAR(160) NOT NULL DEFAULT '',
      valor_bruto DECIMAL(12,2) NOT NULL DEFAULT 0,
      desconto DECIMAL(12,2) NOT NULL DEFAULT 0,
      valor DECIMAL(12,2) NOT NULL DEFAULT 0,
      forma_pagamento VARCHAR(80) NOT NULL DEFAULT 'pix',
      parcelas INT NOT NULL DEFAULT 1,
      status VARCHAR(30) NOT NULL DEFAULT 'pendente',
      porcentagem_comissao DECIMAL(7,3) NOT NULL DEFAULT 20,
      comissao DECIMAL(12,2) NOT NULL DEFAULT 0,
      comissao_status VARCHAR(30) NOT NULL DEFAULT 'prevista',
      cupom_codigo VARCHAR(60) NOT NULL DEFAULT '',
      data_venda DATE NOT NULL,
      pago_em DATETIME NULL,
      cancelado_em DATETIME NULL,
      observacoes LONGTEXT NULL,
      origem VARCHAR(50) NOT NULL DEFAULT 'painel-vendas',
      criado_por VARCHAR(190) NOT NULL DEFAULT '',
      atualizado_por VARCHAR(190) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_vendas_cliente (cliente_id),
      KEY idx_vendas_vendedor (vendedor_id),
      KEY idx_vendas_status (status),
      KEY idx_vendas_data (data_venda),
      KEY idx_vendas_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const columns = await database.query(
    "SELECT COUNT(*) AS total FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='vendas' AND column_name='bestfy_transaction_id'"
  );
  if (!Number(columns[0]?.total || 0)) {
    await database.query("ALTER TABLE vendas ADD COLUMN bestfy_transaction_id VARCHAR(96) NULL AFTER origem");
  }

  const indexes = await database.query(
    "SELECT COUNT(*) AS total FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='vendas' AND index_name='uq_vendas_bestfy_tx'"
  );
  if (!Number(indexes[0]?.total || 0)) {
    await database.query("ALTER TABLE vendas ADD UNIQUE KEY uq_vendas_bestfy_tx (bestfy_transaction_id)");
  }

  prepared = true;
}

function rawPaymentMethod(rawJson) {
  try {
    const raw = typeof rawJson === "object" ? rawJson : JSON.parse(String(rawJson || "{}"));
    const candidates = [
      raw.paymentMethod,
      raw.payment_method,
      raw.paymentMetadata?.paymentMethod,
      raw.paymentMetadata?.method,
      raw.method
    ];
    const value = candidates.find(Boolean);
    return String(value || "bestfy").trim().slice(0, 80) || "bestfy";
  } catch (_) {
    return "bestfy";
  }
}

async function performSync() {
  await ensureSalesStructure();

  const exists = await database.query(
    "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='bestfy_transactions'"
  );
  if (!Number(exists[0]?.total || 0)) return { synced: 0, updated: 0, total: 0 };

  const rows = await database.query(`
    SELECT transaction_id,status,customer_email,customer_name,customer_phone,user_id,plan,amount_cents,
           raw_json,payment_confirmed_at,applied_at,revoked_at,created_at,updated_at
      FROM bestfy_transactions
     WHERE verified_at IS NOT NULL
       AND (applied_at IS NOT NULL OR revoked_at IS NOT NULL)
     ORDER BY created_at ASC
  `);

  let inserted = 0;
  let updated = 0;

  for (const tx of rows) {
    const transactionId = String(tx.transaction_id || "").trim();
    if (!transactionId) continue;

    const amount = Math.max(0, Number(tx.amount_cents || 0) / 100);
    const confirmedAt = tx.payment_confirmed_at || tx.created_at || new Date().toISOString();
    const status = saleStatus(tx);
    const canceledAt = status === "estornado" ? (tx.revoked_at || tx.updated_at || new Date()) : null;
    const observations = JSON.stringify({
      source: "bestfy",
      transactionId,
      verified: true,
      accessApplied: Boolean(tx.applied_at),
      revoked: Boolean(tx.revoked_at)
    });

    const result = await database.query(`
      INSERT INTO vendas (
        id,cliente_id,cliente_nome,cliente_email,cliente_telefone,
        vendedor_id,vendedor_nome,vendedor_email,
        produto_id,produto_codigo,produto_nome,
        valor_bruto,desconto,valor,forma_pagamento,parcelas,status,
        porcentagem_comissao,comissao,comissao_status,cupom_codigo,
        data_venda,pago_em,cancelado_em,observacoes,origem,bestfy_transaction_id,
        criado_por,atualizado_por,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())
      ON DUPLICATE KEY UPDATE
        cliente_id=VALUES(cliente_id),
        cliente_nome=VALUES(cliente_nome),
        cliente_email=VALUES(cliente_email),
        cliente_telefone=VALUES(cliente_telefone),
        produto_codigo=VALUES(produto_codigo),
        produto_nome=VALUES(produto_nome),
        valor_bruto=VALUES(valor_bruto),
        valor=VALUES(valor),
        forma_pagamento=VALUES(forma_pagamento),
        status=VALUES(status),
        data_venda=VALUES(data_venda),
        pago_em=VALUES(pago_em),
        cancelado_em=VALUES(cancelado_em),
        observacoes=VALUES(observacoes),
        atualizado_por='bestfy-sync',
        updated_at=NOW()
    `, [
      id24(),
      String(tx.user_id || "").slice(0, 24),
      String(tx.customer_name || "").slice(0, 160),
      String(tx.customer_email || "").trim().toLowerCase().slice(0, 190),
      String(tx.customer_phone || "").slice(0, 40),
      "", "Bestfy", "",
      "", String(tx.plan || "").slice(0, 60), planName(tx.plan),
      amount, 0, amount, rawPaymentMethod(tx.raw_json), 1, status,
      0, 0, "nao_aplicavel", "",
      mysqlDate(confirmedAt), status === "pago" ? mysqlDateTime(confirmedAt) : null,
      canceledAt ? mysqlDateTime(canceledAt) : null,
      observations, "bestfy", transactionId,
      "bestfy-sync", "bestfy-sync"
    ]);

    if (Number(result?.affectedRows || 0) === 1) inserted += 1;
    else if (Number(result?.affectedRows || 0) >= 2) updated += 1;
  }

  return { synced: inserted, updated, total: rows.length };
}

async function syncBestfySales(options = {}) {
  const force = Boolean(options.force);
  if (!force && Date.now() - lastSyncAt < SYNC_INTERVAL_MS) return { skipped: true };
  if (syncRunning) return syncRunning;

  syncRunning = performSync()
    .then((result) => {
      lastSyncAt = Date.now();
      return result;
    })
    .catch((error) => {
      console.warn("[BESTFY_SALES_SYNC] Sincronização indisponível:", error.message);
      return { error: true, message: error.message };
    })
    .finally(() => { syncRunning = null; });

  return syncRunning;
}

module.exports = { syncBestfySales, ensureSalesStructure };
