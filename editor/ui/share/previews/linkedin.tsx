// LinkedIn's phone feed: a white card on a warm grey feed, the text cut after the fold's lines
// with "…more" on the last one, then the link card.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { longestFitting } from '../fold.ts';
import type { PreviewProps } from '../preview-props.ts';

const MORE = '…more';

/** Links and hashtags in LinkedIn's blue. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/\S+|(?<![\p{L}\p{N}_])#[\p{L}\p{N}_]+)/u).map((part, i) =>
        i % 2 ? (
          <span class="fp-link" key={i}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function LinkedInPreview({ network, text, media, image, post, onFold }: PreviewProps) {
  const feed = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [cut, setCut] = useState(text.length);
  const [open, setOpen] = useState(false);
  const report = useRef(onFold);
  report.current = onFold;
  const lines = network.fold.kind === 'lines' ? network.fold.lines : undefined;

  // Measures a hidden copy of the text at the same width, so showing "…more" can't change what's measured.
  useLayoutEffect(() => {
    const el = measure.current;
    if (!el || lines === undefined) return;
    const run = () => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      // No layout (eg in tests): everything shows.
      if (!(lineHeight > 0) || !el.getBoundingClientRect().width) {
        setCut(text.length);
        return report.current({ text, offset: text.length });
      }
      const max = lines * lineHeight + 1;
      let k = longestFitting(text.length, (n) => {
        el.textContent = n === text.length ? text : `${text.slice(0, n).trimEnd()} ${MORE}`;
        return el.getBoundingClientRect().height <= max;
      });
      // The feed cuts between words, so a word the label doesn't leave room for goes below the fold.
      if (k < text.length && /\S/.test(text[k] ?? '') && /\S/.test(text[k - 1] ?? '')) {
        const space = text.slice(0, k).search(/\s\S*$/);
        if (space > 0) k = space + 1;
      }
      setCut(k);
      report.current({ text, offset: k });
    };
    run();
    let live = true;
    void document.fonts?.ready.then(() => live && run());
    document.fonts?.addEventListener('loadingdone', run);
    // The feed's box only changes size when the window does.
    const resized = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(run);
    if (feed.current) resized?.observe(feed.current);
    return () => {
      live = false;
      document.fonts?.removeEventListener('loadingdone', run);
      resized?.disconnect();
    };
  }, [text, lines]);

  const folded = !open && cut < text.length;
  return (
    <div class="phone-shell">
      <div class="feed feed-li" ref={feed} aria-label={`${network.label} preview`}>
        <article class="fp">
          <div class="fp-head">
            <span class="av">CL</span>
            <span class="fp-who">
              <b>Calvin Lobo</b>
              <span>now</span>
            </span>
          </div>
          <div class="fp-body">
            <div class="fp-text fp-measure" ref={measure} aria-hidden="true" />
            <div class="fp-text">
              <Rich text={folded ? text.slice(0, cut).trimEnd() : text} />
              {folded && (
                <>
                  {' '}
                  <button type="button" class="fp-more" onClick={() => setOpen(true)}>
                    {MORE}
                  </button>
                </>
              )}
            </div>
          </div>
          {media === 'image' &&
            (image ? (
              <img class="fp-image" src={image.src} alt={image.alt} style={{ aspectRatio: `${image.width} / ${image.height}` }} />
            ) : (
              <div class="fp-image fp-image-empty">No image yet</div>
            ))}
          {media === 'link-card' && (
            <div class="card">
              <img src={post.image} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
              <div>
                <b>{post.title}</b>
                <span>{new URL(post.postUrl).hostname.replace(/^www\./, '')}</span>
              </div>
            </div>
          )}
          <div class="fp-bar">
            <span>Like</span>
            <span>Comment</span>
            <span>Repost</span>
            <span>Send</span>
          </div>
        </article>
        <div class="ghost">
          <i style="width:40%" />
          <i />
          <i style="width:75%" />
        </div>
      </div>
    </div>
  );
}
