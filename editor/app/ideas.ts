// The ideas page: the same writing/ideas.md that /idea adds to.
import { addIdea as add, type Idea, ideas, removeIdea as remove } from '../domain/ideas.ts';
import { dayOf } from '../domain/post.ts';
import { Refused } from './errors.ts';
import type { Clock, IdeasFile } from './ports.ts';

export const listIdeas = (file: IdeasFile) => async (): Promise<Idea[]> => ideas(await file.read());

/** Adds an idea at the top of the list, dated today, as /idea does. */
export const addIdea = (file: IdeasFile, clock: Clock) => async (text: string): Promise<Idea[]> => {
  if (!text.trim()) throw new Refused('An idea needs some words.');
  const next = add(await file.read(), text, dayOf(clock.now()));
  await file.write(next);
  return ideas(next);
};

export const removeIdea = (file: IdeasFile) => async (idea: Idea): Promise<Idea[]> => {
  const before = await file.read();
  const next = remove(before, idea);
  if (next !== before) await file.write(next);
  return ideas(next);
};
