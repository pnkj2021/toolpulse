export function calculateWpm(typedCharacters: number, elapsedMilliseconds: number): number {
	if (typedCharacters <= 0 || elapsedMilliseconds <= 0) return 0;
	// Standard typing convention: five typed characters equal one word.
	return Math.max(0, Math.round((typedCharacters / 5) / (elapsedMilliseconds / 60_000)));
}

export function calculateAccuracy(correctCharacters: number, totalTypedCharacters: number): number {
	if (totalTypedCharacters <= 0) return 100;
	return Math.min(100, Math.max(0, Math.round((correctCharacters / totalTypedCharacters) * 100)));
}

export function countCorrectCharacters(typed: string, target: string): number {
	let correct = 0;
	for (let index = 0; index < typed.length; index++) if (typed[index] === target[index]) correct++;
	return correct;
}

export function countFinalIncorrectCharacters(typed: string, target: string): number {
	return Math.max(0, typed.length - countCorrectCharacters(typed, target));
}

export function countNewMistakes(previous: string, next: string, target: string): number {
	let mistakes = 0;
	for (let index = 0; index < next.length; index++) {
		if (next[index] !== previous[index] && next[index] !== target[index]) mistakes++;
	}
	return mistakes;
}

export function remainingSeconds(durationSeconds: number, startedAt: number | null, now: number): number {
	if (startedAt === null) return durationSeconds;
	return Math.max(0, Math.ceil(durationSeconds - (now - startedAt) / 1000));
}

export function shouldStartTimer(startedAt: number | null, typedLength: number): boolean {
	return startedAt === null && typedLength > 0;
}

export function isChallengeComplete(typedLength: number, targetLength: number, secondsRemaining: number): boolean {
	return secondsRemaining <= 0 || (targetLength > 0 && typedLength >= targetLength);
}

export function isPersonalBest(score: number, previousBest: number): boolean {
	return score > Math.max(0, previousBest);
}

export function selectSample<T>(samples: readonly T[], random = Math.random()): T {
	if (!samples.length) throw new Error('At least one typing sample is required.');
	const bounded = Math.min(0.999999, Math.max(0, random));
	return samples[Math.floor(bounded * samples.length)];
}

export function clampPercentage(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizePersonalBests(value: unknown, validModes: readonly string[], validDifficulties: readonly string[]): Record<string, number> {
	if (!value || typeof value !== 'object') return {};
	return Object.fromEntries(Object.entries(value).filter(([key, score]) => {
		const [mode, difficulty] = key.split(':');
		return validModes.includes(mode) && (!difficulty || validDifficulties.includes(difficulty)) && typeof score === 'number' && Number.isFinite(score) && score >= 0;
	}));
}
