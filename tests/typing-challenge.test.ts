import assert from 'node:assert/strict';
import test from 'node:test';
import {
	calculateAccuracy, calculateWpm, clampPercentage, countFinalIncorrectCharacters,
	countNewMistakes, isChallengeComplete, isPersonalBest, remainingSeconds,
	selectSample, shouldStartTimer,
} from '../src/utils/typingChallenge.ts';

test('calculates WPM using five typed characters per word', () => {
	assert.equal(calculateWpm(250, 60_000), 50);
	assert.equal(calculateWpm(125, 30_000), 50);
});

test('calculates accuracy and handles zero typed characters', () => {
	assert.equal(calculateAccuracy(48, 50), 96);
	assert.equal(calculateAccuracy(0, 0), 100);
});

test('tracks newly made mistakes without removing corrected mistakes', () => {
	assert.equal(countNewMistakes('', 'cat', 'car'), 1);
	assert.equal(countNewMistakes('cat', 'car', 'car'), 0);
	assert.equal(countFinalIncorrectCharacters('cat', 'car'), 1);
});

test('timer remains idle until the first character and counts down afterward', () => {
	assert.equal(shouldStartTimer(null, 0), false);
	assert.equal(shouldStartTimer(null, 1), true);
	assert.equal(remainingSeconds(30, null, 5_000), 30);
	assert.equal(remainingSeconds(30, 1_000, 31_000), 0);
});

test('challenge completes at zero time or at the end of the sample', () => {
	assert.equal(isChallengeComplete(5, 10, 0), true);
	assert.equal(isChallengeComplete(10, 10, 8), true);
	assert.equal(isChallengeComplete(4, 10, 8), false);
});

test('compares personal bests strictly', () => {
	assert.equal(isPersonalBest(81, 80), true);
	assert.equal(isPersonalBest(80, 80), false);
});

test('selects deterministic samples and keeps percentages bounded', () => {
	assert.equal(selectSample(['a', 'b', 'c'], 0), 'a');
	assert.equal(selectSample(['a', 'b', 'c'], 0.999), 'c');
	assert.equal(clampPercentage(-2), 0);
	assert.equal(clampPercentage(104), 100);
});
