"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TurmaBankrollModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const pad = (value) => String(value).padStart(2, "0");
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const round = (value) => Math.round((num(value) + Number.EPSILON) * 100) / 100;
  const clampMoney = (value) => Math.max(0, round(value));

  function dateKey(value = new Date()) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return dateKey(new Date());
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function normalizeEntry(entry, index = 0) {
    const rawDelta = entry?.delta !== undefined
      ? num(entry.delta)
      : String(entry?.type || "").toLowerCase() === "loss"
        ? -Math.abs(num(entry?.amount))
        : Math.abs(num(entry?.amount));
    const delta = round(rawDelta);
    return {
      ...entry,
      id: String(entry?.id || `entry-${Date.now()}-${index}`),
      type: delta < 0 ? "loss" : "profit",
      amount: Math.abs(delta),
      delta,
      date: entry?.date || `${dateKey()}T12:00:00`,
      note: String(entry?.note || ""),
    };
  }

  function normalizeDay(day) {
    const result = round(day?.result);
    const initialBankroll = clampMoney(day?.initialBankroll);
    const finalBankroll = day?.finalBankroll === undefined || day?.finalBankroll === null || day?.finalBankroll === ""
      ? clampMoney(initialBankroll + result)
      : clampMoney(day.finalBankroll);
    return {
      ...day,
      date: dateKey(day?.date),
      initialBankroll,
      finalBankroll,
      entries: Math.max(0, Math.floor(num(day?.entries))),
      greens: Math.max(0, Math.floor(num(day?.greens))),
      reds: Math.max(0, Math.floor(num(day?.reds))),
      result,
      notes: String(day?.notes || ""),
    };
  }

  function normalizeState(raw = {}) {
    const state = {
      initial: clampMoney(raw.initial),
      current: clampMoney(raw.current),
      target: clampMoney(raw.target),
      stop: clampMoney(raw.stop),
      unit: Math.max(0.1, Math.min(5, num(raw.unit, 1))),
      goalDays: Math.max(1, Math.min(365, Math.round(num(raw.goalDays, 30)))),
      startDate: raw.startDate ? dateKey(raw.startDate) : dateKey(),
      entries: Array.isArray(raw.entries) ? raw.entries.map(normalizeEntry) : [],
      days: Array.isArray(raw.days) ? raw.days.map(normalizeDay) : [],
    };
    state.entries.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    state.days.sort((a, b) => a.date.localeCompare(b.date));
    const summary = summarize(state);
    state.current = summary.current;
    return state;
  }

  function dailyBuckets(raw = {}) {
    const state = {
      entries: Array.isArray(raw.entries) ? raw.entries.map(normalizeEntry) : [],
      days: Array.isArray(raw.days) ? raw.days.map(normalizeDay) : [],
    };
    const map = new Map();
    state.entries.forEach((entry) => {
      const key = dateKey(entry.date);
      const bucket = map.get(key) || { date: key, result: 0, source: "entries", entries: [] };
      bucket.result = round(bucket.result + entry.delta);
      bucket.entries.push(entry);
      map.set(key, bucket);
    });
    state.days.forEach((day) => {
      const previous = map.get(day.date);
      map.set(day.date, {
        date: day.date,
        result: round(day.result),
        source: "journal",
        entries: previous?.entries || [],
        day,
      });
    });
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  function summarize(raw = {}, today = dateKey()) {
    const initial = clampMoney(raw.initial);
    const buckets = dailyBuckets(raw);
    const accumulated = round(buckets.reduce((sum, item) => sum + item.result, 0));
    return {
      initial,
      accumulated,
      current: clampMoney(initial + accumulated),
      today: round(buckets.find((item) => item.date === today)?.result || 0),
      buckets,
    };
  }

  function series(raw = {}) {
    const summary = summarize(raw);
    let balance = summary.initial;
    const points = [{ date: raw.startDate ? dateKey(raw.startDate) : "inicio", value: balance }];
    summary.buckets.forEach((bucket) => {
      balance = clampMoney(balance + bucket.result);
      points.push({ date: bucket.date, value: balance, result: bucket.result });
    });
    return points;
  }

  function addEntry(raw, payload = {}) {
    const state = normalizeState(raw);
    const type = payload.type === "loss" ? "loss" : "profit";
    const amount = Math.abs(round(payload.amount));
    if (!amount) return state;
    const key = dateKey(payload.date || new Date());
    const delta = type === "loss" ? -amount : amount;
    state.entries.push(normalizeEntry({
      id: payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      amount,
      delta,
      date: `${key}T12:00:00`,
      note: payload.note || "",
    }, state.entries.length));
    const journal = state.days.find((day) => day.date === key);
    if (journal) {
      journal.result = round(journal.result + delta);
      journal.finalBankroll = clampMoney(journal.initialBankroll + journal.result);
      journal.updatedAt = Date.now();
    }
    const normalized = normalizeState(state);
    normalized.current = summarize(normalized).current;
    return normalized;
  }

  function upsertDay(raw, payload = {}) {
    const state = normalizeState(raw);
    const day = normalizeDay(payload);
    const index = state.days.findIndex((item) => item.date === day.date);
    if (index >= 0) state.days[index] = day;
    else state.days.push(day);
    state.days.sort((a, b) => a.date.localeCompare(b.date));
    const normalized = normalizeState(state);
    normalized.current = summarize(normalized).current;
    return normalized;
  }

  function removeDay(raw, date) {
    const state = normalizeState(raw);
    const key = dateKey(date);
    state.days = state.days.filter((item) => item.date !== key);
    const normalized = normalizeState(state);
    normalized.current = summarize(normalized).current;
    return normalized;
  }

  return { dateKey, normalizeState, dailyBuckets, summarize, series, addEntry, upsertDay, removeDay };
});
