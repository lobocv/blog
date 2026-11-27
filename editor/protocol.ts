// Messages between the browser and the editor server. Both sides validate
// with these schemas, so a change here shows up as a type error on both.
import { z } from 'zod';

export const routes = {
  posts: '/api/posts',
  ideas: '/api/ideas',
  post: (slug: string) => `/api/posts/${encodeURIComponent(slug)}`,
  preview: '/api/preview',
  threads: (slug: string) => `/api/posts/${encodeURIComponent(slug)}/threads`,
  events: (slug: string) => `/api/posts/${encodeURIComponent(slug)}/events`,
  suggestion: (slug: string, id: string) => `/api/posts/${encodeURIComponent(slug)}/suggestions/${encodeURIComponent(id)}`,
  stop: (slug: string) => `/api/posts/${encodeURIComponent(slug)}/stop`,
  thread: (slug: string, id: string) => `/api/posts/${encodeURIComponent(slug)}/threads/${encodeURIComponent(id)}`,
  share: (slug: string) => `/api/share/${encodeURIComponent(slug)}`,
  preflight: (slug: string) => `/api/share/${encodeURIComponent(slug)}/preflight`,
  /** PUT saves an edit. Add /copied, /restore or /posted (POST, and DELETE for /posted), or /image. */
  socialPost: (slug: string, network: string) => `/api/share/${encodeURIComponent(slug)}/${encodeURIComponent(network)}`,
  /** GET the share thread, POST a message to Claude in it. */
  shareThread: (slug: string) => `/api/share/${encodeURIComponent(slug)}/thread`,
  shareEvents: (slug: string) => `/api/share/${encodeURIComponent(slug)}/events`,
  shareStop: (slug: string) => `/api/share/${encodeURIComponent(slug)}/stop`,
  /** GET the rendered PNG (?download=1 to save it), POST to render it again. */
  socialImage: (slug: string, network: string) => `/api/share/${encodeURIComponent(slug)}/${encodeURIComponent(network)}/image`,
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

// The share page (docs/editor/sharing-design.md).

const Version = z.object({
  text: z.string(),
  hashtags: z.array(z.string()),
  author: z.enum(['calvin', 'claude']),
  at: z.string(),
  flags: z.array(z.string()).optional(),
  noted: z.boolean().optional(),
});
const FigureRef = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('preview') }),
  z.object({ kind: z.literal('component'), source: z.string(), props: z.record(z.string(), z.string()).optional() }),
  z.object({ kind: z.literal('image'), src: z.string() }),
]);
const Rendered = z.object({ key: z.string(), shape: z.string(), width: z.number(), height: z.number(), at: z.string() });
const SocialPost = z.object({
  text: z.string(),
  hashtags: z.array(z.string()).optional(),
  // Any kind: a later version's choice is passed through, and the page falls back to the network's default.
  media: z.looseObject({ kind: z.string() }).optional(),
  link: z.looseObject({ kind: z.string(), code: z.string().optional() }).optional(),
  status: z.enum(['draft', 'ready', 'posted']),
  versions: z.array(Version),
  posted: z.object({ url: z.string(), at: z.string(), text: z.string() }).optional(),
  rendered: Rendered.optional(),
});
export const ShareState = z.object({ state: z.object({ schemaVersion: z.number(), networks: z.record(z.string(), SocialPost) }) });
export type ShareState = z.infer<typeof ShareState>;

/** GET /api/share/:slug: the published post, its share state and the figures an image can show. Drafts answer 409. */
export const Share = ShareState.extend({
  post: z.object({ slug: z.string(), title: z.string(), summary: z.string(), categories: z.array(z.string()), postUrl: z.url(), image: z.url() }),
  figures: z.array(z.object({ key: z.string(), label: z.string(), figure: FigureRef })),
});
export type Share = z.infer<typeof Share>;

/** GET /api/share/:slug/preflight: the live page's checks. For information only. */
export const Preflight = z.object({ checks: z.array(z.object({ ok: z.boolean(), message: z.string(), code: z.string().optional() })) });
export type Preflight = z.infer<typeof Preflight>;

/** PUT .../share/:slug/:network: what Calvin typed or chose. Answers with the ShareState. */
export const SaveSocialPost = z.object({
  text: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  media: z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('link-card') }),
      z.object({ kind: z.literal('text-only') }),
      z.object({ kind: z.literal('image'), figure: FigureRef.optional(), shape: z.string().optional(), theme: z.enum(['day', 'night']).optional(), alt: z.string().optional() }),
    ])
    .optional(),
});
export type SaveSocialPost = z.infer<typeof SaveSocialPost>;

const Snapshot = z.object({ text: z.string(), hashtags: z.array(z.string()).optional() });
/** POST .../copied: the text as copied, which becomes a version. */
export const Copied = Snapshot;
export type Copied = z.infer<typeof Copied>;
/** POST .../restore: the version to bring back, and the text on screen to keep first. */
export const Restore = z.object({ index: z.number().int().min(0), current: Snapshot });
export type Restore = z.infer<typeof Restore>;
/** POST .../posted records the post's URL; DELETE takes it back off. */
export const Posted = z.object({ url: z.url({ protocol: /^https?$/ }) });
export type Posted = z.infer<typeof Posted>;

/** POST /api/share/:slug/thread: Calvin's message to Claude. Answers with the share thread (as Threads). */
export const NewShareMessage = z.object({ text: z.string().min(1) });
export type NewShareMessage = z.infer<typeof NewShareMessage>;

/**
 * GET /api/share/:slug/events streams these: Claude's work in the share thread, and the share state
 * when Claude writes a version. POST /api/share/:slug/stop stops Claude.
 */
export const ShareEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('threads'), threads: z.array(Thread) }),
  z.object({ type: z.literal('working'), threadId: z.string(), text: z.string(), tool: z.string().optional() }),
  z.object({ type: z.literal('idle') }),
  z.object({ type: z.literal('failed'), threadId: z.string(), message: z.string() }),
  z.object({ type: z.literal('state'), state: ShareState.shape.state }),
]);
export type ShareEvent = z.infer<typeof ShareEvent>;

/** POST .../share/:slug/:network/link: tagged or short. Answers with the ShareState. */
export const ChooseLink = z.object({ kind: z.enum(['tagged', 'short']) });
export type ChooseLink = z.infer<typeof ChooseLink>;

/** Any failed request */
export const Failure = z.object({ error: z.string() });
