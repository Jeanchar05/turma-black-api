"use strict";

function patch(target) {
  if (!target || typeof target.journey !== "function" || target.__eliteV6Patched) return target;
  const original = target.journey.bind(target);
  target.journey = function journeyEliteV6(input = {}) {
    const result = original(input);
    const studyProgress = Math.max(0, Math.min(100, Number(input.studyProgress) || 0));
    const modulesCompleted = Math.max(0, Number(input.modulesCompleted) || 0);
    const examAverage = Math.max(0, Math.min(100, Number(input.examAverage) || 0));
    const examsTaken = Math.max(0, Number(input.examsTaken) || 0);
    const eligible = studyProgress >= 100 && modulesCompleted >= 8 && examsTaken >= 3 && examAverage >= 80;
    if (!eligible) return result;
    const levels = (result.levels || []).map((level, index, all) => ({
      ...level,
      status: index < all.length - 1 ? "completed" : "current",
    }));
    return {
      ...result,
      currentIndex: Math.max(0, levels.length - 1),
      current: levels[levels.length - 1] || result.current,
      next: null,
      levels,
    };
  };
  Object.defineProperty(target, "__eliteV6Patched", { value: true, enumerable: false });
  return target;
}

module.exports = { patch };
