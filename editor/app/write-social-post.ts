// Claude's write_social_post tool: it saves a version straight away (social posts are Claude's to
// write), and puts it on screen unless Calvin has typed since Claude's turn started.
import { postFigures } from '../domain/social/figures.ts';
import { claudeWrote, type ImageChoice, type ShareState } from '../domain/social/social-post.ts';
import { Refused } from './errors.ts';
import type { Clock } from './ports.ts';
import { clean } from './save-social-post.ts';
import { changePost, type Deps, publishedPost } from './share-post.ts';

export type Written = { network: string; text: string; hashtags: string[]; figure?: string; alt?: string; claims?: string[] };

type WriteDeps = Deps & { clock: Clock; /** Each network's text when Claude's turn started. */ turnStart: (slug: string) => Record<string, string> | undefined };

export const writeSocialPost = (deps: WriteDeps) => async (slug: string, w: Written): Promise<{ state: ShareState; replaced: boolean }> => {
  if (!w.text.trim()) throw new Refused('The text is empty.');
  await publishedPost(deps.library, slug);
  const figures = w.figure === undefined ? [] : postFigures((await deps.library.read(slug))?.text ?? '', deps.library.pathOf(slug));
  const figure = w.figure === undefined ? undefined : figures.find((f) => f.key === w.figure)?.figure;
  if (w.figure !== undefined && !figure) throw new Refused(`No figure "${w.figure}". The keys are: ${figures.map((f) => f.key).join(', ')}.`);
  let replaced = false;
  const state = await changePost(deps, slug, w.network, (post, network) => {
    const start = deps.turnStart(slug)?.[network.id];
    // Without a turn to compare against (eg a call after it ended), only fill an empty box.
    replaced = start === undefined ? !post.text.trim() : post.text === start;
    let media: ImageChoice | undefined;
    if ((figure || w.alt !== undefined) && network.media.includes('image')) {
      const current = post.media?.kind === 'image' ? post.media : { kind: 'image' as const };
      media = { ...current, ...(figure && { figure }), ...(w.alt !== undefined && { alt: w.alt }) };
    }
    const flags = (w.claims ?? []).map((c) => c.trim()).filter(Boolean);
    return claudeWrote(post, { text: w.text.trim(), hashtags: clean(w.hashtags), media, flags }, deps.clock.now().toISOString(), replaced);
  });
  return { state, replaced };
};
