export type TimestampUnit = 'seconds' | 'milliseconds';
export type TimestampMode = 'auto' | TimestampUnit;
export type DetectedTimestampUnit = TimestampUnit | 'ambiguous';
export type TimezoneInterpretation = 'local' | 'utc';

export const MIN_DATE_MS = -8_640_000_000_000_000;
export const MAX_DATE_MS = 8_640_000_000_000_000;
export const SECONDS_MAX_MAGNITUDE = 100_000_000_000;
export const MILLISECONDS_MIN_MAGNITUDE = 1_000_000_000_000;

export interface DateParts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
}

export interface TimestampConversion {
	date: Date;
	unit: TimestampUnit;
	seconds: number;
	milliseconds: number;
}

/**
 * Values below 1e11 in magnitude are treated as seconds and values at or above
 * 1e12 as milliseconds. The decade between is deliberately ambiguous so Auto
 * never silently guesses. The sign is ignored and zero is seconds.
 */
export function detectTimestampUnit(value: number | bigint): DetectedTimestampUnit {
	const magnitude = typeof value === 'bigint' ? (value < 0n ? -value : value) : Math.abs(value);
	if (magnitude < (typeof magnitude === 'bigint' ? 100_000_000_000n : SECONDS_MAX_MAGNITUDE)) return 'seconds';
	if (magnitude >= (typeof magnitude === 'bigint' ? 1_000_000_000_000n : MILLISECONDS_MIN_MAGNITUDE)) return 'milliseconds';
	return 'ambiguous';
}

export function parseIntegerTimestamp(input: string): bigint | null {
	const value = input.trim();
	if (!/^[+-]?\d+$/u.test(value)) return null;
	try { return BigInt(value); } catch { return null; }
}

export function timestampToDate(input: string, mode: TimestampMode = 'auto'): TimestampConversion {
	const integer = parseIntegerTimestamp(input);
	if (integer === null) throw new RangeError('Invalid Unix timestamp');
	const detected = detectTimestampUnit(integer);
	if (mode === 'auto' && detected === 'ambiguous') throw new RangeError('Ambiguous Unix timestamp');
	const unit = mode === 'auto' ? detected as TimestampUnit : mode;
	const millisecondsBigInt = unit === 'seconds' ? integer * 1000n : integer;
	if (millisecondsBigInt < BigInt(MIN_DATE_MS) || millisecondsBigInt > BigInt(MAX_DATE_MS)) {
		throw new RangeError('Date is outside the supported JavaScript range.');
	}
	const milliseconds = Number(millisecondsBigInt);
	const date = new Date(milliseconds);
	if (Number.isNaN(date.getTime())) throw new RangeError('Date is outside the supported JavaScript range.');
	return { date, unit, seconds: Math.floor(milliseconds / 1000), milliseconds };
}

function partsMatch(date: Date, parts: DateParts, timezone: TimezoneInterpretation): boolean {
	const prefix = timezone === 'utc' ? 'getUTC' : 'get';
	return date[`${prefix}FullYear` as 'getFullYear']() === parts.year
		&& date[`${prefix}Month` as 'getMonth']() === parts.month - 1
		&& date[`${prefix}Date` as 'getDate']() === parts.day
		&& date[`${prefix}Hours` as 'getHours']() === parts.hour
		&& date[`${prefix}Minutes` as 'getMinutes']() === parts.minute
		&& date[`${prefix}Seconds` as 'getSeconds']() === parts.second;
}

export function datePartsToTimestamp(parts: DateParts, timezone: TimezoneInterpretation): TimestampConversion {
	const values = Object.values(parts);
	if (!values.every(Number.isInteger) || parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31
		|| parts.hour < 0 || parts.hour > 23 || parts.minute < 0 || parts.minute > 59 || parts.second < 0 || parts.second > 59) {
		throw new RangeError('Invalid date or time.');
	}
	const date = timezone === 'utc'
		? new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second))
		: new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
	// Years 0–99 receive special treatment from Date constructors, so normalize explicitly.
	if (parts.year >= 0 && parts.year <= 99) {
		if (timezone === 'utc') date.setUTCFullYear(parts.year); else date.setFullYear(parts.year);
	}
	if (Number.isNaN(date.getTime()) || !partsMatch(date, parts, timezone)) throw new RangeError('Invalid date or time.');
	const milliseconds = date.getTime();
	return { date, unit: 'milliseconds', seconds: Math.floor(milliseconds / 1000), milliseconds };
}

export function formatRelativeTime(timestampMs: number, nowMs = Date.now(), locale?: string): string {
	const differenceSeconds = (timestampMs - nowMs) / 1000;
	const absolute = Math.abs(differenceSeconds);
	if (absolute < 45) return 'now';
	const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
		['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60],
	];
	const [unit, seconds] = units.find(([, size]) => absolute >= size) ?? ['second', 1];
	return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(Math.round(differenceSeconds / seconds), unit);
}
