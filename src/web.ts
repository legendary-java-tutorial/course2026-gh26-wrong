// Игра в браузере: та же сборка в docs/ и тот же docs/game.json; страница — docs/index.html (GitHub Pages).
import { parseGame, hint, temperatureHint, rangeHint, shouldShowRangeHint, parseGuess, secretFor, addRecord, parseRecords, topRecords, type Game, type Mode } from "./game.js";

const $ = (id: string) => document.getElementById(id)!;
const input = $("guess") as HTMLInputElement;
let game: Game;
try {
  game = parseGame(await (await fetch("./game.json")).text());
} catch (e) {
  $("answer").textContent = `Ошибка: ${(e as Error).message}`;
  throw e;
}
$("greeting").textContent = game.greeting;
$("theme").textContent = `тема: ${game.theme}`;
$("choose").hidden = false;

let mode: Mode;
let modeName = "";
let secret = 0;
let tries = 0;
let guesses = new Set<number>();
const recordsKey = "guess-number-records";

function loadRecords() {
  try {
    return parseRecords(localStorage.getItem(recordsKey) ?? "[]");
  } catch {
    return [];
  }
}

let records = loadRecords();

function saveRecords() {
  try {
    localStorage.setItem(recordsKey, JSON.stringify(records));
  } catch {
    // Игра продолжается и без доступного хранилища браузера.
  }
}

function renderRecords() {
  $("records").hidden = false;
  $("records-title").textContent = game.recordsTitle.replace("{mode}", modeName);
  const list = $("records-list");
  list.replaceChildren();
  const best = topRecords(records, modeName);
  if (best.length === 0) {
    const item = document.createElement("li");
    item.textContent = game.recordsEmpty;
    list.append(item);
    return;
  }
  best.forEach((record, index) => {
    const item = document.createElement("li");
    item.textContent = game.recordLine
      .replace("{position}", String(index + 1))
      .replace("{attempts}", String(record.attempts))
      .replace("{date}", new Date(record.date).toLocaleString("ru-RU"));
    list.append(item);
  });
}

function start(name: string) {
  modeName = name;
  mode = game.modes[name];
  secret = secretFor(mode);
  tries = 0;
  guesses = new Set<number>();
  $("range").textContent = `Режим ${name}: число от ${mode.min} до ${mode.max}.`;
  $("answer").textContent = "";
  $("replay").hidden = true;
  $("play").hidden = false;
  input.disabled = false;
  input.value = "";
  input.focus();
  renderRecords();
}

$("replay-prompt").textContent = game.replayPrompt;
$("replay-yes").textContent = game.replayYes;
$("replay-no").textContent = game.replayNo;
$("replay-yes").onclick = () => start(modeName);
$("replay-no").onclick = () => {
  $("answer").textContent += ` ${game.replayEnd}`;
  $("replay").hidden = true;
};

for (const name of Object.keys(game.modes)) {
  const b = document.createElement("button");
  b.textContent = name;
  b.onclick = () => start(name);
  $("modes").append(b);
}

$("play").onsubmit = (e) => {
  e.preventDefault();
  const guess = parseGuess(input.value);
  input.value = "";
  if (guess === null || guess < mode.min || guess > mode.max) {
    $("answer").textContent = `Нужно целое число от ${mode.min} до ${mode.max}.`;
    return;
  }
  tries++;
  if (guess === secret) {
    $("answer").textContent = game.attempts.replace("{count}", String(tries));
    records = addRecord(records, modeName, tries);
    saveRecords();
    renderRecords();
    input.disabled = true;
    $("replay").hidden = false;
    return;
  }
  const repeatedHint = guesses.has(guess) ? `${game.repeatedGuess} ` : "";
  const answer = `${repeatedHint}${hint(mode, secret, guess)} ${temperatureHint(game, mode, secret, guess)}`;
  guesses.add(guess);
  $("answer").textContent = shouldShowRangeHint(tries) ? `${answer} ${rangeHint(game, mode, secret, guesses)}` : answer;
  input.focus();
};
