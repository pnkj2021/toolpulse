import { compareText, defaultDiffOptions, summarizeDiff, type DiffBlock, type DiffOptions, type Resolution } from '../utils/diff';
import { mergeBlocks, resolveAll, type ResolutionMap } from '../utils/merge';

const get = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
const leftInput = get<HTMLTextAreaElement>('#original-text');
const rightInput = get<HTMLTextAreaElement>('#modified-text');
const mergedResult = get<HTMLTextAreaElement>('#merged-result');
const blocksElement = get<HTMLElement>('#diff-blocks');
const emptyElement = get<HTMLElement>('#diff-empty');
const positionElement = get<HTMLElement>('#difference-position');
const liveStatus = get<HTMLElement>('#diff-live-status');

let blocks: DiffBlock[] = [];
let resolutions: ResolutionMap = {};
let currentDifference = 0;
let debounceTimer: number | undefined;

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

function options(): DiffOptions {
	return {
		ignoreWhitespace: get<HTMLInputElement>('#ignore-whitespace')?.checked ?? false,
		ignoreCase: get<HTMLInputElement>('#ignore-case')?.checked ?? false,
		ignoreBlankLines: get<HTMLInputElement>('#ignore-blank-lines')?.checked ?? false,
		ignoreLineEndings: get<HTMLInputElement>('#ignore-line-endings')?.checked ?? defaultDiffOptions.ignoreLineEndings,
	};
}

function numberedLines(lines: string[], start: number | null, side: 'left' | 'right', maxVisible = 500): string {
	if (!lines.length) return '<div class="diff-line diff-line-empty"><span aria-hidden="true">—</span><code>No line</code></div>';
	const visibleIndexes = lines.length <= maxVisible
		? lines.map((_, index) => index)
		: [
			...Array.from({ length: Math.floor(maxVisible / 2) }, (_, index) => index),
			...Array.from({ length: Math.ceil(maxVisible / 2) }, (_, index) => lines.length - Math.ceil(maxVisible / 2) + index),
		];
	const midpoint = Math.floor(visibleIndexes.length / 2);
	return visibleIndexes.map((lineIndex, visibleIndex) => {
		const omitted = visibleIndex === midpoint && lines.length > maxVisible
			? `<div class="diff-omitted" role="note">… ${lines.length - maxVisible} lines hidden for performance …</div>`
			: '';
		const line = lines[lineIndex];
		const number = start === null ? '—' : start + lineIndex;
		return `${omitted}<div class="diff-line"><span aria-hidden="true">${number}</span><code>${escapeHtml(line) || '&nbsp;'}</code><span class="sr-only">${side === 'left' ? 'Original' : 'Modified'} line ${number}</span></div>`;
	}).join('');
}

function blockLabel(block: DiffBlock): string {
	if (block.type === 'added') return 'Added';
	if (block.type === 'removed') return 'Removed';
	if (block.type === 'changed') return 'Modified';
	return 'Unchanged';
}

function resolvedLines(block: DiffBlock): string[] {
	const resolution = resolutions[block.id] ?? 'left';
	if (block.type === 'equal') return block.rightLines;
	if (resolution === 'right') return block.rightLines;
	if (resolution === 'both') return [...block.leftLines, ...block.rightLines];
	return block.leftLines;
}

function mergedPreview(block: DiffBlock): string {
	const lines = resolvedLines(block);
	return `<div class="diff-result-title">Merged preview</div>${numberedLines(lines, null, 'right', block.type === 'equal' ? 12 : 500)}`;
}

function renderBlocks() {
	if (!blocksElement || !emptyElement) return;
	const changedBlocks = blocks.filter((block) => block.type !== 'equal');
	if (!blocks.length || !changedBlocks.length) {
		blocksElement.classList.add('hidden');
		emptyElement.classList.remove('hidden');
		emptyElement.textContent = !leftInput?.value && !rightInput?.value
			? 'Enter text in either editor to begin comparing.'
			: 'No differences found. The texts are identical with the selected comparison options.';
		return;
	}
	blocksElement.classList.remove('hidden');
	emptyElement.classList.add('hidden');
	blocksElement.innerHTML = blocks.map((block) => {
		const changed = block.type !== 'equal';
		const resolution = resolutions[block.id];
		return `<article id="${block.id}" class="diff-block diff-${block.type}${resolution ? ` diff-resolved-${resolution}` : ''}" data-difference="${changed ? 'true' : 'false'}" ${changed ? 'tabindex="-1"' : ''} aria-label="${blockLabel(block)} block">
			<div class="diff-block-heading">
				<span class="diff-label"><span aria-hidden="true">${block.type === 'added' ? '+' : block.type === 'removed' ? '−' : block.type === 'changed' ? '±' : '='}</span>${blockLabel(block)}${changed ? ` <span class="diff-resolution-status" data-resolution-status="${block.id}">${resolution ? `Using ${resolution === 'left' ? 'original' : resolution === 'right' ? 'modified' : 'both'}` : 'Unresolved — using original'}</span>` : ''}</span>
				${changed ? `<div class="diff-resolutions" role="group" aria-label="Resolve ${blockLabel(block).toLowerCase()} block">
					<button type="button" data-resolve="left" data-block="${block.id}" aria-pressed="${resolution === 'left'}">Accept original</button>
					<button type="button" data-resolve="right" data-block="${block.id}" aria-pressed="${resolution === 'right'}">Accept modified</button>
					<button type="button" data-resolve="both" data-block="${block.id}" aria-pressed="${resolution === 'both'}">Accept both</button>
				</div>` : ''}
			</div>
			<div class="diff-sides">
				<div class="diff-side" aria-label="Original text">${numberedLines(block.leftLines, block.leftStartLine, 'left', block.type === 'equal' ? 12 : 500)}</div>
				<div class="diff-side" aria-label="Modified text">${numberedLines(block.rightLines, block.rightStartLine, 'right', block.type === 'equal' ? 12 : 500)}</div>
			</div>
			${changed ? `<div class="diff-result" data-merged-preview="${block.id}" aria-label="Merged preview">${mergedPreview(block)}</div>` : ''}
		</article>`;
	}).join('');
}

function updateResolutionButtons(blockId?: string) {
	blocksElement?.querySelectorAll<HTMLButtonElement>('[data-resolve]').forEach((button) => {
		if (blockId && button.dataset.block !== blockId) return;
		button.setAttribute(
			'aria-pressed',
			String(resolutions[button.dataset.block ?? ''] === button.dataset.resolve),
		);
	});
	blocksElement?.querySelectorAll<HTMLElement>('[data-resolution-status]').forEach((status) => {
		const id = status.dataset.resolutionStatus ?? '';
		if (blockId && id !== blockId) return;
		const resolution = resolutions[id];
		status.textContent = resolution
			? `Using ${resolution === 'left' ? 'original' : resolution === 'right' ? 'modified' : 'both'}`
			: 'Unresolved — using original';
	});
	blocksElement?.querySelectorAll<HTMLElement>('.diff-block[data-difference="true"]').forEach((block) => {
		if (blockId && block.id !== blockId) return;
		block.classList.remove('diff-resolved-left', 'diff-resolved-right', 'diff-resolved-both');
		const resolution = resolutions[block.id];
		if (resolution) block.classList.add(`diff-resolved-${resolution}`);
	});
	blocksElement?.querySelectorAll<HTMLElement>('[data-merged-preview]').forEach((preview) => {
		const id = preview.dataset.mergedPreview ?? '';
		if (blockId && id !== blockId) return;
		const block = blocks.find((candidate) => candidate.id === id);
		if (block) preview.innerHTML = mergedPreview(block);
	});
}

function updateMerged() {
	if (!mergedResult) return;
	mergedResult.value = mergeBlocks(blocks, resolutions);
	const hasResult = Boolean(mergedResult.value);
	const copy = get<HTMLButtonElement>('#copy-merged');
	const download = get<HTMLButtonElement>('#download-merged');
	if (copy) copy.disabled = !hasResult;
	if (download) download.disabled = !hasResult;
}

function updateSummary() {
	const summary = summarizeDiff(blocks);
	const values: Record<string, string> = {
		'#summary-added': summary.addedLines.toLocaleString(),
		'#summary-removed': summary.removedLines.toLocaleString(),
		'#summary-changed': summary.changedBlocks.toLocaleString(),
		'#summary-unchanged': summary.unchangedLines.toLocaleString(),
		'#summary-similarity': `${summary.similarity}%`,
	};
	Object.entries(values).forEach(([selector, value]) => {
		const element = get<HTMLElement>(selector);
		if (element) element.textContent = value;
	});
}

function differences(): DiffBlock[] {
	return blocks.filter((block) => block.type !== 'equal');
}

function updateNavigation(scroll = false) {
	const changed = differences();
	const previous = get<HTMLButtonElement>('#previous-difference');
	const next = get<HTMLButtonElement>('#next-difference');
	if (!changed.length) {
		if (positionElement) positionElement.textContent = 'No differences';
		if (previous) previous.disabled = true;
		if (next) next.disabled = true;
		['#accept-all-left', '#accept-all-right', '#reset-merge'].forEach((selector) => {
			const button = get<HTMLButtonElement>(selector);
			if (button) button.disabled = true;
		});
		return;
	}
	['#accept-all-left', '#accept-all-right', '#reset-merge'].forEach((selector) => {
		const button = get<HTMLButtonElement>(selector);
		if (button) button.disabled = false;
	});
	currentDifference = Math.min(Math.max(currentDifference, 0), changed.length - 1);
	if (positionElement) positionElement.textContent = `Difference ${currentDifference + 1} of ${changed.length}`;
	if (previous) previous.disabled = false;
	if (next) next.disabled = false;
	if (scroll) {
		const target = document.getElementById(changed[currentDifference].id);
		target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		target?.focus({ preventScroll: true });
	}
}

function compare() {
	blocks = compareText(leftInput?.value ?? '', rightInput?.value ?? '', options());
	resolutions = {};
	currentDifference = 0;
	renderBlocks();
	updateMerged();
	updateSummary();
	updateNavigation();
}

function scheduleCompare() {
	window.clearTimeout(debounceTimer);
	debounceTimer = window.setTimeout(compare, 180);
}

function updateEditorChrome(input: HTMLTextAreaElement | null, prefix: string) {
	if (!input) return;
	const count = input.value ? input.value.split('\n').length : 0;
	const numbers = get<HTMLElement>(`#${prefix}-numbers`);
	const countElement = get<HTMLElement>(`#${prefix}-count`);
	if (numbers) numbers.textContent = Array.from({ length: Math.max(1, count) }, (_, index) => index + 1).join('\n');
	if (countElement) countElement.textContent = `${count.toLocaleString()} ${count === 1 ? 'line' : 'lines'}`;
}

[leftInput, rightInput].forEach((input) => input?.addEventListener('input', () => {
	updateEditorChrome(input, input.id);
	scheduleCompare();
}));
[leftInput, rightInput].forEach((input) => input?.addEventListener('scroll', () => {
	const numbers = get<HTMLElement>(`#${input.id}-numbers`);
	if (numbers) numbers.scrollTop = input.scrollTop;
}));
['#ignore-whitespace', '#ignore-case', '#ignore-blank-lines', '#ignore-line-endings'].forEach((selector) =>
	get<HTMLInputElement>(selector)?.addEventListener('change', compare),
);

blocksElement?.addEventListener('click', (event) => {
	const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-resolve]');
	if (!button) return;
	const blockId = button.dataset.block ?? '';
	resolutions[blockId] = button.dataset.resolve as Resolution;
	updateResolutionButtons(blockId);
	updateMerged();
	const resolvedBlock = blocks.find((block) => block.id === blockId);
	if (liveStatus && resolvedBlock) liveStatus.textContent = `${blockLabel(resolvedBlock)} block resolved with ${button.textContent?.trim().toLowerCase()}.`;
});

get<HTMLButtonElement>('#previous-difference')?.addEventListener('click', () => {
	const count = differences().length;
	if (!count) return;
	currentDifference = (currentDifference - 1 + count) % count;
	updateNavigation(true);
});
get<HTMLButtonElement>('#next-difference')?.addEventListener('click', () => {
	const count = differences().length;
	if (!count) return;
	currentDifference = (currentDifference + 1) % count;
	updateNavigation(true);
});

function setAll(resolution: Resolution) {
	resolutions = resolveAll(blocks, resolution);
	updateResolutionButtons();
	updateMerged();
	if (liveStatus) liveStatus.textContent = `All differences now use ${resolution === 'left' ? 'original' : 'modified'} text.`;
}
get<HTMLButtonElement>('#accept-all-left')?.addEventListener('click', () => setAll('left'));
get<HTMLButtonElement>('#accept-all-right')?.addEventListener('click', () => setAll('right'));
get<HTMLButtonElement>('#reset-merge')?.addEventListener('click', () => {
	resolutions = {};
	updateResolutionButtons();
	updateMerged();
	if (liveStatus) liveStatus.textContent = 'Merge choices reset. Unresolved differences use the original text.';
});

get<HTMLButtonElement>('#copy-merged')?.addEventListener('click', async () => {
	if (!mergedResult?.value) return;
	try {
		await navigator.clipboard.writeText(mergedResult.value);
	} catch {
		mergedResult.select();
		document.execCommand('copy');
		mergedResult.setSelectionRange(0, 0);
	}
	const label = get<HTMLElement>('#copy-merged [data-button-label]');
	if (label) label.textContent = 'Copied!';
	if (liveStatus) liveStatus.textContent = 'Merged result copied to the clipboard.';
	window.setTimeout(() => { if (label) label.textContent = 'Copy'; }, 1600);
});
get<HTMLButtonElement>('#download-merged')?.addEventListener('click', () => {
	if (!mergedResult?.value) return;
	const url = URL.createObjectURL(new Blob([mergedResult.value], { type: 'text/plain;charset=utf-8' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = 'merged-result.txt';
	link.click();
	URL.revokeObjectURL(url);
});
get<HTMLButtonElement>('#clear-merged')?.addEventListener('click', () => {
	if (mergedResult) mergedResult.value = '';
	const copy = get<HTMLButtonElement>('#copy-merged');
	const download = get<HTMLButtonElement>('#download-merged');
	if (copy) copy.disabled = true;
	if (download) download.disabled = true;
	if (liveStatus) liveStatus.textContent = 'Merged result cleared. Original inputs were not changed.';
});

document.addEventListener('keydown', (event) => {
	if (!event.altKey || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
	event.preventDefault();
	get<HTMLButtonElement>(event.key === 'ArrowDown' ? '#next-difference' : '#previous-difference')?.click();
});

updateEditorChrome(leftInput, 'original-text');
updateEditorChrome(rightInput, 'modified-text');
compare();
