"use strict";

const express = require("express");

// O módulo ativo está em notificacoes-mysql.js e é carregado por
// notificacoes-compat.js para preservar a ordem atual do server.js.
// Este router vazio impede qualquer uso acidental do MongoDB/Render.
module.exports = express.Router();
