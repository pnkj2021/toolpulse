export const presetDurations = {
	'30': 30_000,
	'60': 60_000,
	'180': 180_000,
	'300': 300_000,
	'600': 600_000,
} as const;

export function clampPercentage(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(99, Math.max(0, Math.round(value)));
}

export function durationInMilliseconds(preset: string, customMinutes: number): number {
	if (preset in presetDurations) return presetDurations[preset as keyof typeof presetDurations];
	const minutes = Number.isFinite(customMinutes) ? Math.min(60, Math.max(0.1, customMinutes)) : 1;
	return Math.round(minutes * 60_000);
}

export function manualProgress(current: number, direction: 1 | -1): number {
	return Math.min(100, Math.max(0, current + direction));
}

export function automaticProgress(current: number, elapsed: number, duration: number, start: number, random = Math.random()): number {
	if (elapsed >= duration) return 100;
	const expected = start + (Math.max(0, elapsed) / Math.max(1, duration)) * (100 - start);
	const jump = 1 + Math.floor(Math.min(0.999999, Math.max(0, random)) * 3);
	return Math.min(99, Math.max(current, Math.min(current + jump, Math.ceil(expected + 1))));
}

export function pauseMultiplier(progress: number): number {
	return [30, 60, 90].some((point) => Math.abs(progress - point) <= 2) ? 1.8 : 1;
}

export function nextCompletionAction(options: { loop: boolean; restart: boolean; restartedOnce: boolean }): 'complete' | 'loop' | 'restart' {
	if (options.restart && (!options.restartedOnce || options.loop)) return 'restart';
	if (options.loop) return 'loop';
	return 'complete';
}
