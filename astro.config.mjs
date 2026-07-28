// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
const today = new Date().toISOString().split('T')[0];

export default defineConfig({
  site: 'https://learnmedicare.org',
  integrations: [
    sitemap({
      // No page here carries a dateModified/updatedAt in frontmatter (all
      // pages are plain .astro files, no content collection), so every URL
      // falls back to today's build date.
      serialize: (item) => ({ ...item, lastmod: today }),
    }),
  ],
});
