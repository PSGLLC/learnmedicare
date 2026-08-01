// Content Layer API (Astro 5+) collection definitions. The blog collection
// backs src/pages/blog/index.astro and src/pages/blog/[slug].astro — see
// those files for how it's consumed. Every other page on this site is a
// plain .astro file with hardcoded frontmatter consts (see astro.config.mjs's
// sitemap comment); blog posts are the first real use of Content Collections
// here, chosen because .md posts with a shared schema (title/date/tags/faqs)
// are exactly what the Content Layer API is built for, and it gives the
// listing/related-articles/tag logic a typed, validated source instead of
// hand-rolled frontmatter parsing.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    // Optional shorter variant for the <title> tag (50-60 char SEO target)
    // — `title` itself is used as the visible H1 and is often longer,
    // descriptive AEO-style headline copy. Falls back to `title` if unset.
    seoTitle: z.string().optional(),
    description: z.string(),
    date: z.coerce.date(),
    dateModified: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    excerpt: z.string(),
    faqs: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        }),
      )
      .optional(),
  }),
});

export const collections = { blog };
