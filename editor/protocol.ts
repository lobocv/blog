// Messages between the browser and the editor server. Both sides validate
// with these schemas, so a change here shows up as a type error on both.
import { z } from 'zod';

export const routes = {
  drafts: '/api/drafts',
  post: (slug: string) => `/api/posts/${encodeURIComponent(slug)}`,
  preview: '/api/preview',
  threads: (slug: string) => `/api/posts/${encodeURIComponent(slug)}/threads`,
  events: (slug: string) => `/api/posts/${encodeURIComponent(slug)}/events`,
  stop: (slug: string) => `/api/posts/${encodeURIComponent(slug)}/stop`,
  thread: (slug: string, id: string) => `/api/posts/${encodeURIComponent(slug)}/threads/${encodeURIComponent(id)}`,
} as const;

/** GET /api/drafts, most recently edited first */
export const Drafts = z.object({
  drafts: z.array(
    z.object({ slug: z.string(), title: z.string(), words: z.number(), minutes: z.number(), modified: z.iso.datetime() }),
  ),
});
export type Drafts = z.infer<typeof Drafts>;

/** GET /api/posts/:slug */
export const Post = z.object({ slug: z.string(), name: z.string(), text: z.string() });
export type Post = z.infer<typeof Post>;

/** PUT /api/posts/:slug. DELETE on the same route deletes a draft. */
export const SavePost = z.object({ text: z.string() });
export type SavePost = z.infer<typeof SavePost>;

const Anchor = z.object({ quote: z.string(), line: z.number().int().min(1) });
const Message = z.object({ author: z.enum(['calvin', 'claude']), text: z.string(), at: z.string() });
const Thread = z.object({
  id: z.string(),
  anchor: Anchor.optional(),
  resolved: z.boolean(),
  lost: z.boolean().optional(),
  messages: z.array(Message),
});

/** GET .../threads, and the reply to every change: all the post's threads */
export const Threads = z.object({ threads: z.array(Thread) });
export type Threads = z.infer<typeof Threads>;

/** GET /api/posts/:slug/events streams these. POST /api/posts/:slug/stop stops Claude. */
export const ClaudeEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('threads'), threads: z.array(Thread) }),
  z.object({ type: z.literal('working'), threadId: z.string(), text: z.string(), tool: z.string().optional() }),
  z.object({ type: z.literal('idle') }),
  z.object({ type: z.literal('failed'), threadId: z.string(), message: z.string() }),
]);
export type ClaudeEvent = z.infer<typeof ClaudeEvent>;

/** POST .../threads. No anchor means the page thread */
export const NewComment = z.object({ anchor: Anchor.optional(), text: z.string().min(1) });
export type NewComment = z.infer<typeof NewComment>;

/** POST .../threads/:id/replies */
export const NewReply = z.object({ text: z.string().min(1) });
export type NewReply = z.infer<typeof NewReply>;

/** GET /api/preview, once `astro dev` answers */
export const PreviewInfo = z.object({ origin: z.url() });
export type PreviewInfo = z.infer<typeof PreviewInfo>;

/** Any failed request */
export const Failure = z.object({ error: z.string() });
