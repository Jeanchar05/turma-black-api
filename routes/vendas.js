"use strict";

const express = require("express");
const router = express.Router();

// Ordem intencional:
// 1) prepara/reconcilia a operação comercial;
// 2) aplica as regras de segurança antes de qualquer mutação legada;
// 3) monta as rotas específicas do Sales Command Center ANTES de /vendas/:id;
// 4) só então monta o router comercial legado.
//
// Isso evita que endpoints como /vendas/command-center e /vendas/metas sejam
// interpretados como se "command-center" ou "metas" fossem IDs de venda.
router.use(require("./vendas-command-preflight"));
router.use(require("./vendas-security-overrides"));
router.use(require("./vendas-command-center"));
router.use(require("./vendas-mysql"));

// Dashboard do aluno integrado ao mesmo MySQL da Hostinger.
router.use("/dashboard-premium", require("./dashboard-premium"));

module.exports = router;
