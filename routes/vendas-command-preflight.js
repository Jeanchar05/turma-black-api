"use strict";

const crypto = require("crypto");
const express = require("express");
const database = require("../config/database");

const router = express.Router();
let preparationPromise = null;
let lastSyncAt = 0;
let lastSyncErrorAt = 0;

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
    CREATE TABLE IF NOT EXISTS formas_pagamento (
      id CHAR(24) NOT NULL PRIMARY KEY,
      codigo VARCHAR(60) NOT NULL UNIQUE,
      nome VARCHAR(120) NOT NULL,
      taxa_percentual DECIMAL(7,3) NOT NULL DEFAULT 0,
      status TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_pagamentos_status (status)
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

  await database.query("UPDATE produtos_planos SET status=0 WHERE codigo IN ('black90','particular')");

  await database.query(
    `INSERT INTO formas_pagamento(id,codigo,nome,taxa_percentual,status)
     VALUES(?,?,?,?,0)
     ON DUPLICATE KEY UPDATE nome=VALUES(nome),status=0`,
    [id24("payment:bestfy"), "bestfy", "Checkout Bestfy", 0]
  );
}

async function syncBestfySales() {
  if (Date.now() - lastSyncAt < 5000) return;

  let rows;
  try {
    // Usamos apenas colunas presentes em todas as versões do ledger. Nome e
    // telefone foram adicionados depois e não podem derrubar instalações que
    // ainda possuem a tabela Bestfy antiga.
    rows = await database.query(
      `SELECT transaction_id,status,customer_email,user_id,
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
    const customerEmail = String(row.customer_email || "").trim().toLowerCase().slice(0, 190);

    await database.query(
      `INSERT INTO vendas
       (id,cliente_id,cliente_nome,cliente_email,cliente_telefone,
        vendedor_id,vendedor_nome,vendedor_email,produto_id,produto_codigo,produto_nome,
        valor_bruto,desconto,valor,forma_pagamento,parcelas,status,
        porcentagem_comissao,comissao,comissao_status,cupom_codigo,data_venda,
        pago_em,cancelado_em,observacoes,origem,criado_por,atualizado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         cliente_id=VALUES(cliente_id),cliente_email=VALUES(cliente_email),
         produto_id=VALUES(produto_id),produto_codigo=VALUES(produto_codigo),
         produto_nome=VALUES(produto_nome),valor_bruto=VALUES(valor_bruto),valor=VALUES(valor),
         status=VALUES(status),data_venda=VALUES(data_venda),pago_em=VALUES(pago_em),
         cancelado_em=VALUES(cancelado_em),observacoes=VALUES(observacoes),
         atualizado_por='bestfy-sync'`,
      [
        sourceId,
        String(row.user_id || "").slice(0, 24),
        customerEmail,
        customerEmail,
        "",
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

  try {
    await syncBestfySales();
  } catch (error) {
    // Reconciliação é enriquecimento do painel. Uma incompatibilidade temporária
    // do ledger Bestfy não pode transformar todas as rotas /vendas em HTTP 503.
    if (Date.now() - lastSyncErrorAt > 60000) {
      lastSyncErrorAt = Date.now();
      console.error("[SALES] Falha não fatal ao reconciliar Bestfy:", error?.message || error);
    }
  }
}

router.use("/vendas", async (_req, res, next) => {
  try {
    await prepare();
    return next();
  } catch (error) {
    console.error("Erro ao preparar estrutura base do Sales Command Center:", error);
    // Se o banco estiver fora, as próprias rotas responderão de acordo com sua
    // disponibilidade. Não derrubamos todo o módulo comercial num preflight.
    return next();
  }
});

router.get("/vendas/dashboard", (_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (payload && typeof payload === "object" && payload.sucesso) {
      if (Array.isArray(payload.ranking)) {
        payload.ranking = payload.ranking.filter((item) => String(item?.vendedorId || "").trim());
        payload.ranking.forEach((item, index) => { item.posicao = index + 1; });
      }

      const paid = Number(payload.indicadores?.vendasConfirmadas || 0);
      const pending = Number(payload.indicadores?.vendasPendentes || 0);
      const legacyCancelled = Array.isArray(payload.funil)
        ? Number(payload.funil.find((item) => /cancel/i.test(String(item?.etapa || "")))?.total || 0)
        : 0;
      const total = paid + pending + legacyCancelled;
      payload.funil = [
        { etapa: "Vendas registradas", total },
        { etapa: "Aguardando pagamento", total: pending },
        { etapa: "Vendas confirmadas", total: paid },
        { etapa: "Canceladas / estornadas", total: legacyCancelled }
      ];
    }
    return originalJson(payload);
  };
  return next();
});

module.exports = router;
module.exports.prepare = prepare;
module.exports.syncBestfySales = syncBestfySales;
