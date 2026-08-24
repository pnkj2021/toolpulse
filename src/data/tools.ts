/**
 * Central tool registry.
 *
 * Keep homepage and future directory pages data-driven by adding new tools here
 * instead of editing individual page templates.
 */
export const toolCategories = ['Text', 'Developer', 'JSON', 'Security', 'Image', 'PDF', 'Calculator', 'Fun'] as const;

export type ToolCategory = (typeof toolCategories)[number];

export interface Tool {
	slug: string;
	name: string;
	description: string;
	icon: string;
	category: ToolCategory;
	tags: readonly ToolCategory[];
	available: boolean;
}

export const tools: readonly Tool[] = [
	{
		slug: 'word-counter',
		name: 'Word Counter',
		description: 'Count words, characters, sentences, and reading time.',
		icon: 'Aa',
		category: 'Text',
		tags: ['Text'],
		available: true,
	},
	{
		slug: 'character-counter',
		name: 'Character Counter',
		description: 'Measure text length with and without spaces.',
		icon: '#',
		category: 'Text',
		tags: ['Text'],
		available: true,
	},
	{
		slug: 'json-formatter',
		name: 'JSON Formatter',
		description: 'Format, minify, and validate JSON instantly.',
		icon: '{}',
		category: 'Developer',
		tags: ['Developer', 'JSON'],
		available: true,
	},
	{
		slug: 'json-builder',
		name: 'JSON Builder',
		description: 'Create valid JSON through a visual interface.',
		icon: '[ ]',
		category: 'Developer',
		tags: ['Developer', 'JSON'],
		available: true,
	},
	{
		slug: 'yaml-viewer',
		name: 'YAML Viewer & OpenAPI Explorer',
		description: 'Validate YAML and inspect OpenAPI or Swagger endpoints.',
		icon: 'YML',
		category: 'Developer',
		tags: ['Developer'],
		available: true,
	},
	{
		slug: 'base64-encoder',
		name: 'Base64 Encoder & Decoder',
		description: 'Encode and decode text or files securely in your browser.',
		icon: '64',
		category: 'Developer',
		tags: ['Developer'],
		available: true,
	},
	{
		slug: 'diff-checker',
		name: 'Diff Checker & Merge Tool',
		description: 'Compare text line by line and merge changes privately.',
		icon: '±',
		category: 'Developer',
		tags: ['Developer', 'Text'],
		available: true,
	},
	{
		slug: 'jwt-decoder',
		name: 'JWT Decoder & Inspector',
		description: 'Decode JWT headers, payloads, claims, and expiration locally.',
		icon: 'JWT',
		category: 'Developer',
		tags: ['Developer', 'JSON', 'Security'],
		available: true,
	},
	{
		slug: 'windows-update-simulator',
		name: 'Windows Update Simulator',
		description: 'Create a harmless fullscreen update simulation with customizable progress, timing, and messages.',
		icon: '%',
		category: 'Fun',
		tags: ['Fun'],
		available: true,
	},
	{
		slug: 'typing-challenge',
		name: 'Typing Challenge',
		description: 'Practice words and code while measuring WPM, accuracy, and mistakes.',
		icon: '>_',
		category: 'Fun',
		tags: ['Fun', 'Developer'],
		available: true,
	},
];

export const availableTools = tools.filter((tool) => tool.available);

export function toolHref(tool: Tool): string {
	return `/tools/${tool.slug}/`;
}
