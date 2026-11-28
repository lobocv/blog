// Messages between the browser and the editor server. Both sides validate
// with these schemas, so a change here shows up as a type error on both.
import { z } from 'zod';

export const routes = {
  posts: '/api/posts',
  ideas: '/api/ideas',
  scopeIdea: '/api/ideas/scope',
  post: (slug: string) => `/api/posts/${encodeURIComponent(slug)}`,
  preview: '/api/preview',
  threads: (slug: string) => `/api/posts/${encodeURIComponent(slug)}/threads`,
  events: (slug: string) => `/api/posts/${encodeURIComponent(slug)}/events`,
  suggestion: (slug: string, id: string) => `/api/posts/${encodeURIComponent(slug)}/suggestions/${encodeURIComponent(id)}`,
  stop: (slug: string) => `/api/posts/${encodeURIComponent(slug)}/stop`,
  thread: (slug: string, id: string) => `/api/posts/${encodeURIComponent(slug)}/threads/${encodeURIComponent(id)}`,
} as const;

/** GET /api/posts: drafts, most recently edited first, then published posts, newest first */
export const PostList = z.object({
  posts: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      draft: z.boolean(),
      date: z.string().optional(),
      words: z.number(),
      minutes: z.number(),
      modified: z.iso.datetime(),
    }),
  ),
});
export type PostList = z.infer<typeof PostList>;

/** GET /api/ideas, in the order writing/ideas.md lists them. POST adds one ({ text }), DELETE removes one (an Idea). Both answer with the list. */
export const Idea = z.object({ date: z.string().optional(), text: z.string(), series: z.string().optional() });
export const Ideas = z.object({ ideas: z.array(Idea) });
export type Ideas = z.infer<typeof Ideas>;
export const NewIdea = z.object({ text: z.string() });
export type NewIdea = z.infer<typeof NewIdea>;
/** POST /api/ideas/scope starts a draft from an idea with a working title, and runs /scope in its page thread. Answers with a CreatedDraft. */
export const ScopeIdea = z.object({ idea: Idea, title: z.string() });
export type ScopeIdea = z.infer<typeof ScopeIdea>;

/** POST /api/posts starts a draft from a title, and answers with its slug. */
export const NewDraft = z.object({ title: z.string() });
export type NewDraft = z.infer<typeof NewDraft>;
export const CreatedDraft = z.object({ slug: z.string() });

/** GET /api/posts/:slug */
export const Post = z.object({ slug: z.string(), name: z.string(), text: z.string() });
export type Post = z.infer<typeof Post>;

/** PUT /api/posts/:slug. DELETE on the same route deletes a draft. */
export const SavePost = z.object({ text: z.string() });
export type SavePost = z.infer<typeof SavePost>;

const Anchor = z.object({ quote: z.string(), line: z.number().int().min(1) });
const Suggestion = z.object({
  id: z.string(),
  find: z.string(),
  replace: z.string(),
  line: z.number().int().min(1),
  status: z.enum(['open', 'accepted', 'rejected']),
  mechanical: z.boolean().optional(),
});
const Message = z.object({ author: z.enum(['calvin', 'claude']), text: z.string(), at: z.string(), suggestion: Suggestion.optional() });
const Thread = z.object({
  id: z.string(),
  anchor: Anchor.optional(),
  resolved: z.boolean(),
  lost: z.boolean().optional(),
  messages: z.array(Message),
  review: z.object({ title: z.string(), done: z.number(), total: z.number() }).optional(),
});

/** GET .../threads, and the reply to every change: all the post's threads */
export const Threads = z.object({ threads: z.array(Thread) });
export type Threads = z.infer<typeof Threads>;

/**
 * GET /api/posts/:slug/events streams these: Claude's work, and edits made outside the editor.
 * POST /api/posts/:slug/stop stops Claude.
 */
export const PostEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('threads'), threads: z.array(Thread) }),
  z.object({ type: z.literal('working'), threadId: z.string(), text: z.string(), tool: z.string().optional() }),
  z.object({ type: z.literal('idle') }),
  z.object({ type: z.literal('failed'), threadId: z.string(), message: z.string() }),
  z.object({ type: z.literal('outside'), text: z.string() }),
  /** A figure's code changed: Source reloads its figures. */
  z.object({ type: z.literal('figures') }),
]);
export type PostEvent = z.infer<typeof PostEvent>;

/** POST .../threads. No anchor means the page thread */
export const NewComment = z.object({ anchor: Anchor.optional(), text: z.string().min(1) });
export type NewComment = z.infer<typeof NewComment>;

/** POST /api/posts/:slug/suggestions/:id, after an accepted edit was applied to the text */
export const Settle = z.object({ status: z.enum(['accepted', 'rejected']), replace: z.string().optional() });
export type Settle = z.infer<typeof Settle>;

/** POST .../threads/:id/replies */
export const NewReply = z.object({ text: z.string().min(1) });
export type NewReply = z.infer<typeof NewReply>;

/** GET /api/preview, once `astro dev` answers */
export const PreviewInfo = z.object({ origin: z.url() });
export type PreviewInfo = z.infer<typeof PreviewInfo>;

/** Any failed request */
export const Failure = z.object({ error: z.string() });
