"use strict";

const assert = require("node:assert/strict");
const Evolution = require("../services/student-evolution");
require("../services/journey-elite-v6").patch(Evolution);

function utcDate(iso) {
  return new Date(`${iso}T15:00:00Z`);
}

function testSchedule() {
  const monday = Evolution.examConfig("daily", utcDate("2026-09-21"));
  assert.equal(monday.available, true);
  assert.equal(monday.questions, 10);
  assert.equal(monday.difficulty, "Fácil");

  const tuesday = Evolution.examConfig("daily", utcDate("2026-09-22"));
  assert.equal(tuesday.available, true);
  assert.equal(tuesday.questions, 10);
  assert.equal(tuesday.difficulty, "Fácil / Médio");

  const saturday = Evolution.examConfig("weekly", utcDate("2026-09-26"));
  assert.equal(saturday.available, true);
  assert.equal(saturday.questions, 20);
  assert.equal(saturday.difficulty, "Alta");
  assert.equal(Evolution.examConfig("daily", utcDate("2026-09-26")).available, false);

  const sunday = Evolution.examConfig("primo", utcDate("2026-09-27"));
  assert.equal(sunday.available, true);
  assert.equal(sunday.questions, 25);
  assert.equal(sunday.difficulty, "Impossível");
}

function testGeneratedExamDoesNotLeakAnswers() {
  const generated = Evolution.generateExam({
    type: "primo",
    userId: "0123456789abcdef01234567",
    date: utcDate("2026-09-27"),
    nonce: 1,
  });

  assert.equal(generated.publicExam.totalQuestions, 25);
  assert.equal(generated.publicExam.questions.length, 25);
  assert.equal(new Set(generated.publicExam.questions.map((question) => `${question.moduleId}:${question.prompt}`)).size, 25);

  const serialized = JSON.stringify(generated.publicExam);
  assert.equal(serialized.includes("correctOption"), false);
  assert.equal(serialized.includes("correctAlternativeId"), false);
  assert.equal(serialized.includes("explanation"), false);
  assert.equal(serialized.includes("expected"), false);

  generated.publicExam.questions.forEach((question) => {
    assert.equal(question.alternatives.length, 4);
    assert.equal(new Set(question.alternatives.map((item) => item.text)).size, 4);
  });
}

function testServerSideScoring() {
  const generated = Evolution.generateExam({
    type: "daily",
    userId: "0123456789abcdef01234567",
    date: utcDate("2026-09-21"),
    nonce: 2,
  });
  const answers = generated.payload.questions.map((question) => ({
    questionId: question.id,
    alternativeId: String(question.correctOption),
  }));
  const perfect = Evolution.scoreExam(generated.payload, answers);
  assert.equal(perfect.score, 100);
  assert.equal(perfect.correct, 10);
  assert.equal(perfect.approved, true);
  assert.equal(perfect.review.length, 10);

  const empty = Evolution.scoreExam(generated.payload, []);
  assert.equal(empty.score, 0);
  assert.equal(empty.correct, 0);
  assert.equal(empty.approved, false);
}

function testJourneyRules() {
  const advanced = Evolution.journey({
    studyProgress: 100,
    modulesCompleted: 8,
    examAverage: 79,
    examsTaken: 8,
  });
  assert.notEqual(advanced.current.key, "elite");

  const elite = Evolution.journey({
    studyProgress: 100,
    modulesCompleted: 8,
    examAverage: 90,
    examsTaken: 3,
  });
  assert.equal(elite.current.key, "elite");
  assert.equal(elite.score, 97);
}

function testBankrollSanitization() {
  const entries = Array.from({ length: 1600 }, (_, index) => ({
    id: `item-${index}`,
    delta: index % 2 ? -12.345 : 20.999,
    note: "x".repeat(300),
  }));
  const state = Evolution.sanitizeBankrollState({
    initial: -100,
    current: 250.129,
    target: -4,
    stop: 30,
    unit: 99,
    goalDays: 999,
    startDate: "2026-09-21",
    entries,
  });
  assert.equal(state.initial, 0);
  assert.equal(state.current, 250.13);
  assert.equal(state.target, 0);
  assert.equal(state.unit, 5);
  assert.equal(state.goalDays, 365);
  assert.equal(state.entries.length, 1500);
  assert.equal(state.entries[0].note.length, 160);
}

for (const test of [
  testSchedule,
  testGeneratedExamDoesNotLeakAnswers,
  testServerSideScoring,
  testJourneyRules,
  testBankrollSanitization,
]) test();

console.log("Evolution V6 regression: OK");
