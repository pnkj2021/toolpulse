import assert from 'node:assert/strict';
import test from 'node:test';
import { typingModes } from '../src/data/typingSamples.ts';
import {
	generateTypingChallenge, generateUniqueChallenge, seededRandom, typingDifficulties,
} from '../src/utils/typingGenerators.ts';
import { normalizePersonalBests } from '../src/utils/typingChallenge.ts';

test('generates non-empty challenges for every mode and difficulty', () => {
	for (const mode of typingModes) for (const difficulty of typingDifficulties) {
		const challenge = generateTypingChallenge(mode, difficulty, { seed: 12, duration: 30 });
		assert.equal(challenge.mode, mode);
		assert.equal(challenge.difficulty, difficulty);
		assert.ok(challenge.text.length >= 40);
		assert.ok(challenge.text.length < 700);
	}
});

test('seeded and injected randomness are deterministic', () => {
	assert.equal(seededRandom(91)(), seededRandom(91)());
	assert.deepEqual(generateTypingChallenge('javascript', 'hard', { seed: 44 }), generateTypingChallenge('javascript', 'hard', { seed: 44 }));
	assert.equal(generateTypingChallenge('words', 'easy', { random: () => .2 }).text, generateTypingChallenge('words', 'easy', { random: () => .2 }).text);
});

test('generated JSON always parses', () => {
	for (const difficulty of typingDifficulties) for (const duration of [15, 30, 60] as const) {
		assert.doesNotThrow(() => JSON.parse(generateTypingChallenge('json', difficulty, { seed: duration, duration }).text));
	}
});

test('JavaScript uses coherent safe template structures', () => {
	assert.match(generateTypingChallenge('javascript', 'easy', { seed: 1 }).text, /const\s+\w+\s*=/u);
	assert.match(generateTypingChallenge('javascript', 'medium', { seed: 1 }).text, /function\s+\w+\(/u);
	assert.match(generateTypingChallenge('javascript', 'hard', { seed: 1 }).text, /async function|\.reduce/u);
	assert.doesNotMatch(generateTypingChallenge('javascript', 'hard', { seed: 1 }).text, /eval\(|document\.cookie|Function\(/u);
});

test('SQL uses SELECT-only safe templates', () => {
	for (const difficulty of typingDifficulties) {
		const text = generateTypingChallenge('sql', difficulty, { seed: 7 }).text;
		assert.match(text, /^SELECT\s/u);
		assert.doesNotMatch(text, /DROP|TRUNCATE|DELETE/u);
	}
});

test('HTML/CSS produces balanced safe structures without scripts', () => {
	for (const difficulty of typingDifficulties) {
		const text = generateTypingChallenge('html-css', difficulty, { seed: 8 }).text;
		assert.match(text, /<\w+[^>]*>[\s\S]*<\/\w+>/u);
		assert.doesNotMatch(text, /<script|on\w+=/iu);
	}
});

test('duration and difficulty materially change generated challenges', () => {
	const short = generateTypingChallenge('words', 'easy', { seed: 3, duration: 15 }).text;
	const long = generateTypingChallenge('words', 'easy', { seed: 3, duration: 60 }).text;
	assert.notEqual(short, long);
	assert.ok(long.length > short.length);
	assert.notEqual(generateTypingChallenge('sql', 'easy', { seed: 3 }).text, generateTypingChallenge('sql', 'hard', { seed: 3 }).text);
});

test('duplicate prevention retries and keeps bounded history', () => {
	const history: string[] = [];
	const first = generateUniqueChallenge('json', 'medium', history, { seed: 20 }, 2);
	const second = generateUniqueChallenge('json', 'medium', history, { seed: 20 }, 2);
	assert.notEqual(first.id, second.id);
	generateUniqueChallenge('json', 'medium', history, { seed: 30 }, 2);
	assert.equal(history.length, 2);
});

test('old and mode-difficulty personal best data migrate safely', () => {
	const normalized = normalizePersonalBests({ javascript: 70, 'javascript:hard': 82, bad: 100, 'sql:unknown': 40, words: 'fast' }, typingModes, typingDifficulties);
	assert.deepEqual(normalized, { javascript: 70, 'javascript:hard': 82 });
	assert.deepEqual(normalizePersonalBests(null, typingModes, typingDifficulties), {});
});
