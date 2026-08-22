import {
	automaticProgress,
	clampPercentage,
	durationInMilliseconds,
	manualProgress,
	nextCompletionAction,
	pauseMultiplier,
} from '../utils/updateSimulator';

type Settings = {
	style: string;
	start: number;
	mode: 'automatic' | 'manual';
	duration: number;
	loop: boolean;
	restart: boolean;
	screenSaver: boolean;
	primaryMessage: string;
	secondaryMessage: string;
};

const form = document.querySelector<HTMLFormElement>('#simulator-form');
const simulation = document.querySelector<HTMLElement>('#simulation');
const content = document.querySelector<HTMLElement>('#simulation-content');
const title = document.querySelector<HTMLElement>('#simulation-title');
const description = document.querySelector<HTMLElement>('#simulation-description');
const progressOutput = document.querySelector<HTMLElement>('#simulation-progress');
const restartNote = document.querySelector<HTMLElement>('#restart-note');
const manualHelp = document.querySelector<HTMLElement>('#manual-help');
const fullscreenStatus = document.querySelector<HTMLElement>('#fullscreen-status');
const configurationStatus = document.querySelector<HTMLElement>('#configuration-status');
const durationSelect = document.querySelector<HTMLSelectElement>('#duration');
const durationFields = document.querySelector<HTMLElement>('#duration-fields');
const customDurationField = document.querySelector<HTMLElement>('#custom-duration-field');

let settings: Settings | null = null;
let progress = 0;
let cycleStartedAt = 0;
let timer: number | undefined;
let cursorTimer: number | undefined;
let shiftTimer: number | undefined;
let active = false;
let fullscreenRequested = false;
let restarting = false;
let restartedOnce = false;

function readSettings(): Settings {
	const data = new FormData(form ?? undefined);
	const primary = String(data.get('primaryMessage') ?? '').trim() || 'Working on updates';
	const secondary = String(data.get('secondaryMessage') ?? '').trim() || 'Please keep your computer on.';
	return {
		style: String(data.get('style') ?? '11'),
		start: clampPercentage(Number(data.get('start'))),
		mode: data.get('mode') === 'manual' ? 'manual' : 'automatic',
		duration: durationInMilliseconds(String(data.get('duration') ?? '60'), Number(data.get('customDuration'))),
		loop: data.get('loop') === 'on',
		restart: data.get('restart') === 'on',
		screenSaver: data.get('screenSaver') === 'on',
		primaryMessage: primary,
		secondaryMessage: secondary,
	};
}

function render() {
	if (!settings) return;
	if (title) title.textContent = settings.primaryMessage;
	if (description) description.textContent = settings.secondaryMessage;
	if (progressOutput) progressOutput.textContent = settings.style === '11' ? `You are ${progress}% there.` : `${progress}% complete`;
	manualHelp?.classList.toggle('hidden', settings.mode !== 'manual');
	restartNote?.classList.toggle('hidden', !settings.restart);
}

function clearTimers() {
	window.clearTimeout(timer);
	window.clearTimeout(cursorTimer);
	window.clearInterval(shiftTimer);
	timer = undefined;
	cursorTimer = undefined;
	shiftTimer = undefined;
}

function scheduleCursorHide() {
	if (!settings?.screenSaver || !simulation) return;
	window.clearTimeout(cursorTimer);
	simulation.classList.remove('cursor-hidden');
	cursorTimer = window.setTimeout(() => simulation.classList.add('cursor-hidden'), 3000);
}

function beginScreenSaver() {
	if (!settings?.screenSaver || !content) return;
	scheduleCursorHide();
	let position = 0;
	const offsets = ['translate(-50%, -50%)', 'translate(-49%, -51%)', 'translate(-51%, -49%)', 'translate(-50%, -50%)'];
	shiftTimer = window.setInterval(() => {
		position = (position + 1) % offsets.length;
		content.style.transform = offsets[position];
	}, 120_000);
}

function scheduleAutomaticTick() {
	if (!active || !settings || settings.mode !== 'automatic' || restarting) return;
	const elapsed = performance.now() - cycleStartedAt;
	progress = automaticProgress(progress, elapsed, settings.duration, settings.start);
	render();
	if (progress >= 100) {
		void handleCompletion();
		return;
	}
	const delay = (350 + Math.random() * 650) * pauseMultiplier(progress);
	timer = window.setTimeout(scheduleAutomaticTick, delay);
}

function restartCycle() {
	if (!settings) return;
	progress = settings.start;
	cycleStartedAt = performance.now();
	restarting = false;
	simulation?.classList.remove('restart-black');
	render();
	scheduleAutomaticTick();
}

async function handleCompletion() {
	if (!active || !settings || restarting) return;
	const action = nextCompletionAction({ loop: settings.loop, restart: settings.restart, restartedOnce });
	if (action === 'complete') return;
	restarting = true;
	if (action === 'loop') {
		timer = window.setTimeout(restartCycle, 1000);
		return;
	}
	restartedOnce = true;
	await new Promise<void>((resolve) => { timer = window.setTimeout(resolve, 900); });
	if (!active) return;
	simulation?.classList.add('restart-black');
	if (title) title.textContent = 'Restarting';
	if (progressOutput) progressOutput.textContent = '';
	if (description) description.textContent = 'This is still only a visual simulation.';
	await new Promise<void>((resolve) => { timer = window.setTimeout(resolve, 1400); });
	if (active) restartCycle();
}

async function stopSimulation(message = 'Simulation paused. You can adjust the settings and start again.') {
	if (!active) return;
	active = false;
	clearTimers();
	simulation?.classList.add('hidden');
	simulation?.classList.remove('cursor-hidden', 'restart-black');
	if (content) content.style.transform = '';
	if (document.fullscreenElement) {
		try { await document.exitFullscreen(); } catch { /* Browser controls remain available. */ }
	}
	if (configurationStatus) configurationStatus.textContent = message;
	form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
}

async function startSimulation() {
	if (!simulation) return;
	settings = readSettings();
	progress = settings.start;
	restartedOnce = false;
	restarting = false;
	active = true;
	fullscreenRequested = false;
	simulation.dataset.style = settings.style;
	simulation.classList.remove('hidden', 'restart-black');
	fullscreenStatus?.classList.add('hidden');
	if (configurationStatus) configurationStatus.textContent = '';
	render();
	beginScreenSaver();

	try {
		fullscreenRequested = true;
		await simulation.requestFullscreen();
	} catch {
		fullscreenRequested = false;
		fullscreenStatus?.classList.remove('hidden');
	}

	cycleStartedAt = performance.now();
	if (settings.mode === 'automatic') scheduleAutomaticTick();
}

form?.addEventListener('submit', (event) => {
	event.preventDefault();
	void startSimulation();
});

durationSelect?.addEventListener('change', () => customDurationField?.classList.toggle('hidden', durationSelect.value !== 'custom'));
form?.addEventListener('change', () => {
	const manual = new FormData(form).get('mode') === 'manual';
	durationFields?.classList.toggle('opacity-50', manual);
	durationFields?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach((control) => { control.disabled = manual; });
});
simulation?.addEventListener('mousemove', scheduleCursorHide);
simulation?.addEventListener('pointerdown', scheduleCursorHide);

document.addEventListener('keydown', (event) => {
	if (!active || !settings) return;
	if (event.key === 'Escape') {
		if (!document.fullscreenElement) void stopSimulation();
		return;
	}
	if (settings.mode !== 'manual' || restarting) return;
	if (event.key === 'ArrowRight' || event.key === ' ') {
		event.preventDefault();
		progress = manualProgress(progress, 1);
		render();
		if (progress === 100) void handleCompletion();
	} else if (event.key === 'ArrowLeft') {
		event.preventDefault();
		progress = manualProgress(progress, -1);
		render();
	}
});

document.addEventListener('fullscreenchange', () => {
	if (active && fullscreenRequested && !document.fullscreenElement) void stopSimulation('Fullscreen exited. The simulation is paused.');
});
