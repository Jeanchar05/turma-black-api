"use strict";

const express = require("express");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
const sharp = require("sharp");
const database = require("../config/database");
const { auth, montarUsuarioSeguro } = require("../middleware/auth");
const { hashPassword, verifyPassword, validatePasswordPolicy, MIN_USER_PASSWORD_LENGTH } = require("../services/passwords");
const { revokeAllUserSessions } = require("../services/sessions");
const studyService = require("../services/study-state");
const studyModel = require("../public/study-state-model");
const Profile = require("../services/profile-security-v6");

const router = express.Router();
let structurePromise = null;

function userId(req) { return String(req.usuario?.id || req.usuario?._id || req.usuarioDoc?._id || ""); }
function production() { return String(process.env.NODE_ENV || "").toLowerCase() === "production"; }
function verificationSecret() { return String(process.env.PROFILE_VERIFICATION_SECRET || process.env.JWT_SECRET || "profile-verification-dev"); }
function text(value, max = 1000) { return String(value || "").trim().slice(0, max); }

async function ensureStructure() {
  if (!structurePromise) {
    structurePromise = database.query(`
      CREATE TABLE IF NOT EXISTS profile_phone_verifications (
        id CHAR(24) NOT NULL PRIMARY KEY,
        user_id CHAR(24) NOT NULL,
        target_phone VARCHAR(24) NOT NULL,
        code_hash CHAR(64) NOT NULL,
        attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_profile_phone_user (user_id, created_at),
        KEY idx_profile_phone_expiry (expires_at),
        CONSTRAINT fk_profile_phone_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch((error) => { structurePromise = null; throw error; });
  }
  return structurePromise;
}

async function tableExists(name) {
  const rows = await database.query("SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?", [name]);
  return Number(rows[0]?.total || 0) > 0;
}

async function deliverPhoneCode(phone, code) {
  const url = String(process.env.PHONE_OTP_WEBHOOK_URL || "").trim();
  const secret = String(process.env.PHONE_OTP_WEBHOOK_SECRET || "").trim();
  if (!url || !/^https:\/\//i.test(url)) {
    if (production()) throw Object.assign(new Error("O envio por SMS/WhatsApp ainda não está configurado."), { code: "PHONE_OTP_NOT_CONFIGURED" });
    return { delivered: false, development: true };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify({ to: phone, code, template: "turma-do-primo-profile-phone", expiresInMinutes: 10 }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Provedor respondeu ${response.status}.`);
    return { delivered: true, development: false };
  } finally { clearTimeout(timeout); }
}

router.put("/perfil", auth, async (req, res) => {
  try {
    const user = req.usuarioDoc;
    if (!user) return res.status(401).json({ erro: "Conta não encontrada." });
    const name = Profile.safeDisplayName(req.body?.nome);
    if (!name) return res.status(400).json({ erro: "Nome é obrigatório." });
    const requestedPhoneRaw = text(req.body?.telefone, 40);
    const currentPhone = Profile.normalizePhone(user.telefone || "");
    const requestedPhone = requestedPhoneRaw ? Profile.normalizePhone(requestedPhoneRaw) : "";
    if (requestedPhoneRaw && !requestedPhone) return res.status(400).json({ erro: "Informe um telefone válido com DDD." });
    if (requestedPhone && requestedPhone !== currentPhone) {
      return res.status(409).json({ erro: "Confirme o novo telefone com o código de verificação antes de salvar.", codigo: "PHONE_VERIFICATION_REQUIRED" });
    }
    user.nome = name;
    if (req.body?.foto !== undefined) {
      const photo = String(req.body.foto || "").trim();
      if (photo && !/^https:\/\//i.test(photo) && !/^data:image\/webp;base64,/i.test(photo)) return res.status(400).json({ erro: "Foto de perfil inválida." });
      if (photo.length > 350000) return res.status(413).json({ erro: "Foto de perfil muito grande." });
      user.foto = photo;
    }
    user.atualizadoPor = req.usuario?.email || "perfil-v6";
    await user.save({ validateModifiedOnly: true });
    return res.json({ sucesso: true, usuario: montarUsuarioSeguro(user) });
  } catch (error) {
    console.error("Erro ao atualizar perfil V6:", error);
    return res.status(500).json({ erro: "Não foi possível atualizar o perfil." });
  }
});

router.post("/perfil/foto", auth, async (req, res) => {
  try {
    const raw = String(req.body?.base64 || "").replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "").replace(/\s+/g, "");
    if (!raw || raw.length > 6 * 1024 * 1024) return res.status(400).json({ erro: "Envie uma imagem válida de até 4 MB." });
    let input;
    try { input = Buffer.from(raw, "base64"); } catch (_) { return res.status(400).json({ erro: "Imagem inválida." }); }
    if (!input.length || input.length > 4 * 1024 * 1024) return res.status(413).json({ erro: "A imagem deve ter no máximo 4 MB." });
    const output = await sharp(input, { failOn: "error" }).rotate().resize(420, 420, { fit: "cover", position: "attention" }).webp({ quality: 80, effort: 4 }).toBuffer();
    const photo = `data:image/webp;base64,${output.toString("base64")}`;
    const user = req.usuarioDoc;
    user.foto = photo;
    user.atualizadoPor = "profile-photo-v6";
    await user.save({ validateModifiedOnly: true });
    return res.json({ sucesso: true, foto: photo, usuario: montarUsuarioSeguro(user) });
  } catch (error) {
    console.error("Erro ao processar foto do perfil:", error.message);
    return res.status(415).json({ erro: "Não foi possível processar essa imagem. Use JPG, PNG ou WEBP." });
  }
});

router.post("/perfil/telefone/solicitar", auth, async (req, res) => {
  try {
    await ensureStructure();
    const id = userId(req);
    const phone = Profile.normalizePhone(req.body?.telefone);
    if (!phone) return res.status(400).json({ erro: "Informe um telefone brasileiro válido com DDD." });
    if (phone === Profile.normalizePhone(req.usuarioDoc?.telefone || "")) return res.status(409).json({ erro: "Este telefone já está cadastrado na sua conta." });
    const recent = await database.query("SELECT created_at FROM profile_phone_verifications WHERE user_id=? ORDER BY created_at DESC LIMIT 1", [id]);
    if (recent[0]?.created_at && Date.now() - new Date(recent[0].created_at).getTime() < 60000) return res.status(429).json({ erro: "Aguarde um minuto antes de solicitar outro código." });
    const code = Profile.generateCode();
    const delivery = await deliverPhoneCode(phone, code);
    const verificationId = crypto.randomBytes(12).toString("hex");
    const digest = Profile.hashCode({ code, userId: id, phone, secret: verificationSecret() });
    await database.query("DELETE FROM profile_phone_verifications WHERE user_id=? OR expires_at < CURRENT_TIMESTAMP", [id]);
    await database.query("INSERT INTO profile_phone_verifications (id,user_id,target_phone,code_hash,expires_at) VALUES (?,?,?,?,DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 10 MINUTE))", [verificationId, id, phone, digest]);
    return res.json({
      sucesso: true,
      verificationId,
      telefone: Profile.maskPhone(phone),
      mensagem: delivery.delivered ? "Código enviado. Ele expira em 10 minutos." : "Fluxo de verificação preparado em ambiente de desenvolvimento.",
      ...(delivery.development ? { devCode: code } : {}),
    });
  } catch (error) {
    if (error.code === "PHONE_OTP_NOT_CONFIGURED") return res.status(503).json({ erro: error.message, codigo: error.code });
    console.error("Erro ao solicitar verificação de telefone:", error);
    return res.status(503).json({ erro: "Não foi possível enviar o código agora." });
  }
});

router.post("/perfil/telefone/confirmar", auth, async (req, res) => {
  try {
    await ensureStructure();
    const id = userId(req);
    const verificationId = text(req.body?.verificationId, 24);
    const code = String(req.body?.codigo || "").replace(/\D+/g, "").slice(0, 6);
    if (!/^[a-f0-9]{24}$/i.test(verificationId) || !/^\d{6}$/.test(code)) return res.status(400).json({ erro: "Código inválido." });
    const rows = await database.query("SELECT * FROM profile_phone_verifications WHERE id=? AND user_id=? LIMIT 1", [verificationId, id]);
    const item = rows[0];
    if (!item) return res.status(404).json({ erro: "Solicitação de verificação não encontrada." });
    if (new Date(item.expires_at).getTime() <= Date.now()) { await database.query("DELETE FROM profile_phone_verifications WHERE id=?", [verificationId]); return res.status(410).json({ erro: "O código expirou. Solicite outro." }); }
    if (Number(item.attempts || 0) >= 5) return res.status(429).json({ erro: "Muitas tentativas. Solicite um novo código." });
    await database.query("UPDATE profile_phone_verifications SET attempts=attempts+1 WHERE id=?", [verificationId]);
    const valid = Profile.verifyCode({ code, userId: id, phone: item.target_phone, secret: verificationSecret(), digest: item.code_hash });
    if (!valid) return res.status(400).json({ erro: "Código incorreto." });
    const user = req.usuarioDoc;
    user.telefone = item.target_phone;
    user.atualizadoPor = "phone-verification-v6";
    await user.save({ validateModifiedOnly: true });
    await database.query("DELETE FROM profile_phone_verifications WHERE user_id=?", [id]);
    return res.json({ sucesso: true, mensagem: "Telefone confirmado e atualizado.", usuario: montarUsuarioSeguro(user) });
  } catch (error) {
    console.error("Erro ao confirmar telefone:", error);
    return res.status(500).json({ erro: "Não foi possível confirmar o telefone." });
  }
});

router.post("/seguranca/senha", auth, async (req, res) => {
  try {
    const current = String(req.body?.senhaAtual || "");
    const next = String(req.body?.novaSenha || "");
    if (!current || !next) return res.status(400).json({ erro: "Informe a senha atual e a nova senha." });
    const user = req.usuarioDoc;
    const check = await verifyPassword(user.senha, current);
    if (!check.valid) return res.status(401).json({ erro: "A senha atual está incorreta." });
    const policy = validatePasswordPolicy(next, { minimumLength: MIN_USER_PASSWORD_LENGTH, email: user.email, name: user.nome });
    if (!policy.valid) return res.status(400).json({ erro: policy.reason, codigo: "SENHA_FRACA" });
    user.senha = await hashPassword(next);
    user.atualizadoPor = "password-change-v6";
    await user.save({ validateModifiedOnly: true });
    await revokeAllUserSessions(userId(req), "password-change");
    return res.json({ sucesso: true, mensagem: "Senha alterada. Por segurança, entre novamente em todos os dispositivos.", relogin: true });
  } catch (error) {
    console.error("Erro ao alterar senha:", error);
    return res.status(500).json({ erro: "Não foi possível alterar a senha." });
  }
});

router.get("/perfil/relatorio.pdf", auth, async (req, res) => {
  try {
    const id = userId(req);
    const user = req.usuarioDoc;
    const study = await studyService.update(id, []);
    const studySummary = studyModel.summary(study.state);
    let examSummary = { total: 0, average: 0, best: 0, questions: 0, correct: 0 };
    if (await tableExists("student_exam_attempts")) {
      const rows = await database.query(`SELECT COUNT(*) total, COALESCE(AVG(score),0) average_score, COALESCE(MAX(score),0) best_score, COALESCE(SUM(total_questions),0) questions, COALESCE(SUM(correct_answers),0) correct_answers FROM student_exam_attempts WHERE user_id=? AND status='finished'`, [id]);
      examSummary = { total: Number(rows[0]?.total || 0), average: Number(rows[0]?.average_score || 0), best: Number(rows[0]?.best_score || 0), questions: Number(rows[0]?.questions || 0), correct: Number(rows[0]?.correct_answers || 0) };
    }
    let bankroll = null;
    if (await tableExists("student_bankroll_state")) {
      const rows = await database.query("SELECT state,updated_at FROM student_bankroll_state WHERE user_id=? LIMIT 1", [id]);
      if (rows[0]) { try { bankroll = { ...JSON.parse(rows[0].state), updatedAt: rows[0].updated_at }; } catch (_) {} }
    }
    let supportCount = 0;
    if (await tableExists("support_tickets")) {
      const rows = await database.query("SELECT COUNT(*) total FROM support_tickets WHERE usuario_id=? OR usuario_email=?", [id, user.email]);
      supportCount = Number(rows[0]?.total || 0);
    }
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: "Relatório Turma do Primo", Author: "Turma do Primo" } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const completed = new Promise((resolve, reject) => { doc.on("end", resolve); doc.on("error", reject); });
    const section = (title) => { doc.moveDown(.8).font("Helvetica-Bold").fontSize(13).fillColor("#6f32a8").text(title); doc.moveDown(.25); };
    const row = (label, value) => { doc.font("Helvetica-Bold").fontSize(9).fillColor("#3c3340").text(label, { continued: true }); doc.font("Helvetica").fillColor("#5f5564").text(`  ${String(value ?? "—")}`); };
    doc.font("Helvetica-Bold").fontSize(23).fillColor("#3d145b").text("TURMA DO PRIMO");
    doc.font("Helvetica").fontSize(11).fillColor("#75677c").text("Relatório completo do aluno");
    doc.moveDown(.4).fontSize(8).text(`Gerado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date())}`);
    section("Conta"); row("Nome", user.nome); row("E-mail", user.email); row("Telefone", Profile.maskPhone(user.telefone) || "Não informado"); row("Plano", user.plano || "free"); row("Status", user.status || "ativo"); row("Último login", user.ultimoLogin || "—");
    section("Aprendizado"); row("Módulos concluídos", `${studySummary.modulosConcluidos}/${studySummary.totalModulos}`); row("Progresso geral", `${studySummary.progressoGeral}%`); row("Etapas concluídas", studySummary.etapasConcluidas); row("Dias de foco (30 dias)", studySummary.diasFoco);
    section("Provas"); row("Provas realizadas", examSummary.total); row("Média", `${examSummary.average.toFixed(1)}%`); row("Melhor nota", `${examSummary.best.toFixed(1)}%`); row("Questões respondidas", examSummary.questions); row("Acertos", examSummary.correct);
    section("Gestão"); if (bankroll) { row("Banca inicial", `R$ ${Number(bankroll.initial || 0).toFixed(2)}`); row("Banca atual", `R$ ${Number(bankroll.current || 0).toFixed(2)}`); row("Meta diária", `R$ ${Number(bankroll.target || 0).toFixed(2)}`); row("Stop diário", `R$ ${Number(bankroll.stop || 0).toFixed(2)}`); row("Lançamentos", Array.isArray(bankroll.entries) ? bankroll.entries.length : 0); } else row("Gestão", "Ainda não configurada");
    section("Suporte e atividade"); row("Chamados de suporte", supportCount); row("Sessão atual", "Autenticada e protegida");
    doc.moveDown(1.4).font("Helvetica-Oblique").fontSize(8).fillColor("#817486").text("Este relatório reúne dados da conta, aprendizado, provas e gestão disponíveis no momento da geração.");
    doc.end();
    await completed;
    const buffer = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=relatorio-turma-do-primo-${id.slice(-6)}.pdf`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(buffer);
  } catch (error) {
    console.error("Erro ao gerar relatório do perfil:", error);
    return res.status(500).json({ erro: "Não foi possível gerar o relatório agora." });
  }
});

module.exports = router;
