// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://learnmedicare.org',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // The external Q&A redirect is not an indexable content page.
      filter: (page) => new URL(page).pathname !== '/agent-resources/',
      // Omit lastmod until a reliable per-page content revision date is available.
    }),
  ],
});
