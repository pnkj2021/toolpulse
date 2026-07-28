import { detectMimeType, filenameForMimeType, isTextMimeType } from './fileTypes.ts';

export type ParsedBase64 = {
	payload: string;
	mimeType: string;
	isDataUrl: boolean;
};

export interface DecodedBase64 {
	bytes: Uint8Array;
	mimeType: string;
	isDataUrl: boolean;
}

export type DecodedBase64Result =
	| {
		kind: 'text';
		text: string;
		bytes: Uint8Array;
		mimeType: string;
		filename: string;
		isDataUrl: boolean;
	}
	| {
		kind: 'binary';
		bytes: Uint8Array;
		mimeType: string;
		filename: string;
		isDataUrl: boolean;
	};

const DEFAULT_MIME_TYPE = 'application/octet-stream';
const BASE64_CHARACTERS = /^[A-Za-z0-9+/]*={0,2}$/u;

export function normalizeBase64(value: string): string {
	return value.replace(/[\s\t\r\n]+/gu, '');
}

export function parseBase64Input(input: string): ParsedBase64 {
	const trimmed = input.trim();
	if (!trimmed) throw new Error('No input provided.');

	if (!trimmed.startsWith('data:')) {
		const payload = normalizeBase64(trimmed);
		if (!payload) throw new Error('Empty Base64 payload.');
		return { payload, mimeType: DEFAULT_MIME_TYPE, isDataUrl: false };
	}

	const commaIndex = trimmed.indexOf(',');
	if (commaIndex < 0) throw new Error('Invalid Base64 Data URL.');

	const metadata = trimmed.slice(5, commaIndex);
	if (!/(?:^|;)base64(?:;|$)/iu.test(metadata)) {
		throw new Error('This Data URL is not Base64 encoded.');
	}

	const mimeType = metadata.split(';', 1)[0].trim() || DEFAULT_MIME_TYPE;
	const payload = normalizeBase64(trimmed.slice(commaIndex + 1));
	if (!payload) throw new Error('The Base64 payload is empty.');

	return { payload, mimeType, isDataUrl: true };
}

function preparePayload(payload: string): string {
	const normalized = normalizeBase64(payload);
	if (!normalized) throw new Error('The Base64 payload is empty.');
	if (!BASE64_CHARACTERS.test(normalized)) throw new Error('Invalid Base64 content.');

	const firstPadding = normalized.indexOf('=');
	if (firstPadding >= 0) {
		const padding = normalized.slice(firstPadding);
		if (!/^={1,2}$/u.test(padding) || normalized.length % 4 !== 0) {
			throw new Error('Invalid Base64 padding.');
		}
		return normalized;
	}

	const remainder = normalized.length % 4;
	if (remainder === 1) throw new Error('Invalid Base64 padding.');
	return normalized + '='.repeat((4 - remainder) % 4);
}

export function validateBase64(payload: string): boolean {
	try {
		preparePayload(payload);
		return true;
	} catch {
		return false;
	}
}

export function bytesToBase64(bytes: Uint8Array): string {
	const chunkSize = 0x8000;
	let binary = '';
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
	}
	return btoa(binary);
}

export function decodeBase64ToBytes(input: string): DecodedBase64 {
	const parsed = parseBase64Input(input);
	const paddedPayload = preparePayload(parsed.payload);

	try {
		const binary = atob(paddedPayload);
		const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

		// Reject syntactically plausible input with non-canonical padding bits.
		const decodedRoundTrip = bytesToBase64(bytes).replace(/=+$/u, '');
		const inputWithoutPadding = paddedPayload.replace(/=+$/u, '');
		if (decodedRoundTrip !== inputWithoutPadding) throw new Error('round-trip mismatch');

		return { bytes, mimeType: parsed.mimeType, isDataUrl: parsed.isDataUrl };
	} catch (error) {
		if (error instanceof Error && error.message === 'round-trip mismatch') {
			throw new Error('Invalid Base64 content.');
		}
		throw new Error('Unable to decode the Base64 content.');
	}
}

export function decodeBase64ToBlob(input: string): Blob {
	const decoded = decodeBase64(input);
	return new Blob([decoded.bytes], { type: decoded.mimeType });
}

export function decodeBase64(input: string): DecodedBase64Result {
	const decoded = decodeBase64ToBytes(input);
	const detectedMimeType = decoded.isDataUrl ? decoded.mimeType : detectMimeType(decoded.bytes);
	let mimeType = detectedMimeType ?? 'application/octet-stream';

	if (detectedMimeType && isTextMimeType(detectedMimeType)) {
		try {
			const text = new TextDecoder('utf-8', { fatal: true }).decode(decoded.bytes);
			return {
				kind: 'text',
				text,
				bytes: decoded.bytes,
				mimeType,
				filename: filenameForMimeType(mimeType),
				isDataUrl: decoded.isDataUrl,
			};
		} catch {
			// A declared text type with invalid UTF-8 is safer to expose as bytes.
		}
	}

	if (!detectedMimeType) {
		try {
			const text = new TextDecoder('utf-8', { fatal: true }).decode(decoded.bytes);
			mimeType = 'text/plain';
			return {
				kind: 'text',
				text,
				bytes: decoded.bytes,
				mimeType,
				filename: filenameForMimeType(mimeType),
				isDataUrl: decoded.isDataUrl,
			};
		} catch {
			mimeType = 'application/octet-stream';
		}
	}

	return {
		kind: 'binary',
		bytes: decoded.bytes,
		mimeType,
		filename: filenameForMimeType(mimeType),
		isDataUrl: decoded.isDataUrl,
	};
}

// Kept as a compatibility helper for existing callers.
export function base64ToBytes(input: string): Uint8Array {
	return decodeBase64ToBytes(input).bytes;
}

export function encodeText(value: string): string {
	if (!value) throw new Error('No input provided.');
	return bytesToBase64(new TextEncoder().encode(value));
}

export function decodeText(value: string): string {
	const result = decodeBase64(value);
	if (result.kind === 'binary') throw new Error('The decoded content is a binary file.');
	return result.text;
}

export async function encodeFile(file: File): Promise<string> {
	return bytesToBase64(new Uint8Array(await file.arrayBuffer()));
}

export function decodeFile(value: string, fallbackMimeType = DEFAULT_MIME_TYPE): DecodedBase64 {
	const decoded = decodeBase64ToBytes(value);
	return {
		...decoded,
		mimeType: decoded.isDataUrl ? decoded.mimeType : fallbackMimeType,
	};
}

export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 bytes';
	const units = ['bytes', 'KB', 'MB', 'GB'];
	const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / 1024 ** unitIndex;
	return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function downloadBlob(content: BlobPart, mimeType: string, fileName: string): void {
	const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.append(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
