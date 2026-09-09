"use strict";

const express = require("express");
const crypto = require("crypto");
const database = require("../config/database");
const { auth } = require("../middleware/auth");

const router = express.Router();

const PLANOS = Object.freeze({
  black30: { valor: 99.99, dias: 30 },
  black180: { valor: 249.99, dias: 180 },
  black360: { valor: 397.00, dias: 365 }
});

function id24() { return crypto.randomBytes(12).toString("hex"); }
function texto(value, max = 1000) { return String(value ?? "").trim().slice(0, max); }
function email(value) { return texto(value, 190).toLowerCase(); }

async function garantirTabela() {
  await database.query(`
    CREATE TABLE IF NOT EXISTS solicitacoes_liberacao (
      id CHAR(24) NOT NULL PRIMARY KEY,
      codigo VARCHAR(64) NOT NULL UNIQUE,
      usuario_id CHAR(24) NOT NULL DEFAULT '',
      nome VARCHAR(160) NOT NULL DEFAULT '',
      email VARCHAR(190) NOT NULL DEFAULT '',
      telefone VARCHAR(40) NOT NULL DEFAULT '',
      plano VARCHAR(32) NOT NULL DEFAULT 'black30',
      valor DECIMAL(12,2) NOT NULL DEFAULT 0,
      referencia_pagamento VARCHAR(190) NOT NULL DEFAULT '',
      comprovante LONGTEXT NULL,
      observacao TEXT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'pendente',
      analisado_em DATETIME NULL,
      analisado_por VARCHAR(190) NOT NULL DEFAULT '',
      motivo_recusa VARCHAR(1000) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_liberacao_user (usuario_id, status),
      KEY idx_liberacao_status (status, created_at),
      KEY idx_liberacao_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function gerarCodigoUnico() {
  for (let tentativa = 0; tentativa < 12; tentativa += 1) {
    const bloco = () => crypto.randomBytes(2).toString("hex").toUpperCase();
    const codigo = `PRIMO-${bloco()}-${bloco()}`;
    const rows = await database.query("SELECT id FROM solicitacoes_liberacao WHERE codigo=? LIMIT 1", [codigo]);
    if (!rows.length) return codigo;
  }
  throw new Error("Falha ao gerar código único.");
}

function formatar(row) {
  return {
    id: row.id, _id: row.id, codigo: row.codigo || "", usuarioId: row.usuario_id || "", nome: row.nome || "", email: row.email || "", telefone: row.telefone || "",
    plano: row.plano || "black30", valor: Number(row.valor || 0), referenciaPagamento: row.referencia_pagamento || "", comprovante: row.comprovante || "", observacao: row.observacao || "", status: row.status || "pendente",
    analisadoEm: row.analisado_em || "", analisadoPor: row.analisado_por || "", motivoRecusa: row.motivo_recusa || "", createdAt: row.created_at || "", updatedAt: row.updated_at || ""
  };
}

router.post("/liberacoes/solicitar", auth, async (req, res) => {
  try {
    await garantirTabela();
    const plano = String(req.body?.plano || "").trim().toLowerCase();
    const dadosPlano = PLANOS[plano];
    if (!dadosPlano) return res.status(400).json({ erro: "Plano inválido para solicitação de liberação.", codigo: "PLANO_LIBERACAO_INVALIDO" });

    const usuarioId = texto(req.usuario?.id || req.usuario?._id, 24);
    const pendentes = await database.query("SELECT * FROM solicitacoes_liberacao WHERE usuario_id=? AND status='pendente' ORDER BY created_at DESC LIMIT 1", [usuarioId]);
    if (pendentes[0]) {
      return res.json({ sucesso: true, mensagem: "Você já possui uma solicitação aguardando análise.", solicitacao: formatar(pendentes[0]) });
    }

    const id = id24();
    const codigo = await gerarCodigoUnico();
    await database.query(`INSERT INTO solicitacoes_liberacao
      (id,codigo,usuario_id,nome,email,telefone,plano,valor,referencia_pagamento,comprovante,observacao,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'pendente')`, [
      id, codigo, usuarioId, texto(req.usuario?.nome,160), email(req.usuario?.email), texto(req.usuario?.telefone,40), plano, dadosPlano.valor,
      texto(req.body?.referenciaPagamento,190), texto(req.body?.comprovante,4000), texto(req.body?.observacao,1000)
    ]);

    const rows = await database.query("SELECT * FROM solicitacoes_liberacao WHERE id=? LIMIT 1", [id]);
    return res.status(201).json({ sucesso: true, mensagem: "Solicitação criada. Aguarde a análise da equipe.", solicitacao: formatar(rows[0]) });
  } catch (error) {
    console.error("Erro MySQL ao solicitar liberação:", error);
    return res.status(500).json({ erro: "Erro interno ao gerar solicitação de liberação." });
  }
});

router.get("/liberacoes/minha", auth, async (req, res) => {
  try {
    await garantirTabela();
    const usuarioId = texto(req.usuario?.id || req.usuario?._id,24);
    const rows = await database.query("SELECT * FROM solicitacoes_liberacao WHERE usuario_id=? ORDER BY created_at DESC LIMIT 30", [usuarioId]);
    return res.json({ sucesso: true, origem: "mysql", solicitacoes: rows.map(formatar) });
  } catch (error) {
    console.error("Erro MySQL ao listar liberações:", error);
    return res.status(500).json({ erro: "Erro interno ao carregar solicitações." });
  }
});

module.exports = router;
