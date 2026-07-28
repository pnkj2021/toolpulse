function graphemes(value: string): string[] {
	if (typeof Intl.Segmenter === 'function') {
		const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
		return Array.from(segmenter.segment(value), ({ segment }) => segment);
	}
	return Array.from(value);
}

export function countCharacters(value: string): number {
	return graphemes(value).length;
}

export function countCharactersWithoutWhitespace(value: string): number {
	return graphemes(value).filter((character) => !/^\s+$/u.test(character)).length;
}
