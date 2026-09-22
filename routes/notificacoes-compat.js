"use strict";

const express = require("express");
const router = express.Router();

// Compatibilidade mantida no mesmo ponto de montagem do servidor.
// As extensões que precisam interceptar rotas antigas entram aqui antes
// dos roteadores legados carregados depois no server.js.
const evolution = require("../services/student-evolution");
require("../services/bankroll-days-v6").patch(evolution);
require("../services/journey-elite-v6").patch(evolution);
router.use(require("./support-admin-v7"));
router.use(require("./notificacoes-mysql"));
router.use(require("./student-evolution"));
router.use("/dashboard-premium", require("./profile-v6"));
router.use("/profile-v6", require("./profile-save-v6"));

module.exports = router;
