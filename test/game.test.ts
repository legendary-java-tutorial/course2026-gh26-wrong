// Тесты курса: npm test проверяет игру без партии — тексты в docs/game.json и логику ответов.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseGame, hint, temperatureHint, rangeHint, shouldShowRangeHint, parseGuess, secretFor, addRecord, parseRecords, topRecords } from "../src/game.ts";

test("тексты игры: docs/game.json правильный, режимы названы в приветствии", () => {
  const game = parseGame(readFileSync(new URL("../docs/game.json", import.meta.url), "utf8"));
  const names = Object.keys(game.modes);
  assert.equal(game.attempts.replace("{count}", "7"), "Угадал за 7 попыток!");
  assert.equal(game.repeatedGuess, "Это число ты уже вводил.");
  assert.equal(game.replayPrompt, "Сыграем ещё?");
  assert.equal(game.replayYes, "Да");
  assert.equal(game.replayNo, "Нет");
  assert.equal(game.replayEnd, "До встречи!");
  assert.equal(game.recordsTitle.replace("{mode}", "quick"), "Топ-5 режима quick (попытки)");
  assert.equal(game.recordsEmpty, "Пока рекордов нет.");
  assert.equal(game.recordLine.replace("{position}", "1").replace("{attempts}", "3").replace("{date}", "сегодня"), "1. 3 — сегодня");
  assert.deepEqual(names, ["quick", "classic", "лёгкий", "трудный"]);
  assert.deepEqual([game.modes.quick.min, game.modes.quick.max], [1, 10]);
  assert.deepEqual([game.modes.classic.min, game.modes.classic.max], [1, 100]);
  assert.deepEqual([game.modes["лёгкий"].min, game.modes["лёгкий"].max], [1, 50]);
  assert.deepEqual([game.modes["трудный"].min, game.modes["трудный"].max], [1, 500]);
  if (names.length > 1) {
    for (const name of names) assert.ok(game.greeting.includes(name), `в приветствии нет режима "${name}"`);
  }
});

test("подсказка: степень близости к загаданному числу", () => {
  const game = parseGame(readFileSync(new URL("../docs/game.json", import.meta.url), "utf8"));
  const mode = game.modes["трудный"];
  assert.equal(temperatureHint(game, mode, 1, 75), game.hot);
  assert.equal(temperatureHint(game, mode, 1, 76), game.warm);
  assert.equal(temperatureHint(game, mode, 1, 302), game.freezing);
});

test("рекорды: сортировка, топ-5 по режимам и равные результаты", () => {
  const base = "2026-11-10T10:00:00.000Z";
  let records = [1, 2, 3, 4, 5, 6].map((attempts) => ({
    mode: "quick",
    attempts,
    date: new Date(Date.parse(base) + attempts * 1000).toISOString(),
  }));
  records = addRecord(records, "classic", 2, base);
  assert.deepEqual(topRecords(records, "quick").map((record) => record.attempts), [1, 2, 3, 4, 5]);
  assert.equal(topRecords(records, "classic").length, 1);
  assert.equal(topRecords(records).filter((record) => record.mode === "quick").length, 5);
  records = addRecord(records, "quick", 2, "2026-11-10T09:00:00.000Z");
  assert.equal(topRecords(records, "quick")[1].date, "2026-11-10T09:00:00.000Z");
  assert.equal(addRecord(records, "quick", 0, base).length, records.length);
});

test("рекорды: чтение повреждённых данных и отбрасывание некорректных записей", () => {
  assert.deepEqual(parseRecords("не JSON"), []);
  assert.deepEqual(parseRecords("{}"), []);
  const records = parseRecords(JSON.stringify([
    { mode: "quick", attempts: 2, date: "2026-11-10T10:00:00.000Z" },
    { mode: "quick", attempts: 0, date: "2026-11-10T10:00:00.000Z" },
    { mode: "classic", attempts: 1, date: "не дата" },
  ]));
  assert.deepEqual(records, [{ mode: "quick", attempts: 2, date: "2026-11-10T10:00:00.000Z" }]);
});

test("подсказка-диапазон: появляется после пятой ошибки", () => {
  assert.equal(shouldShowRangeHint(4), false);
  assert.equal(shouldShowRangeHint(5), true);
  assert.equal(shouldShowRangeHint(6), true);
});

test("подсказка-диапазон: границы режима заменяются догадками и сужаются", () => {
  const game = parseGame(readFileSync(new URL("../docs/game.json", import.meta.url), "utf8"));
  const mode = game.modes.classic;
  assert.equal(rangeHint(game, mode, 50, []), "Число где-то от 1 до 100.");
  assert.equal(rangeHint(game, mode, 50, [20, 80]), "Число где-то от 20 до 80.");
  assert.equal(rangeHint(game, mode, 50, [20, 30, 80, 70]), "Число где-то от 30 до 70.");
  assert.equal(rangeHint(game, mode, 50, [50]), "Число где-то от 1 до 100.");
});

test("логика игры: ответы на догадку и загаданное число", () => {
  const mode = { min: 1, max: 10, higher: "выше", lower: "ниже", win: "да" };
  assert.equal(hint(mode, 5, 3), "выше");
  assert.equal(hint(mode, 5, 8), "ниже");
  assert.equal(hint(mode, 5, 5), "да");
  assert.equal(secretFor(mode, () => 0), 1);
  assert.equal(secretFor(mode, () => 0.9999), 10);
  assert.equal(parseGuess(" 7 "), 7);
  assert.equal(parseGuess(""), null);
  assert.equal(parseGuess("2.5"), null);
});
