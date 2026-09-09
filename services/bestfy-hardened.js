"use strict";

const database = require("../config/database");
const { withTransaction } = require("./db-transaction");
const bestfy = require("./bestfy");

function normalizeStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  const aliases = {
    CANCELLED: "CANCELED",
    CANCELADO: "CANCELED",
    PAGO: "PAID",
    ESTORNADO: "REFUNDED",
    RECUSADO: "REJECTED"
  };
  return aliases[status] || status;
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

function isPaid(status) {
  return normalizeStatus(status) === "PAID";
}

async function revokedRow(transactionId) {
  const rows = await database.query(
    `SELECT transaction_id,status,user_id,customer_email,applied_at,revoked_at
       FROM bestfy_transactions
      WHERE transaction_id=? LIMIT 1`,
    [String(transactionId || "")]
  );
  return rows[0] || null;
}

/**
 * Reconciliador idempotente para a janela crítica da revogação Bestfy.
 *
 * A implementação histórica marcava revoked_at e só depois persistia a conta.
 * Se o processo falhasse entre as duas gravações, um replay via webhook podia
 * enxergar a transação como duplicada. Esta rotina aceita exatamente esse
 * estado e conclui a atualização da conta em uma transação MySQL. Se a conta
 * já estiver reconciliada, a chamada vira um no-op seguro.
 */
async function reconcileRevocation(transactionId, requestedStatus) {
  const id = String(transactionId || "").trim();
  if (!id) return { reconciled: false, reason: "missing-transaction" };

  return withTransaction(async (tx) => {
    const rows = await tx.query(
      "SELECT * FROM bestfy_transactions WHERE transaction_id=? LIMIT 1 FOR UPDATE",
      [id]
    );
    const payment = rows[0] || null;
    if (!payment || !payment.applied_at) {
      return { reconciled: false, reason: "not-applied" };
    }

    const finalStatus = normalizeStatus(requestedStatus || payment.status || "REVOKED");
    if (isPaid(finalStatus)) {
      return { reconciled: false, reason: "still-paid" };
    }

    const userId = String(payment.user_id || "").trim();
    const customerEmail = String(payment.customer_email || "").trim().toLowerCase();
    let users = [];

    if (userId) {
      users = await tx.query(
        "SELECT id,email,plano,data_expiracao,extras,status,suspenso FROM usuarios WHERE id=? LIMIT 1 FOR UPDATE",
        [userId]
      );
    }
    if (!users.length && customerEmail) {
      users = await tx.query(
        "SELECT id,email,plano,data_expiracao,extras,status,suspenso FROM usuarios WHERE LOWER(email)=? LIMIT 1 FOR UPDATE",
        [customerEmail]
      );
    }

    const user = users[0] || null;
    let userChanged = false;
    let restoredTransactionId = "";

    if (user) {
      const extras = parseExtras(user.extras);
      const currentBestfyId = String(extras.bestfyTransactionId || "").trim();

      if (currentBestfyId === id) {
        const previousRows = await tx.query(
          `SELECT transaction_id,plan,access_expires_at,payment_confirmed_at
             FROM bestfy_transactions
            WHERE transaction_id<>?
              AND (user_id=? OR (user_id='' AND customer_email=?))
              AND status='PAID'
              AND applied_at IS NOT NULL
              AND revoked_at IS NULL
              AND access_expires_at<>''
            ORDER BY access_expires_at DESC, applied_at DESC
            LIMIT 1`,
          [id, String(user.id), String(user.email || "").trim().toLowerCase()]
        );

        const previous = previousRows.find((row) => {
          const expires = new Date(row.access_expires_at || "").getTime();
          return Number.isFinite(expires) && expires > Date.now();
        }) || null;

        if (previous) {
          extras.bestfyTransactionId = String(previous.transaction_id || "");
          extras.bestfyStatus = "PAID";
          extras.bestfyPaidAt = previous.payment_confirmed_at || extras.bestfyPaidAt || "";
          extras.bestfyRevokedAt = new Date().toISOString();
          restoredTransactionId = extras.bestfyTransactionId;

          await tx.query(
            `UPDATE usuarios
                SET plano=?,data_expiracao=?,extras=?,atualizado_por='bestfy-reconcile',updated_at=CURRENT_TIMESTAMP
              WHERE id=?`,
            [previous.plan || "free", previous.access_expires_at || "", JSON.stringify(extras), String(user.id)]
          );
        } else {
          extras.bestfyTransactionId = "";
          extras.bestfyStatus = finalStatus;
          extras.bestfyRevokedAt = new Date().toISOString();

          await tx.query(
            `UPDATE usuarios
                SET plano='free',data_expiracao='',extras=?,atualizado_por='bestfy-reconcile',updated_at=CURRENT_TIMESTAMP
              WHERE id=?`,
            [JSON.stringify(extras), String(user.id)]
          );
        }
        userChanged = true;
      }
    }

    await tx.query(
      `UPDATE bestfy_transactions
          SET status=?,revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP),
              processing=0,processing_started_at=NULL,last_error=NULL,updated_at=CURRENT_TIMESTAMP
        WHERE transaction_id=?`,
      [finalStatus, id]
    );

    return {
      reconciled: true,
      userFound: Boolean(user),
      userChanged,
      restoredPreviousAccess: Boolean(restoredTransactionId)
    };
  });
}

async function recoverIfPartiallyRevoked(transactionId) {
  const row = await revokedRow(transactionId);
  if (!row || !row.applied_at || !row.revoked_at || isPaid(row.status)) return null;
  return reconcileRevocation(transactionId, row.status);
}

async function processarWebhookBestfy(payload = {}) {
  const transactionId = String(payload?.transactionId || "").trim();

  try {
    const result = await bestfy.processarWebhookBestfy(payload);
    const verifiedStatus = normalizeStatus(result?.statusVerificado || result?.status);

    if (transactionId && !isPaid(verifiedStatus) && (result?.revogado || result?.duplicado)) {
      const recovery = await reconcileRevocation(transactionId, verifiedStatus);
      return { ...result, reconciliacaoConcluida: Boolean(recovery?.reconciled) };
    }

    return result;
  } catch (error) {
    // Se a implementação anterior já marcou revoked_at antes de falhar ao
    // persistir o usuário, conclua a reconciliação agora. Não usamos apenas o
    // status recebido no webhook: exigimos evidência local de revogação já
    // gravada, que só ocorre depois da revalidação Bestfy.
    if (transactionId) {
      try {
        const recovery = await recoverIfPartiallyRevoked(transactionId);
        if (recovery?.reconciled) {
          const row = await revokedRow(transactionId);
          return {
            recebido: true,
            transactionId,
            status: normalizeStatus(row?.status),
            revogado: true,
            recuperadoAposFalha: true,
            reconciliacaoConcluida: true
          };
        }
      } catch (recoveryError) {
        console.error("[BESTFY_RECONCILE] Falha ao recuperar revogação:", recoveryError.message);
      }
    }
    throw error;
  }
}

module.exports = {
  ...bestfy,
  processarWebhookBestfy,
  reconcileRevocation,
  recoverIfPartiallyRevoked
};
