// A critique's progress (eg "Line critique · 3 of 7"), which Claude reports as it works through
// its checklist. It lives on the page thread, since a critique is about the whole post.
import { PAGE, type Thread } from './thread.ts';

export type Review = { title: string; done: number; total: number };

/** Records Claude's progress on the page thread (starting it if needed). Fails with a message Claude can act on. */
export function setReview(threads: Thread[], review: Review): { threads: Thread[] } | { error: string } {
  const { title, done, total } = review;
  if (!title.trim()) return { error: '`title` is empty.' };
  if (!Number.isInteger(done) || !Number.isInteger(total) || total < 1 || done < 0 || done > total) {
    return { error: '`done` and `total` must be whole numbers with 0 <= done <= total and total >= 1.' };
  }
  const clean = { title: title.trim(), done, total };
  if (!threads.some((t) => t.id === PAGE)) return { threads: [...threads, { id: PAGE, resolved: false, messages: [], review: clean }] };
  return { threads: threads.map((t) => (t.id === PAGE ? { ...t, review: clean } : t)) };
}
