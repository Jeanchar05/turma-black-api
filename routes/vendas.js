"use strict";

// Compatibilidade: o servidor continua carregando routes/vendas.js,
// mas toda a operação comercial agora usa o MySQL da Hostinger.
module.exports = require("./vendas-mysql");
