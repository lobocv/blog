// Pure logic for the journey page: data checks, side-item placement and the
// scroll-to-camera mapping. Rendering is in src/pages/journey.astro and src/scripts/journey/.
import type { Chapter, SideItem, TIMELINE } from '../data/timeline';

const DASH = '—';

/** Problems with the timeline data, one message each. Empty means valid. */
export function validateTimeline(t: typeof TIMELINE): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  t.chapters.forEach((c, i) => {
    if (ids.has(c.id)) errs.push(`duplicate chapter id "${c.id}"`);
    ids.add(c.id);
    if (c.end && c.end < c.start) errs.push(`"${c.id}" ends (${c.end}) before it starts (${c.start})`);
    const texts = [c.title, c.role ?? '', ...c.paragraphs, ...(c.bullets ?? [])];
    if (texts.some(s => s.includes(DASH))) errs.push(`"${c.id}" contains an em-dash`);
    const prev = t.chapters[i - 1];
    if (!prev) return;
    if (c.start < prev.start) errs.push(`"${c.id}" starts before "${prev.id}"; chapters must be in order`);
    if (c.age < prev.age) errs.push(`"${c.id}" has a younger wolf than "${prev.id}"`);
    // Same-month handover is fine; only a start strictly before the previous end overlaps
    if (c.kind === 'work' && prev.kind === 'work' && (!prev.end || c.start < prev.end))
      errs.push(`work chapters "${prev.id}" and "${c.id}" overlap`);
  });
  for (const s of t.side) {
    if ([s.title, s.summary, s.body ?? ''].some(x => x.includes(DASH))) errs.push(`side item "${s.title}" contains an em-dash`);
  }
  return errs;
}

/** Side items keyed by the id of the chapter they ran alongside: the last chapter starting on or before the item. */
export function attachSideItems(chapters: Chapter[], side: SideItem[]): Map<string, SideItem[]> {
  const out = new Map<string, SideItem[]>();
  for (const s of side) {
    const host = chapters.filter(c => c.start <= s.start).at(-1) ?? chapters[0];
    if (!host) continue;
    out.set(host.id, [...(out.get(host.id) ?? []), s]);
  }
  return out;
}

/**
 * Where the camera sits for a reading line (a document y), as a fractional chapter position.
 * `tops` are the rows' document tops in order; `lastBottom` is where the last row's span ends.
 * Before the first row the camera approaches from -0.6; past the end it stops at chapters.length.
 */
export function cameraPos(tops: number[], line: number, lastBottom: number): { index: number; pos: number } {
  let i = -1;
  for (let k = 0; k < tops.length; k++) if (tops[k] <= line) i = k;
  if (i < 0) return { index: 0, pos: -0.6 * (1 - Math.max(0, line / tops[0])) };
  const next = tops[i + 1] ?? lastBottom;
  return { index: i, pos: i + Math.min(1, (line - tops[i]) / (next - tops[i])) };
}

/** Share of a chapter's scroll over which the wolf grows into that chapter's age */
const AGE_BLEND = 0.2;

/**
 * The wolf's (fractional) age at a camera position, so growing up is tied to scroll like everything
 * else in the scene: it blends from the previous chapter's age over the first AGE_BLEND of a chapter.
 */
export function ageAt(ages: number[], pos: number): number {
  const i = Math.max(0, Math.min(ages.length - 1, Math.floor(pos)));
  const f = pos - i, prev = ages[i - 1];
  if (prev === undefined || f >= AGE_BLEND) return ages[i];
  return prev + (ages[i] - prev) * Math.max(0, f) / AGE_BLEND;
}
