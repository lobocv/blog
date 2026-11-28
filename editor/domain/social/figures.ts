// The images a network's post can carry: the post's preview card, then each figure the post places
// on a line of its own, in the order they appear.
import { figureLine } from '../figure-line.ts';
import type { FigureRef } from './social-post.ts';

export type FigureOption = { key: string; label: string; figure: FigureRef };

/** A stable name for a figure, to tell choices apart and to know when a render is out of date. */
export const figureKey = (f: FigureRef): string =>
  f.kind === 'preview' ? 'preview' : f.kind === 'image' ? `image:${f.src}` : `component:${f.source}${f.props && Object.keys(f.props).length ? JSON.stringify(f.props) : ''}`;

/** `postPath` is the post file relative to the repo, for resolving its imports and images. */
export function postFigures(postText: string, postPath: string): FigureOption[] {
  const out: FigureOption[] = [{ key: 'preview', label: 'Preview card', figure: { kind: 'preview' } }];
  for (const line of postText.split('\n')) {
    const f = figureLine(line, postText, postPath);
    if (!f) continue;
    let figure: FigureRef;
    let label: string;
    if (f.kind === 'component') {
      if (!f.source) continue;
      figure = { kind: 'component', source: f.source, ...(f.props && Object.keys(f.props).length && { props: f.props }) };
      label = f.name;
    } else {
      figure = { kind: 'image', src: f.src };
      label = f.alt || f.src.split('/').pop()!;
    }
    const key = figureKey(figure);
    if (!out.some((o) => o.key === key)) out.push({ key, label, figure });
  }
  return out;
}
