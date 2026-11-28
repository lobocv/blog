// Starting a post from the ideas page: the same steps /scope takes in a terminal, with the draft
// made first so the interview can run in its page thread.
import type { Idea } from '../domain/ideas.ts';
import { createDraft } from './create-draft.ts';
import { removeIdea } from './ideas.ts';
import type { Clock, IdeasFile, PostLibrary, ThreadStore } from './ports.ts';
import { addComment } from './threads.ts';

type Deps = { library: PostLibrary; threads: ThreadStore; clock: Clock; ideas: IdeasFile };

/**
 * Makes a draft with Calvin's working title, takes the idea off the list and asks for /scope in
 * the draft's page thread. Returns the slug and the thread for Claude to reply in.
 */
export const scopeIdea =
  (deps: Deps) =>
  async (idea: Idea, title: string): Promise<{ slug: string; threadId: string }> => {
    // First, so a title that's taken changes nothing.
    const slug = await createDraft(deps.library, deps.clock)(title);
    await removeIdea(deps.ideas)(idea);
    const series = idea.series ? `[${idea.series}] ` : '';
    const { id } = await addComment(deps)(slug, { text: `/scope ${series}${idea.text}` });
    return { slug, threadId: id };
  };
