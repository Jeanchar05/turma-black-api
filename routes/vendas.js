"use strict";

const express = require("express");
const router = express.Router();

// Ordem intencional: reconciliamos preços/Bestfy, aplicamos as regras de
// segurança e então expomos a camada consolidada do Sales Command Center antes
// do router legado comercial.
router.use(require("./vendas-command-preflight"));
router.use(require("./vendas-security-overrides"));
router.use(require("./vendas-command-center"));
router.use(require("./vendas-mysql"));

// Dashboard do aluno integrado ao mesmo MySQL da Hostinger.
router.use("/dashboard-premium", require("./dashboard-premium"));

module.exports = router;
