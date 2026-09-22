"use strict";

const express = require("express");
const router = express.Router();

// Compatibilidade mantida no mesmo ponto de montagem do servidor.
// As notificações continuam no MySQL e este roteador também concentra
// as extensões V6 que precisam viver na raiz sem duplicar configuração
// no server.js.
router.use(require("./notificacoes-mysql"));
router.use(require("./student-evolution"));
router.use("/dashboard-premium", require("./profile-v6"));

module.exports = router;
