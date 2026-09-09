"use strict";

const crypto = require("crypto");
const express = require("express");
const database = require("../config/database");

const router = express.Router();
let preparationPromise = null;
let lastSyncAt = 0;

const OFFICIAL_PLANS = [
  { codigo: "black30", nome: "Mensal", descricao: "Acesso completo por 30 dias", preco: 99.99, dias: 30, ordem: 1 },
  { codigo: "black180", nome: "6 meses", descricao: "Acesso completo por 180 dias", preco: 249.99, dias: 180, ordem: 2 },
  { codigo: "black360", nome: "Anual", descricao: "Acesso completo por 365 dias", preco: 397.00, dias: 365, ordem: 3 }
];

function id24(seed = "") {
  if (seed) return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24);
  return crypto.randomBytes(12).toString("hex");
}

function sqlDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function dateOnly(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function normalizeBestfyStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  const aliases = { CANCELLED: "CANCELED", CANCELADO: "CANCELED", PAGO: "PAID", ESTORNADO: "REFUNDED" };
  return aliases[status] || status;
}

function salesStatusFromBestfy(row) {
  const status = normalizeBestfyStatus(row.status);
  if (status === "PAID" && !row.revoked_at) return "pago";
  if (status === "REFUNDED") return "estornado";
  if (["CANCELED", "REJECTED", "FAILED"].includes(status)) return "cancelado";
  if (row.revoked_at) return "cancelado";
  return "pendente";
}

function planName(code) {
  return OFFICIAL_PLANS.find((item) => item.codigo === code)?.nome || code || "Plano Premium";
}

async function ensureCommandCenterTables() {
  await database.query(`
    CREATE TABLE IF NOT EXISTS produtos_planos (
      id CHAR(24) NOT NULL PRIMARY KEY,
      codigo VARCHAR(60) NOT NULL UNIQUE,
      nome VARCHAR(160) NOT NULL,
      descricao VARCHAR(600) NOT NULL DEFAULT '',
      preco DECIMAL(12,2) NOT NULL DEFAULT 0,
      duracao_dias INT NOT NULL DEFAULT 30,
      status TINYINT(1) NOT NULL DEFAULT 1,
      destaque TINYINT(1) NOT NULL DEFAULT 0,
      ordem INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_produtos_status (status),
      KEY idx_produtos_ordem (ordem)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

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

  await database.query(`
    CREATE TABLE IF NOT EXISTS vendas_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      venda_id CHAR(24) NOT NULL DEFAULT '',
      usuario_id CHAR(24) NOT NULL DEFAULT '',
      usuario_email VARCHAR(190) NOT NULL DEFAULT '',
      acao VARCHAR(80) NOT NULL,
      detalhes LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_vendas_logs_venda (venda_id),
      KEY idx_vendas_logs_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  for (const plan of OFFICIAL_PLANS) {
    await database.query(
      `INSERT INTO produtos_planos
       (id,codigo,nome,descricao,preco,duracao_dias,status,destaque,ordem)
       VALUES (?,?,?,?,?,?,1,0,?)
       ON DUPLICATE KEY UPDATE
         nome=VALUES(nome),descricao=VALUES(descricao),preco=VALUES(preco),
         duracao_dias=VALUES(duracao_dias),status=1,ordem=VALUES(ordem)`,
      [id24(`plan:${plan.codigo}`), plan.codigo, plan.nome, plan.descricao, plan.preco, plan.dias, plan.ordem]
    );
  }

  // Planos históricos ficam preservados para relatórios, mas não podem ser vendidos novamente.
  await database.query("UPDATE produtos_planos SET status=0 WHERE codigo IN ('black90','particular')");
}

async function syncBestfySales() {
  if (Date.now() - lastSyncAt < 5000) return;

  let rows;
  try {
    rows = await database.query(
      `SELECT transaction_id,status,customer_email,customer_name,customer_phone,user_id,
              plan,amount_cents,payment_confirmed_at,verified_at,applied_at,revoked_at,
              created_at,updated_at
         FROM bestfy_transactions
        WHERE verified_at IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 2000`
    );
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return;
    throw error;
  }

  const products = await database.query("SELECT id,codigo,nome FROM produtos_planos");
  const productMap = new Map(products.map((item) => [String(item.codigo), item]));

  for (const row of rows) {
    const transactionId = String(row.transaction_id || "").trim();
    if (!transactionId) continue;

    const status = salesStatusFromBestfy(row);
    const product = productMap.get(String(row.plan || "")) || {};
    const amount = Math.max(0, Number(row.amount_cents || 0) / 100);
    const paidAt = status === "pago" ? (sqlDate(row.payment_confirmed_at) || sqlDate(row.applied_at)) : null;
    const canceledAt = status === "pago" ? null : (sqlDate(row.revoked_at) || null);
    const sourceId = id24(`bestfy:${transactionId}`);
    const note = `Transação Bestfy ${transactionId}`;

    await database.query(
      `INSERT INTO vendas
       (id,cliente_id,cliente_nome,cliente_email,cliente_telefone,
        vendedor_id,vendedor_nome,vendedor_email,produto_id,produto_codigo,produto_nome,
        valor_bruto,desconto,valor,forma_pagamento,parcelas,status,
        porcentagem_comissao,comissao,comissao_status,cupom_codigo,data_venda,
        pago_em,cancelado_em,observacoes,origem,criado_por,atualizado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         cliente_id=VALUES(cliente_id),cliente_nome=VALUES(cliente_nome),cliente_email=VALUES(cliente_email),
         cliente_telefone=VALUES(cliente_telefone),produto_id=VALUES(produto_id),produto_codigo=VALUES(produto_codigo),
         produto_nome=VALUES(produto_nome),valor_bruto=VALUES(valor_bruto),valor=VALUES(valor),
         status=VALUES(status),data_venda=VALUES(data_venda),pago_em=VALUES(pago_em),
         cancelado_em=VALUES(cancelado_em),observacoes=VALUES(observacoes),
         atualizado_por='bestfy-sync'`,
      [
        sourceId,
        String(row.user_id || "").slice(0, 24),
        String(row.customer_name || "").slice(0, 160),
        String(row.customer_email || "").trim().toLowerCase().slice(0, 190),
        String(row.customer_phone || "").slice(0, 40),
        "",
        "Checkout Bestfy",
        "",
        String(product.id || "").slice(0, 24),
        String(row.plan || "").slice(0, 60),
        String(product.nome || planName(row.plan)).slice(0, 160),
        amount,
        0,
        amount,
        "bestfy",
        1,
        status,
        0,
        0,
        "prevista",
        "",
        dateOnly(row.payment_confirmed_at || row.created_at),
        paidAt,
        canceledAt,
        note,
        "bestfy",
        "bestfy-webhook",
        "bestfy-sync"
      ]
    );
  }

  lastSyncAt = Date.now();
}

async function prepare() {
  if (!preparationPromise) {
    preparationPromise = ensureCommandCenterTables().finally(() => {
      preparationPromise = null;
    });
  }
  await preparationPromise;
  await syncBestfySales();
}

router.use("/vendas", async (_req, res, next) => {
  try {
    await prepare();
    return next();
  } catch (error) {
    console.error("Erro ao preparar Sales Command Center:", error);
    return res.status(503).json({ erro: "O painel de vendas está temporariamente indisponível." });
  }
});

module.exports = router;
module.exports.prepare = prepare;
module.exports.syncBestfySales = syncBestfySales;
