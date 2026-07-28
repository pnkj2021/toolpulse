import assert from 'node:assert/strict';
import test from 'node:test';
import {
	countCharacters,
	countCharactersWithoutWhitespace,
} from '../src/utils/textStats.ts';

test('counts emoji as one grapheme', () => {
	assert.equal(countCharacters('🙂'), 1);
});

test('counts Hindi grapheme clusters', () => {
	assert.equal(countCharacters('नमस्ते'), 3);
});

test('counts combining marks with their base character', () => {
	assert.equal(countCharacters('e\u0301'), 1);
});

test('counts a family emoji sequence as one grapheme', () => {
	assert.equal(countCharacters('👨‍👩‍👧‍👦'), 1);
});

test('distinguishes characters with and without Unicode whitespace', () => {
	const value = 'A B\nC\tD';
	assert.equal(countCharacters(value), 7);
	assert.equal(countCharactersWithoutWhitespace(value), 4);
});
