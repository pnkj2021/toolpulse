import { CronError, describeCron, getNextRuns, parseCron, type CronMode } from '../utils/cron';
const input = document.querySelector<HTMLInputElement>('#cron-input')!;
const validation = document.querySelector<HTMLElement>('#cron-validation')!;
const explanation = document.querySelector<HTMLElement>('#cron-explanation')!;
const fields = [...document.querySelectorAll<HTMLElement>('[data-cron-field]')];
const runs = document.querySelector<HTMLOListElement>('#next-runs')!;
const runsError = document.querySelector<HTMLElement>('#runs-error')!;
const status = document.querySelector<HTMLElement>('#cron-status');
let mode: CronMode = 'local';

function render() {
	validation.className = 'validation-message'; runsError.hidden = true;
	try {
		const schedule = parseCron(input.value); input.setAttribute('aria-invalid', 'false'); validation.classList.add('valid'); validation.textContent = '✓ Valid cron expression'; explanation.textContent = describeCron(schedule);
		fields.forEach((card) => { const field = schedule[card.dataset.cronField! as keyof typeof schedule] as { raw: string; description: string }; card.hidden = false; card.querySelector('strong')!.textContent = field.raw; card.querySelector('p')!.textContent = field.description; });
		const next = getNextRuns(schedule, new Date(), 5, mode); runs.replaceChildren();
		if (!next.length) { runsError.hidden = false; runsError.textContent = 'No upcoming run could be found within the supported 8-year search range.'; }
		else { const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium', ...(mode === 'utc' ? { timeZone: 'UTC' } : {}) }); next.forEach((date) => { const item = document.createElement('li'); item.textContent = `${formatter.format(date)}${mode === 'utc' ? ' UTC' : ''}`; runs.append(item); }); }
	} catch (reason) {
		input.setAttribute('aria-invalid', 'true'); validation.classList.add('invalid'); validation.textContent = reason instanceof CronError ? reason.message : 'Invalid cron expression.'; explanation.textContent = 'Correct the expression to see its explanation.'; fields.forEach((card) => { card.hidden = true; }); runs.replaceChildren();
	}
}
input.addEventListener('input', render);
document.querySelectorAll<HTMLButtonElement>('[data-time-mode]').forEach((button) => button.addEventListener('click', () => { mode = button.dataset.timeMode as CronMode; document.querySelectorAll<HTMLButtonElement>('[data-time-mode]').forEach((item) => { const selected = item === button; item.setAttribute('aria-pressed', String(selected)); item.classList.toggle('toggle-active', selected); }); document.querySelector('#runs-mode')!.textContent = mode === 'utc' ? 'UTC' : 'Local Time'; render(); }));
document.querySelector<HTMLSelectElement>('#cron-preset')?.addEventListener('change', (event) => { const value = (event.target as HTMLSelectElement).value; if (value) { input.value = value; render(); input.focus(); } });
document.querySelector<HTMLButtonElement>('#reset-cron')?.addEventListener('click', () => { input.value = '*/15 9-17 * * 1-5'; render(); input.focus(); });
document.querySelector<HTMLButtonElement>('#copy-cron')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(input.value.trim()); if (status) status.textContent = 'Cron expression copied.'; } catch { if (status) status.textContent = 'Clipboard permission was not granted.'; } });
const query = new URLSearchParams(location.search).get('cron'); if (query !== null) input.value = query; render();
