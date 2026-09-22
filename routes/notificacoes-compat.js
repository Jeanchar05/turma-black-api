"use strict";

const express = require("express");
const router = express.Router();

// Compatibilidade mantida no mesmo ponto de montagem do servidor.
// As notificações continuam no MySQL e este roteador também concentra
// as extensões V6 que precisam viver na raiz sem duplicar configuração
// no server.js.
const evolution = require("../services/student-evolution");
require("../services/bankroll-days-v6").patch(evolution);
require("../services/journey-elite-v6").patch(evolution);
router.use(require("./notificacoes-mysql"));
router.use(require("./student-evolution"));
router.use("/dashboard-premium", require("./profile-v6"));
router.use("/profile-v6", require("./profile-save-v6"));

module.exports = router;
