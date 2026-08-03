import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeBase64Url, formatJwtTimestamp, getJwtClaims, getTokenStatus, parseJwt } from '../src/utils/jwt.ts';

const encode = (value: unknown) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const token = (header: unknown = { alg: 'HS256', typ: 'JWT' }, payload: unknown = { sub: '123' }, signature = 'c2ln') => `${encode(header)}.${encode(payload)}.${signature}`;

test('decodes a valid JWT without Base64 padding', () => assert.equal(parseJwt(token()).payload.sub, '123'));
test('supports Base64URL dash and underscore characters', () => {
	assert.equal(decodeBase64Url(encode('🙂')), '🙂');
	assert.match(encode('🙂'), /[-_]/u);
});
test('decodes Unicode payloads', () => assert.equal(parseJwt(token(undefined, { name: 'नमस्ते' })).payload.name, 'नमस्ते'));
test('decodes emoji payloads', () => assert.equal(parseJwt(token(undefined, { icon: '🙂' })).payload.icon, '🙂'));
test('rejects empty input', () => assert.throws(() => parseJwt(''), /Paste a JWT/u));
test('rejects one segment', () => assert.throws(() => parseJwt('abc'), /three dot-separated/u));
test('rejects two segments', () => assert.throws(() => parseJwt('abc.def'), /three dot-separated/u));
test('rejects four segments', () => assert.throws(() => parseJwt('a.b.c.d'), /three dot-separated/u));
test('rejects invalid Base64URL', () => assert.throws(() => parseJwt('%%%.abc.sig'), /Header is not valid Base64URL/u));
test('reports invalid header JSON', () => assert.throws(() => parseJwt(`${encode('no json')}.${encode({ sub: 1 })}.sig`), /Header decoded successfully/u));
test('reports invalid payload JSON', () => assert.throws(() => parseJwt(`${encode({ alg: 'none' })}.${encode('no json')}.sig`), /Payload decoded successfully/u));
test('returns active for a future exp', () => assert.equal(getTokenStatus({ exp: 200 }, 100), 'active'));
test('returns expired for a past exp', () => assert.equal(getTokenStatus({ exp: 50 }, 100), 'expired'));
test('returns not active yet for future nbf', () => assert.equal(getTokenStatus({ nbf: 200, exp: 300 }, 100), 'not-active-yet'));
test('returns unknown without exp', () => assert.equal(getTokenStatus({ sub: '1' }, 100), 'unknown'));
test('ignores string exp as a status timestamp', () => assert.equal(getTokenStatus({ exp: '200' }, 100), 'unknown'));
test('formats iat timestamps and exposes standard claims', () => {
	const claims = getJwtClaims({ iat: 1_720_000_000 });
	assert.equal(claims[0]?.timestamp?.unix, 1_720_000_000);
	assert.match(formatJwtTimestamp(1_720_000_000)?.utc ?? '', /UTC/u);
});
test('reports a missing signature without claiming validation', () => assert.equal(parseJwt(token(undefined, undefined, '')).signaturePresent, false));
test('handles a large payload', () => assert.equal((parseJwt(token(undefined, { data: 'x'.repeat(250_000) })).payload.data as string).length, 250_000));
test('extracts audience arrays without coercing their type', () => assert.deepEqual(getJwtClaims({ aud: ['api', 'web'] })[0]?.value, ['api', 'web']));
