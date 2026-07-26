"use strict";

const express = require("express");
const crypto = require("crypto");

const database = require("../config/database");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();

function gerarId() {
  return crypto.randomBytes(12).toString("hex");
}

async function garantirTabela() {
  await database.query(`
    CREATE TABLE IF NOT EXISTS provas_resultados (
      id CHAR(24) NOT NULL PRIMARY KEY,
      usuario_id CHAR(24) NOT NULL DEFAULT '',
      usuario_nome VARCHAR(160) NOT NULL DEFAULT '',
      usuario_email VARCHAR(190) NOT NULL DEFAULT '',
      prova_id CHAR(24) NOT NULL DEFAULT '',
      prova_titulo VARCHAR(190) NOT NULL DEFAULT '',
      prova_modulo VARCHAR(160) NOT NULL DEFAULT '',
      nota DECIMAL(6,2) NOT NULL DEFAULT 0,
      nota_minima DECIMAL(6,2) NOT NULL DEFAULT 70,
      acertos INT NOT NULL DEFAULT 0,
      erros INT NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'pendente',
      respostas LONGTEXT NULL,
      finalizado_em DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_provas_resultados_usuario (usuario_id),
      KEY idx_provas_resultados_prova (prova_id),
      KEY idx_provas_resultados_status (status),
      KEY idx_provas_resultados_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function formatar(row) {
  return {
    id: row.id,
    _id: row.id,
    usuarioId: row.usuario_id || "",
    usuarioNome: row.usuario_nome || "",
    usuarioEmail: row.usuario_email || "",
    provaId: row.prova_id || "",
    provaTitulo: row.prova_titulo || "Prova",
    provaModulo: row.prova_modulo || "Sem módulo",
    nota: Number(row.nota || 0),
    notaMinima: Number(row.nota_minima || 70),
    acertos: Number(row.acertos || 0),
    erros: Number(row.erros || 0),
    status: row.status || "pendente",
    finalizadoEm: row.finalizado_em || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

router.get(
  "/provas/resumo",
  auth,
  requirePermission("provas"),
  async (req, res) => {
    try {
      await garantirTabela();
      const rows = await database.query(`
        SELECT
          COUNT(*) AS resultados,
          SUM(CASE WHEN status = 'aprovado' THEN 1 ELSE 0 END) AS aprovados,
          SUM(CASE WHEN status = 'reprovado' THEN 1 ELSE 0 END) AS reprovados,
          SUM(CASE WHEN status = 'em_analise' THEN 1 ELSE 0 END) AS em_analise,
          SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) AS pendentes
        FROM provas_resultados
      `);

      const item = rows[0] || {};
      return res.json({
        sucesso: true,
        origem: "mysql",
        resumo: {
          resultados: Number(item.resultados || 0),
          aprovados: Number(item.aprovados || 0),
          reprovados: Number(item.reprovados || 0),
          emAnalise: Number(item.em_analise || 0),
          pendentes: Number(item.pendentes || 0)
        }
      });
    } catch (error) {
      console.error("Erro MySQL no resumo de provas:", error);
      return res.status(500).json({ erro: "Erro interno ao carregar os resultados das provas." });
    }
  }
);

router.get(
  "/provas/resultados-v2",
  auth,
  requirePermission("provas"),
  async (req, res) => {
    try {
      await garantirTabela();

      const busca = String(req.query?.busca || "").trim();
      const status = String(req.query?.status || "").trim();
      const limite = Math.min(Math.max(Number(req.query?.limite || 300), 1), 500);
      const filtros = [];
      const params = [];

      if (busca) {
        filtros.push(`(
          usuario_nome LIKE ? OR usuario_email LIKE ? OR
          prova_titulo LIKE ? OR prova_modulo LIKE ?
        )`);
        const termo = `%${busca}%`;
        params.push(termo, termo, termo, termo);
      }

      if (["aprovado", "reprovado", "em_analise", "pendente"].includes(status)) {
        filtros.push("status = ?");
        params.push(status);
      }

      const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
      const rows = await database.query(
        `SELECT * FROM provas_resultados ${where} ORDER BY created_at DESC LIMIT ${limite}`,
        params
      );

      return res.json({
        sucesso: true,
        origem: "mysql",
        total: rows.length,
        resultados: rows.map(formatar)
      });
    } catch (error) {
      console.error("Erro MySQL ao listar resultados de provas:", error);
      return res.status(500).json({ erro: "Erro interno ao listar os resultados das provas." });
    }
  }
);

router.post(
  "/provas/resultados-v2",
  auth,
  requirePermission("provas"),
  async (req, res) => {
    try {
      await garantirTabela();
      const id = gerarId();
      const body = req.body || {};

      await database.query(
        `INSERT INTO provas_resultados (
          id, usuario_id, usuario_nome, usuario_email, prova_id,
          prova_titulo, prova_modulo, nota, nota_minima, acertos,
          erros, status, respostas, finalizado_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          String(body.usuarioId || ""),
          String(body.usuarioNome || ""),
          String(body.usuarioEmail || ""),
          String(body.provaId || ""),
          String(body.provaTitulo || "Prova"),
          String(body.provaModulo || "Sem módulo"),
          Number(body.nota || 0),
          Number(body.notaMinima || 70),
          Number(body.acertos || 0),
          Number(body.erros || 0),
          String(body.status || "pendente"),
          JSON.stringify(body.respostas || []),
          body.finalizadoEm || null
        ]
      );

      return res.status(201).json({ sucesso: true, id });
    } catch (error) {
      console.error("Erro MySQL ao registrar resultado de prova:", error);
      return res.status(500).json({ erro: "Erro interno ao registrar o resultado da prova." });
    }
  }
);

module.exports = router;
