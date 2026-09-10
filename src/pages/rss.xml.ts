import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { SITE_URL, TAGLINE } from '../site.config';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog');

  return rss({
    title: 'Learn Medicare Blog',
    description: `Plain-language Medicare articles from licensed insurance agent Kayla Price. ${TAGLINE}`,
    site: context.site ?? SITE_URL,
    items: posts
      .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
      .map((post) => ({
        title: post.data.title,
        description: post.data.excerpt,
        pubDate: post.data.date,
        link: `/blog/${post.id}/`,
      })),
    customData: `<language>en-us</language>`,
  });
}
