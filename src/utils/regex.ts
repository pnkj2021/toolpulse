export const MAX_REGEX_INPUT_LENGTH = 1024 * 1024;
export const MAX_REGEX_MATCHES = 10_000;
export const SUPPORTED_REGEX_FLAGS = ['g', 'i', 'm', 's', 'u', 'y'] as const;
export type RegexFlag = (typeof SUPPORTED_REGEX_FLAGS)[number];

export interface RegexMatch {
	index: number;
	end: number;
	value: string;
	groups: Array<string | undefined>;
	namedGroups: Record<string, string | undefined>;
}

export interface RegexEvaluation {
	matches: RegexMatch[];
	truncated: boolean;
}

export function normalizeFlags(flags: string): string {
	return SUPPORTED_REGEX_FLAGS.filter((flag) => flags.includes(flag)).join('');
}

export function createRegex(pattern: string, flags = ''): RegExp {
	return new RegExp(pattern, normalizeFlags(flags));
}

export function validateRegex(pattern: string, flags = ''): { valid: true; regex: RegExp } | { valid: false; error: string } {
	try {
		return { valid: true, regex: createRegex(pattern, flags) };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { valid: false, error: message.replace(/^Invalid regular expression:\s*/u, '') };
	}
}

function advanceStringIndex(text: string, index: number, unicode: boolean): number {
	if (!unicode || index >= text.length) return index + 1;
	const first = text.charCodeAt(index);
	if (first < 0xd800 || first > 0xdbff || index + 1 >= text.length) return index + 1;
	const second = text.charCodeAt(index + 1);
	return second >= 0xdc00 && second <= 0xdfff ? index + 2 : index + 1;
}

function normalizeMatch(match: RegExpExecArray): RegexMatch {
	return {
		index: match.index,
		end: match.index + match[0].length,
		value: match[0],
		groups: match.slice(1),
		namedGroups: { ...(match.groups ?? {}) },
	};
}

export function findMatches(pattern: string, flags: string, text: string, maxMatches = MAX_REGEX_MATCHES): RegexEvaluation {
	if (text.length > MAX_REGEX_INPUT_LENGTH) throw new RangeError(`Test text exceeds the ${MAX_REGEX_INPUT_LENGTH}-character limit.`);
	const regex = createRegex(pattern, flags);
	const matches: RegexMatch[] = [];
	let result: RegExpExecArray | null;
	do {
		result = regex.exec(text);
		if (!result) break;
		matches.push(normalizeMatch(result));
		if (!regex.global) break;
		if (result[0].length === 0) regex.lastIndex = advanceStringIndex(text, regex.lastIndex, regex.unicode);
	} while (matches.length < maxMatches);
	return { matches, truncated: matches.length === maxMatches && regex.global };
}

export function replaceMatches(pattern: string, flags: string, text: string, replacement: string): string {
	if (text.length > MAX_REGEX_INPUT_LENGTH) throw new RangeError(`Test text exceeds the ${MAX_REGEX_INPUT_LENGTH}-character limit.`);
	return text.replace(createRegex(pattern, flags), replacement);
}

export function formatRegex(pattern: string, flags = ''): string {
	return `/${pattern.replace(/\//gu, '\\/')}/${normalizeFlags(flags)}`;
}

export function calculateRegexStats(matches: RegexMatch[], text: string): { matches: number; groups: number; characters: number } {
	return { matches: matches.length, groups: matches.reduce((maximum, match) => Math.max(maximum, match.groups.length), 0), characters: text.length };
}
