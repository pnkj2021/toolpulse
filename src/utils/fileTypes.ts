const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/svg+xml': 'svg',
	'application/pdf': 'pdf',
	'application/json': 'json',
	'application/xml': 'xml',
	'application/javascript': 'js',
	'application/x-javascript': 'js',
	'application/sql': 'sql',
	'application/graphql': 'graphql',
	'application/zip': 'zip',
	'text/plain': 'txt',
	'text/html': 'html',
	'text/css': 'css',
	'text/csv': 'csv',
};

const TEXT_APPLICATION_TYPES = new Set([
	'application/json',
	'application/xml',
	'application/javascript',
	'application/x-javascript',
	'application/sql',
	'application/graphql',
	'image/svg+xml',
]);

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
	return signature.every((byte, index) => bytes[index] === byte);
}

export function detectMimeType(bytes: Uint8Array): string | undefined {
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
	if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
	if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'application/zip';
	if (
		startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
		&& bytes[8] === 0x57
		&& bytes[9] === 0x45
		&& bytes[10] === 0x42
		&& bytes[11] === 0x50
	) return 'image/webp';
	return undefined;
}

export function isTextMimeType(mimeType: string): boolean {
	const normalized = mimeType.toLowerCase().split(';', 1)[0];
	return normalized.startsWith('text/') || TEXT_APPLICATION_TYPES.has(normalized);
}

export function extensionForMimeType(mimeType: string): string {
	return MIME_EXTENSIONS[mimeType.toLowerCase().split(';', 1)[0]] ?? 'bin';
}

export function filenameForMimeType(mimeType: string): string {
	const extension = extensionForMimeType(mimeType);
	if (mimeType.startsWith('image/')) return `decoded-image.${extension}`;
	if (mimeType === 'text/plain') return 'decoded-text.txt';
	return `decoded-file.${extension}`;
}
