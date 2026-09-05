// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

// Set SITE_URL to the real deployment origin in production.
const site = process.env.SITE_URL ?? 'https://ybstools.com';

// https://astro.build/config
export default defineConfig({
  site,
  trailingSlash: 'always',
  integrations: [sitemap({
    filter: (page) => !['/404', '/404/'].includes(new URL(page).pathname),
  })],
  vite: {
    plugins: [tailwindcss()]
  }
});
