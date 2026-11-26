// The writing editor shows the real `astro dev` page in an iframe. Astro injects startBridge into
// that page (see astro.config.mjs), and the two sides talk with these messages. Lines count from
// the top of the post file, front matter included, as in `src/lib/source-lines.mjs`.

/** Where a post is served on the site. */
export const postPath = (slug: string) => `/posts/${encodeURIComponent(slug)}/`;

/** A rendered block (paragraph, heading, list item, ...): the line it starts on and how far it is from the top of the window. */
export type BlockPlace = { line: number; top: number };

/** Editor to page. `marks` highlights the blocks that have threads, `selected` the selected thread's block. */
export type ToPage = { type: 'scrollTo'; line: number } | { type: 'marks'; lines: number[]; selected?: number };

/**
 * Page to editor. Keys are passed on because a focused iframe gets them instead of the editor.
 * `selection` (with ⌘K) says what Calvin selected and which block it's in.
 */
export type FromPage =
  | { type: 'ready' }
  | { type: 'at'; line: number }
  | { type: 'blocks'; blocks: BlockPlace[] }
  | {
      type: 'key';
      code: string;
      key: string;
      metaKey: boolean;
      altKey: boolean;
      ctrlKey: boolean;
      shiftKey: boolean;
      selection?: { line: number; text: string };
    };

/** Of things that start on a line, the last one starting on or above `line`. */
export function lastAtOrAbove<T>(items: Iterable<T>, line: number, lineOf: (t: T) => number): T | undefined {
  let best: T | undefined;
  let bestLine = -1;
  for (const item of items) {
    const at = lineOf(item);
    if (at <= line && at > bestLine) [best, bestLine] = [item, at];
  }
  return best;
}

const dataLine = (el: Element) => Number(el.getAttribute('data-line'));

/** The block that holds `line`: the last tagged block starting on or above it. */
export const blockAt = (blocks: Iterable<Element>, line: number) => lastAtOrAbove(blocks, line, dataLine);

const MARK_STYLE = `
[data-editor-mark] { background: rgba(232, 184, 96, .10); box-shadow: 0 0 0 6px rgba(232, 184, 96, .10); border-radius: 2px; }
[data-editor-mark="on"] { background: rgba(232, 184, 96, .22); box-shadow: 0 0 0 6px rgba(232, 184, 96, .22); }
`;

/** Runs in the preview page. Does nothing unless the page is inside the editor. */
export function startBridge(win: Window) {
  if (win.parent === win) return;
  const doc = win.document;
  const send = (msg: FromPage) => win.parent.postMessage(msg, '*');
  const blocks = () => [...doc.querySelectorAll('[data-line]')];
  // The site's nav bar stays on screen, so the block in view is the first one below it.
  const headerBottom = () => {
    let bottom = 0;
    for (const el of doc.querySelectorAll('header, nav')) {
      const r = el.getBoundingClientRect();
      if (r.top <= 0 && ['sticky', 'fixed'].includes(win.getComputedStyle(el).position)) bottom = Math.max(bottom, r.bottom);
    }
    return bottom;
  };

  const style = doc.createElement('style');
  style.textContent = MARK_STYLE;
  doc.head.append(style);

  const report = () => {
    const all = blocks();
    send({ type: 'blocks', blocks: all.map((el) => ({ line: dataLine(el), top: el.getBoundingClientRect().top })) });
    const below = headerBottom();
    const top = all.find((el) => el.getBoundingClientRect().bottom > below);
    if (top) send({ type: 'at', line: dataLine(top) });
  };

  // One report per frame at most, however fast the page scrolls.
  let queued = false;
  const queueReport = () => {
    if (queued) return;
    queued = true;
    win.requestAnimationFrame(() => {
      queued = false;
      report();
    });
  };

  win.addEventListener('message', (e: MessageEvent<ToPage>) => {
    if (e.source !== win.parent) return;
    const msg = e.data;
    if (msg?.type === 'scrollTo') {
      const el = blockAt(blocks(), msg.line);
      if (el) win.scrollTo({ top: win.scrollY + el.getBoundingClientRect().top - headerBottom() - 16 });
      queueReport();
    } else if (msg?.type === 'marks') {
      for (const el of doc.querySelectorAll('[data-editor-mark]')) el.removeAttribute('data-editor-mark');
      const all = blocks();
      for (const line of msg.lines) blockAt(all, line)?.setAttribute('data-editor-mark', '');
      if (msg.selected !== undefined) blockAt(all, msg.selected)?.setAttribute('data-editor-mark', 'on');
    }
  });

  win.addEventListener('scroll', queueReport);
  win.addEventListener('resize', queueReport);
  // Images and fonts loading move the blocks.
  new ResizeObserver(queueReport).observe(doc.body);

  win.addEventListener('keydown', (e) => {
    const { code, key, metaKey, altKey, ctrlKey, shiftKey } = e;
    // ⌥ plus a letter would type a character, and ⌘\, ⌘K and ⌘/ belong to the editor.
    if (altKey || (metaKey && ['Backslash', 'KeyK', 'Slash'].includes(code))) e.preventDefault();
    send({ type: 'key', code, key, metaKey, altKey, ctrlKey, shiftKey, selection: metaKey && code === 'KeyK' ? selection() : undefined });
  });

  function selection() {
    const sel = win.getSelection();
    const node = sel?.anchorNode;
    const el = (node instanceof Element ? node : node?.parentElement)?.closest('[data-line]');
    return el ? { line: dataLine(el), text: sel!.toString() } : undefined;
  }

  send({ type: 'ready' });
  queueReport();
}
