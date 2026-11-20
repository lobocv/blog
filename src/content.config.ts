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

const projects = defineCollection({
  loader: glob({
    pattern: '*/index.mdx',
    base: './src/content/projects',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    title: z.string(),
    kind: z.enum(['work', 'personal']),
    org: z.string().optional(),
    role: z.string(),
    period: z.string(),
    /** One-line outcome: the card text and meta description */
    summary: z.string(),
    problem: z.string(),
    contribution: z.string(),
    outcome: z.string(),
    impact: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
    /** Lower comes first on the index */
    order: z.number().default(100),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts, pages, projects };
