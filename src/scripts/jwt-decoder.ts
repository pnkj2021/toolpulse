import { formatRelativeTimestamp, getJwtClaims, getTokenStatus, parseJwt, type JwtDecodeResult, type TokenStatus } from '../utils/jwt';

const get = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
const input = get<HTMLTextAreaElement>('#jwt-input');
const error = get<HTMLElement>('#jwt-error');
const live = get<HTMLElement>('#jwt-live-status');
let result: JwtDecodeResult | null = null;
let timer: number | undefined;

const setText = (selector: string, value: string) => { const element = get<HTMLElement>(selector); if (element) element.textContent = value; };
const setVisible = (selector: string, visible: boolean) => get<HTMLElement>(selector)?.classList.toggle('hidden', !visible);
const displayValue = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value);

function structure(selector: string, valid: boolean, label: string): void {
	const element = get<HTMLElement>(selector); if (!element) return;
	element.classList.toggle('jwt-structure-valid', valid); element.classList.toggle('jwt-structure-missing', !valid);
	element.textContent = `${label} ${valid ? '✓' : '—'}`;
}

function renderStatus(status: TokenStatus): void {
	const labels = { active: 'ACTIVE', expired: 'EXPIRED', 'not-active-yet': 'NOT ACTIVE YET', unknown: 'UNKNOWN' };
	const element = get<HTMLElement>('#jwt-status'); if (!element || !result) return;
	element.textContent = labels[status];
	element.className = `mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-black tracking-wide ${status === 'active' ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : status === 'expired' ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300' : status === 'not-active-yet' ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`;
	const timestamp = status === 'not-active-yet' ? result.payload.nbf : result.payload.exp;
	setText('#jwt-status-detail', typeof timestamp === 'number' ? `${status === 'expired' ? 'Expired' : status === 'not-active-yet' ? 'Active' : 'Expires'} ${formatRelativeTimestamp(timestamp)}.` : 'No valid numeric expiration claim.');
}

function renderClaims(): void {
	if (!result) return;
	const claims = getJwtClaims(result.payload); const container = get<HTMLElement>('#jwt-claims');
	setVisible('#jwt-claims-section', claims.length > 0); if (!container) return;
	container.replaceChildren(...claims.map((claim) => {
		const item = document.createElement('dl'); item.className = 'jwt-claim';
		const term = document.createElement('dt'); term.textContent = `${claim.key} — ${claim.label}`;
		const value = document.createElement('dd'); value.textContent = displayValue(claim.value);
		item.append(term, value);
		if (claim.timestamp) { const utc = document.createElement('dd'); utc.textContent = `UTC: ${claim.timestamp.utc}`; const local = document.createElement('dd'); local.textContent = `Local: ${claim.timestamp.local}`; item.append(utc, local); }
		return item;
	}));
}

function clearResults(): void {
	result = null; setVisible('#jwt-overview', false); setVisible('#jwt-results', false); setVisible('#jwt-claims-section', false);
	if (error) { error.classList.add('hidden'); error.textContent = ''; }
}

function decode(): void {
	const token = input?.value.trim() ?? ''; if (!token) { clearResults(); return; }
	try {
		result = parseJwt(token); if (error) error.classList.add('hidden');
		setVisible('#jwt-overview', true); setVisible('#jwt-results', true);
		structure('#structure-header', true, 'Header'); structure('#structure-payload', true, 'Payload'); structure('#structure-signature', result.signaturePresent, 'Signature');
		setText('#jwt-algorithm', typeof result.header.alg === 'string' ? result.header.alg : 'Not specified');
		setText('#jwt-type', typeof result.header.typ === 'string' ? result.header.typ : 'Not specified');
		setText('#header-summary', `Algorithm: ${typeof result.header.alg === 'string' ? result.header.alg : 'unknown'} · Type: ${typeof result.header.typ === 'string' ? result.header.typ : 'unknown'}`);
		setText('#jwt-header-json', JSON.stringify(result.header, null, 2)); setText('#jwt-payload-json', JSON.stringify(result.payload, null, 2));
		setText('#jwt-issued', typeof result.payload.iat === 'number' ? formatRelativeTimestamp(result.payload.iat) : 'Not specified');
		setText('#jwt-expires', typeof result.payload.exp === 'number' ? formatRelativeTimestamp(result.payload.exp) : 'Not specified');
		renderStatus(getTokenStatus(result.payload)); renderClaims(); if (live) live.textContent = 'JWT decoded locally.';
	} catch (caught) {
		result = null; setVisible('#jwt-overview', false); setVisible('#jwt-results', false); setVisible('#jwt-claims-section', false);
		if (error) { error.textContent = caught instanceof Error ? caught.message : 'Unable to decode this JWT.'; error.classList.remove('hidden'); }
	}
}

function scheduleDecode(): void { clearTimeout(timer); timer = window.setTimeout(decode, 140); }
async function copyText(value: string, button: HTMLButtonElement | null): Promise<void> {
	if (!value) return;
	try { await navigator.clipboard.writeText(value); }
	catch { if (live) live.textContent = 'Clipboard permission was not granted.'; return; }
	const original = button?.textContent;
	if (button) button.textContent = 'Copied!'; if (live) live.textContent = 'Copied to clipboard.';
	window.setTimeout(() => { if (button && original) button.textContent = original; }, 1400);
}
input?.addEventListener('input', scheduleDecode);
get<HTMLButtonElement>('#paste-jwt')?.addEventListener('click', async () => { if (!input) return; try { input.value = await navigator.clipboard.readText(); decode(); input.focus(); } catch { if (live) live.textContent = 'Clipboard permission was not granted.'; } });
get<HTMLButtonElement>('#clear-jwt')?.addEventListener('click', () => { if (input) { input.value = ''; input.focus(); } clearResults(); });
get<HTMLButtonElement>('#copy-token')?.addEventListener('click', (event) => void copyText(input?.value ?? '', event.currentTarget as HTMLButtonElement));
get<HTMLButtonElement>('#copy-header')?.addEventListener('click', (event) => void copyText(result ? JSON.stringify(result.header, null, 2) : '', event.currentTarget as HTMLButtonElement));
get<HTMLButtonElement>('#copy-payload')?.addEventListener('click', (event) => void copyText(result ? JSON.stringify(result.payload, null, 2) : '', event.currentTarget as HTMLButtonElement));
