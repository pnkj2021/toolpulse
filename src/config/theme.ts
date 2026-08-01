export const THEME_STORAGE_KEY = 'ybs-theme';

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
	return value === 'light' || value === 'dark';
}
