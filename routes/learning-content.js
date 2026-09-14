"use strict";
const express = require("express");
const { auth, requirePremium } = require("../middleware/auth");
const { getCargo, temPermissaoEfetiva } = require("../middleware/permissions");
const { sensitiveWriteRateLimit } = require("../middleware/rate-limit");
const service = require("../services/learning-content");
const pdf = require("../services/learning-pdf");
const router = express.Router();
router.use(auth, requirePremium, (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
async function canManage(req) {
  const user = req.usuarioDoc || req.usuario;
  return (
    ["dev", "dono", "superadmin", "admin"].includes(getCargo(user)) &&
    (await temPermissaoEfetiva(user, "painelAdmin"))
  );
}
function fail(res, e) {
  if (!e.status)
    console.error("Falha no conteúdo das aulas:", e.code || e.message);
  return res
    .status(e.status || 503)
    .json({
      erro: e.status
        ? e.message
        : "Não foi possível carregar o conteúdo. Tente novamente.",
    });
}
router.get("/catalog", async (req, res) => {
  try {
    const manage = await canManage(req);
    res.json({ ...(await service.list(manage)), canManage: manage });
  } catch (e) {
    fail(res, e);
  }
});
router.put("/content/:id", sensitiveWriteRateLimit, async (req, res) => {
  try {
    const userId = String(req.usuario.id || req.usuario._id || "");
    if (req.get("X-Study-Account") !== userId)
      return res.status(401).json({ erro: "A conta mudou. Entre novamente." });
    if (!(await canManage(req)))
      return res
        .status(403)
        .json({ erro: "Somente a equipe autorizada pode publicar conteúdos." });
    if (!req.is("application/json"))
      return res.status(415).json({ erro: "Formato inválido." });
    res.json({ content: await service.save(req.params.id, req.body, userId) });
  } catch (e) {
    fail(res, e);
  }
});
router.get("/materials/:id.pdf", async (req, res) => {
  try {
    const { modules } = await service.list(false),
      content = modules.find((m) => m.id === req.params.id);
    if (!content)
      return res.status(404).json({ erro: "Material não encontrado." });
    const doc = pdf.create(content);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="turma-do-primo-${content.id}.pdf"`,
    });
    doc.on("error", (e) => {
      console.error("Falha no PDF:", e.message);
      res.destroy();
    });
    doc.pipe(res);
    doc.end();
  } catch (e) {
    if (!res.headersSent) fail(res, e);
    else res.destroy();
  }
});
module.exports = router;
