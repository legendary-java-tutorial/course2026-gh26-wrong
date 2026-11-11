// Игра в терминале: npm start собирает её в docs/ и запускает отсюда.
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { parseGame, hint, temperatureHint, rangeHint, shouldShowRangeHint, parseGuess, secretFor, addRecord, parseRecords, topRecords } from "./game.js";
let game;
try {
    game = parseGame(readFileSync(new URL("./game.json", import.meta.url), "utf8"));
}
catch (e) {
    console.error(e.message);
    process.exit(1);
}
const recordsFile = new URL("./records.json", import.meta.url);
let records;
try {
    records = parseRecords(readFileSync(recordsFile, "utf8"));
}
catch {
    records = [];
}
function saveRecords() {
    try {
        writeFileSync(recordsFile, `${JSON.stringify(records, null, 2)}\n`, "utf8");
    }
    catch {
        console.error(game.cli.saveError);
    }
}
function printRecords(modeName) {
    console.log(game.recordsTitle.replace("{mode}", modeName));
    const best = topRecords(records, modeName);
    if (best.length === 0) {
        console.log(game.recordsEmpty);
        return;
    }
    best.forEach((record, index) => {
        console.log(game.recordLine
            .replace("{position}", String(index + 1))
            .replace("{attempts}", String(record.attempts))
            .replace("{date}", new Date(record.date).toLocaleString("ru-RU")));
    });
}
const rl = createInterface({ input: stdin, output: stdout });
rl.on("close", () => {
    console.log(`\n${game.cli.exitMessage}`);
    process.exit(0);
});
const names = Object.keys(game.modes);
const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
const themeLine = fill(game.cli.themeLine, { theme: game.theme });
const menuLines = names.map((modeName, index) => {
    const { min, max } = game.modes[modeName];
    return `${index + 1}. ${modeName} — ${min}–${max}`;
});
const contentWidth = Math.max(...[game.greeting, themeLine, ...menuLines].map((line) => [...line].length));
const border = `+${"-".repeat(contentWidth + 2)}+`;
console.log(border);
console.log(`| ${game.greeting.padEnd(contentWidth)} |`);
console.log(`| ${themeLine.padEnd(contentWidth)} |`);
console.log(`|${"-".repeat(contentWidth + 2)}|`);
for (const line of menuLines)
    console.log(`| ${line.padEnd(contentWidth)} |`);
console.log(border);
let name = names[0];
if (names.length > 1) {
    const answer = (await rl.question(fill(game.cli.modePrompt, { modes: names.join(" / ") }))).trim();
    const selectedIndex = Number(answer) - 1;
    name = names.includes(answer) ? answer : names[selectedIndex] ?? names[0];
}
const mode = game.modes[name];
console.log(`\n${fill(game.cli.modeLine, { mode: name, min: mode.min, max: mode.max })}`);
printRecords(name);
let replay = true;
while (replay) {
    const secret = secretFor(mode);
    const guesses = new Set();
    for (let tries = 1;;) {
        const guess = parseGuess(await rl.question(game.cli.guessPrompt));
        if (guess === null || guess < mode.min || guess > mode.max) {
            console.log(fill(game.cli.invalidGuess, { min: mode.min, max: mode.max }));
            continue;
        }
        if (guess === secret) {
            console.log(game.attempts.replace("{count}", String(tries)));
            records = addRecord(records, name, tries);
            saveRecords();
            printRecords(name);
            break;
        }
        if (guesses.has(guess))
            console.log(game.repeatedGuess);
        console.log(fill(game.cli.hintLine, { hint: hint(mode, secret, guess) }));
        console.log(fill(game.cli.temperatureLine, { hint: temperatureHint(game, mode, secret, guess) }));
        guesses.add(guess);
        if (shouldShowRangeHint(tries))
            console.log(rangeHint(game, mode, secret, guesses));
        tries++;
    }
    replay = (await rl.question(fill(game.cli.replayLine, { prompt: game.replayPrompt, yes: game.replayYes, no: game.replayNo }))).trim().toLocaleLowerCase() === game.replayYes.toLocaleLowerCase();
}
console.log(game.replayEnd);
rl.removeAllListeners("close");
rl.close();
