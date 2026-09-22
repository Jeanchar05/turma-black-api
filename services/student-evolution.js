"use strict";

const crypto = require("crypto");
const curriculum = require("../public/study-curriculum");

const TZ = "America/Sao_Paulo";
const MODULE_IDS = curriculum.modules.map((item) => item.id);
const MODULE_NAMES = new Map(curriculum.modules.map((item) => [item.id, item.name]));

const EXAM_CONFIGS = Object.freeze({
  daily: { key: "daily", title: "Prova Diária", questions: 10, minScore: 70, attempts: 3, days: [1, 2, 3, 4, 5] },
  weekly: { key: "weekly", title: "Prova Semanal", questions: 20, minScore: 75, attempts: 3, days: [6] },
  primo: { key: "primo", title: "Desafio do Primo", questions: 25, minScore: 80, attempts: 3, days: [0] },
});

const DAILY_DIFFICULTY = Object.freeze({
  1: "Fácil",
  2: "Fácil / Médio",
  3: "Médio",
  4: "Difícil",
  5: "Muito difícil",
});

const JOURNEY_LEVELS = Object.freeze([
  { key: "fundamentos", title: "Nível 01 — Fundamentos", min: 0 },
  { key: "leitura", title: "Nível 02 — Leitura", min: 15 },
  { key: "estrategias", title: "Nível 03 — Estratégias", min: 30 },
  { key: "gestao", title: "Nível 04 — Gestão", min: 50 },
  { key: "pratica", title: "Nível 05 — Prática", min: 65 },
  { key: "avancado", title: "Nível 06 — Avançado", min: 85 },
  { key: "elite", title: "Primo Elite", min: 100 },
]);

function datePartsInTimeZone(input = new Date(), timeZone = TZ) {
  const date = input instanceof Date ? input : new Date(input);
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
  const parts = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { iso: `${parts.year}-${parts.month}-${parts.day}`, year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), weekday: weekdayMap[parts.weekday] };
}

function examTypeForDate(input = new Date()) {
  const { weekday } = datePartsInTimeZone(input);
  if (weekday === 0) return "primo";
  if (weekday === 6) return "weekly";
  return "daily";
}

function examConfig(type, input = new Date()) {
  const config = EXAM_CONFIGS[type];
  if (!config) throw Object.assign(new Error("Tipo de prova inválido."), { status: 400 });
  const parts = datePartsInTimeZone(input);
  return {
    ...config,
    available: config.days.includes(parts.weekday),
    date: parts.iso,
    weekday: parts.weekday,
    difficulty: type === "daily" ? DAILY_DIFFICULTY[parts.weekday] || "Médio" : type === "weekly" ? "Alta" : "Impossível",
  };
}

function seed32(value) {
  return crypto.createHash("sha256").update(String(value)).digest().readUInt32LE(0);
}

function seededRandom(seed) {
  let state = seed32(seed) || 0x12345678;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, rand) { return list[Math.floor(rand() * list.length)]; }
function shuffle(list, rand) {
  const result = [...list];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rand() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
function uniqueSorted(values) { return [...new Set((values || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b); }
function signature(values) { return uniqueSorted(values).join(","); }

function buildChallenge(moduleId, rand, round = 0) {
  const wheel = curriculum.wheel;
  const n = pick(wheel, rand);
  let prompt = "";
  let expected = [];
  let explanation = "";

  if (moduleId === "gemeos") {
    const origin = pick([11, 22, 33], rand);
    expected = [11, 22, 33].filter((value) => value !== origin);
    prompt = `A origem é ${origin}. Quais são os outros dois Gêmeos?`;
    explanation = `A família é 11, 22 e 33. Retirando a origem ${origin}, ficam ${expected.join(" e ")}.`;
  }
  if (moduleId === "espelhos") {
    const origin = Number(pick(Object.keys(curriculum.mirrors), rand));
    expected = [curriculum.mirrors[origin]];
    prompt = `Na tabela do módulo, qual é o Espelho de ${origin}?`;
    explanation = `${origin} corresponde a ${expected[0]} na tabela de Espelhos.`;
  }
  if (moduleId === "fibonacci") {
    const other = pick(wheel, rand);
    expected = curriculum.pairResults(n, other);
    prompt = `Para o par ${n} e ${other}, quais resultados válidos vêm da soma e da diferença absoluta?`;
    explanation = `${n} + ${other} = ${n + other}${n + other > 36 ? " (descartada por passar de 36)" : ""}; diferença = ${Math.abs(n - other)}.`;
  }
  if (moduleId === "magneto") {
    expected = curriculum.magnets[n];
    prompt = `A origem é ${n}. Quais conexões estão cadastradas no Magneto?`;
    explanation = `O mapa Magneto associa ${n} a ${expected.join(", ")}.`;
  }
  if (moduleId === "camaleoes") {
    const value = 10 + Math.floor(rand() * 27);
    const a = Math.floor(value / 10);
    const b = value % 10;
    expected = curriculum.digitResults(value);
    prompt = `Separe os dígitos de ${value}. Quais são a soma e a diferença absoluta?`;
    explanation = `${a} + ${b} = ${a + b}; |${a} − ${b}| = ${Math.abs(a - b)}.`;
  }
  if (moduleId === "pitagoras") {
    const triangle = pick(curriculum.triangles, rand);
    const missingIndex = Math.floor(rand() * 3);
    const shown = triangle.points.filter((_, index) => index !== missingIndex);
    expected = [triangle.points[missingIndex]];
    prompt = `Na família ${triangle.name}, já temos ${shown.join(" e ")}. Qual integrante falta?`;
    explanation = `A família ${triangle.name} reúne ${triangle.points.join(", ")}.`;
  }
  if (moduleId === "cavalo") {
    const value = pick(wheel.filter((item) => item % 10 !== 0), rand);
    const familyIndex = curriculum.familyOf(value);
    expected = curriculum.families[familyIndex];
    prompt = `O número é ${value}. Quais são os três terminais da família dele?`;
    explanation = `${value} termina em ${value % 10} e pertence ao Cavalo ${familyIndex + 1}: ${expected.join(", ")}.`;
  }
  if (moduleId === "eclipse") {
    const variant = round % 3;
    expected = variant === 0 ? [0, 10, 20, 30] : variant === 1 ? [9, 19, 29] : [0, 9, 10, 19, 20, 29, 30];
    prompt = variant === 0 ? "Quais números formam o terminal 0 no Eclipse?" : variant === 1 ? "Quais números formam o terminal 9 no Eclipse?" : "Quais números completam a órbita dos terminais 0 e 9?";
    explanation = `Resposta do Eclipse: ${expected.join(", ")}.`;
  }
  return { moduleId, moduleName: MODULE_NAMES.get(moduleId) || moduleId, prompt, expected: uniqueSorted(expected), explanation };
}

function mutateAnswer(correct, rand) {
  const values = uniqueSorted(correct);
  const wheel = curriculum.wheel;
  if (!values.length) return [pick(wheel, rand)];
  const result = [...values];
  const position = Math.floor(rand() * result.length);
  let replacement = result[position];
  for (let attempts = 0; attempts < 25 && values.includes(replacement); attempts += 1) replacement = pick(wheel, rand);
  result[position] = replacement;
  if (rand() > 0.72 && result.length > 1) {
    const second = Math.floor(rand() * result.length);
    let next = result[second];
    for (let attempts = 0; attempts < 25 && result.includes(next); attempts += 1) next = pick(wheel, rand);
    result[second] = next;
  }
  return uniqueSorted(result);
}

function answerLabel(values) {
  const normalized = uniqueSorted(values);
  if (normalized.length === 1) return String(normalized[0]);
  return normalized.join(" · ");
}

function buildQuestion(moduleId, rand, round, index) {
  const challenge = buildChallenge(moduleId, rand, round);
  const options = new Map([[signature(challenge.expected), challenge.expected]]);
  for (let attempts = 0; options.size < 4 && attempts < 80; attempts += 1) {
    const candidate = mutateAnswer(challenge.expected, rand);
    options.set(signature(candidate), candidate);
  }
  while (options.size < 4) {
    const fallback = uniqueSorted([Math.floor(rand() * 37)]);
    options.set(signature(fallback), fallback);
  }
  const shuffled = shuffle([...options.values()].slice(0, 4), rand);
  const correctSignature = signature(challenge.expected);
  return {
    id: `q${index + 1}`,
    moduleId: challenge.moduleId,
    moduleName: challenge.moduleName,
    prompt: challenge.prompt,
    alternatives: shuffled.map((values, optionIndex) => ({ id: String(optionIndex), text: answerLabel(values), values })),
    correctOption: shuffled.findIndex((item) => signature(item) === correctSignature),
    explanation: challenge.explanation,
  };
}

function generateExam({ type, userId, date = new Date(), nonce = 1 }) {
  const config = examConfig(type, date);
  if (!config.available) throw Object.assign(new Error("Esta prova não está disponível hoje."), { status: 403 });
  const rand = seededRandom(`${type}:${userId}:${config.date}:${nonce}:${crypto.randomBytes(8).toString("hex")}`);
  const questions = [];
  const seen = new Set();
  let guard = 0;
  while (questions.length < config.questions && guard < config.questions * 40) {
    guard += 1;
    const moduleId = MODULE_IDS[(questions.length + Math.floor(rand() * MODULE_IDS.length)) % MODULE_IDS.length];
    const question = buildQuestion(moduleId, rand, questions.length + guard, questions.length);
    const key = `${question.moduleId}:${question.prompt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(question);
  }
  if (questions.length !== config.questions) throw new Error("Não foi possível montar uma prova completa.");
  const id = crypto.randomBytes(12).toString("hex");
  const payload = { version: 1, id, type, title: config.title, date: config.date, difficulty: config.difficulty, minScore: config.minScore, questions };
  return {
    id,
    payload,
    publicExam: {
      id,
      type,
      title: config.title,
      date: config.date,
      difficulty: config.difficulty,
      minScore: config.minScore,
      totalQuestions: questions.length,
      questions: questions.map((question) => ({
        id: question.id,
        moduleId: question.moduleId,
        moduleName: question.moduleName,
        prompt: question.prompt,
        alternatives: question.alternatives.map((alternative) => ({ id: alternative.id, text: alternative.text })),
      })),
    },
  };
}

function scoreExam(payload, answers = []) {
  if (!payload || !Array.isArray(payload.questions)) throw Object.assign(new Error("Prova inválida."), { status: 400 });
  const answerMap = new Map((Array.isArray(answers) ? answers : []).map((item) => [String(item?.questionId || ""), String(item?.alternativeId ?? "")]).filter(([questionId]) => questionId));
  let correct = 0;
  const review = payload.questions.map((question) => {
    const selected = answerMap.get(question.id);
    const expected = String(question.correctOption);
    const ok = selected === expected;
    if (ok) correct += 1;
    return {
      questionId: question.id,
      moduleId: question.moduleId,
      moduleName: question.moduleName,
      ok,
      selectedAlternativeId: selected ?? null,
      correctAlternativeId: expected,
      correctAnswer: question.alternatives[question.correctOption]?.text || "",
      explanation: question.explanation,
    };
  });
  const total = payload.questions.length;
  const score = total ? Math.round((correct / total) * 10000) / 100 : 0;
  const minScore = Number(payload.minScore || 70);
  return { total, correct, wrong: Math.max(0, total - correct), score, minScore, approved: score >= minScore, review };
}

function summarizeAttempts(rows = []) {
  const finished = rows.filter((row) => String(row.status || "") === "finished");
  const taken = finished.length;
  const average = taken ? Math.round((finished.reduce((sum, row) => sum + Number(row.score || 0), 0) / taken) * 100) / 100 : 0;
  const best = taken ? Math.max(...finished.map((row) => Number(row.score || 0))) : 0;
  const questions = finished.reduce((sum, row) => sum + Number(row.total_questions || row.totalQuestions || 0), 0);
  const correct = finished.reduce((sum, row) => sum + Number(row.correct_answers || row.correctAnswers || 0), 0);
  return { taken, average, best, questions, correct, accuracy: questions ? Math.round((correct / questions) * 10000) / 100 : 0 };
}

function journey({ studyProgress = 0, modulesCompleted = 0, examAverage = 0, examsTaken = 0 } = {}) {
  const study = Math.max(0, Math.min(100, Number(studyProgress) || 0));
  const exam = Math.max(0, Math.min(100, Number(examAverage) || 0));
  const combined = Math.round(study * 0.72 + (examsTaken ? exam : study) * 0.28);
  let index = 0;
  JOURNEY_LEVELS.forEach((level, levelIndex) => { if (combined >= level.min) index = levelIndex; });
  if (index === JOURNEY_LEVELS.length - 1 && (study < 100 || modulesCompleted < MODULE_IDS.length || examsTaken < 3 || exam < 80)) index -= 1;
  return {
    score: combined,
    currentIndex: index,
    current: JOURNEY_LEVELS[index],
    next: JOURNEY_LEVELS[index + 1] || null,
    levels: JOURNEY_LEVELS.map((level, levelIndex) => ({ ...level, status: levelIndex < index ? "completed" : levelIndex === index ? "current" : "locked" })),
  };
}

function sanitizeBankrollState(input = {}) {
  const toMoney = (value, max = 100000000) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(max, Math.round(number * 100) / 100)) : 0;
  };
  const entries = (Array.isArray(input.entries) ? input.entries : []).slice(-1500).map((entry, index) => {
    const delta = Math.max(-100000000, Math.min(100000000, Number(entry?.delta || 0) || 0));
    return {
      id: String(entry?.id || `${Date.now()}-${index}`).slice(0, 80),
      type: delta < 0 ? "loss" : "profit",
      amount: Math.abs(Math.round(delta * 100) / 100),
      delta: Math.round(delta * 100) / 100,
      date: String(entry?.date || new Date().toISOString()).slice(0, 40),
      note: String(entry?.note || "").slice(0, 160),
      balance: toMoney(entry?.balance),
    };
  });
  return {
    initial: toMoney(input.initial),
    current: toMoney(input.current),
    target: toMoney(input.target),
    stop: toMoney(input.stop),
    unit: Math.max(0.1, Math.min(5, Number(input.unit || 1) || 1)),
    goalDays: Math.max(1, Math.min(365, Math.round(Number(input.goalDays || 30) || 30))),
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(String(input.startDate || "")) ? String(input.startDate) : datePartsInTimeZone().iso,
    entries,
    days: [],
  };
}

module.exports = { TZ, MODULE_IDS, EXAM_CONFIGS, JOURNEY_LEVELS, datePartsInTimeZone, examTypeForDate, examConfig, seededRandom, buildChallenge, generateExam, scoreExam, summarizeAttempts, journey, sanitizeBankrollState };
