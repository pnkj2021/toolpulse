export type CronMode = 'local' | 'utc';
export type CronFieldName = 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek';
export interface CronField { name: CronFieldName; raw: string; values: number[]; wildcard: boolean; description: string }
export interface CronSchedule { expression: string; minute: CronField; hour: CronField; dayOfMonth: CronField; month: CronField; dayOfWeek: CronField }

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const WEEKDAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const definitions: Array<{ name: CronFieldName; label: string; min: number; max: number; names?: string[] }> = [
	{ name: 'minute', label: 'minute', min: 0, max: 59 }, { name: 'hour', label: 'hour', min: 0, max: 23 },
	{ name: 'dayOfMonth', label: 'day-of-month', min: 1, max: 31 }, { name: 'month', label: 'month', min: 1, max: 12, names: MONTHS },
	{ name: 'dayOfWeek', label: 'day-of-week', min: 0, max: 7, names: WEEKDAYS },
];

export class CronError extends Error {
	readonly field?: CronFieldName;
	constructor(message: string, field?: CronFieldName) { super(message); this.field = field; }
}
const displayTime = (hour: number, minute = 0) => { const suffix = hour >= 12 ? 'PM' : 'AM'; const h = hour % 12 || 12; return `${h}:${String(minute).padStart(2, '0')} ${suffix}`; };

function resolveValue(token: string, definition: typeof definitions[number]): number {
	const upper = token.toUpperCase(); const named = definition.names?.indexOf(upper) ?? -1;
	const value = named >= 0 ? named + (definition.name === 'month' ? 1 : 0) : Number(token);
	if (!/^\d+$/u.test(token) && named < 0) throw new CronError(`Invalid ${definition.label} value: ${token}. Expected ${definition.min}–${definition.max}.`, definition.name);
	if (!Number.isInteger(value) || value < definition.min || value > definition.max) throw new CronError(`Invalid ${definition.label} value: ${token}. Expected ${definition.min}–${definition.max}.`, definition.name);
	return value;
}

function describeField(name: CronFieldName, raw: string, values: number[]): string {
	if (raw === '*') return ({ minute: 'Every minute', hour: 'Every hour', dayOfMonth: 'Every day', month: 'Every month', dayOfWeek: 'Every weekday' })[name];
	const step = /^\*\/(\d+)$/u.exec(raw); if (step) return `Every ${step[1]} ${name === 'minute' ? 'minutes' : name === 'hour' ? 'hours' : 'values'}`;
	if (name === 'hour' && values.length === 1) return `At ${displayTime(values[0]!)}`;
	if (name === 'minute' && values.length === 1) return `At minute ${values[0]}`;
	if (name === 'month') return values.map((v) => MONTHS[v - 1]).join(', ');
	if (name === 'dayOfWeek') return values.map((v) => WEEKDAYS[v]).join(', ');
	return `Values: ${values.join(', ')}`;
}

export function parseCronField(raw: string, definition: typeof definitions[number]): CronField {
	if (!raw || /[#?@]/u.test(raw) || /(?:^|,)(?:L|W|\d+[LW])(?:$|,)/iu.test(raw)) throw new CronError("This syntax isn't supported by the standard 5-field YBS Cron Tester.", definition.name);
	const values = new Set<number>(); const parts = raw.split(','); if (parts.some((part) => !part)) throw new CronError(`Invalid list in ${definition.label} field.`, definition.name);
	for (const part of parts) {
		const slash = part.split('/'); if (slash.length > 2) throw new CronError(`Invalid step in ${definition.label} field.`, definition.name);
		const base = slash[0]!; const step = slash[1] === undefined ? 1 : Number(slash[1]);
		if (!Number.isInteger(step) || step <= 0) throw new CronError(`Invalid ${definition.label} step: ${slash[1] ?? ''}. Step must be greater than 0.`, definition.name);
		let start: number; let end: number;
		if (base === '*') { start = definition.min; end = definition.max; }
		else if (base.includes('-')) { const range = base.split('-'); if (range.length !== 2 || !range[0] || !range[1]) throw new CronError(`Invalid range in ${definition.label} field.`, definition.name); start = resolveValue(range[0], definition); end = resolveValue(range[1], definition); if (start > end) throw new CronError(`Invalid ${definition.label} range: ${base}. Range start must not exceed its end.`, definition.name); }
		else { start = resolveValue(base, definition); end = slash[1] === undefined ? start : definition.max; }
		for (let value = start; value <= end; value += step) values.add(definition.name === 'dayOfWeek' && value === 7 ? 0 : value);
	}
	const sorted = [...values].sort((a, b) => a - b); if (!sorted.length) throw new CronError(`The ${definition.label} field has no values.`, definition.name);
	return { name: definition.name, raw, values: sorted, wildcard: raw === '*', description: describeField(definition.name, raw.toUpperCase(), sorted) };
}

export function parseCron(expression: string): CronSchedule {
	const normalized = expression.trim().replace(/\s+/gu, ' '); const parts = normalized ? normalized.split(' ') : [];
	if (parts.length !== 5) throw new CronError(`Expected 5 cron fields but found ${parts.length}.`);
	const fields = definitions.map((definition, index) => parseCronField(parts[index]!, definition));
	return { expression: normalized, minute: fields[0]!, hour: fields[1]!, dayOfMonth: fields[2]!, month: fields[3]!, dayOfWeek: fields[4]! } as CronSchedule;
}

const includes = (field: CronField, value: number) => field.values.includes(value);
function components(date: Date, mode: CronMode) { const u = mode === 'utc' ? 'UTC' : ''; return { year: date[`get${u}FullYear` as 'getFullYear'](), month: date[`get${u}Month` as 'getMonth']() + 1, day: date[`get${u}Date` as 'getDate'](), weekday: date[`get${u}Day` as 'getDay'](), hour: date[`get${u}Hours` as 'getHours'](), minute: date[`get${u}Minutes` as 'getMinutes']() }; }
export function matchesCron(schedule: CronSchedule, date: Date, mode: CronMode): boolean {
	const c = components(date, mode); const dom = includes(schedule.dayOfMonth, c.day); const dow = includes(schedule.dayOfWeek, c.weekday);
	const dayMatches = schedule.dayOfMonth.wildcard ? dow : schedule.dayOfWeek.wildcard ? dom : dom || dow;
	return includes(schedule.month, c.month) && includes(schedule.hour, c.hour) && includes(schedule.minute, c.minute) && dayMatches;
}

function makeDate(year: number, month: number, day: number, hour: number, minute: number, mode: CronMode): Date { return mode === 'utc' ? new Date(Date.UTC(year, month - 1, day, hour, minute)) : new Date(year, month - 1, day, hour, minute); }
export function getNextRuns(schedule: CronSchedule, from: Date, count = 5, mode: CronMode = 'local', horizonYears = 8): Date[] {
	const start = components(from, mode); const results: Date[] = []; const endYear = start.year + horizonYears;
	for (let year = start.year; year <= endYear && results.length < count; year++) for (let month = 1; month <= 12 && results.length < count; month++) {
		if (year === start.year && month < start.month || !includes(schedule.month, month)) continue;
		const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
		for (let day = 1; day <= days && results.length < count; day++) {
			if (year === start.year && month === start.month && day < start.day) continue;
			const dayProbe = makeDate(year, month, day, 12, 0, mode); const c = components(dayProbe, mode); if (c.year !== year || c.month !== month || c.day !== day) continue;
			const dom = includes(schedule.dayOfMonth, day); const dow = includes(schedule.dayOfWeek, c.weekday); const dayMatches = schedule.dayOfMonth.wildcard ? dow : schedule.dayOfWeek.wildcard ? dom : dom || dow; if (!dayMatches) continue;
			for (const hour of schedule.hour.values) {
				for (const minute of schedule.minute.values) { const candidate = makeDate(year, month, day, hour, minute, mode); const cc = components(candidate, mode); if (cc.year !== year || cc.month !== month || cc.day !== day || cc.hour !== hour || cc.minute !== minute || candidate.getTime() <= from.getTime()) continue; results.push(candidate); if (results.length === count) break; }
				if (results.length === count) break;
			}
		}
	}
	return results;
}

export function describeCron(schedule: CronSchedule): string {
	const { minute, hour, dayOfMonth: dom, month, dayOfWeek: dow } = schedule;
	let timing = minute.raw === '*' && hour.raw === '*' ? 'Every minute' : /^\*\/\d+$/u.test(minute.raw) && hour.raw === '*' ? minute.description : minute.values.length === 1 && hour.values.length === 1 ? `At ${displayTime(hour.values[0]!, minute.values[0]!)}` : `${minute.description}; ${hour.description}`;
	if (!dom.wildcard && dow.wildcard && dom.values.length === 1) timing += ` on day ${dom.values[0]} of every month`;
	else if (dom.wildcard && !dow.wildcard) timing += ` on ${dow.values.map((v) => WEEKDAYS[v]).join(', ')}`;
	else if (!dom.wildcard && !dow.wildcard) timing += ` when the day of month is ${dom.values.join(', ')} OR the weekday is ${dow.values.map((v) => WEEKDAYS[v]).join(', ')}`;
	if (!month.wildcard) timing += ` in ${month.values.map((v) => MONTHS[v - 1]).join(', ')}`;
	return timing;
}

export const cronFieldDefinitions = definitions;
