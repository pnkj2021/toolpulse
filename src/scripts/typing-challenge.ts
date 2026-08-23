import { typingModeLabels, typingModes, typingSamples, type TypingMode } from '../data/typingSamples';
import { generateUniqueChallenge, typingDifficulties, type TypingDifficulty } from '../utils/typingGenerators';
import {
	calculateAccuracy, calculateWpm, countCorrectCharacters, countFinalIncorrectCharacters,
	countNewMistakes, isChallengeComplete, isPersonalBest, remainingSeconds, selectSample,
	shouldStartTimer, normalizePersonalBests,
} from '../utils/typingChallenge';

const STORAGE_KEY = 'ybs-typing-best-v1';
const SHARE_URL = 'https://ybstools.com/tools/typing-challenge/';
const targetElement = document.querySelector<HTMLElement>('#target-text');
const input = document.querySelector<HTMLTextAreaElement>('#typing-input');
const resultsPanel = document.querySelector<HTMLElement>('#results-panel');
const status = document.querySelector<HTMLElement>('#game-status');
const challengeLabel = document.querySelector<HTMLElement>('#challenge-label');
const personalBestElement = document.querySelector<HTMLElement>('#personal-best');
const bestMessage = document.querySelector<HTMLElement>('#best-message');
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-mode]')];
const durationButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-duration]')];
const difficultyButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-difficulty]')];
const timerTrack = document.querySelector<HTMLElement>('#timer-track');
const timerProgress = document.querySelector<HTMLElement>('#timer-progress');

const live = {
	wpm: document.querySelector<HTMLElement>('#wpm-value'), accuracy: document.querySelector<HTMLElement>('#accuracy-value'),
	time: document.querySelector<HTMLElement>('#time-value'), mistakes: document.querySelector<HTMLElement>('#mistakes-value'),
	streak: document.querySelector<HTMLElement>('#streak-value'),
};
const result = {
	wpm: document.querySelector<HTMLElement>('#result-wpm'), accuracy: document.querySelector<HTMLElement>('#result-accuracy'),
	mistakes: document.querySelector<HTMLElement>('#result-mistakes'), incorrect: document.querySelector<HTMLElement>('#result-incorrect'),
	characters: document.querySelector<HTMLElement>('#result-characters'), mode: document.querySelector<HTMLElement>('#result-mode'),
	difficulty: document.querySelector<HTMLElement>('#result-difficulty'),
};

let mode: TypingMode = 'words';
let durationSeconds = 30;
let difficulty: TypingDifficulty = 'medium';
let target = '';
const challengeHistory: string[] = [];
let previousTyped = '';
let startedAt: number | null = null;
let endedAt: number | null = null;
let mistakes = 0;
let streak = 0;
let timer: number | undefined;
let complete = false;

function loadBests(): Record<string, number> {
	try {
		const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		return normalizePersonalBests(value, typingModes, typingDifficulties);
	} catch { return {}; }
}

function saveBests(bests: Record<string, number>) {
	try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bests)); } catch { /* Scores remain available for this attempt. */ }
}

function updateBestLabel() {
	const bests = loadBests();
	const best = bests[`${mode}:${difficulty}`] ?? bests[mode];
	if (personalBestElement) personalBestElement.textContent = best ? `${difficulty[0].toUpperCase() + difficulty.slice(1)} best: ${best} WPM` : 'Personal best: —';
}

function displayCharacter(character: string): string {
	if (character === ' ') return '\u00a0';
	if (character === '\t') return '  ';
	return character;
}

function renderTarget(typed: string) {
	if (!targetElement) return;
	const fragment = document.createDocumentFragment();
	for (let index = 0; index < target.length; index++) {
		const span = document.createElement('span');
		const expected = target[index];
		span.textContent = displayCharacter(expected);
		if (index < typed.length) {
			if (typed[index] === expected) span.className = 'typing-correct';
			else {
				span.className = 'typing-incorrect';
				span.title = `Incorrect character; expected ${expected === ' ' ? 'space' : expected === '\n' ? 'line break' : expected}`;
			}
		} else if (index === typed.length) span.className = 'typing-current';
		fragment.append(span);
	}
	targetElement.replaceChildren(fragment);
	const current = targetElement.children[Math.min(typed.length, target.length - 1)] as HTMLElement | undefined;
	current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function metrics(now = performance.now()) {
	const typed = input?.value ?? '';
	const correct = countCorrectCharacters(typed, target);
	const elapsed = startedAt === null ? 0 : Math.max(1, (endedAt ?? now) - startedAt);
	return {
		typed, correct, elapsed,
		wpm: calculateWpm(typed.length, elapsed),
		accuracy: calculateAccuracy(correct, typed.length),
		remaining: remainingSeconds(durationSeconds, startedAt, endedAt ?? now),
		incorrect: countFinalIncorrectCharacters(typed, target),
	};
}

function renderStats(now = performance.now()) {
	const value = metrics(now);
	if (live.wpm) live.wpm.textContent = String(value.wpm);
	if (live.accuracy) live.accuracy.textContent = `${value.accuracy}%`;
	if (live.time) {
		const minutes = Math.floor(value.remaining / 60);
		const seconds = value.remaining % 60;
		live.time.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
		live.time.setAttribute('aria-label', `${value.remaining} seconds remaining`);
		live.time.classList.toggle('typing-timer-urgent', startedAt !== null && value.remaining <= 10 && value.remaining > 0);
		const percentage = durationSeconds > 0 ? (value.remaining / durationSeconds) * 100 : 0;
		if (timerProgress) {
			timerProgress.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
			timerProgress.classList.toggle('timer-progress-urgent', startedAt !== null && value.remaining <= 10 && value.remaining > 0);
		}
		timerTrack?.setAttribute('aria-valuemax', String(durationSeconds));
		timerTrack?.setAttribute('aria-valuenow', String(value.remaining));
	}
	if (live.mistakes) live.mistakes.textContent = String(mistakes);
	if (live.streak) live.streak.textContent = streak >= 10 ? `🔥 ${streak}` : String(streak);
	return value;
}

function stopTimer() { window.clearInterval(timer); timer = undefined; }

function finishChallenge(now = performance.now()) {
	if (complete) return;
	complete = true;
	endedAt = now;
	stopTimer();
	if (input) input.disabled = true;
	const value = renderStats(now);
	if (result.wpm) result.wpm.textContent = String(value.wpm);
	if (result.accuracy) result.accuracy.textContent = `${value.accuracy}%`;
	if (result.mistakes) result.mistakes.textContent = String(mistakes);
	if (result.incorrect) result.incorrect.textContent = String(value.incorrect);
	if (result.characters) result.characters.textContent = String(value.typed.length);
	if (result.mode) result.mode.textContent = typingModeLabels[mode];
	if (result.difficulty) result.difficulty.textContent = difficulty[0].toUpperCase() + difficulty.slice(1);

	const bests = loadBests();
	const bestKey = `${mode}:${difficulty}`;
	const previousBest = bests[bestKey] ?? bests[mode] ?? 0;
	if (isPersonalBest(value.wpm, previousBest)) {
		bests[bestKey] = value.wpm;
		saveBests(bests);
		if (bestMessage) bestMessage.textContent = `🔥 New ${typingModeLabels[mode]} ${difficulty} best: ${value.wpm} WPM`;
	} else if (bestMessage) bestMessage.textContent = previousBest ? `Personal best: ${previousBest} WPM` : '';
	updateBestLabel();
	resultsPanel?.classList.remove('hidden');
	resultsPanel?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
	if (status) status.textContent = `Challenge complete. ${value.wpm} words per minute with ${value.accuracy}% accuracy and ${mistakes} mistakes.`;
}

function tick() {
	const value = renderStats();
	if (isChallengeComplete(value.typed.length, target.length, value.remaining)) finishChallenge();
}

function resetAttempt(newSample: boolean) {
	stopTimer();
	if (newSample || !target) {
		try {
			target = generateUniqueChallenge(mode, difficulty, challengeHistory, { duration: durationSeconds as 15 | 30 | 60 }).text;
		} catch {
			target = selectSample(typingSamples[mode]);
		}
	}
	previousTyped = '';
	startedAt = null;
	endedAt = null;
	mistakes = 0;
	streak = 0;
	complete = false;
	if (input) { input.disabled = false; input.value = ''; input.maxLength = target.length; }
	if (challengeLabel) challengeLabel.textContent = `${typingModeLabels[mode]} · ${difficulty[0].toUpperCase() + difficulty.slice(1)}`;
	resultsPanel?.classList.add('hidden');
	renderTarget('');
	renderStats();
	updateBestLabel();
	window.requestAnimationFrame(() => input?.focus());
}

input?.addEventListener('keydown', (event) => {
	if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
		event.preventDefault();
		const start = input.selectionStart;
		input.setRangeText('  ', start, input.selectionEnd, 'end');
		input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '  ' }));
	}
});

input?.addEventListener('input', () => {
	if (complete) return;
	const typed = input.value.slice(0, target.length);
	if (input.value !== typed) input.value = typed;
	const newMistakes = countNewMistakes(previousTyped, typed, target);
	mistakes += newMistakes;
	if (typed.length > previousTyped.length) {
		const lastIndex = typed.length - 1;
		streak = typed[lastIndex] === target[lastIndex] ? streak + 1 : 0;
	} else if (typed.length < previousTyped.length) streak = Math.min(streak, typed.length);
	previousTyped = typed;
	if (shouldStartTimer(startedAt, typed.length)) {
		startedAt = performance.now();
		timer = window.setInterval(tick, 200);
		if (status) status.textContent = 'Challenge started.';
	}
	renderTarget(typed);
	const value = renderStats();
	if (isChallengeComplete(typed.length, target.length, value.remaining)) finishChallenge();
});

modeButtons.forEach((button) => button.addEventListener('click', () => {
	mode = button.dataset.mode as TypingMode;
	modeButtons.forEach((item) => { const active = item === button; item.classList.toggle('mode-button-active', active); item.setAttribute('aria-pressed', String(active)); });
	resetAttempt(true);
}));
durationButtons.forEach((button) => button.addEventListener('click', () => {
	durationSeconds = Number(button.dataset.duration ?? 30);
	durationButtons.forEach((item) => { const active = item === button; item.classList.toggle('timer-button-active', active); item.setAttribute('aria-pressed', String(active)); });
	resetAttempt(true);
}));
difficultyButtons.forEach((button) => button.addEventListener('click', () => {
	difficulty = button.dataset.difficulty as TypingDifficulty;
	difficultyButtons.forEach((item) => { const active = item === button; item.classList.toggle('difficulty-button-active', active); item.setAttribute('aria-pressed', String(active)); });
	resetAttempt(true);
}));

document.querySelector('#restart-button')?.addEventListener('click', () => resetAttempt(false));
document.querySelector('#new-challenge-button')?.addEventListener('click', () => resetAttempt(true));
document.querySelector('#try-again-button')?.addEventListener('click', () => resetAttempt(false));
document.querySelector('#result-new-button')?.addEventListener('click', () => resetAttempt(true));
document.querySelector('#reset-scores-button')?.addEventListener('click', () => {
	try { localStorage.removeItem(STORAGE_KEY); } catch { /* No saved scores to remove. */ }
	updateBestLabel();
	if (status) status.textContent = 'Personal best scores reset.';
});

document.querySelector('#copy-result-button')?.addEventListener('click', async () => {
	const value = metrics();
	const label = difficulty[0].toUpperCase() + difficulty.slice(1);
	const text = `I scored ${value.wpm} WPM with ${value.accuracy}% accuracy on the YBS ${typingModeLabels[mode]} Typing Challenge (${label}).\n\nCan you beat it?\n\n${SHARE_URL}`;
	try { await navigator.clipboard.writeText(text); }
	catch {
		const temporary = document.createElement('textarea');
		temporary.value = text;
		temporary.style.position = 'fixed';
		temporary.style.opacity = '0';
		document.body.append(temporary);
		temporary.select();
		document.execCommand('copy');
		temporary.remove();
	}
	if (status) status.textContent = 'Result copied to clipboard.';
});

resetAttempt(true);
