"use strict";

const express = require("express");
const { loginRateLimit, loginIpRateLimit } = require("../middleware/rate-limit");
const { loginCompativel } = require("../services/login-core");

const router = express.Router();
router.post("/login", loginIpRateLimit, loginRateLimit, loginCompativel);
router.post("/auth/login", loginIpRateLimit, loginRateLimit, loginCompativel);
router.use("/admin", require("./admin-mysql-core"));
module.exports = router;
