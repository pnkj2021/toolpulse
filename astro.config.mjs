// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// Set SITE_URL to the real deployment origin in production.
const site = process.env.SITE_URL ?? 'https://ybstools.com';

// https://astro.build/config
export default defineConfig({
  site,
  vite: {
    plugins: [tailwindcss()]
  }
});
