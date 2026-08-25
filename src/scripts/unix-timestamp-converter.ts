import { datePartsToTimestamp, detectTimestampUnit, formatRelativeTime, parseIntegerTimestamp, timestampToDate, type TimestampMode, type TimezoneInterpretation } from '../utils/timestamp';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const input = byId<HTMLInputElement>('timestamp-input');
const error = byId<HTMLElement>('timestamp-error');
const results = byId<HTMLElement>('timestamp-results');
const detected = byId<HTMLElement>('detected-unit');
const liveStatus = byId<HTMLElement>('copy-status');
const unitButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-unit]')];
let mode: TimestampMode = 'auto';

function setText(id: string, value: string) { const element = byId<HTMLElement>(id); if (element) element.textContent = value; }
function setCopyEnabled(group: string, enabled: boolean) { document.querySelectorAll<HTMLButtonElement>(`[data-copy="${group}"]`).forEach((button) => { button.disabled = !enabled; }); }

function renderTimestamp() {
	if (!input || !error || !results || !detected) return;
	const parsed = parseIntegerTimestamp(input.value);
	error.classList.add('hidden'); input.removeAttribute('aria-invalid');
	if (parsed === null) {
		results.classList.add('hidden'); detected.textContent = input.value.trim() ? 'Detected: —' : 'Detected: Seconds or milliseconds';
		if (input.value.trim()) { error.textContent = 'Invalid Unix timestamp'; error.classList.remove('hidden'); input.setAttribute('aria-invalid', 'true'); }
		setCopyEnabled('timestamp-result', false); return;
	}
	const unit = mode === 'auto' ? detectTimestampUnit(parsed) : mode;
	detected.textContent = unit === 'ambiguous' ? 'Detected: Ambiguous — choose Seconds or Milliseconds' : `Detected: ${unit === 'seconds' ? 'Seconds' : 'Milliseconds'}`;
	try {
		const conversion = timestampToDate(input.value, mode);
		const local = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'medium' }).format(conversion.date);
		const utc = new Intl.DateTimeFormat(undefined, {
			year: 'numeric', month: 'long', day: 'numeric',
			hour: 'numeric', minute: '2-digit', second: '2-digit',
			timeZone: 'UTC', timeZoneName: 'short',
		}).format(conversion.date);
		setText('result-local', local); setText('result-utc', utc); setText('result-iso', conversion.date.toISOString());
		setText('result-seconds', String(conversion.seconds)); setText('result-milliseconds', String(conversion.milliseconds));
		setText('result-relative', formatRelativeTime(conversion.milliseconds));
		results.classList.remove('hidden'); setCopyEnabled('timestamp-result', true);
	} catch (reason) {
		results.classList.add('hidden'); setCopyEnabled('timestamp-result', false); input.setAttribute('aria-invalid', 'true');
		error.textContent = reason instanceof Error ? reason.message : 'Invalid Unix timestamp'; error.classList.remove('hidden');
	}
}

unitButtons.forEach((button) => button.addEventListener('click', () => {
	mode = button.dataset.unit as TimestampMode;
	unitButtons.forEach((item) => { const selected = item === button; item.setAttribute('aria-pressed', String(selected)); item.classList.toggle('unit-active', selected); });
	renderTimestamp();
}));
input?.addEventListener('input', renderTimestamp);

function pad(value: number) { return String(value).padStart(2, '0'); }
function populateNow() {
	const now = new Date();
	const date = byId<HTMLInputElement>('date-input'); const time = byId<HTMLInputElement>('time-input');
	if (date) date.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	if (time) time.value = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
	renderDate();
}

function renderDate() {
	const dateInput = byId<HTMLInputElement>('date-input'); const timeInput = byId<HTMLInputElement>('time-input');
	const timezone = byId<HTMLSelectElement>('timezone-input'); const dateError = byId<HTMLElement>('date-error'); const dateResults = byId<HTMLElement>('date-results');
	if (!dateInput || !timeInput || !timezone || !dateError || !dateResults) return;
	dateError.classList.add('hidden'); dateInput.removeAttribute('aria-invalid'); timeInput.removeAttribute('aria-invalid');
	const dateMatch = /^(\d{4,})-(\d{2})-(\d{2})$/u.exec(dateInput.value); const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(timeInput.value);
	if (!dateMatch || !timeMatch) { dateResults.classList.add('hidden'); setCopyEnabled('date-result', false); return; }
	try {
		const conversion = datePartsToTimestamp({ year: Number(dateMatch[1]), month: Number(dateMatch[2]), day: Number(dateMatch[3]), hour: Number(timeMatch[1]), minute: Number(timeMatch[2]), second: Number(timeMatch[3] ?? 0) }, timezone.value as TimezoneInterpretation);
		setText('date-seconds', String(conversion.seconds)); setText('date-milliseconds', String(conversion.milliseconds)); setText('date-iso', conversion.date.toISOString());
		dateResults.classList.remove('hidden'); setCopyEnabled('date-result', true);
	} catch (reason) {
		dateResults.classList.add('hidden'); setCopyEnabled('date-result', false); dateInput.setAttribute('aria-invalid', 'true'); timeInput.setAttribute('aria-invalid', 'true');
		dateError.textContent = reason instanceof Error ? reason.message : 'Invalid date or time.'; dateError.classList.remove('hidden');
	}
}
['date-input', 'time-input', 'timezone-input'].forEach((id) => byId<HTMLElement>(id)?.addEventListener('input', renderDate));
byId<HTMLButtonElement>('use-current-time')?.addEventListener('click', populateNow);
byId<HTMLButtonElement>('clear-date')?.addEventListener('click', () => { const d = byId<HTMLInputElement>('date-input'); const t = byId<HTMLInputElement>('time-input'); if (d) d.value = ''; if (t) t.value = ''; renderDate(); d?.focus(); });

document.addEventListener('click', async (event) => {
	const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-copy-value]'); if (!button) return;
	const target = byId<HTMLElement>(button.dataset.copyValue ?? ''); if (!target) return;
	try { await navigator.clipboard.writeText(target.textContent ?? ''); if (liveStatus) liveStatus.textContent = `${button.getAttribute('aria-label') ?? 'Value'} copied to clipboard.`; }
	catch { if (liveStatus) liveStatus.textContent = 'Clipboard permission was not granted.'; }
});

function updateCurrent() { const seconds = String(Math.floor(Date.now() / 1000)); setText('current-timestamp', seconds); }
updateCurrent(); window.setInterval(updateCurrent, 1000);

const query = new URLSearchParams(window.location.search).get('timestamp');
if (query !== null && input) input.value = query;
renderTimestamp(); populateNow();
