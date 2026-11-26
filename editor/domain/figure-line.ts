// Lines that only place a figure, which Source shows rendered below the line: a component with
// no children (eg `<ContextStack />`) or an image. A component with children (eg a callout around
// Calvin's prose) stays as text.
import { type Figure, figureIn } from './figure.ts';

/** The figure a line places on its own, with any plain string props (`steps="3"`). */
export function figureLine(line: string, postText: string, postPath: string): (Figure & { props?: Record<string, string> }) | undefined {
  const tag = /^\s*<([A-Z][\w.]*)((?:\s+[\w-]+="[^"]*")*)\s*\/>\s*$/.exec(line);
  if (tag) {
    const figure = figureIn(line, postText, postPath);
    const props = Object.fromEntries([...tag[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    return figure && { ...figure, props };
  }
  if (/^\s*!\[[^\]]*\]\([^)]+\)\s*$/.test(line) || /^\s*<img\b[^>]*>\s*$/i.test(line)) return figureIn(line, postText, postPath);
  return undefined;
}

/** Where the preview server shows a figure: the editor's page for one component, or the image file. */
export function figureUrl(figure: Figure & { props?: Record<string, string> }, origin: string): string | undefined {
  if (figure.kind === 'component') {
    if (!figure.source) return undefined;
    const props = figure.props && Object.keys(figure.props).length ? `&props=${encodeURIComponent(JSON.stringify(figure.props))}` : '';
    return `${origin}/_editor/figure?src=${encodeURIComponent(figure.source)}${props}`;
  }
  if (/^[a-z]+:/i.test(figure.src)) return figure.src;
  // Astro serves public/ at the root, and Vite serves the post's own files by their path.
  return `${origin}/${figure.src.replace(/^public\//, '')}`;
}
