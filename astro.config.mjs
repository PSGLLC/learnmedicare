// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://learnmedicare.org',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // /medicare-qa/ is a static file in public/ (not an Astro page), so the integration
      // can't discover it on its own.
      customPages: ['https://learnmedicare.org/medicare-qa/'],
      filter: (page) => new URL(page).pathname !== '/agent-resources/',
      // Omit lastmod until a reliable per-page content revision date is available.
    }),
  ],
});
