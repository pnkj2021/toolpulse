import assert from 'node:assert/strict';
import test from 'node:test';
import { createRegex, findMatches, formatRegex, MAX_REGEX_INPUT_LENGTH, replaceMatches, validateRegex } from '../src/utils/regex.ts';

test('basic matching follows global and non-global JavaScript semantics', () => {
	assert.deepEqual(findMatches('cat', '', 'a cat').matches.map((match) => match.value), ['cat']);
	assert.equal(findMatches('dog', '', 'a cat').matches.length, 0);
	assert.deepEqual(findMatches('a', 'g', 'banana').matches.map((match) => match.index), [1, 3, 5]);
	assert.equal(findMatches('a', '', 'banana').matches.length, 1);
	assert.equal(findMatches('hello', 'i', 'HELLO').matches.length, 1);
	assert.equal(findMatches('^two$', 'm', 'one\ntwo\nthree').matches[0]?.value, 'two');
	assert.equal(findMatches('a.b', 's', 'a\nb').matches.length, 1);
	assert.equal(findMatches('😀', 'u', 'x😀y').matches[0]?.index, 1);
});

test('validation handles invalid and empty inputs', () => {
	assert.equal(validateRegex('[a-z').valid, false);
	assert.equal(validateRegex('').valid, true);
	assert.equal(findMatches('a', 'g', '').matches.length, 0);
	assert.throws(() => createRegex('[', 'g'));
});

test('normalizes numbered, nested, optional, and named capture groups', () => {
	assert.deepEqual(findMatches('(a)', '', 'a').matches[0].groups, ['a']);
	assert.deepEqual(findMatches('(a)(b)', '', 'ab').matches[0].groups, ['a', 'b']);
	assert.deepEqual(findMatches('(a)?b', '', 'b').matches[0].groups, [undefined]);
	assert.deepEqual(findMatches('((a)b)', '', 'ab').matches[0].groups, ['ab', 'a']);
	assert.deepEqual(findMatches('(?<user>\\w+)@(?<domain>[\\w.]+)', '', 'alex@example.com').matches[0].namedGroups, { user: 'alex', domain: 'example.com' });
	assert.deepEqual(findMatches('(?<first>a)(?<second>b)', '', 'ab').matches[0].namedGroups, { first: 'a', second: 'b' });
});

test('reports accurate match start, end, and multiple positions', () => {
	const match = findMatches('cat', '', 'a cat!').matches[0];
	assert.equal(match.index, 2);
	assert.equal(match.end, 5);
	assert.deepEqual(findMatches('x', 'g', 'x-x').matches.map((item) => [item.index, item.end]), [[0, 1], [2, 3]]);
});

test('zero-length global matches terminate safely', () => {
	assert.deepEqual(findMatches('^', '', 'abc').matches.map((match) => match.index), [0]);
	assert.deepEqual(findMatches('(?=a)', 'g', 'aaa').matches.map((match) => match.index), [0, 1, 2]);
	assert.deepEqual(findMatches('(?:)', 'gu', '😀').matches.map((match) => match.index), [0, 2]);
});

test('supports Unicode, Hindi, combining marks, and newline text with JavaScript semantics', () => {
	assert.equal(findMatches('😀', 'gu', '😀😀').matches.length, 2);
	assert.equal(findMatches('नमस्ते', 'u', 'नमस्ते दुनिया').matches.length, 1);
	assert.equal(findMatches('e\\u0301', 'u', 'é').matches.length, 1);
	assert.equal(findMatches('^b', 'm', 'a\nb').matches[0]?.index, 2);
});

test('supports g, i, m, s, u, and y flags', () => {
	assert.equal(findMatches('a', 'g', 'aa').matches.length, 2);
	assert.equal(findMatches('a', 'i', 'A').matches.length, 1);
	assert.equal(findMatches('^b', 'm', 'a\nb').matches.length, 1);
	assert.equal(findMatches('.', 's', '\n').matches.length, 1);
	assert.equal(findMatches('😀', 'u', '😀').matches.length, 1);
	assert.equal(findMatches('a', 'y', 'abc').matches.length, 1);
	assert.equal(findMatches('b', 'y', 'abc').matches.length, 0);
});

test('replacement uses native JavaScript replacement tokens and flag behavior', () => {
	assert.equal(replaceMatches('cat', '', 'cat', 'dog'), 'dog');
	assert.equal(replaceMatches('cat', '', 'cat', '[$&]'), '[cat]');
	assert.equal(replaceMatches('(John) (Smith)', '', 'John Smith', '$2, $1'), 'Smith, John');
	assert.equal(replaceMatches('(a)(b)', '', 'ab', '$2$1'), 'ba');
	assert.equal(replaceMatches('(?<word>cat)', '', 'cat', '$<word>s'), 'cats');
	assert.equal(replaceMatches('a', 'g', 'banana', 'x'), 'bxnxnx');
	assert.equal(replaceMatches('a', '', 'banana', 'x'), 'bxnana');
});

test('untrusted-looking text remains ordinary match data', () => {
	assert.equal(findMatches('<script>', '', '<script>alert(1)</script>').matches[0].value, '<script>');
	assert.equal(findMatches('<img', '', '<img src=x onerror=alert(1)>').matches[0].value, '<img');
});

test('bounds large input and formats a copyable expression', () => {
	assert.equal(findMatches('z', 'g', 'a'.repeat(MAX_REGEX_INPUT_LENGTH)).matches.length, 0);
	assert.throws(() => findMatches('.', 'g', 'a'.repeat(MAX_REGEX_INPUT_LENGTH + 1)), RangeError);
	assert.equal(formatRegex('a/b', 'iggi'), '/a\\/b/gi');
});
