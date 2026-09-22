"use strict";

const express = require("express");
const crypto = require("crypto");
const database = require("../config/database");
const { auth, requirePremium } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const studyState = require("../services/study-state");
const StudyModel = require("../public/study-state-model");
const Evolution = require("../services/student-evolution");

const router = express.Router();
let structurePromise = null;

function userId(req) { return String(req.usuario?.id || req.usuario?._id || req.usuarioDoc?._id || ""); }
function userName(req) { return String(req.usuario?.nome || req.usuarioDoc?.nome || "Aluno"); }
function userEmail(req) { return String(req.usuario?.email || req.usuarioDoc?.email || ""); }

async function ensureStructure() {
  if (!structurePromise) {
    structurePromise = (async () => {
      await database.query(`
        CREATE TABLE IF NOT EXISTS student_bankroll_state (
          user_id CHAR(24) NOT NULL PRIMARY KEY,
          state LONGTEXT NOT NULL,
          revision INT NOT NULL DEFAULT 1,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_student_bankroll_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await database.query(`
        CREATE TABLE IF NOT EXISTS student_exam_attempts (
          id CHAR(24) NOT NULL PRIMARY KEY,
          user_id CHAR(24) NOT NULL,
          user_name VARCHAR(160) NOT NULL DEFAULT '',
          user_email VARCHAR(190) NOT NULL DEFAULT '',
          exam_type VARCHAR(24) NOT NULL,
          exam_title VARCHAR(120) NOT NULL,
          exam_date DATE NOT NULL,
          difficulty VARCHAR(60) NOT NULL DEFAULT '',
          min_score DECIMAL(6,2) NOT NULL DEFAULT 70,
          status VARCHAR(24) NOT NULL DEFAULT 'started',
          payload LONGTEXT NOT NULL,
          answers LONGTEXT NULL,
          score DECIMAL(6,2) NOT NULL DEFAULT 0,
          correct_answers INT NOT NULL DEFAULT 0,
          total_questions INT NOT NULL DEFAULT 0,
          started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          finished_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_student_exam_user_date (user_id, exam_date),
          KEY idx_student_exam_type_date (exam_type, exam_date),
          KEY idx_student_exam_status (status),
          CONSTRAINT fk_student_exam_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await database.query(`
        CREATE TABLE IF NOT EXISTS student_activity (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          user_id CHAR(24) NOT NULL,
          type VARCHAR(48) NOT NULL,
          title VARCHAR(190) NOT NULL,
          metadata LONGTEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_student_activity_user (user_id, created_at),
          CONSTRAINT fk_student_activity_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })().catch((error) => { structurePromise = null; throw error; });
  }
  return structurePromise;
}

async function logActivity(id, type, title, metadata = {}) {
  await ensureStructure();
  await database.query(
    "INSERT INTO student_activity (user_id, type, title, metadata) VALUES (?, ?, ?, ?)",
    [id, type, String(title || "").slice(0, 190), JSON.stringify(metadata || {})],
  );
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function serializeAttempt(row) {
  return {
    id: row.id,
    type: row.exam_type,
    title: row.exam_title,
    date: row.exam_date,
    difficulty: row.difficulty,
    minScore: Number(row.min_score || 70),
    status: row.status,
    score: Number(row.score || 0),
    correct: Number(row.correct_answers || 0),
    total: Number(row.total_questions || 0),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

async function listAttempts(id, limit = 60) {
  await ensureStructure();
  return database.query(
    `SELECT id, exam_type, exam_title, exam_date, difficulty, min_score, status,
            score, correct_answers, total_questions, started_at, finished_at
       FROM student_exam_attempts
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ${Math.min(Math.max(Number(limit) || 60, 1), 250)}`,
    [id],
  );
}

async function homePayload(id) {
  const study = await studyState.update(id, []);
  const studySummary = StudyModel.summary(study.state);
  const attempts = await listAttempts(id, 250);
  const examSummary = Evolution.summarizeAttempts(attempts);
  const journey = Evolution.journey({
    studyProgress: studySummary.progressoGeral,
    modulesCompleted: studySummary.modulosConcluidos,
    examAverage: examSummary.average,
    examsTaken: examSummary.taken,
  });
  const todayType = Evolution.examTypeForDate();
  const today = Evolution.examConfig(todayType);
  const todayAttempts = attempts.filter((item) => item.exam_type === todayType && String(item.exam_date) === today.date).length;
  return {
    study: studySummary,
    exams: examSummary,
    journey,
    today: { ...today, attemptsUsed: todayAttempts, attemptsRemaining: Math.max(0, today.attempts - todayAttempts) },
  };
}

router.use("/student", auth, requirePremium);

router.get("/student/evolution/home", async (req, res) => {
  try {
    return res.json({ success: true, ...(await homePayload(userId(req))) });
  } catch (error) {
    console.error("Erro ao carregar evolução do aluno:", error);
    return res.status(503).json({ error: "Não foi possível carregar sua evolução agora." });
  }
});

router.get("/student/gestao", async (req, res) => {
  try {
    await ensureStructure();
    const id = userId(req);
    const rows = await database.query("SELECT state, revision, updated_at FROM student_bankroll_state WHERE user_id = ? LIMIT 1", [id]);
    if (!rows.length) return res.json({ success: true, exists: false, revision: 0, state: null });
    return res.json({
      success: true,
      exists: true,
      revision: Number(rows[0].revision || 1),
      updatedAt: rows[0].updated_at,
      state: Evolution.sanitizeBankrollState(parseJson(rows[0].state, {})),
    });
  } catch (error) {
    console.error("Erro ao carregar gestão:", error);
    return res.status(503).json({ error: "Não foi possível carregar sua gestão agora." });
  }
});

router.put("/student/gestao", async (req, res) => {
  try {
    await ensureStructure();
    const id = userId(req);
    const next = Evolution.sanitizeBankrollState(req.body?.state || {});
    const requestedRevision = Number(req.body?.revision || 0);
    const rows = await database.query("SELECT revision FROM student_bankroll_state WHERE user_id = ? LIMIT 1", [id]);
    if (rows.length && requestedRevision && requestedRevision !== Number(rows[0].revision)) {
      const current = await database.query("SELECT state, revision, updated_at FROM student_bankroll_state WHERE user_id = ? LIMIT 1", [id]);
      return res.status(409).json({
        error: "Sua gestão mudou em outro dispositivo.",
        code: "BANKROLL_REVISION_CONFLICT",
        revision: Number(current[0].revision || 1),
        state: Evolution.sanitizeBankrollState(parseJson(current[0].state, {})),
        updatedAt: current[0].updated_at,
      });
    }
    if (!rows.length) {
      await database.query("INSERT INTO student_bankroll_state (user_id, state, revision) VALUES (?, ?, 1)", [id, JSON.stringify(next)]);
      await logActivity(id, "bankroll", "Gestão da banca configurada", { current: next.current, entries: next.entries.length });
      return res.json({ success: true, revision: 1, state: next });
    }
    const revision = Number(rows[0].revision || 1) + 1;
    await database.query("UPDATE student_bankroll_state SET state = ?, revision = ? WHERE user_id = ?", [JSON.stringify(next), revision, id]);
    return res.json({ success: true, revision, state: next });
  } catch (error) {
    console.error("Erro ao salvar gestão:", error);
    return res.status(503).json({ error: "Não foi possível sincronizar sua gestão agora." });
  }
});

router.get("/student/provas/agenda", async (req, res) => {
  try {
    const attempts = await listAttempts(userId(req), 250);
    const summary = Evolution.summarizeAttempts(attempts);
    const currentType = Evolution.examTypeForDate();
    const cards = ["daily", "weekly", "primo"].map((type) => {
      const config = Evolution.examConfig(type);
      const used = attempts.filter((item) => item.exam_type === type && String(item.exam_date) === config.date).length;
      return {
        type,
        title: config.title,
        available: config.available,
        date: config.date,
        weekday: config.weekday,
        difficulty: config.difficulty,
        questions: config.questions,
        minScore: config.minScore,
        attempts: config.attempts,
        attemptsUsed: used,
        attemptsRemaining: Math.max(0, config.attempts - used),
        current: type === currentType,
      };
    });
    return res.json({ success: true, currentType, summary, cards, history: attempts.slice(0, 15).map(serializeAttempt) });
  } catch (error) {
    console.error("Erro ao carregar agenda de provas:", error);
    return res.status(503).json({ error: "Não foi possível carregar as provas agora." });
  }
});

router.post("/student/provas/iniciar", async (req, res) => {
  try {
    await ensureStructure();
    const id = userId(req);
    const type = String(req.body?.type || "").trim().toLowerCase();
    const config = Evolution.examConfig(type);
    if (!config.available) return res.status(403).json({ error: "Esta prova não está disponível hoje." });
    const countRows = await database.query(
      "SELECT COUNT(*) AS total FROM student_exam_attempts WHERE user_id = ? AND exam_type = ? AND exam_date = ?",
      [id, type, config.date],
    );
    const used = Number(countRows[0]?.total || 0);
    if (used >= config.attempts) {
      return res.status(403).json({ error: "Você atingiu o limite de tentativas desta prova hoje.", attemptsUsed: used, attempts: config.attempts });
    }
    const exam = Evolution.generateExam({ type, userId: id, date: new Date(), nonce: used + 1 });
    await database.query(
      `INSERT INTO student_exam_attempts (
        id, user_id, user_name, user_email, exam_type, exam_title, exam_date,
        difficulty, min_score, status, payload, total_questions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'started', ?, ?)`,
      [exam.id, id, userName(req), userEmail(req), type, config.title, config.date, config.difficulty, config.minScore, JSON.stringify(exam.payload), exam.publicExam.totalQuestions],
    );
    await logActivity(id, "exam_started", `${config.title} iniciada`, { attemptId: exam.id, type, questions: exam.publicExam.totalQuestions });
    return res.status(201).json({ success: true, exam: exam.publicExam, attemptsUsed: used + 1, attemptsRemaining: Math.max(0, config.attempts - used - 1) });
  } catch (error) {
    const status = Number(error.status || 0);
    if (status) return res.status(status).json({ error: error.message });
    console.error("Erro ao iniciar prova:", error);
    return res.status(503).json({ error: "Não foi possível iniciar a prova agora." });
  }
});

router.post("/student/provas/finalizar", async (req, res) => {
  try {
    await ensureStructure();
    const id = userId(req);
    const attemptId = String(req.body?.attemptId || "").trim();
    if (!/^[a-f0-9]{24}$/i.test(attemptId)) return res.status(400).json({ error: "Tentativa inválida." });
    const rows = await database.query("SELECT * FROM student_exam_attempts WHERE id = ? AND user_id = ? LIMIT 1", [attemptId, id]);
    if (!rows.length) return res.status(404).json({ error: "Tentativa não encontrada." });
    const attempt = rows[0];
    if (attempt.status === "finished") return res.status(409).json({ error: "Esta prova já foi finalizada." });
    const result = Evolution.scoreExam(parseJson(attempt.payload, null), Array.isArray(req.body?.answers) ? req.body.answers : []);
    await database.query(
      "UPDATE student_exam_attempts SET status = 'finished', answers = ?, score = ?, correct_answers = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
      [JSON.stringify(req.body?.answers || []), result.score, result.correct, attemptId, id],
    );
    await logActivity(id, "exam_finished", `${attempt.exam_title} finalizada`, { attemptId, type: attempt.exam_type, score: result.score, correct: result.correct, total: result.total, approved: result.approved });
    return res.json({ success: true, result: { attemptId, title: attempt.exam_title, type: attempt.exam_type, difficulty: attempt.difficulty, ...result }, evolution: await homePayload(id) });
  } catch (error) {
    const status = Number(error.status || 0);
    if (status) return res.status(status).json({ error: error.message });
    console.error("Erro ao finalizar prova:", error);
    return res.status(503).json({ error: "Não foi possível finalizar a prova agora." });
  }
});

router.get("/student/provas/historico", async (req, res) => {
  try {
    const rows = await listAttempts(userId(req), req.query?.limit || 60);
    return res.json({ success: true, attempts: rows.map(serializeAttempt), summary: Evolution.summarizeAttempts(rows) });
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
    return res.status(503).json({ error: "Não foi possível carregar o histórico agora." });
  }
});

router.get("/student/atividades", async (req, res) => {
  try {
    await ensureStructure();
    const rows = await database.query(
      "SELECT type, title, metadata, created_at FROM student_activity WHERE user_id = ? ORDER BY created_at DESC LIMIT 80",
      [userId(req)],
    );
    return res.json({ success: true, activities: rows.map((row) => ({ type: row.type, title: row.title, metadata: parseJson(row.metadata, {}), createdAt: row.created_at })) });
  } catch (error) {
    console.error("Erro ao carregar atividades:", error);
    return res.status(503).json({ error: "Não foi possível carregar suas atividades agora." });
  }
});

router.get("/admin/evolution/overview", auth, requirePermission("provas"), async (req, res) => {
  try {
    await ensureStructure();
    const examRows = await database.query(`
      SELECT COUNT(*) AS attempts,
             SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS finished,
             ROUND(AVG(CASE WHEN status = 'finished' THEN score ELSE NULL END), 2) AS average_score,
             COUNT(DISTINCT user_id) AS students
        FROM student_exam_attempts
    `);
    const bankRows = await database.query("SELECT COUNT(*) AS configured, MAX(updated_at) AS last_update FROM student_bankroll_state");
    const today = Evolution.datePartsInTimeZone().iso;
    const todayRows = await database.query("SELECT exam_type, COUNT(*) AS total FROM student_exam_attempts WHERE exam_date = ? GROUP BY exam_type", [today]);
    return res.json({
      success: true,
      exams: {
        attempts: Number(examRows[0]?.attempts || 0),
        finished: Number(examRows[0]?.finished || 0),
        averageScore: Number(examRows[0]?.average_score || 0),
        students: Number(examRows[0]?.students || 0),
      },
      management: { configured: Number(bankRows[0]?.configured || 0), lastUpdate: bankRows[0]?.last_update || null },
      today: Object.fromEntries(todayRows.map((row) => [row.exam_type, Number(row.total || 0)])),
    });
  } catch (error) {
    console.error("Erro no overview acadêmico:", error);
    return res.status(503).json({ error: "Não foi possível carregar o overview acadêmico." });
  }
});

router.get("/admin/evolution/exams", auth, requirePermission("provas"), async (req, res) => {
  try {
    await ensureStructure();
    const limit = Math.min(Math.max(Number(req.query?.limit || 150), 1), 300);
    const rows = await database.query(
      `SELECT id, user_name, user_email, exam_type, exam_title, exam_date, difficulty,
              score, correct_answers, total_questions, status, started_at, finished_at
         FROM student_exam_attempts
        ORDER BY created_at DESC
        LIMIT ${limit}`,
    );
    return res.json({
      success: true,
      attempts: rows.map((row) => ({
        id: row.id,
        userName: row.user_name,
        userEmail: row.user_email,
        type: row.exam_type,
        title: row.exam_title,
        date: row.exam_date,
        difficulty: row.difficulty,
        score: Number(row.score || 0),
        correct: Number(row.correct_answers || 0),
        total: Number(row.total_questions || 0),
        status: row.status,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
      })),
    });
  } catch (error) {
    console.error("Erro ao listar provas acadêmicas:", error);
    return res.status(503).json({ error: "Não foi possível listar as provas agora." });
  }
});

router.get("/student/evolution/ping", (req, res) => {
  res.json({ success: true, release: "turma-evolution-v6", requestId: crypto.randomBytes(4).toString("hex") });
});

module.exports = router;
