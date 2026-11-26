// Threads can be on a figure as well as on words: an MDX component (eg `<ContextStack />`) or a
// Markdown image. The thread quotes the line that places it, like any other thread, and this
// works out what that line shows so Claude knows where the figure's code or image file is.

export type Figure =
  /** `source` is the component's file, from the post's import, relative to the repo. */
  | { kind: 'component'; name: string; source?: string }
  /** `src` is relative to the repo when the image sits next to the post. */
  | { kind: 'image'; src: string; alt: string };

/** The figure a quoted line places, if it places one. `postPath` is the post file, relative to the repo. */
export function figureIn(quote: string, postText: string, postPath: string): Figure | undefined {
  const tag = /^\s*<([A-Z][\w.]*)/.exec(quote);
  if (tag) {
    const name = tag[1];
    const from = new RegExp(`^import\\s+${name.replace('.', '\\.')}\\s+from\\s+['"]([^'"]+)['"]`, 'm').exec(postText)?.[1];
    return { kind: 'component', name, source: from && resolve(postPath, from) };
  }
  const md = /!\[([^\]]*)\]\(\s*([^)\s]+)/.exec(quote);
  if (md) return { kind: 'image', alt: md[1], src: fileOf(postPath, md[2]) };
  const html = /<img\b[^>]*>/i.exec(quote)?.[0];
  const src = html && /\ssrc=["']([^"']+)["']/.exec(html)?.[1];
  if (src) return { kind: 'image', alt: /\salt=["']([^"']*)["']/.exec(html)?.[1] ?? '', src: fileOf(postPath, src) };
  return undefined;
}

/** Where an image's file is: next to the post, in public/ for a site path, or a URL as it is. */
function fileOf(postPath: string, src: string): string {
  if (/^[a-z]+:/i.test(src)) return src;
  return src.startsWith('/') ? `public${src}` : resolve(postPath, src);
}

/** `rel` (eg `../../components/X.astro`) as seen from the folder holding `file`. */
function resolve(file: string, rel: string): string {
  if (!rel.startsWith('.')) return rel;
  const parts = file.split('/').slice(0, -1);
  for (const p of rel.split('/')) {
    if (p === '..') parts.pop();
    else if (p !== '.') parts.push(p);
  }
  return parts.join('/');
}
