const el = (id) => document.getElementById(id);

const digitsRange = el('digitsRange');
const digitsValue = el('digitsValue');
const attemptsRange = el('attemptsRange');
const attemptsValue = el('attemptsValue');
const timeRange = el('timeRange');
const timeValueLabel = el('timeValueLabel');
const startBtn = el('startBtn');

const attemptCounter = el('attemptCounter');
const timerDisplay = el('timerDisplay');
const timerBarWrap = el('timerBarWrap');
const timerBar = el('timerBar');
const digitsEl = el('digits');
const crackBtn = el('crackBtn');
const deleteBtn = el('deleteBtn');
const resultMessage = el('resultMessage');
const historyEl = el('history');

const statPlays = el('statPlays');
const statClears = el('statClears');
const statRate = el('statRate');

const STORAGE_KEY = 'codeCrackStats';
const stats = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"plays":0,"clears":0}');

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

function renderStats() {
    statPlays.textContent = stats.plays;
    statClears.textContent = stats.clears;
    statRate.textContent = stats.plays ? Math.round((stats.clears / stats.plays) * 100) + '%' : '-';
}

function saveResult(won) {
    stats.plays++;
    if (won) stats.clears++;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
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

function shakeDigits() {
    digitsEl.classList.add('shake');
    setTimeout(() => digitsEl.classList.remove('shake'), 300);
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
        setTimeout(() => endGame(true), 800);
        return;
    }

    addToHistory(currentInput.slice(), results);

    if (attempts >= maxAttempts) {
        setTimeout(() => endGame(false), 1000);
        return;
    }

    setTimeout(() => {
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

    digitCount = Number(digitsRange.value);
    maxAttempts = Number(attemptsRange.value);
    timeLimitMs = Number(timeRange.value);

    active = true;
    locked = false;
    attempts = 0;
    currentInput = [];
    correctPin = Array.from({ length: digitCount }, () => Math.floor(Math.random() * 10));

    startBtn.disabled = true;
    resultMessage.textContent = '';
    resultMessage.className = 'result-message';
    historyEl.innerHTML = '';
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
    active = false;
    locked = true;
    clearInterval(timerInterval);
    timerInterval = null;
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

renderStats();
renderDigits();
