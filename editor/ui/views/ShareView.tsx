import { computed, signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { checkPost, type MeasuredFold } from '../../domain/social/checks.ts';
import { figureKey } from '../../domain/social/figures.ts';
import { cleanHashtag } from '../../domain/social/hashtags.ts';
import type { MediaKind } from '../../domain/social/network.ts';
import { networks } from '../../domain/social/networks/registry.ts';
import { imageKey, resolvePost } from '../../domain/social/resolve.ts';
import type { ImageChoice, SocialPost } from '../../domain/social/social-post.ts';
import { type Preflight, routes, type SaveSocialPost, type Share } from '../../protocol.ts';
import { copiedSocialPost, loadPreflight, markPosted, renderShareImage, restoreSocialPost, saveSocialPost, unmarkPosted } from '../api.ts';
import { createAutosave } from '../autosave.ts';
import { KeySheet } from '../components/KeySheet.tsx';
import { formatAgo, formatNumber } from '../format.ts';
import { describeKey } from '../keymap.ts';
import { previews } from '../share/previews/index.ts';
import { ShareText, type ShareTextHandle } from '../share/ShareText.tsx';
import type { Mark } from './thread-marks.ts';

type State = Share['state'];
/** What Calvin has typed or chosen on a tab, saved by autosave. Unset fields keep the network's defaults. */
type Working = SaveSocialPost;

const MEDIA: Record<MediaKind, string> = { image: 'Image', 'link-card': 'Link card', 'text-only': 'Text only' };

/** The working copy over the saved post, leaving out fields Calvin hasn't set. */
function merged(saved: State['networks'][string] | undefined, working: Working): SocialPost {
  const base = (saved ?? { text: '', status: 'draft', versions: [] }) as SocialPost;
  const set = Object.fromEntries(Object.entries(working).filter(([, v]) => v !== undefined));
  return { ...base, ...set };
}

const isTyping = (el: Element | null) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el instanceof HTMLElement && el.isContentEditable);

/**
 * A published post's share page: a tab per network, each with the text, its checks and a phone
 * preview, hashtags, the link, the media choice, and copying and recording the posted URL.
 */
export function ShareView({ share, onPosts }: { share: Share; onPosts: () => void }) {
  const slug = share.post.slug;
  const s = useMemo(() => {
    const state = signal<State>(share.state);
    const working = signal<Record<string, Working>>(
      Object.fromEntries(
        networks.map((n) => {
          const p = share.state.networks[n.id];
          return [n.id, { text: p?.text ?? '', hashtags: p?.hashtags, media: p?.media as Working['media'] }];
        }),
      ),
    );
    const autosaves = Object.fromEntries(
      networks.map((n) => [
        n.id,
        createAutosave(
          async (json) => {
            state.value = await saveSocialPost(slug, n.id, JSON.parse(json) as Working);
          },
          500,
          3000,
          JSON.stringify(working.value[n.id]),
        ),
      ]),
    );
    const tab = signal(0);
    const folds = signal<Record<string, MeasuredFold>>({});
    const network = computed(() => networks[tab.value]);
    const ctx = { postUrl: share.post.postUrl, categories: share.post.categories, title: share.post.title, summary: share.post.summary };
    const resolved = computed(() => resolvePost(network.value, merged(state.value.networks[network.value.id], working.value[network.value.id]), ctx));
    const failures = computed(() => checkPost(network.value, resolved.value.parts, folds.value[network.value.id], resolved.value.image));
    return {
      state,
      working,
      autosaves,
      tab,
      folds,
      network,
      resolved,
      failures,
      // Where the fold falls in Calvin's text, when the preview measured this text.
      foldAt: computed(() => {
        const f = folds.value[network.value.id];
        const { assembled, parts } = resolved.value;
        if (!f || f.text !== assembled.text) return undefined;
        const at = f.offset - assembled.shift;
        return at >= 0 && at < parts.text.trimEnd().length ? at : undefined;
      }),
      preflight: signal<Preflight['checks'] | 'checking' | string>('checking'),
      // The image choice being rendered, and the last one that failed (not retried until Calvin asks).
      rendering: signal<string | undefined>(undefined),
      renderError: signal<{ key: string; message: string } | undefined>(undefined),
      versionsOpen: signal(false),
      sheetOpen: signal(false),
      lastKey: signal<string | undefined>(undefined),
      postedUrl: signal(''),
      toast: signal<string | undefined>(undefined),
      error: signal<string | undefined>(undefined),
    };
  }, [share]);
  const text = useRef<ShareTextHandle>(undefined);
  const network = s.network.value;
  const autosave = s.autosaves[network.id];
  const saved = s.state.value.networks[network.id];
  const work = s.working.value[network.id];
  const { parts, media, assembled, image } = s.resolved.value;
  const wantKey = image && imageKey(image);
  // The rendered image is current when it was made from the choices on screen.
  const rendered = saved?.rendered;
  const fresh = Boolean(rendered && rendered.key === wantKey);
  const imageSrc = rendered && `${routes.socialImage(slug, network.id)}?v=${encodeURIComponent(rendered.at)}`;

  // Renders whenever the image choice on screen differs from what was last rendered.
  useEffect(() => {
    const id = network.id;
    if (!wantKey || fresh || s.rendering.value === wantKey || s.renderError.value?.key === wantKey) return;
    s.rendering.value = wantKey;
    (async () => {
      await s.autosaves[id].flush();
      s.state.value = await renderShareImage(slug, id);
      if (s.renderError.value?.key === wantKey) s.renderError.value = undefined;
    })()
      .catch((err: Error) => (s.renderError.value = { key: wantKey, message: err.message }))
      .finally(() => s.rendering.value === wantKey && (s.rendering.value = undefined));
  }, [wantKey, fresh, network.id, s.renderError.value]);

  useEffect(() => {
    loadPreflight(slug).then(
      (checks) => (s.preflight.value = checks),
      (err: Error) => (s.preflight.value = err.message),
    );
  }, [s]);

  const flash = (message: string) => {
    s.toast.value = message;
    setTimeout(() => s.toast.value === message && (s.toast.value = undefined), 1800);
  };
  const fail = (err: unknown) => (s.error.value = (err as Error).message);

  /** Changes the image choice, keeping the rest of it. */
  const setImage = (patch: Partial<ImageChoice>, now = true) => {
    const current = s.working.value[s.network.value.id].media;
    change({ media: { ...(current?.kind === 'image' ? current : {}), ...patch, kind: 'image' } }, now);
  };

  const saveImage = () => {
    if (!s.state.value.networks[s.network.value.id]?.rendered) return;
    const a = document.createElement('a');
    a.href = `${routes.socialImage(slug, s.network.value.id)}?download=1`;
    a.download = '';
    a.click();
  };

  /** Records a change on the current tab and schedules its save. `now` saves straight away (eg a chip removed). */
  const change = (patch: Working, now = false) => {
    const id = s.network.value.id;
    const next = { ...s.working.value[id], ...patch };
    s.working.value = { ...s.working.value, [id]: next };
    s.autosaves[id].change(JSON.stringify(next));
    if (now) void s.autosaves[id].flush();
  };

  const actions = useRef({
    async copy() {
      const id = s.network.value.id;
      s.error.value = undefined;
      try {
        await s.autosaves[id].flush();
        const { parts, assembled } = s.resolved.value;
        await navigator.clipboard.writeText(assembled.text);
        s.state.value = await copiedSocialPost(slug, id, { text: parts.text, hashtags: parts.hashtags });
        flash('Copied');
      } catch (err) {
        fail(err);
      }
    },
    compose() {
      window.open(s.network.value.composeUrl, '_blank', 'noopener');
    },
    async restore(index: number) {
      const id = s.network.value.id;
      s.error.value = undefined;
      try {
        await s.autosaves[id].flush();
        const { parts } = s.resolved.value;
        const next = await restoreSocialPost(slug, id, { index, current: { text: parts.text, hashtags: parts.hashtags } });
        const p = next.networks[id];
        const w: Working = { ...s.working.value[id], text: p.text, hashtags: p.hashtags };
        // The server has this already, so the editor's change below doesn't save it again.
        s.autosaves[id].markSaved(JSON.stringify(w));
        s.working.value = { ...s.working.value, [id]: w };
        s.state.value = next;
        s.versionsOpen.value = false;
        text.current?.setText(p.text);
      } catch (err) {
        fail(err);
      }
    },
  });

  const flushAll = () => Promise.all(Object.values(s.autosaves).map((a) => a.flush()));
  const leave = () => void flushAll().then(onPosts, onPosts);

  useLayoutEffect(() => {
    const flush = () => void flushAll();
    const onKey = (e: KeyboardEvent) => {
      if (!['Meta', 'Alt', 'Control', 'Shift'].includes(e.key)) s.lastKey.value = describeKey(e);
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      const typing = isTyping(document.activeElement);
      // A bare letter on the page, or the letter with ⌥ anywhere (in a text box, letters are text).
      const key = e.altKey || !typing;
      const act = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (e.code === 'Escape') {
        if (s.sheetOpen.value) act(() => (s.sheetOpen.value = false));
        else if (s.versionsOpen.value) act(() => (s.versionsOpen.value = false));
        else if (typing) act(() => (document.activeElement as HTMLElement).blur());
        else act(leave);
        return;
      }
      if (!key) return;
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (digit && Number(digit[1]) <= networks.length) act(() => (s.tab.value = Number(digit[1]) - 1));
      else if (e.code === 'KeyC') act(() => void actions.current.copy());
      else if (e.code === 'KeyP') act(() => actions.current.compose());
      else if (e.code === 'KeyI') act(saveImage);
      else if (e.code === 'KeyV' && s.state.value.networks[s.network.value.id]?.versions.length) act(() => (s.versionsOpen.value = !s.versionsOpen.value));
      else if (e.code === 'KeyH') act(() => (s.sheetOpen.value = !s.sheetOpen.value));
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [s]);

  const marks: Mark[] = [
    ...s.failures.value.flatMap((f) => f.ranges.map((r) => ({ ...r, className: 'cm-bad' }))),
    ...(s.foldAt.value === undefined
      ? []
      : [
          { from: s.foldAt.value, to: s.foldAt.value + 1, className: 'cm-fold' },
          { from: s.foldAt.value, to: parts.text.length, className: 'cm-past' },
        ]),
  ];

  const Preview = previews[network.id];
  const versions = saved?.versions ?? [];
  const pf = s.preflight.value;
  const failedChecks = Array.isArray(pf) ? pf.filter((c) => !c.ok) : [];
  const count = network.count(assembled.text);

  return (
    <>
      <main class="page share-page">
        <div class="share">
          <header class="share-head">
            <div>
              <h1>{share.post.title}</h1>
              {share.post.summary && <p>{share.post.summary}</p>}
              <div class="share-url">{share.post.postUrl}</div>
            </div>
            <img class="share-og" src={share.post.image} alt="The post's preview card" onError={(e) => (e.currentTarget.hidden = true)} />
          </header>

          <section class="pf" aria-label="Pre-flight">
            {pf === 'checking' && <span class="pf-quiet">Checking the live page…</span>}
            {typeof pf === 'string' && pf !== 'checking' && <span class="pf-bad">{pf}</span>}
            {Array.isArray(pf) && failedChecks.length === 0 && <span class="pf-quiet">Live page and preview card look right</span>}
            {failedChecks.map((c) => (
              <span class="pf-bad" key={c.message}>
                {c.message}
              </span>
            ))}
          </section>

          <nav class="share-tabs" aria-label="Networks">
            {networks.map((n, i) => (
              <button type="button" key={n.id} class={`share-tab${i === s.tab.value ? ' on' : ''}`} aria-pressed={i === s.tab.value} onClick={() => (s.tab.value = i)}>
                {n.label}
                {s.state.value.networks[n.id]?.status === 'posted' && <span class="dot dot-claude" title="Posted" />}
                <kbd class="k">{i + 1}</kbd>
              </button>
            ))}
          </nav>

          <div class="share-work">
            <div class="share-edit">
              <section class="share-block">
                <div class="share-block-head">
                  <span class="share-label">Text</span>
                  {versions.length > 0 && (
                    <div class="share-versions">
                      <button type="button" class="share-versions-btn" onClick={() => (s.versionsOpen.value = !s.versionsOpen.value)} title="Versions (V)">
                        {versions.length} {versions.length === 1 ? 'version' : 'versions'}
                      </button>
                      {s.versionsOpen.value && (
                        <ul class="share-versions-list" role="menu" aria-label="Versions">
                          {versions
                            .map((v, i) => ({ v, i }))
                            .reverse()
                            .map(({ v, i }) => (
                              <li key={i} class="share-version">
                                <span class="share-version-text">{v.text.split('\n')[0] || '(empty)'}</span>
                                <span class="share-version-at">{formatAgo(new Date(v.at))}</span>
                                <button type="button" class="btn" role="menuitem" onClick={() => void actions.current.restore(i)}>
                                  Restore
                                </button>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <ShareText key={network.id} text={work.text ?? ''} label={`${network.label} post text`} marks={marks} handle={text} onChange={(t) => change({ text: t })} />
                <div class="share-meta">
                  <span class={count > network.limit ? 'over' : ''}>
                    {formatNumber(count)} / {formatNumber(network.limit)}
                  </span>
                  {s.foldAt.value !== undefined && (
                    <span>
                      <span class="fold-key" />
                      “…more”
                    </span>
                  )}
                </div>
                {s.failures.value.length > 0 && (
                  <ul class="share-checks" aria-label="Failing checks">
                    {s.failures.value.map((f) => (
                      <li key={f.check}>{f.message}</li>
                    ))}
                  </ul>
                )}
              </section>

              <section class="share-block">
                <div class="share-block-head">
                  <span class="share-label">Hashtags</span>
                </div>
                <div class="chips">
                  {parts.hashtags.map((t) => (
                    <span class="chip" key={t}>
                      #{t}
                      <button type="button" aria-label={`Remove #${t}`} onClick={() => change({ hashtags: parts.hashtags.filter((x) => x !== t) }, true)}>
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    aria-label="Add a hashtag"
                    placeholder="Add, then ↵"
                    onKeyDown={(e) => {
                      // Cleaned the way the server stores it, so what's copied matches what's saved.
                      const tag = cleanHashtag(e.currentTarget.value);
                      if (e.key === 'Enter' && !e.isComposing) {
                        if (tag && !parts.hashtags.some((t) => t.toLowerCase() === tag.toLowerCase())) change({ hashtags: [...parts.hashtags, tag] }, true);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              </section>

              <section class="share-block">
                <div class="share-block-head">
                  <span class="share-label">Link</span>
                </div>
                <div class="share-link">
                  <code>{parts.link}</code>
                  <button type="button" class="btn" onClick={() => navigator.clipboard.writeText(parts.link).then(() => flash('Link copied'), fail)}>
                    Copy link
                  </button>
                </div>
              </section>

              {network.media.length > 1 && (
                <section class="share-block">
                  <div class="share-block-head">
                    <span class="share-label">Media</span>
                    <div class="share-seg" role="group" aria-label="Media">
                      {network.media.map((m) => (
                        <button
                          type="button"
                          key={m}
                          class={m === media ? 'on' : ''}
                          aria-pressed={m === media}
                          // Image keeps its earlier choices (figure, theme, alt text) when Calvin comes back to it.
                          onClick={() => (m === 'image' ? setImage({}) : change({ media: { kind: m } }, true))}
                        >
                          {MEDIA[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {image && (
                    <div class="share-picker">
                      <ul class="share-figures" aria-label="Figures">
                        {share.figures.map((f) => {
                          const on = f.key === figureKey(image.figure);
                          return (
                            <li key={f.key}>
                              <button type="button" class={on ? 'on' : ''} aria-pressed={on} onClick={() => setImage({ figure: f.figure })}>
                                {f.label}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <div class="share-stage">
                        <div class="share-stage-tools">
                          {network.imageShapes.length > 1 && (
                            <div class="share-seg" role="group" aria-label="Shape">
                              {network.imageShapes.map((shape) => {
                                const on = (image.shape ?? (fresh ? rendered?.shape : undefined)) === shape.id;
                                return (
                                  <button type="button" key={shape.id} class={on ? 'on' : ''} aria-pressed={on} onClick={() => setImage({ shape: shape.id })}>
                                    {shape.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div class="share-seg" role="group" aria-label="Theme">
                            {(['day', 'night'] as const).map((t) => (
                              <button type="button" key={t} class={image.theme === t ? 'on' : ''} aria-pressed={image.theme === t} onClick={() => setImage({ theme: t })}>
                                {t === 'day' ? 'Day' : 'Night'}
                              </button>
                            ))}
                          </div>
                          {fresh && rendered && (
                            <span class="share-size">
                              {rendered.width} × {rendered.height}
                            </span>
                          )}
                        </div>
                        <div class="share-frame">
                          {imageSrc && <img src={imageSrc} alt={image.alt} class={fresh ? '' : 'stale'} />}
                          {s.rendering.value === wantKey && <span class="share-frame-note">Rendering…</span>}
                          {s.renderError.value?.key === wantKey && (
                            <span class="share-frame-note share-frame-error">
                              {s.renderError.value?.message}{' '}
                              <button type="button" class="btn" onClick={() => (s.renderError.value = undefined)}>
                                Try again
                              </button>
                            </span>
                          )}
                        </div>
                        {network.altText && (
                          <label class="share-alt">
                            <span class="share-label">Alt text</span>
                            <textarea
                              class="share-field"
                              rows={2}
                              aria-label="Alt text"
                              placeholder="What the image shows"
                              value={image.alt}
                              onInput={(e) => setImage({ alt: e.currentTarget.value }, false)}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              )}

              <section class="share-actions">
                <button type="button" class="btn btn-go" onClick={() => void actions.current.copy()}>
                  Copy text <kbd class="k">C</kbd>
                </button>
                {image && (
                  <button type="button" class="btn" disabled={!rendered} onClick={saveImage}>
                    Save image <kbd class="k">I</kbd>
                  </button>
                )}
                <button type="button" class="btn" onClick={() => actions.current.compose()}>
                  Open {network.label} <kbd class="k">P</kbd>
                </button>
                {saved?.posted ? (
                  <div class="share-posted-done">
                    <span>Posted {formatAgo(new Date(saved.posted.at))}</span>
                    <a href={saved.posted.url} target="_blank" rel="noopener">
                      {saved.posted.url}
                    </a>
                    <button type="button" class="share-undo" onClick={() => unmarkPosted(slug, network.id).then((st) => (s.state.value = st), fail)}>
                      Undo
                    </button>
                  </div>
                ) : (
                  <form
                    class="share-posted"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const url = s.postedUrl.value.trim();
                      if (!url) return;
                      s.error.value = undefined;
                      markPosted(slug, network.id, { url }).then((st) => {
                        s.state.value = st;
                        s.postedUrl.value = '';
                      }, fail);
                    }}
                  >
                    <input
                      class="share-field"
                      aria-label="Posted URL"
                      placeholder={`The ${network.label} post's URL, once posted`}
                      value={s.postedUrl.value}
                      onInput={(e) => (s.postedUrl.value = e.currentTarget.value)}
                    />
                    <button type="submit" class="btn">
                      Mark posted
                    </button>
                  </form>
                )}
                {s.error.value && <p class="share-error">{s.error.value}</p>}
              </section>
            </div>

            <aside class="phone" aria-label="Feed preview">
              {Preview && (
                <Preview
                  network={network}
                  text={assembled.text}
                  media={media}
                  image={image && imageSrc && rendered ? { src: imageSrc, alt: image.alt, width: rendered.width, height: rendered.height } : undefined}
                  post={share.post}
                  onFold={(f) => {
                    const prev = s.folds.peek()[network.id];
                    if (prev?.text !== f.text || prev.offset !== f.offset) s.folds.value = { ...s.folds.peek(), [network.id]: f };
                  }}
                />
              )}
            </aside>
          </div>
        </div>
      </main>
      <footer class="status">
        <div class="status-views">
          <button type="button" class="status-view" onClick={leave} title="Back to posts (esc)">
            Posts
          </button>
          <span class="status-view on">Share</span>
        </div>
        <div class="status-stats">
          {autosave.state.value === 'failed' && <span class="status-error">Not saved, retrying</span>}
          {saved?.status === 'ready' && <span>Copied, not posted yet</span>}
          <button type="button" class="status-keys" onClick={() => (s.sheetOpen.value = true)} title="Keyboard shortcuts (H)">
            Keys
          </button>
        </div>
      </footer>
      {s.toast.value && <div class="notice">{s.toast.value}</div>}
      {s.sheetOpen.value && <KeySheet lastKey={s.lastKey.value} onClose={() => (s.sheetOpen.value = false)} />}
    </>
  );
}
