import type { DiffBlock, Resolution } from './diff.ts';

export type ResolutionMap = Record<string, Resolution>;

export function mergeBlocks(blocks: DiffBlock[], resolutions: ResolutionMap = {}): string {
	return blocks
		.flatMap((block) => {
			if (block.type === 'equal') return block.rightLines;
			const resolution = resolutions[block.id] ?? block.resolution ?? 'left';
			if (resolution === 'left') return block.leftLines;
			if (resolution === 'both') return [...block.leftLines, ...block.rightLines];
			return block.rightLines;
		})
		.join('\n');
}

export function resolveAll(blocks: DiffBlock[], resolution: Resolution): ResolutionMap {
	return Object.fromEntries(
		blocks.filter((block) => block.type !== 'equal').map((block) => [block.id, resolution]),
	);
}

export function copyBlockToSide(
	blocks: DiffBlock[],
	blockId: string,
	direction: 'left-to-right' | 'right-to-left',
): string {
	const targetDefault: Resolution = direction === 'left-to-right' ? 'right' : 'left';
	const copiedSource: Resolution = direction === 'left-to-right' ? 'left' : 'right';
	const resolutions = Object.fromEntries(
		blocks
			.filter((block) => block.type !== 'equal')
			.map((block) => [block.id, block.id === blockId ? copiedSource : targetDefault]),
	) as ResolutionMap;
	return mergeBlocks(blocks, resolutions);
}
