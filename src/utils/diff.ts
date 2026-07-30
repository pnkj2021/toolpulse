export type DiffOptions = {
	ignoreWhitespace: boolean;
	ignoreCase: boolean;
	ignoreBlankLines: boolean;
	ignoreLineEndings: boolean;
};

export type Resolution = 'left' | 'right' | 'both';
export type DiffBlockType = 'equal' | 'added' | 'removed' | 'changed';

export type DiffBlock = {
	id: string;
	type: DiffBlockType;
	leftStartLine: number | null;
	rightStartLine: number | null;
	leftLines: string[];
	rightLines: string[];
	resolution?: Resolution;
};

export type DiffSummary = {
	addedLines: number;
	removedLines: number;
	changedBlocks: number;
	unchangedLines: number;
	similarity: number;
};

type LineUnit = {
	comparable: string;
	lines: string[];
	startLine: number;
};

type Edit = {
	type: 'equal' | 'insert' | 'delete';
	left?: LineUnit;
	right?: LineUnit;
};

// Myers is fast for normal text (where the edit distance is small), but retaining
// every frontier becomes expensive for two very large, completely unrelated inputs.
// Past this edit-distance bound we intentionally return one replacement block so the
// browser stays responsive instead of attempting an unbounded quadratic trace.
const MAX_MYERS_DEPTH = 2_000;

export const defaultDiffOptions: DiffOptions = {
	ignoreWhitespace: false,
	ignoreCase: false,
	ignoreBlankLines: false,
	ignoreLineEndings: true,
};

function splitLines(text: string, ignoreLineEndings: boolean): string[] {
	if (!text) return [];
	return ignoreLineEndings ? text.replace(/\r\n?/gu, '\n').split('\n') : text.split('\n');
}

function normalizeLine(line: string, options: DiffOptions): string {
	let normalized = line;
	if (options.ignoreWhitespace) normalized = normalized.replace(/\s+/gu, ' ').trim();
	if (options.ignoreCase) normalized = normalized.toLocaleLowerCase();
	return normalized;
}

function createUnits(text: string, options: DiffOptions): LineUnit[] {
	const lines = splitLines(text, options.ignoreLineEndings);
	if (!options.ignoreBlankLines) {
		return lines.map((line, index) => ({
			comparable: normalizeLine(line, options),
			lines: [line],
			startLine: index + 1,
		}));
	}

	const units: LineUnit[] = [];
	let pending: string[] = [];
	let pendingStart = 1;
	lines.forEach((line, index) => {
		if (!line.trim()) {
			if (pending.length === 0) pendingStart = index + 1;
			pending.push(line);
			return;
		}
		const payload = [...pending, line];
		units.push({
			comparable: normalizeLine(line, options),
			lines: payload,
			startLine: pending.length ? pendingStart : index + 1,
		});
		pending = [];
	});

	if (pending.length) {
		units.push({
			comparable: '\u0000YBS_DIFF_EOF\u0000',
			lines: pending,
			startLine: pendingStart,
		});
	}
	return units;
}

function backtrack(
	trace: Map<number, number>[],
	left: LineUnit[],
	right: LineUnit[],
): Edit[] {
	let x = left.length;
	let y = right.length;
	const edits: Edit[] = [];

	for (let depth = trace.length - 1; depth >= 0; depth--) {
		const diagonal = x - y;
		const previous = trace[depth];
		const previousDiagonal =
			diagonal === -depth ||
			(diagonal !== depth && (previous.get(diagonal - 1) ?? -1) < (previous.get(diagonal + 1) ?? -1))
				? diagonal + 1
				: diagonal - 1;
		const previousX = previous.get(previousDiagonal) ?? 0;
		const previousY = previousX - previousDiagonal;

		while (x > previousX && y > previousY) {
			edits.push({ type: 'equal', left: left[x - 1], right: right[y - 1] });
			x--;
			y--;
		}
		if (depth === 0) break;
		if (x === previousX) {
			edits.push({ type: 'insert', right: right[y - 1] });
			y--;
		} else {
			edits.push({ type: 'delete', left: left[x - 1] });
			x--;
		}
	}
	return edits.reverse();
}

function myers(left: LineUnit[], right: LineUnit[]): Edit[] {
	const maximum = left.length + right.length;
	if (maximum > MAX_MYERS_DEPTH) {
		return [
			...left.map((line): Edit => ({ type: 'delete', left: line })),
			...right.map((line): Edit => ({ type: 'insert', right: line })),
		];
	}
	let frontier = new Map<number, number>([[1, 0]]);
	const trace: Map<number, number>[] = [];

	for (let depth = 0; depth <= maximum; depth++) {
		trace.push(new Map(frontier));
		const next = new Map<number, number>();
		for (let diagonal = -depth; diagonal <= depth; diagonal += 2) {
			let x =
				diagonal === -depth ||
				(diagonal !== depth && (frontier.get(diagonal - 1) ?? -1) < (frontier.get(diagonal + 1) ?? -1))
					? frontier.get(diagonal + 1) ?? 0
					: (frontier.get(diagonal - 1) ?? 0) + 1;
			let y = x - diagonal;
			while (
				x < left.length &&
				y < right.length &&
				left[x].comparable === right[y].comparable
			) {
				x++;
				y++;
			}
			next.set(diagonal, x);
			if (x >= left.length && y >= right.length) {
				return backtrack(trace, left, right);
			}
		}
		frontier = next;
	}
	return [];
}

function diffUnits(left: LineUnit[], right: LineUnit[]): Edit[] {
	let prefixLength = 0;
	while (
		prefixLength < left.length &&
		prefixLength < right.length &&
		left[prefixLength].comparable === right[prefixLength].comparable
	) {
		prefixLength++;
	}

	let suffixLength = 0;
	while (
		suffixLength < left.length - prefixLength &&
		suffixLength < right.length - prefixLength &&
		left[left.length - suffixLength - 1].comparable === right[right.length - suffixLength - 1].comparable
	) {
		suffixLength++;
	}

	const prefix = left.slice(0, prefixLength).map((line, index): Edit => ({
		type: 'equal',
		left: line,
		right: right[index],
	}));
	const middle = myers(
		left.slice(prefixLength, left.length - suffixLength),
		right.slice(prefixLength, right.length - suffixLength),
	);
	const suffix = left.slice(left.length - suffixLength).map((line, index): Edit => ({
		type: 'equal',
		left: line,
		right: right[right.length - suffixLength + index],
	}));
	return [...prefix, ...middle, ...suffix];
}

function flatten(units: LineUnit[]): string[] {
	return units.flatMap((unit) => unit.lines);
}

export function compareText(
	leftText: string,
	rightText: string,
	options: DiffOptions = defaultDiffOptions,
): DiffBlock[] {
	if (!leftText && !rightText) return [];
	const edits = diffUnits(createUnits(leftText, options), createUnits(rightText, options));
	const blocks: DiffBlock[] = [];
	let index = 0;

	while (index < edits.length) {
		const edit = edits[index];
		if (edit.type === 'equal') {
			const equalEdits: Edit[] = [];
			while (edits[index]?.type === 'equal') equalEdits.push(edits[index++]);
			const leftUnits = equalEdits.flatMap((item) => (item.left ? [item.left] : []));
			const rightUnits = equalEdits.flatMap((item) => (item.right ? [item.right] : []));
			blocks.push({
				id: `equal-${blocks.length}`,
				type: 'equal',
				leftStartLine: leftUnits[0]?.startLine ?? null,
				rightStartLine: rightUnits[0]?.startLine ?? null,
				leftLines: flatten(leftUnits),
				rightLines: flatten(rightUnits),
			});
			continue;
		}

		const changedEdits: Edit[] = [];
		while (edits[index] && edits[index].type !== 'equal') changedEdits.push(edits[index++]);
		const leftUnits = changedEdits.flatMap((item) => (item.left ? [item.left] : []));
		const rightUnits = changedEdits.flatMap((item) => (item.right ? [item.right] : []));
		const type: DiffBlockType =
			leftUnits.length && rightUnits.length ? 'changed' : leftUnits.length ? 'removed' : 'added';
		blocks.push({
			id: `difference-${blocks.filter((block) => block.type !== 'equal').length}`,
			type,
			leftStartLine: leftUnits[0]?.startLine ?? null,
			rightStartLine: rightUnits[0]?.startLine ?? null,
			leftLines: flatten(leftUnits),
			rightLines: flatten(rightUnits),
		});
	}
	return blocks;
}

export function summarizeDiff(blocks: DiffBlock[]): DiffSummary {
	let addedLines = 0;
	let removedLines = 0;
	let unchangedLines = 0;
	let changedBlocks = 0;

	for (const block of blocks) {
		if (block.type === 'equal') {
			unchangedLines += Math.max(block.leftLines.length, block.rightLines.length);
		} else {
			changedBlocks++;
			addedLines += block.rightLines.length;
			removedLines += block.leftLines.length;
		}
	}
	const total = unchangedLines + addedLines + removedLines;
	return {
		addedLines,
		removedLines,
		changedBlocks,
		unchangedLines,
		similarity: total === 0 ? 100 : Math.round((unchangedLines / total) * 100),
	};
}
