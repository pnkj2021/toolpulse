export type JwtObject = Record<string, unknown>;
export type TokenStatus = 'active' | 'expired' | 'not-active-yet' | 'unknown';

export type JwtDecodeResult = {
	rawHeader: string;
	rawPayload: string;
	signature: string;
	header: JwtObject;
	payload: JwtObject;
	signaturePresent: boolean;
};

export type JwtClaim = {
	key: string;
	label: string;
	value: unknown;
	timestamp?: { unix: number; utc: string; local: string };
};

const MAX_SEGMENT_LENGTH = 4_000_000;
const CLAIM_LABELS: Record<string, string> = {
	iss: 'Issuer', sub: 'Subject', aud: 'Audience', exp: 'Expiration Time',
	nbf: 'Not Before', iat: 'Issued At', jti: 'JWT ID',
};

function assertObject(value: unknown, section: 'Header' | 'Payload'): asserts value is JwtObject {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${section} JSON must be an object.`);
	}
}

export function decodeBase64Url(value: string, section = 'JWT section'): string {
	if (value.length > MAX_SEGMENT_LENGTH) throw new Error(`${section} is too large to decode safely.`);
	if (!value || !/^[A-Za-z0-9_-]+$/u.test(value) || value.length % 4 === 1) {
		throw new Error(`${section} is not valid Base64URL.`);
	}
	const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
	try {
		const binary = atob(padded);
		const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new Error(`${section} is not valid Base64URL or UTF-8.`);
	}
}

function parseSection(segment: string, section: 'Header' | 'Payload'): JwtObject {
	const decoded = decodeBase64Url(segment, section);
	try {
		const parsed: unknown = JSON.parse(decoded);
		assertObject(parsed, section);
		return parsed;
	} catch (error) {
		if (error instanceof Error && error.message.endsWith('must be an object.')) throw error;
		throw new Error(`${section} decoded successfully but does not contain valid JSON.`);
	}
}

export function parseJwt(token: string): JwtDecodeResult {
	const trimmed = token.trim();
	if (!trimmed) throw new Error('Paste a JWT to begin.');
	const parts = trimmed.split('.');
	if (parts.length !== 3) throw new Error('JWT must contain three dot-separated sections.');
	const [rawHeader = '', rawPayload = '', signature = ''] = parts;
	if (signature && (!/^[A-Za-z0-9_-]+$/u.test(signature) || signature.length % 4 === 1)) {
		throw new Error('Signature is not valid Base64URL.');
	}
	return {
		rawHeader, rawPayload, signature,
		header: parseSection(rawHeader, 'Header'),
		payload: parseSection(rawPayload, 'Payload'),
		signaturePresent: signature.length > 0,
	};
}

export function formatJwtTimestamp(value: number): { unix: number; utc: string; local: string } | null {
	if (!Number.isFinite(value)) return null;
	const date = new Date(value * 1000);
	if (Number.isNaN(date.getTime())) return null;
	return { unix: value, utc: date.toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'medium' }) + ' UTC', local: date.toLocaleString() };
}

export function getJwtClaims(payload: JwtObject): JwtClaim[] {
	return Object.entries(CLAIM_LABELS)
		.filter(([key]) => Object.hasOwn(payload, key))
		.map(([key, label]) => {
			const value = payload[key];
			return { key, label, value, ...(['exp', 'nbf', 'iat'].includes(key) && typeof value === 'number' ? { timestamp: formatJwtTimestamp(value) ?? undefined } : {}) };
		});
}

export function getTokenStatus(payload: JwtObject, nowSeconds = Date.now() / 1000): TokenStatus {
	if (typeof payload.nbf === 'number' && Number.isFinite(payload.nbf) && nowSeconds < payload.nbf) return 'not-active-yet';
	if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) return nowSeconds >= payload.exp ? 'expired' : 'active';
	return 'unknown';
}

export function formatRelativeTimestamp(timestamp: number, nowSeconds = Date.now() / 1000): string {
	const seconds = Math.round(timestamp - nowSeconds);
	const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	const ranges: Array<[number, Intl.RelativeTimeFormatUnit]> = [[86400, 'day'], [3600, 'hour'], [60, 'minute']];
	for (const [size, unit] of ranges) if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
	return formatter.format(seconds, 'second');
}
