import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/posts',
    // The folder name is the URL slug, as in Hugo.
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z
    .object({
      title: z.string(),
      draft: z.boolean().default(false),
      date: z.coerce.date().optional(),
      categories: z.array(z.string()).default([]),
      summary: z.string().optional(),
      feature: z.object({ lang: z.string(), code: z.string() }).optional(),
    })
    .superRefine((d, ctx) => {
      if (d.draft) return;
      if (!d.date) ctx.addIssue({ code: 'custom', path: ['date'], message: 'published posts need a date' });
      if (!d.summary) ctx.addIssue({ code: 'custom', path: ['summary'], message: 'published posts need a summary' });
    }),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({ title: z.string() }),
});

export const collections = { posts, pages };
