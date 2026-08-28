import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQrPayload, errorCorrectionMap, qrFilename } from '../src/utils/qrCode.ts';

test('builds normal and special-character HTTPS URLs', () => {
	assert.equal(buildQrPayload('url', { url: 'https://example.com/path' }).payload, 'https://example.com/path');
	assert.equal(buildQrPayload('url', { url: 'https://example.com/?q=a%20b&x=✓' }).payload, 'https://example.com/?q=a%20b&x=✓');
});
test('preserves plain and Unicode text', () => {
	assert.equal(buildQrPayload('text', { text: 'Hello world' }).payload, 'Hello world');
	assert.equal(buildQrPayload('text', { text: 'नमस्ते 🙂' }).payload, 'नमस्ते 🙂');
});
test('builds secured, open, and escaped Wi-Fi payloads', () => {
	assert.equal(buildQrPayload('wifi', { ssid: 'Office', password: 'secret', security: 'WPA' }).payload, 'WIFI:T:WPA;S:Office;P:secret;H:false;;');
	assert.equal(buildQrPayload('wifi', { ssid: 'Guest', security: 'nopass' }).payload, 'WIFI:T:nopass;S:Guest;H:false;;');
	assert.equal(buildQrPayload('wifi', { ssid: 'A;B', password: 'p:a\\b', security: 'WPA', hidden: true }).payload, 'WIFI:T:WPA;S:A\\;B;P:p\\:a\\\\b;H:true;;');
});
test('builds email payloads with encoded subject and message', () => {
	assert.equal(buildQrPayload('email', { email: 'hi@example.com' }).payload, 'mailto:hi@example.com');
	assert.equal(buildQrPayload('email', { email: 'hi@example.com', subject: 'Hello & welcome', message: 'Line one\nLine two' }).payload, 'mailto:hi@example.com?subject=Hello%20%26%20welcome&body=Line%20one%0ALine%20two');
});
test('builds phone and SMS payloads', () => {
	assert.equal(buildQrPayload('phone', { phone: '+1 555 0100' }).payload, 'tel:+1 555 0100');
	assert.equal(buildQrPayload('sms', { phone: '+15550100', message: 'Meet at 5:30 & bring tea' }).payload, 'SMSTO:+15550100:Meet at 5:30 & bring tea');
});
test('builds minimum and complete escaped vCards', () => {
	assert.match(buildQrPayload('vcard', { firstName: 'Ada' }).payload, /N:;Ada;;;\r\nFN:Ada/u);
	const result = buildQrPayload('vcard', { firstName: 'Ada', lastName: 'Lovelace', organization: 'Math, Inc.', phone: '+44 1234', email: 'ada@example.com', website: 'https://example.com/a;b' }).payload;
	assert.match(result, /ORG:Math\\, Inc\./u); assert.match(result, /TEL:\+44 1234/u); assert.match(result, /EMAIL:ada@example.com/u); assert.match(result, /URL:https:\/\/example\.com\/a\\;b/u); assert.match(result, /END:VCARD$/u);
});
test('rejects empty or invalid required input', () => {
	for (const [type, fields] of [['url', {}], ['url', { url: 'javascript:alert(1)' }], ['text', { text: ' ' }], ['wifi', { ssid: '' }], ['email', { email: 'bad' }], ['phone', { phone: 'x' }], ['sms', { phone: '' }], ['vcard', {}]] as const) assert.equal(buildQrPayload(type, fields).payload, '');
});
test('maps error correction and creates download filenames', () => {
	assert.deepEqual(errorCorrectionMap, { low: 'L', medium: 'M', quartile: 'Q', high: 'H' });
	assert.equal(qrFilename('png'), 'ybs-qr-code.png'); assert.equal(qrFilename('svg'), 'ybs-qr-code.svg');
});
