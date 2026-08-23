import type { TypingMode } from '../data/typingSamples';

export const typingDifficulties = ['easy', 'medium', 'hard'] as const;
export type TypingDifficulty = (typeof typingDifficulties)[number];
export type ChallengeDuration = 15 | 30 | 60;

export interface TypingChallenge {
	text: string;
	mode: TypingMode;
	difficulty: TypingDifficulty;
	id: string;
}

export interface GeneratorOptions {
	duration?: ChallengeDuration;
	random?: () => number;
	seed?: number;
}

const pick = <T>(values: readonly T[], random: () => number): T => values[Math.floor(Math.min(.999999, Math.max(0, random())) * values.length)];
const identifier = (values: readonly string[], random: () => number) => pick(values, random);

export function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state += 0x6D2B79F5;
		let value = state;
		value = Math.imul(value ^ value >>> 15, value | 1);
		value ^= value + Math.imul(value ^ value >>> 7, value | 61);
		return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
	};
}

function hash(value: string): string {
	let result = 2166136261;
	for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
	return (result >>> 0).toString(36);
}

function words(difficulty: TypingDifficulty, duration: ChallengeDuration, random: () => number): string {
	const common = ['the', 'quick', 'clear', 'small', 'good', 'new', 'simple', 'steady', 'useful', 'local'];
	const subjects = ['browser', 'function', 'interface', 'developer', 'system', 'client', 'project', 'service', 'component', 'application'];
	const actions = ['checks', 'builds', 'returns', 'updates', 'formats', 'validates', 'creates', 'reviews', 'stores', 'renders'];
	const objects = ['data', 'results', 'values', 'settings', 'requests', 'content', 'state', 'responses', 'messages', 'records'];
	const advanced = ['asynchronous operations', 'predictable state management', 'structured error handling', 'accessible interface design', 'deterministic test coverage', 'carefully composed abstractions'];
	const sentence = () => {
		if (difficulty === 'easy') return `${pick(common, random)} ${pick(subjects, random)} ${pick(actions, random)} ${pick(objects, random)} in the browser`;
		if (difficulty === 'medium') return `the ${pick(subjects, random)} ${pick(actions, random)} the ${pick(objects, random)} before updating the ${pick(['interface', 'result', 'current view', 'local state'], random)}`;
		return `${pick(advanced, random)} require ${pick(['careful review', 'consistent naming', 'precise feedback', 'measured iteration'], random)}, especially when the ${pick(subjects, random)} ${pick(actions, random)} nested ${pick(objects, random)}`;
	};
	const minimum = difficulty === 'easy' ? (duration === 15 ? 60 : 95) : difficulty === 'medium' ? (duration === 15 ? 120 : duration === 30 ? 155 : 210) : (duration === 15 ? 180 : duration === 30 ? 230 : 310);
	const output: string[] = [];
	while (output.join(' ').length < minimum) output.push(sentence());
	return output.map((item, index) => `${index ? item : item[0].toUpperCase() + item.slice(1)}${difficulty === 'hard' && index % 2 ? ';' : '.'}`).join(' ');
}

function javascript(difficulty: TypingDifficulty, duration: ChallengeDuration, random: () => number): string {
	const nouns = ['users', 'items', 'products', 'orders', 'scores', 'projects'];
	const singular = ['user', 'item', 'product', 'order', 'score', 'project'];
	const functions = ['loadData', 'fetchUsers', 'filterItems', 'formatResult', 'calculateTotal', 'updateSettings'];
	const properties = ['active', 'price', 'score', 'quantity', 'status'];
	const collection = identifier(nouns, random);
	const item = identifier(singular, random);
	const property = identifier(properties, random);
	if (difficulty === 'easy') {
		const base = `const ${item} = { id: ${1 + Math.floor(random() * 90)}, active: ${random() > .5} };\nconst result = ${item}.active ? "ready" : "paused";`;
		return duration === 60 ? `${base}\nconsole.log(result);` : base;
	}
	if (difficulty === 'medium') {
		return `function ${identifier(functions, random)}(${collection}) {\n  const selected = ${collection}.filter(${item} => ${item}.${property});\n  return selected.map(${item} => ({ id: ${item}.id, value: ${item}.${property} }));\n}`;
	}
	const asyncName = identifier(functions, random);
	return `async function ${asyncName}(config = {}) {\n  const { limit = 10, status = "active" } = config;\n  const response = await loadData({ limit, status });\n  return response?.items\n    ?.filter(({ ${property} }) => Boolean(${property}))\n    .map((${item}, index) => ({ ...${item}, rank: index + 1 }))\n    .reduce((result, ${item}) => ({ ...result, [${item}.id]: ${item} }), {}) ?? {};\n}`;
}

function json(difficulty: TypingDifficulty, duration: ChallengeDuration, random: () => number): string {
	const names = ['Keyboard', 'Dashboard', 'Notebook', 'Workspace', 'Monitor'];
	const statuses = ['active', 'draft', 'ready', 'paused'];
	const base = { name: pick(names, random), version: 1 + Math.floor(random() * 8), active: random() > .35 };
	if (difficulty === 'easy') return JSON.stringify(base, null, 2);
	if (difficulty === 'medium') return JSON.stringify({ ...base, status: pick(statuses, random), tags: ['browser', 'local', duration === 60 ? 'extended' : 'fast'], scores: [72, 84, 91] }, null, 2);
	return JSON.stringify({ project: base, owner: { id: 10 + Math.floor(random() * 80), name: pick(['Avery', 'Jordan', 'Morgan'], random), roles: ['editor', 'reviewer'] }, settings: { theme: 'system', features: { autosave: false, hints: true, retries: 2 } }, metrics: duration === 15 ? [18, 24, 31] : [18, 24, 31, 47, 58, 63] }, null, 2);
}

function sql(difficulty: TypingDifficulty, duration: ChallengeDuration, random: () => number): string {
	const tables = ['users', 'orders', 'products', 'projects', 'tasks', 'customers'];
	const table = pick(tables, random);
	const status = pick(['active', 'pending', 'complete'], random);
	if (difficulty === 'easy') return `SELECT id, name\nFROM ${table}\nWHERE status = '${status}';`;
	if (difficulty === 'medium') return `SELECT id, name, status, created_at\nFROM ${table}\nWHERE status = '${status}'\n  AND created_at >= CURRENT_DATE - INTERVAL '${duration} days'\nORDER BY created_at DESC;`;
	const parent = pick(['users', 'customers', 'projects'], random);
	const child = parent === 'projects' ? 'tasks' : 'orders';
	const foreignKey = parent === 'projects' ? 'project_id' : `${parent.slice(0, -1)}_id`;
	return `SELECT ${parent}.id, ${parent}.name, COUNT(${child}.id) AS related_count\nFROM ${parent}\nLEFT JOIN ${child} ON ${child}.${foreignKey} = ${parent}.id\nWHERE ${parent}.status = '${status}'\n  AND ${parent}.created_at >= CURRENT_DATE - INTERVAL '${duration} days'\nGROUP BY ${parent}.id, ${parent}.name\nHAVING COUNT(${child}.id) >= ${1 + Math.floor(random() * 4)}\nORDER BY related_count DESC;`;
}

function htmlCss(difficulty: TypingDifficulty, duration: ChallengeDuration, random: () => number): string {
	const blocks = ['card', 'panel', 'toolbar', 'container', 'navigation'];
	const block = pick(blocks, random);
	if (difficulty === 'easy') {
		const element = pick(['section', 'article', 'div'], random);
		return `<${element} class="${block}">\n  <h2>Project summary</h2>\n  <p>Review the latest changes.</p>\n</${element}>`;
	}
	if (difficulty === 'medium') return `<section class="${block}">\n  <header class="${block}__header">\n    <h2>Project activity</h2>\n    <button type="button">View details</button>\n  </header>\n  <p class="${block}__content">Updates are ready to review.</p>\n</section>\n\n<style>\n  .${block} { display: grid; gap: 1rem; padding: 1.25rem; border-radius: 0.75rem; }\n  .${block}__header { display: flex; align-items: center; justify-content: space-between; }\n</style>`;
	return `<main class="${block}">\n  <section class="${block}__content">\n    <header><h2>Development workspace</h2></header>\n    <ul class="${block}__grid">\n      <li class="${block}__item">Build status</li>\n      <li class="${block}__item">Test coverage</li>\n      <li class="${block}__item">Review queue</li>\n    </ul>\n  </section>\n</main>\n\n<style>\n  .${block} { max-width: ${duration === 60 ? '72rem' : '56rem'}; margin: 0 auto; padding: 1.5rem; }\n  .${block}__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }\n  .${block}__item { padding: 1rem; border-radius: 0.75rem; font-size: 0.95rem; }\n</style>`;
}

export function generateTypingChallenge(mode: TypingMode, difficulty: TypingDifficulty, options: GeneratorOptions = {}): TypingChallenge {
	const duration = options.duration ?? 30;
	const random = options.random ?? (options.seed === undefined ? Math.random : seededRandom(options.seed));
	const generators = { words, javascript, json, sql, 'html-css': htmlCss } as const;
	const text = generators[mode](difficulty, duration, random);
	return { text, mode, difficulty, id: hash(`${mode}:${difficulty}:${text}`) };
}

export function generateUniqueChallenge(mode: TypingMode, difficulty: TypingDifficulty, history: string[], options: GeneratorOptions = {}, historyLimit = 8): TypingChallenge {
	let challenge = generateTypingChallenge(mode, difficulty, options);
	for (let attempt = 0; attempt < 12 && history.includes(challenge.id); attempt++) challenge = generateTypingChallenge(mode, difficulty, { ...options, seed: options.seed === undefined ? undefined : options.seed + attempt + 1 });
	history.push(challenge.id);
	if (history.length > historyLimit) history.splice(0, history.length - historyLimit);
	return challenge;
}
