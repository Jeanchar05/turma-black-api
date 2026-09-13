"use strict";
const express = require("express");
const { auth, requirePremium } = require("../middleware/auth");
const service = require("../services/study-state");
const router = express.Router();
router.use(auth, requirePremium);
router.use((req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
async function handle(req, res) {
  const userId = String(
    req.usuario.id || req.usuario._id || req.usuarioDoc?._id || "",
  );
  if (
    (req.method === "POST" && !req.get("X-Study-Account")) ||
    (req.get("X-Study-Account") && req.get("X-Study-Account") !== userId)
  )
    return res
      .status(401)
      .json({ erro: "A conta mudou. Entre novamente para continuar." });
  try {
    if (
      req.method === "POST" &&
      (!Array.isArray(req.body?.operations) || req.body.operations.length === 0)
    )
      return res.status(400).json({ erro: "Envie as alterações do estudo." });
    return res.json(
      await service.update(
        userId,
        req.method === "POST" ? req.body.operations : [],
      ),
    );
  } catch (error) {
    if (error.status === 409)
      return res
        .status(409)
        .json({ erro: error.message, ...(await service.update(userId)) });
    if (error.status)
      return res.status(error.status).json({ erro: error.message });
    console.error("Falha ao salvar estudo:", error.code || error.message);
    return res
      .status(503)
      .json({ erro: "Não foi possível sincronizar agora. Tente novamente." });
  }
}
router.get("/state", handle);
router.post("/state", handle);
module.exports = router;
