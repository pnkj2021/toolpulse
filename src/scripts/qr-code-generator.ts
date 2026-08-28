import QRCode from 'qrcode';
import { buildQrPayload, errorCorrectionMap, qrFilename, type ErrorCorrection, type QrFields, type QrType } from '../utils/qrCode';

const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-qr-type]')];
const panels = [...document.querySelectorAll<HTMLElement>('[data-fields]')];
const preview = document.querySelector<HTMLElement>('#qr-preview');
const empty = document.querySelector<HTMLElement>('#qr-empty');
const error = document.querySelector<HTMLElement>('#qr-error');
const status = document.querySelector<HTMLElement>('#qr-status');
const foreground = document.querySelector<HTMLInputElement>('#qr-foreground');
const background = document.querySelector<HTMLInputElement>('#qr-background');
const correction = document.querySelector<HTMLSelectElement>('#qr-correction');
const size = document.querySelector<HTMLSelectElement>('#qr-size');
const pngButton = document.querySelector<HTMLButtonElement>('#download-png');
const svgButton = document.querySelector<HTMLButtonElement>('#download-svg');
const copyButton = document.querySelector<HTMLButtonElement>('#copy-qr');
const resetButton = document.querySelector<HTMLButtonElement>('#qr-reset');
const wifiSecurity = document.querySelector<HTMLSelectElement>('#wifi-security');
const wifiPasswordField = document.querySelector<HTMLElement>('#wifi-password-field');
let activeType: QrType = 'url';
let currentPayload = '';
let currentSvg = '';
let renderToken = 0;

function activePanel(): HTMLElement | undefined { return panels.find((panel) => panel.dataset.fields === activeType); }
function fields(): QrFields {
	const result: QrFields = {};
	activePanel()?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((input) => { result[input.name] = input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked : input.value; });
	return result;
}
function options() {
	return { errorCorrectionLevel: errorCorrectionMap[(correction?.value ?? 'medium') as ErrorCorrection], width: Number(size?.value ?? 384), margin: 3, color: { dark: foreground?.value ?? '#0f172a', light: background?.value ?? '#ffffff' } };
}
function setActions(enabled: boolean) { [pngButton, svgButton, copyButton].forEach((button) => { if (button) button.disabled = !enabled; }); }
function showError(message: string) { if (error) { error.textContent = message; error.classList.toggle('hidden', !message); } }
function setStatus(message: string) { if (status) status.textContent = message; }
function clearPreview(message = '') { currentPayload = ''; currentSvg = ''; preview?.classList.add('hidden'); if (preview) preview.replaceChildren(); empty?.classList.remove('hidden'); setActions(false); showError(message); }

async function render() {
	const token = ++renderToken;
	setStatus('');
	const result = buildQrPayload(activeType, fields());
	if (!result.payload) { clearPreview(result.error); return; }
	try {
		const svg = await QRCode.toString(result.payload, { ...options(), type: 'svg' });
		if (token !== renderToken) return;
		currentPayload = result.payload; currentSvg = svg;
		const documentSvg = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
		preview?.replaceChildren(document.importNode(documentSvg, true));
		preview?.classList.remove('hidden'); empty?.classList.add('hidden'); showError(''); setActions(true);
	} catch { clearPreview('This content is too large for the selected QR settings. Try shorter content or higher error correction capacity.'); }
}
function selectType(type: QrType, focus = false) {
	activeType = type;
	tabs.forEach((tab) => { const selected = tab.dataset.qrType === type; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; if (selected && focus) tab.focus(); });
	panels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.fields !== type));
	void render();
}
function updateWifiPassword() { const open = wifiSecurity?.value === 'nopass'; wifiPasswordField?.classList.toggle('hidden', open); const input = wifiPasswordField?.querySelector<HTMLInputElement>('input'); if (input) input.disabled = open; }
async function pngBlob(): Promise<Blob> {
	const canvas = document.createElement('canvas');
	await QRCode.toCanvas(canvas, currentPayload, options());
	return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG creation failed')), 'image/png'));
}
function download(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }

tabs.forEach((tab, index) => {
	tab.addEventListener('click', () => selectType(tab.dataset.qrType as QrType));
	tab.addEventListener('keydown', (event) => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; selectType(tabs[next].dataset.qrType as QrType, true); });
});
panels.forEach((panel) => { panel.addEventListener('input', () => void render()); panel.addEventListener('change', () => { updateWifiPassword(); void render(); }); });
[foreground, background, correction, size].forEach((input) => { input?.addEventListener('input', () => void render()); input?.addEventListener('change', () => void render()); });
pngButton?.addEventListener('click', async () => { try { download(await pngBlob(), qrFilename('png')); setStatus('PNG downloaded.'); } catch { setStatus('The PNG could not be downloaded. Please try again.'); } });
svgButton?.addEventListener('click', () => { try { download(new Blob([currentSvg], { type: 'image/svg+xml' }), qrFilename('svg')); setStatus('SVG downloaded.'); } catch { setStatus('The SVG could not be downloaded. Please try again.'); } });
copyButton?.addEventListener('click', async () => { try { if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': await pngBlob() })]); setStatus('QR image copied.'); } catch { setStatus('Image copying is not supported here. Download the PNG instead.'); } });
resetButton?.addEventListener('click', () => { panels.forEach((panel) => panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((input) => { if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = false; else if (input instanceof HTMLSelectElement) input.selectedIndex = 0; else input.value = ''; })); if (foreground) foreground.value = '#0f172a'; if (background) background.value = '#ffffff'; if (correction) correction.value = 'medium'; if (size) size.value = '384'; updateWifiPassword(); selectType('url'); setStatus('Reset complete.'); });
updateWifiPassword(); clearPreview();
