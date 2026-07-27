"use strict";

const express = require("express");
const router = express.Router();

// Compatibilidade: o servidor continua carregando routes/vendas.js.
router.use(require("./vendas-mysql"));

// Dashboard do aluno integrado ao mesmo MySQL da Hostinger.
router.use("/dashboard-premium", require("./dashboard-premium"));

module.exports = router;
