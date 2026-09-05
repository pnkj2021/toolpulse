import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { availableTools, toolHref } from '../src/data/tools.ts';

const projectRoot = process.cwd();
const pagesRoot = path.join(projectRoot, 'src', 'pages');

async function pageFiles(directory = pagesRoot): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(entries.map((entry) => {
		const entryPath = path.join(directory, entry.name);
		return entry.isDirectory() ? pageFiles(entryPath) : [entryPath];
	}));
	return files.flat().filter((file) => file.endsWith('.astro'));
}

function routeForPage(file: string): string {
	const relativePath = path.relative(pagesRoot, file).replaceAll(path.sep, '/');
	const route = relativePath.replace(/(?:^|\/)index\.astro$/, '').replace(/\.astro$/, '/');
	return `/${route}`.replace('//', '/');
}

test('toolHref always returns canonical trailing-slash routes', () => {
	for (const tool of availableTools) {
		assert.equal(toolHref(tool), `/tools/${tool.slug}/`);
	}
});

test('every indexable page declares one trailing-slash canonical path', async () => {
	for (const file of await pageFiles()) {
		if (path.basename(file) === '404.astro') continue;
		const source = await readFile(file, 'utf8');
		const props = [...source.matchAll(/canonicalPath=(?:"([^"]+)"|\{canonicalPath\})/g)];
		assert.equal(props.length, 1, `${path.relative(projectRoot, file)} must pass canonicalPath exactly once`);

		const canonicalPath = props[0][1]
			?? source.match(/const canonicalPath\s*=\s*['"]([^'"]+)['"]/)?.[1];
		assert.ok(canonicalPath, `${path.relative(projectRoot, file)} must define its canonicalPath`);
		assert.ok(canonicalPath.endsWith('/'), `${canonicalPath} must end in /`);
		assert.equal(canonicalPath, routeForPage(file), `${canonicalPath} must match its page route`);
	}
});

test('literal internal page links use trailing slashes', async () => {
	const componentRoot = path.join(projectRoot, 'src', 'components');
	const componentFiles = (await readdir(componentRoot, { recursive: true }))
		.filter((file) => file.endsWith('.astro'))
		.map((file) => path.join(componentRoot, file));

	for (const file of [...(await pageFiles()), ...componentFiles]) {
		const source = await readFile(file, 'utf8');
		for (const [, href] of source.matchAll(/href=["']([^"']+)["']/g)) {
			if (!href.startsWith('/') || href === '/' || href.startsWith('/#')) continue;
			if (/\.[a-z0-9]+(?:[?#].*)?$/i.test(href)) continue;
			const pathname = href.split(/[?#]/, 1)[0];
			assert.ok(pathname.endsWith('/'), `${href} in ${path.relative(projectRoot, file)} must use a trailing slash`);
		}
	}
});

test('sitemap contains every indexable canonical URL exactly once', async () => {
	const sitemap = await readFile(path.join(projectRoot, 'public', 'sitemap.xml'), 'utf8');
	const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
	assert.equal(new Set(urls).size, urls.length, 'sitemap URLs must be unique');
	for (const url of urls) assert.ok(new URL(url).pathname.endsWith('/'), `${url} must end in /`);

	const expectedRoutes = (await pageFiles())
		.filter((file) => path.basename(file) !== '404.astro')
		.map(routeForPage)
		.sort();
	const sitemapRoutes = urls.map((url) => new URL(url).pathname).sort();
	assert.deepEqual(sitemapRoutes, expectedRoutes);
});

test('Cloudflare permanently redirects every non-home page to its canonical route', async () => {
	const redirects = await readFile(path.join(projectRoot, 'public', '_redirects'), 'utf8');
	const rules = redirects.trim().split(/\r?\n/).map((line) => line.split(/\s+/));
	const sitemap = await readFile(path.join(projectRoot, 'public', 'sitemap.xml'), 'utf8');
	const canonicalRoutes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
		.map((match) => new URL(match[1]).pathname)
		.filter((route) => route !== '/');

	assert.equal(rules.length, canonicalRoutes.length);
	assert.deepEqual(rules.map(([, destination]) => destination).sort(), canonicalRoutes.sort());
	for (const [source, destination, status] of rules) {
		assert.equal(source, destination.slice(0, -1));
		assert.equal(status, '301');
	}
});

test('the shared layout is the only canonical tag source', async () => {
	const files = [...(await pageFiles()), path.join(projectRoot, 'src', 'layouts', 'BaseLayout.astro')];
	let canonicalTags = 0;
	for (const file of files) {
		const source = await readFile(file, 'utf8');
		canonicalTags += (source.match(/rel=["']canonical["']/g) ?? []).length;
	}
	assert.equal(canonicalTags, 1);
});
