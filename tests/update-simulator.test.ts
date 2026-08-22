import assert from 'node:assert/strict';
import test from 'node:test';
import {
	automaticProgress,
	clampPercentage,
	durationInMilliseconds,
	manualProgress,
	nextCompletionAction,
	pauseMultiplier,
} from '../src/utils/updateSimulator.ts';

test('clamps custom start percentages to 0 through 99', () => {
	assert.equal(clampPercentage(-4), 0);
	assert.equal(clampPercentage(42.4), 42);
	assert.equal(clampPercentage(120), 99);
});

test('maps preset and custom durations', () => {
	assert.equal(durationInMilliseconds('30', 1), 30_000);
	assert.equal(durationInMilliseconds('600', 1), 600_000);
	assert.equal(durationInMilliseconds('custom', 2.5), 150_000);
});

test('automatic progress advances naturally and reaches 100 on time', () => {
	assert.equal(automaticProgress(10, 20_000, 60_000, 10, 0.9), 13);
	assert.equal(automaticProgress(97, 60_000, 60_000, 10, 0), 100);
});

test('manual progress increases, decreases, and stays in bounds', () => {
	assert.equal(manualProgress(50, 1), 51);
	assert.equal(manualProgress(50, -1), 49);
	assert.equal(manualProgress(100, 1), 100);
	assert.equal(manualProgress(0, -1), 0);
});

test('slowdown zones use longer pauses', () => {
	assert.equal(pauseMultiplier(30), 1.8);
	assert.equal(pauseMultiplier(60), 1.8);
	assert.equal(pauseMultiplier(90), 1.8);
	assert.equal(pauseMultiplier(45), 1);
});

test('completion stops unless loop or restart is enabled', () => {
	assert.equal(nextCompletionAction({ loop: false, restart: false, restartedOnce: false }), 'complete');
	assert.equal(nextCompletionAction({ loop: true, restart: false, restartedOnce: false }), 'loop');
	assert.equal(nextCompletionAction({ loop: false, restart: true, restartedOnce: false }), 'restart');
	assert.equal(nextCompletionAction({ loop: false, restart: true, restartedOnce: true }), 'complete');
});
