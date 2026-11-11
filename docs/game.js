// Логика игры «Угадай число»: тексты и режимы — из docs/game.json, код их не хранит.
// Текст docs/game.json → игра; ошибка — понятная, по-русски, с названием файла.
export function parseGame(text) {
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new Error("docs/game.json не читается: проверьте запятые между строками, кавычки и скобки");
    }
    return checkGame(data);
}
export function checkGame(data) {
    const g = data;
    if (!g || typeof g !== "object")
        throw new Error("docs/game.json: ожидается объект в фигурных скобках");
    for (const key of ["theme", "greeting", "attempts", "hot", "warm", "cool", "freezing", "rangeHint", "repeatedGuess", "replayPrompt", "replayYes", "replayNo", "replayEnd", "recordsTitle", "recordsEmpty", "recordLine"]) {
        if (typeof g[key] !== "string" || g[key].trim() === "")
            throw new Error(`docs/game.json: пустое или пропущенное поле "${key}"`);
    }
    if (!g.cli || typeof g.cli !== "object")
        throw new Error('docs/game.json: нет настроек интерфейса в "cli"');
    for (const [key, value] of Object.entries(g.cli)) {
        if (typeof value !== "string" || value.trim() === "")
            throw new Error(`docs/game.json: пустое или пропущенное поле "cli.${key}"`);
    }
    if (!g.modes || typeof g.modes !== "object" || Object.keys(g.modes).length === 0) {
        throw new Error('docs/game.json: нет ни одного режима в "modes"');
    }
    for (const [name, m] of Object.entries(g.modes)) {
        if (!m || typeof m !== "object")
            throw new Error(`docs/game.json: режим "${name}" должен быть в фигурных скобках`);
        if (!Number.isInteger(m.min) || !Number.isInteger(m.max) || m.min >= m.max) {
            throw new Error(`docs/game.json: в режиме "${name}" min и max — целые числа, min меньше max`);
        }
        for (const key of ["higher", "lower", "win"]) {
            if (typeof m[key] !== "string" || m[key].trim() === "") {
                throw new Error(`docs/game.json: в режиме "${name}" пустое или пропущенное сообщение "${key}"`);
            }
        }
    }
    return g;
}
function isGameRecord(item) {
    if (!item || typeof item !== "object")
        return false;
    const record = item;
    return typeof record.mode === "string" && record.mode !== "" &&
        typeof record.attempts === "number" && Number.isInteger(record.attempts) && record.attempts > 0 &&
        typeof record.date === "string" && Number.isFinite(Date.parse(record.date));
}
// Сохраняет корректные результаты и оставляет топ-5 для каждого режима.
export function parseRecords(text) {
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        return [];
    }
    if (!Array.isArray(data))
        return [];
    const records = data.filter(isGameRecord);
    return topRecords(records);
}
export function addRecord(records, mode, attempts, date = new Date().toISOString()) {
    if (!mode || !Number.isInteger(attempts) || attempts < 1 || !Number.isFinite(Date.parse(date)))
        return topRecords(records);
    return topRecords([...records, { mode, attempts, date }]);
}
export function topRecords(records, mode) {
    const sorted = records
        .filter((record) => !mode || record.mode === mode)
        .slice()
        .sort((a, b) => a.attempts - b.attempts || Date.parse(a.date) - Date.parse(b.date) || a.mode.localeCompare(b.mode));
    if (mode)
        return sorted.slice(0, 5);
    const counts = new Map();
    return sorted.filter((record) => {
        const count = counts.get(record.mode) ?? 0;
        if (count >= 5)
            return false;
        counts.set(record.mode, count + 1);
        return true;
    });
}
// Ответ на догадку: больше, меньше или угадал.
export function hint(mode, secret, guess) {
    if (guess < secret)
        return mode.higher;
    if (guess > secret)
        return mode.lower;
    return mode.win;
}
// Оценка близости догадки к загаданному числу относительно диапазона режима.
export function temperatureHint(game, mode, secret, guess) {
    const distance = Math.abs(secret - guess);
    const range = mode.max - mode.min;
    if (distance <= range * 0.15)
        return game.hot;
    if (distance <= range * 0.3)
        return game.warm;
    if (distance <= range * 0.6)
        return game.cool;
    return game.freezing;
}
// Подсказка появляется после пяти неверных попыток.
export function shouldShowRangeHint(failedAttempts) {
    return failedAttempts >= 5;
}
// Диапазон по истории догадок; неизвестную границу заменяет граница режима.
export function rangeHint(game, mode, secret, guesses) {
    let lower = mode.min;
    let upper = mode.max;
    for (const guess of guesses) {
        if (guess < secret && guess > lower)
            lower = guess;
        if (guess > secret && guess < upper)
            upper = guess;
    }
    return game.rangeHint.replace("{min}", String(lower)).replace("{max}", String(upper));
}
// Загаданное число режима: целое от min до max включительно.
export function secretFor(mode, random = Math.random) {
    return Math.min(mode.max, mode.min + Math.floor(random() * (mode.max - mode.min + 1)));
}
// Догадка из строки ввода: целое число или null.
export function parseGuess(text) {
    const t = text.trim();
    if (!/^-?\d+$/.test(t))
        return null;
    return Number(t);
}
