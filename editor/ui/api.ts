import {
  type Copied,
  CreatedDraft,
  Failure,
  Ideas,
  type NewIdea,
  type NewDraft,
  type NewComment,
  type NewReply,
  type NewShareMessage,
  type ChooseLink,
  Post,
  PostList,
  type Posted,
  Preflight,
  PreviewInfo,
  type Restore,
  routes,
  type SavePost,
  type SaveSocialPost,
  type ScopeIdea,
  type Settle,
  Share,
  ShareState,
  Threads,
} from '../protocol.ts';

async function failure(res: Response, fallback: string): Promise<Error> {
  const body = Failure.safeParse(await res.json().catch(() => null));
  return new Error(body.success ? body.data.error : `${fallback} (${res.status})`);
}

export async function loadPosts(): Promise<PostList['posts']> {
  const res = await fetch(routes.posts);
  if (!res.ok) throw await failure(res, "Couldn't list the posts");
  return PostList.parse(await res.json()).posts;
}

export async function loadPost(slug: string): Promise<Post> {
  const res = await fetch(routes.post(slug));
  if (!res.ok) throw await failure(res, "Couldn't open the post");
  return Post.parse(await res.json());
}

export async function savePost(slug: string, text: string): Promise<void> {
  const body: SavePost = { text };
  const res = await fetch(routes.post(slug), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    // Lets a save started as the window closes finish. Browsers cap keepalive bodies at 64 KB.
    keepalive: text.length < 60_000,
  });
  if (!res.ok) throw await failure(res, 'Save failed');
}

export async function loadIdeas(): Promise<Ideas['ideas']> {
  const res = await fetch(routes.ideas);
  if (!res.ok) throw await failure(res, "Couldn't read the ideas");
  return Ideas.parse(await res.json()).ideas;
}

async function changeIdeas(method: 'POST' | 'DELETE', body: unknown, fallback: string): Promise<Ideas['ideas']> {
  const res = await fetch(routes.ideas, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw await failure(res, fallback);
  return Ideas.parse(await res.json()).ideas;
}

export const addIdea = (text: string) => changeIdeas('POST', { text } satisfies NewIdea, "Couldn't add the idea");
export const removeIdea = (idea: Ideas['ideas'][number]) => changeIdeas('DELETE', idea, "Couldn't remove the idea");

/** Starts a draft from an idea with a working title, with /scope running in its page thread. Resolves with its slug. */
export async function scopeIdea(idea: Ideas['ideas'][number], title: string): Promise<string> {
  const body: ScopeIdea = { idea, title };
  const res = await fetch(routes.scopeIdea, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw await failure(res, "Couldn't start the post");
  return CreatedDraft.parse(await res.json()).slug;
}

/** Starts a draft from a title. Resolves with its slug. */
export async function createDraft(title: string): Promise<string> {
  const body: NewDraft = { title };
  const res = await fetch(routes.posts, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw await failure(res, "Couldn't start the draft");
  return CreatedDraft.parse(await res.json()).slug;
}

export async function deleteDraft(slug: string): Promise<void> {
  const res = await fetch(routes.post(slug), { method: 'DELETE' });
  if (!res.ok) throw await failure(res, "Couldn't delete the draft");
}

/** Waits until the preview server is up. */
export async function loadPreviewOrigin(): Promise<string> {
  const res = await fetch(routes.preview);
  if (!res.ok) throw await failure(res, "The preview didn't start");
  return PreviewInfo.parse(await res.json()).origin;
}

async function threadsFrom(res: Response, fallback: string): Promise<Threads['threads']> {
  if (!res.ok) throw await failure(res, fallback);
  return Threads.parse(await res.json()).threads;
}

const postJson = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export async function loadThreads(slug: string) {
  return threadsFrom(await fetch(routes.threads(slug)), "Couldn't load the threads");
}

export async function addComment(slug: string, comment: NewComment) {
  return threadsFrom(await postJson(routes.threads(slug), comment), "Couldn't add the comment");
}

export async function replyToThread(slug: string, id: string, reply: NewReply) {
  return threadsFrom(await postJson(`${routes.thread(slug, id)}/replies`, reply), "Couldn't send the reply");
}

export async function resolveThread(slug: string, id: string) {
  return threadsFrom(await postJson(`${routes.thread(slug, id)}/resolve`, {}), "Couldn't resolve the thread");
}

export async function stopClaude(slug: string) {
  await fetch(routes.stop(slug), { method: 'POST' });
}

export async function settleSuggestion(slug: string, id: string, settle: Settle) {
  return threadsFrom(await postJson(routes.suggestion(slug, id), settle), "Couldn't save the suggestion");
}

// The share page.

export async function loadShare(slug: string): Promise<Share> {
  const res = await fetch(routes.share(slug));
  if (!res.ok) throw await failure(res, "Couldn't open the share page");
  return Share.parse(await res.json());
}

export async function loadPreflight(slug: string): Promise<Preflight['checks']> {
  const res = await fetch(routes.preflight(slug));
  if (!res.ok) throw await failure(res, "Couldn't check the live page");
  return Preflight.parse(await res.json()).checks;
}

async function shareState(res: Response, fallback: string): Promise<ShareState['state']> {
  if (!res.ok) throw await failure(res, fallback);
  return ShareState.parse(await res.json()).state;
}

const json = (method: string, body?: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

export async function saveSocialPost(slug: string, network: string, change: SaveSocialPost) {
  return shareState(await fetch(routes.socialPost(slug, network), { ...json('PUT', change), keepalive: true }), 'Save failed');
}

export async function copiedSocialPost(slug: string, network: string, copied: Copied) {
  return shareState(await fetch(`${routes.socialPost(slug, network)}/copied`, json('POST', copied)), "Couldn't keep the copied version");
}

export async function restoreSocialPost(slug: string, network: string, restore: Restore) {
  return shareState(await fetch(`${routes.socialPost(slug, network)}/restore`, json('POST', restore)), "Couldn't restore that version");
}

export async function markPosted(slug: string, network: string, posted: Posted) {
  return shareState(await fetch(`${routes.socialPost(slug, network)}/posted`, json('POST', posted)), "Couldn't mark it posted");
}

export async function unmarkPosted(slug: string, network: string) {
  return shareState(await fetch(`${routes.socialPost(slug, network)}/posted`, json('DELETE')), "Couldn't undo posted");
}

/** Renders the network's image again from its current choices. */
export async function renderShareImage(slug: string, network: string) {
  return shareState(await fetch(routes.socialImage(slug, network), json('POST', {})), "Couldn't render the image");
}

/** The share thread: Calvin's messages to Claude on the share page, and its replies. */
export async function loadShareThread(slug: string) {
  return threadsFrom(await fetch(routes.shareThread(slug)), "Couldn't load the share thread");
}

export async function sendShareMessage(slug: string, message: NewShareMessage) {
  return threadsFrom(await postJson(routes.shareThread(slug), message), "Couldn't send the message");
}

export async function stopShareClaude(slug: string) {
  await fetch(routes.shareStop(slug), { method: 'POST' });
}

/** Tagged or short link for a network's post. A short link gets its code the first time. */
export async function chooseLink(slug: string, network: string, choice: ChooseLink) {
  return shareState(await fetch(`${routes.socialPost(slug, network)}/link`, json('POST', choice)), "Couldn't change the link");
}
