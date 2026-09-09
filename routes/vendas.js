"use strict";

const express = require("express");
const router = express.Router();

// Ordem intencional:
// 1) prepara/reconcilia sem derrubar o módulo;
// 2) aplica as regras de segurança antes de qualquer mutação legada;
// 3) deixa as rotas comerciais existentes responderem normalmente;
// 4) expõe as rotas adicionais do Sales Command Center por último.
//
// Assim, se a tabela opcional de metas tiver qualquer problema de criação na
// hospedagem, ela não intercepta e transforma TODO /vendas em HTTP 503.
router.use(require("./vendas-command-preflight"));
router.use(require("./vendas-security-overrides"));
router.use(require("./vendas-mysql"));
router.use(require("./vendas-command-center"));

// Dashboard do aluno integrado ao mesmo MySQL da Hostinger.
router.use("/dashboard-premium", require("./dashboard-premium"));

module.exports = router;
