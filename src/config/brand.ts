export const BRAND = {
	shortName: 'YBS',
	fullName: 'Your Browser Suite',
	tagline: 'Everything you need. Right in your browser.',
	description: 'Fast, privacy-first browser tools that run locally in your browser. Compare text, format JSON, encode Base64, count words, and much more.',
	defaultTitle: 'YBS | Your Browser Suite',
	primaryColor: '#2563EB',
	accentColor: '#06B6D4',
	darkColor: '#0F172A',
	backgroundColor: '#F8FAFC',
	email: 'hello@ybs.tools',
	url: 'https://ybstools.com',
} as const;

export const SEO = {
	defaultTitle: BRAND.defaultTitle,
	defaultDescription: BRAND.description,
	openGraphImage: '/og-image.png',
	twitterCard: 'summary_large_image',
} as const;
