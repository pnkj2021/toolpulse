import { calculateRegexStats, findMatches, formatRegex, MAX_REGEX_INPUT_LENGTH, replaceMatches, validateRegex, type RegexMatch } from '../utils/regex';

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const patternInput = $<HTMLInputElement>('#regex-pattern');
const textInput = $<HTMLTextAreaElement>('#test-text');
const replacementInput = $<HTMLInputElement>('#replacement');
let matches: RegexMatch[] = [];
let selectedIndex = 0;
let timer: number | undefined;

const examples: Record<string, { pattern: string; flags: string; text: string; replacement?: string }> = {
	email: { pattern: '(?<user>[A-Za-z0-9._%+-]+)@(?<domain>[A-Za-z0-9.-]+\\.[A-Za-z]{2,})', flags: 'gi', text: 'Contact alex@example.com or sam@example.org.\nBackup email: developer@ybstools.com.\nInvalid examples: hello@ and @example.com.' },
	url: { pattern: 'https?://[^\\s]+', flags: 'gi', text: 'Docs: https://ybstools.com/tools/regex-tester/ and http://example.test.' },
	numbers: { pattern: '-?\\d+(?:\\.\\d+)?', flags: 'g', text: 'Temperatures: -4, 18.5, and 27 degrees.' },
	date: { pattern: '\\b\\d{4}-\\d{2}-\\d{2}\\b', flags: 'g', text: 'Dates: 2026-08-24 and 2027-01-05.' },
	hashtag: { pattern: '#[A-Za-z0-9_]+', flags: 'g', text: 'Topics: #JavaScript #Regex #YBS.' },
	whitespace: { pattern: '\\s+', flags: 'g', text: 'Tabs\tspaces   and\nnewlines.' },
	repeated: { pattern: '\\b(\\w+)\\s+\\1\\b', flags: 'gi', text: 'This is is a repeated repeated word example.' },
};

function flags(): string { return [...document.querySelectorAll<HTMLInputElement>('[data-flag]:checked')].map((input) => input.dataset.flag).join(''); }
function element(tag: string, text?: string, className?: string): HTMLElement { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function setError(message?: string) { const box = $('#regex-error'); box.classList.toggle('hidden', !message); box.textContent = message ? `Invalid regular expression — ${message}` : ''; }
function setMode(mode: 'test' | 'replace') { const replace = mode === 'replace'; $('#replacement-panel').classList.toggle('hidden', !replace); $('#test-mode').setAttribute('aria-selected', String(!replace)); $('#replace-mode').setAttribute('aria-selected', String(replace)); }

async function copyText(value: string, button?: HTMLButtonElement) {
	try { await navigator.clipboard.writeText(value); }
	catch { const textarea = document.createElement('textarea'); textarea.value = value; textarea.style.position = 'fixed'; textarea.style.opacity = '0'; document.body.append(textarea); textarea.select(); document.execCommand('copy'); textarea.remove(); }
	if (button) { const label = button.textContent; button.textContent = 'Copied!'; window.setTimeout(() => { button.textContent = label; }, 1200); }
}

function renderPreview() {
	const preview = $('#highlight-preview'); preview.replaceChildren();
	const text = textInput.value;
	if (!text) { preview.textContent = 'Matches will be highlighted here.'; return; }
	if (!matches.length) { preview.append(document.createTextNode(text)); return; }
	let cursor = 0;
	matches.forEach((match, index) => {
		if (match.index > cursor) preview.append(document.createTextNode(text.slice(cursor, match.index)));
		const mark = element('mark', match.value || '​', 'match-highlight');
		mark.dataset.matchIndex = String(index); mark.dataset.selected = String(index === selectedIndex);
		mark.setAttribute('aria-label', match.value ? `Match ${index + 1}: ${match.value}` : `Zero-length match ${index + 1}`);
		preview.append(mark); cursor = Math.max(cursor, match.end);
	});
	preview.append(document.createTextNode(text.slice(cursor)));
}

function renderDetail() {
	const detail = $('#match-detail'); detail.replaceChildren(); const match = matches[selectedIndex]; if (!match) return;
	const top = element('div'); top.append(element('p', `MATCH ${selectedIndex + 1}`, 'text-xs font-bold tracking-wide text-blue-600'), element('h3', match.value || '(zero-length match)', 'mt-1 break-all font-mono text-base font-bold'));
	const copy = element('button', 'Copy Match', 'button-secondary mt-3') as HTMLButtonElement; copy.type = 'button'; copy.onclick = () => copyText(match.value, copy); top.append(copy); detail.append(top);
	const positions = element('section', undefined, 'detail-block text-sm'); positions.append(element('p', `Start: ${match.index} · End: ${match.end} · Length: ${match.value.length}`, 'text-slate-600 dark:text-slate-300')); detail.append(positions);
	if (match.groups.length) { const groups = element('section', undefined, 'detail-block'); groups.append(element('h4', `Capture Groups (${match.groups.length})`, 'text-sm font-bold')); match.groups.forEach((value, index) => { const row = element('div', undefined, 'mt-2 grid grid-cols-[auto_1fr] gap-3 text-sm'); row.append(element('span', `Group ${index + 1}`, 'text-slate-500'), element('code', value === undefined ? 'Not matched' : value, 'min-w-0 break-all')); groups.append(row); }); detail.append(groups); }
	const named = Object.entries(match.namedGroups); if (named.length) { const section = element('section', undefined, 'detail-block'); section.append(element('h4', 'Named Groups', 'text-sm font-bold')); named.forEach(([name, value]) => { const row = element('div', undefined, 'mt-2 grid grid-cols-[auto_1fr] gap-3 text-sm'); row.append(element('span', name, 'font-semibold text-slate-500'), element('code', value === undefined ? 'Not matched' : value, 'min-w-0 break-all')); section.append(row); }); detail.append(section); }
}

function selectMatch(index: number) { if (!matches.length) return; selectedIndex = (index + matches.length) % matches.length; renderPreview(); renderMatchList(); renderDetail(); $('#match-position').textContent = `${selectedIndex + 1} / ${matches.length}`; document.querySelector<HTMLElement>(`[data-match-index="${selectedIndex}"]`)?.scrollIntoView({ block: 'nearest' }); }
function renderMatchList() { const list = $('#match-list'); list.replaceChildren(); matches.forEach((match, index) => { const button = element('button', undefined, 'match-row') as HTMLButtonElement; button.type = 'button'; button.setAttribute('aria-selected', String(index === selectedIndex)); button.append(element('span', String(index + 1), 'w-6 shrink-0 text-right font-bold text-slate-400'), element('span', match.value || '(zero-length)', 'min-w-0 truncate font-mono')); button.onclick = () => selectMatch(index); list.append(button); }); }

function renderReplacement(valid: boolean) { const output = $('#replacement-preview'); if (!valid || !patternInput.value || textInput.value.length > MAX_REGEX_INPUT_LENGTH) { output.textContent = ''; return; } try { output.textContent = replaceMatches(patternInput.value, flags(), textInput.value, replacementInput.value); } catch { output.textContent = ''; } }

function evaluate() {
	const pattern = patternInput.value; const text = textInput.value; const activeFlags = flags();
	$('#inline-flags').textContent = activeFlags; $('#effective-regex').textContent = formatRegex(pattern, activeFlags); $('#text-count').textContent = `${text.length.toLocaleString()} / ${MAX_REGEX_INPUT_LENGTH.toLocaleString()} characters`;
	const validation = validateRegex(pattern, activeFlags);
	if (!validation.valid) { setError(validation.error); matches = []; renderResults(false); renderReplacement(false); return; }
	if (text.length > MAX_REGEX_INPUT_LENGTH) { setError(`Test text exceeds the ${MAX_REGEX_INPUT_LENGTH.toLocaleString()}-character local limit.`); matches = []; renderResults(false); renderReplacement(false); return; }
	setError();
	if (!pattern) { matches = []; renderResults(false); renderReplacement(true); return; }
	try { const evaluation = findMatches(pattern, activeFlags, text); matches = evaluation.matches; selectedIndex = Math.min(selectedIndex, Math.max(0, matches.length - 1)); renderResults(true, evaluation.truncated); renderReplacement(true); }
	catch (error) { setError(error instanceof Error ? error.message : String(error)); matches = []; renderResults(false); renderReplacement(false); }
}

function renderResults(evaluated: boolean, truncated = false) {
	const empty = $('#result-empty'); const content = $('#result-content'); const stats = calculateRegexStats(matches, textInput.value); $('#match-count').textContent = String(stats.matches); $('#stats').textContent = `${stats.matches} Match${stats.matches === 1 ? '' : 'es'} · ${stats.groups} Group${stats.groups === 1 ? '' : 's'} · ${stats.characters.toLocaleString()} Characters${flags().includes('g') ? '' : ' · Global off: first match only'}${truncated ? ' · Results limited' : ''}`;
	const nav = $('#match-nav'); nav.classList.toggle('hidden', !matches.length); nav.classList.toggle('flex', Boolean(matches.length));
	if (!evaluated || !matches.length) { empty.classList.remove('hidden'); content.classList.add('hidden'); empty.replaceChildren(); const wrap = element('div'); wrap.append(element('p', evaluated ? 'No matches found' : 'Enter a regular expression and some test text to see matches.', 'font-semibold text-slate-700 dark:text-slate-200')); if (evaluated) wrap.append(element('p', 'Try adjusting your pattern or flags.', 'mt-1')); else { const button = element('button', 'Try an example', 'button-secondary mt-3') as HTMLButtonElement; button.id = 'try-example'; button.onclick = () => loadExample('email'); wrap.append(button); } empty.append(wrap); }
	else { empty.classList.add('hidden'); content.classList.remove('hidden'); content.classList.add('grid'); renderMatchList(); renderDetail(); $('#match-position').textContent = `${selectedIndex + 1} / ${matches.length}`; }
	renderPreview();
}

function loadExample(key: string) { const example = examples[key]; if (!example) return; patternInput.value = example.pattern; textInput.value = example.text; replacementInput.value = example.replacement ?? ''; document.querySelectorAll<HTMLInputElement>('[data-flag]').forEach((input) => { input.checked = example.flags.includes(input.dataset.flag ?? ''); }); ($('#example-select') as HTMLSelectElement).value = key; evaluate(); }
function schedule() { window.clearTimeout(timer); timer = window.setTimeout(evaluate, 220); }

[patternInput, textInput, replacementInput].forEach((input) => input.addEventListener('input', schedule)); document.querySelectorAll<HTMLInputElement>('[data-flag]').forEach((input) => input.addEventListener('change', evaluate));
$('#test-mode').addEventListener('click', () => setMode('test')); $('#replace-mode').addEventListener('click', () => setMode('replace')); $('#previous-match').addEventListener('click', () => selectMatch(selectedIndex - 1)); $('#next-match').addEventListener('click', () => selectMatch(selectedIndex + 1));
$('#copy-regex').addEventListener('click', () => copyText(formatRegex(patternInput.value, flags()), $('#copy-regex') as HTMLButtonElement)); $('#copy-replacement').addEventListener('click', () => copyText($('#replacement-preview').textContent ?? '', $('#copy-replacement') as HTMLButtonElement));
$('#example-select').addEventListener('change', (event) => loadExample((event.target as HTMLSelectElement).value));
evaluate();
