import { Failure, type NewComment, type NewReply, Post, PostList, PreviewInfo, routes, type SavePost, type Settle, Threads } from '../protocol.ts';

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
