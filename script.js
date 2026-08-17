const el = (id) => document.getElementById(id);

const digitsRange = el('digitsRange');
const digitsValue = el('digitsValue');
const attemptsRange = el('attemptsRange');
const attemptsValue = el('attemptsValue');
const timeRange = el('timeRange');
const timeValueLabel = el('timeValueLabel');
const noDuplicateCheck = el('noDuplicateCheck');
const startBtn = el('startBtn');

const attemptCounter = el('attemptCounter');
const timerDisplay = el('timerDisplay');
const timerBarWrap = el('timerBarWrap');
const timerBar = el('timerBar');
const digitsEl = el('digits');
const numpadEl = el('numpad');
const crackBtn = el('crackBtn');
const deleteBtn = el('deleteBtn');
const resultMessage = el('resultMessage');
const historyEl = el('history');

const statPlays = el('statPlays');
const statClears = el('statClears');
const statRate = el('statRate');

const STORAGE_KEY = 'codeCrackStats';

function loadStats() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!raw || typeof raw !== 'object') throw new Error('invalid');
        const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
        return { plays: num(raw.plays), clears: num(raw.clears) };
    } catch {
        return { plays: 0, clears: 0 };
    }
}

const stats = loadStats();

let active = false;
let digitCount = 4;
let maxAttempts = 6;
let timeLimitMs = 60000;
let correctPin = [];
let currentInput = [];
let attempts = 0;
let deadline = 0;
let timerInterval = null;
let locked = false;
let pendingTimer = null;

function renderStats() {
    statPlays.textContent = stats.plays;
    statClears.textContent = stats.clears;
    statRate.textContent = stats.plays ? Math.round((stats.clears / stats.plays) * 100) + '%' : '-';
}

function saveResult(won) {
    stats.plays++;
    if (won) stats.clears++;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch {
        // storage unavailable/full - continue with in-memory stats only
    }
    renderStats();
}

digitsRange.addEventListener('input', () => { digitsValue.textContent = digitsRange.value; });
attemptsRange.addEventListener('input', () => { attemptsValue.textContent = attemptsRange.value; });
timeRange.addEventListener('input', () => { timeValueLabel.textContent = (timeRange.value / 1000).toFixed(1); });

function renderDigits() {
    digitsEl.innerHTML = '';
    for (let i = 0; i < digitCount; i++) {
        const box = document.createElement('div');
        box.className = 'digit';
        if (currentInput[i] !== undefined) box.textContent = currentInput[i];
        digitsEl.appendChild(box);
    }
}

function addDigit(num) {
    if (!active || locked) return;
    if (currentInput.length >= digitCount) return;
    currentInput.push(num);
    renderDigits();
}

function deleteDigit() {
    if (!active || locked) return;
    currentInput.pop();
    renderDigits();
}

function buildNumpad() {
    for (let n = 0; n <= 9; n++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'numpad-btn';
        btn.textContent = String(n);
        btn.addEventListener('click', () => addDigit(n));
        numpadEl.appendChild(btn);
    }
}

function shakeDigits() {
    digitsEl.classList.add('shake');
    setTimeout(() => digitsEl.classList.remove('shake'), 300);
}

function generatePin(count, noDuplicate) {
    if (!noDuplicate) {
        return Array.from({ length: count }, () => Math.floor(Math.random() * 10));
    }
    const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}

function evaluateGuess(guess, pin) {
    const results = new Array(guess.length);
    const pinCopy = pin.slice();
    const guessCopy = guess.slice();

    for (let i = 0; i < guess.length; i++) {
        if (guessCopy[i] === pinCopy[i]) {
            results[i] = 'correct';
            pinCopy[i] = null;
            guessCopy[i] = null;
        }
    }
    for (let i = 0; i < guess.length; i++) {
        if (guessCopy[i] === null) continue;
        const foundIndex = pinCopy.indexOf(guessCopy[i]);
        if (foundIndex !== -1) {
            results[i] = 'wrong-position';
            pinCopy[foundIndex] = null;
        } else {
            results[i] = 'not-in-pin';
        }
    }
    return results;
}

function showResultsOnDigits(results) {
    [...digitsEl.children].forEach((box, i) => {
        box.classList.remove('correct', 'wrong-position', 'not-in-pin');
        box.classList.add(results[i]);
    });
}

function addToHistory(guess, results) {
    const empty = historyEl.querySelector('.history-empty');
    if (empty) empty.remove();

    const entry = document.createElement('div');
    entry.className = 'history-entry';
    guess.forEach((d, i) => {
        const span = document.createElement('span');
        span.className = 'history-digit ' + results[i];
        span.textContent = d;
        entry.appendChild(span);
    });
    historyEl.prepend(entry);
}

function crack() {
    if (!active || locked) return;
    if (performance.now() >= deadline) {
        endGame(false);
        return;
    }
    if (currentInput.length !== digitCount) {
        shakeDigits();
        return;
    }

    locked = true;
    attempts++;
    attemptCounter.textContent = `${attempts} / ${maxAttempts}`;

    const results = evaluateGuess(currentInput, correctPin);
    const allCorrect = results.every((r) => r === 'correct');
    showResultsOnDigits(results);

    if (allCorrect) {
        endGame(true);
        return;
    }

    addToHistory(currentInput.slice(), results);

    if (attempts >= maxAttempts) {
        endGame(false);
        return;
    }

    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
        pendingTimer = null;
        if (!active) return;
        currentInput = [];
        renderDigits();
        locked = false;
    }, 800);
}

function updateTimer() {
    const remaining = deadline - performance.now();
    const pct = Math.max(0, (remaining / timeLimitMs) * 100);
    timerBar.style.width = pct + '%';
    timerBar.classList.toggle('danger', pct <= 20);
    timerDisplay.textContent = Math.max(0, remaining / 1000).toFixed(1) + 's';

    if (remaining <= 0) {
        clearInterval(timerInterval);
        endGame(false);
    }
}

function startGame() {
    if (active) return;
    clearTimeout(pendingTimer);
    pendingTimer = null;

    digitCount = Number(digitsRange.value);
    maxAttempts = Number(attemptsRange.value);
    timeLimitMs = Number(timeRange.value);

    active = true;
    locked = false;
    attempts = 0;
    currentInput = [];
    correctPin = generatePin(digitCount, noDuplicateCheck.checked);

    startBtn.disabled = true;
    resultMessage.textContent = '';
    resultMessage.className = 'result-message';
    historyEl.innerHTML = '<div class="history-empty">まだ記録がありません</div>';
    attemptCounter.textContent = `0 / ${maxAttempts}`;
    renderDigits();

    deadline = performance.now() + timeLimitMs;
    timerBarWrap.classList.add('active');
    timerBar.style.width = '100%';
    timerBar.classList.remove('danger');
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 50);
    updateTimer();
}

function endGame(success) {
    if (!active) return;
    active = false;
    locked = true;
    clearInterval(timerInterval);
    timerInterval = null;
    clearTimeout(pendingTimer);
    pendingTimer = null;
    timerBarWrap.classList.remove('active');

    resultMessage.textContent = success
        ? `CODE CRACKED (${attempts}回)`
        : `LOCKOUT - PIN: ${correctPin.join('')}`;
    resultMessage.className = 'result-message ' + (success ? 'success' : 'fail');

    saveResult(success);
    startBtn.disabled = false;
}

crackBtn.addEventListener('click', crack);
deleteBtn.addEventListener('click', deleteDigit);
startBtn.addEventListener('click', startGame);

document.addEventListener('keydown', (e) => {
    if (!active) return;
    if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        addDigit(Number(e.key));
    } else if (e.key === 'Backspace') {
        e.preventDefault();
        deleteDigit();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        crack();
    }
});

buildNumpad();
renderStats();
renderDigits();
