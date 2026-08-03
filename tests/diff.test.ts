import assert from 'node:assert/strict';
import test from 'node:test';
import { compareInline, compareText, defaultDiffOptions, summarizeDiff, type DiffOptions } from '../src/utils/diff.ts';
import { copyBlockToSide, mergeBlocks, resolveAll } from '../src/utils/merge.ts';

const options = (override: Partial<DiffOptions> = {}): DiffOptions => ({ ...defaultDiffOptions, ...override });
const changed = (left: string, right: string, override: Partial<DiffOptions> = {}) =>
	compareText(left, right, options(override)).filter((block) => block.type !== 'equal');

test('identical text has no changed blocks', () => assert.equal(changed('one\ntwo', 'one\ntwo').length, 0));
test('detects an insertion', () => assert.equal(changed('one', 'one\ntwo')[0]?.type, 'added'));
test('detects a deletion', () => assert.equal(changed('one\ntwo', 'one')[0]?.type, 'removed'));
test('groups a replacement as changed', () => assert.equal(changed('old', 'new')[0]?.type, 'changed'));
test('finds multiple separate blocks', () => assert.equal(changed('a\nb\nc\nd\ne', 'a\nB\nc\nD\ne').length, 2));
test('ignores whitespace without changing source lines', () => {
	const blocks = compareText('  hello\tworld', 'hello   world', options({ ignoreWhitespace: true }));
	assert.equal(changed('  hello\tworld', 'hello   world', { ignoreWhitespace: true }).length, 0);
	assert.deepEqual(blocks[0]?.leftLines, ['  hello\tworld']);
});
test('ignores extra blank lines', () => assert.equal(changed('a\n\nb', 'a\nb', { ignoreBlankLines: true }).length, 0));
test('ignores case', () => assert.equal(changed('Hello', 'hello', { ignoreCase: true }).length, 0));
test('can ignore CRLF versus LF', () => {
	assert.equal(changed('a\r\nb', 'a\nb', { ignoreLineEndings: true }).length, 0);
	assert.equal(changed('a\r\nb', 'a\nb', { ignoreLineEndings: false }).length, 1);
});
test('supports Unicode', () => assert.equal(changed('नमस्ते', 'नमस्ते').length, 0));
test('supports emoji', () => assert.equal(changed('🙂', '🙃')[0]?.type, 'changed'));
test('handles empty inputs', () => {
	assert.deepEqual(compareText('', '', options()), []);
	assert.equal(changed('', 'new').length, 1);
	assert.equal(changed('old', '').length, 1);
});
test('merges left, right, and both resolutions', () => {
	const blocks = compareText('before\nold\nafter', 'before\nnew\nafter', options());
	const difference = blocks.find((block) => block.type !== 'equal');
	assert.ok(difference);
	assert.equal(mergeBlocks(blocks, { [difference.id]: 'left' }), 'before\nold\nafter');
	assert.equal(mergeBlocks(blocks, { [difference.id]: 'right' }), 'before\nnew\nafter');
	assert.equal(mergeBlocks(blocks, { [difference.id]: 'both' }), 'before\nold\nnew\nafter');
});
test('unresolved merge blocks use original text', () => {
	const blocks = compareText('before\nold\nafter', 'before\nnew\nafter', options());
	assert.equal(mergeBlocks(blocks), 'before\nold\nafter');
});
test('summarizes additions, removals, and similarity', () => {
	const summary = summarizeDiff(compareText('a\nb', 'a\nc', options()));
	assert.equal(summary.changedBlocks, 1);
	assert.equal(summary.addedLines, 1);
	assert.equal(summary.removedLines, 1);
	assert.equal(summary.unchangedLines, 1);
});
test('handles large text', () => {
	const left = Array.from({ length: 5000 }, (_, index) => `line ${index}`).join('\n');
	const right = left.replace('line 2500', 'changed 2500');
	assert.equal(changed(left, right).length, 1);
});
test('bounds work for large unrelated inputs', () => {
	const left = Array.from({ length: 3000 }, (_, index) => `left ${index}`).join('\n');
	const right = Array.from({ length: 3000 }, (_, index) => `right ${index}`).join('\n');
	const differences = changed(left, right);
	assert.equal(differences.length, 1);
	assert.equal(differences[0]?.type, 'changed');
});
test('preserves a final newline in merged output', () => {
	const blocks = compareText('same\nold\n', 'same\nnew\n', options());
	const difference = blocks.find((block) => block.type !== 'equal');
	assert.ok(difference);
	assert.equal(mergeBlocks(blocks, { [difference.id]: 'left' }), 'same\nold\n');
	assert.equal(mergeBlocks(blocks, { [difference.id]: 'right' }), 'same\nnew\n');
});

test('highlights only the changed characters inside a replacement line', () => {
	const inline = compareInline('const name = "ToolPulse";', 'const name = "YBS";');
	assert.deepEqual(inline.left.find((part) => part.type === 'removed')?.text, 'ToolPulse');
	assert.deepEqual(inline.right.find((part) => part.type === 'added')?.text, 'YBS');
});

test('copies one original block to modified without changing other modified blocks', () => {
	const blocks = compareText('a\nleft one\nc\nleft two\ne', 'a\nright one\nc\nright two\ne', options());
	const differences = blocks.filter((block) => block.type !== 'equal');
	assert.equal(copyBlockToSide(blocks, differences[0]!.id, 'left-to-right'), 'a\nleft one\nc\nright two\ne');
});

test('copies one modified block to original without changing other original blocks', () => {
	const blocks = compareText('a\nleft one\nc\nleft two\ne', 'a\nright one\nc\nright two\ne', options());
	const differences = blocks.filter((block) => block.type !== 'equal');
	assert.equal(copyBlockToSide(blocks, differences[0]!.id, 'right-to-left'), 'a\nright one\nc\nleft two\ne');
});

test('bulk resolutions select all original or all modified text', () => {
	const blocks = compareText('old one\nold two', 'new one\nnew two', options());
	assert.equal(mergeBlocks(blocks, resolveAll(blocks, 'left')), 'old one\nold two');
	assert.equal(mergeBlocks(blocks, resolveAll(blocks, 'right')), 'new one\nnew two');
});
