export type QrType = 'url' | 'text' | 'wifi' | 'email' | 'phone' | 'sms' | 'vcard';
export type ErrorCorrection = 'low' | 'medium' | 'quartile' | 'high';

export interface QrFields { [key: string]: string | boolean | undefined }
export interface PayloadResult { payload: string; error: string }

const ok = (payload: string): PayloadResult => ({ payload, error: '' });
const fail = (error: string): PayloadResult => ({ payload: '', error });
const value = (fields: QrFields, key: string) => String(fields[key] ?? '').trim();
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
const validPhone = (phone: string) => /^[+()\d][+()\d .-]{2,}$/u.test(phone);

export function escapeWifiValue(input: string): string {
	return input.replace(/([\\;,:"])/gu, '\\$1');
}

export function escapeVCardValue(input: string): string {
	return input.replace(/\\/gu, '\\\\').replace(/\r?\n/gu, '\\n').replace(/([;,])/gu, '\\$1');
}

export function buildQrPayload(type: QrType, fields: QrFields): PayloadResult {
	switch (type) {
		case 'url': {
			const url = value(fields, 'url');
			if (!url) return fail('Enter a URL to create a QR code.');
			try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); }
			catch { return fail('Enter a complete HTTP or HTTPS URL.'); }
			return ok(url);
		}
		case 'text': {
			const text = String(fields.text ?? '');
			return text.trim() ? ok(text) : fail('Enter some text to create a QR code.');
		}
		case 'wifi': {
			const ssid = value(fields, 'ssid');
			const security = value(fields, 'security') || 'WPA';
			const password = String(fields.password ?? '');
			if (!ssid) return fail('Enter the Wi-Fi network name.');
			if (!['WPA', 'WEP', 'nopass'].includes(security)) return fail('Choose a supported Wi-Fi security type.');
			if (security !== 'nopass' && !password) return fail('Enter the Wi-Fi password.');
			return ok(`WIFI:T:${security};S:${escapeWifiValue(ssid)};${security === 'nopass' ? '' : `P:${escapeWifiValue(password)};`}H:${fields.hidden === true ? 'true' : 'false'};;`);
		}
		case 'email': {
			const email = value(fields, 'email');
			if (!validEmail(email)) return fail('Enter a valid email address.');
			const query: string[] = [];
			const subject = String(fields.subject ?? '');
			const body = String(fields.message ?? '');
			if (subject) query.push(`subject=${encodeURIComponent(subject)}`);
			if (body) query.push(`body=${encodeURIComponent(body)}`);
			return ok(`mailto:${email}${query.length ? `?${query.join('&')}` : ''}`);
		}
		case 'phone': {
			const phone = value(fields, 'phone');
			return validPhone(phone) ? ok(`tel:${phone}`) : fail('Enter a valid phone number.');
		}
		case 'sms': {
			const phone = value(fields, 'phone');
			if (!validPhone(phone)) return fail('Enter a valid phone number.');
			return ok(`SMSTO:${phone}:${String(fields.message ?? '')}`);
		}
		case 'vcard': {
			const first = value(fields, 'firstName');
			const last = value(fields, 'lastName');
			if (!first && !last) return fail('Enter at least a first or last name.');
			const phone = value(fields, 'phone');
			const email = value(fields, 'email');
			const website = value(fields, 'website');
			if (phone && !validPhone(phone)) return fail('Enter a valid phone number.');
			if (email && !validEmail(email)) return fail('Enter a valid email address.');
			if (website) { try { const parsed = new URL(website); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); } catch { return fail('Enter a complete HTTP or HTTPS website URL.'); } }
			const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escapeVCardValue(last)};${escapeVCardValue(first)};;;`, `FN:${escapeVCardValue([first, last].filter(Boolean).join(' '))}`];
			const organization = value(fields, 'organization');
			if (organization) lines.push(`ORG:${escapeVCardValue(organization)}`);
			if (phone) lines.push(`TEL:${escapeVCardValue(phone)}`);
			if (email) lines.push(`EMAIL:${escapeVCardValue(email)}`);
			if (website) lines.push(`URL:${escapeVCardValue(website)}`);
			lines.push('END:VCARD');
			return ok(lines.join('\r\n'));
		}
	}
}

export const errorCorrectionMap: Record<ErrorCorrection, 'L' | 'M' | 'Q' | 'H'> = { low: 'L', medium: 'M', quartile: 'Q', high: 'H' };
export function qrFilename(format: 'png' | 'svg'): string { return `ybs-qr-code.${format}`; }
