"use strict";

const express = require("express");
const router = express.Router();

// Ordem intencional: primeiro reconciliamos preços/Bestfy, depois aplicamos as
// regras de segurança que interceptam mutações sensíveis. Só então o restante
// das rotas legadas do módulo comercial é carregado.
router.use(require("./vendas-command-preflight"));
router.use(require("./vendas-security-overrides"));
router.use(require("./vendas-mysql"));

// Dashboard do aluno integrado ao mesmo MySQL da Hostinger.
router.use("/dashboard-premium", require("./dashboard-premium"));

module.exports = router;
