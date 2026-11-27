import { useSignal } from '@preact/signals';
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { PostList } from '../../protocol.ts';
import { PageTabs } from '../components/PageTabs.tsx';
import { formatAgo, formatDate, formatNumber } from '../format.ts';

type Summary = PostList['posts'][number];

type Props = {
  /** Drafts first, then published posts, as the server lists them. */
  posts: Summary[];
  onOpen: (slug: string) => void;
  onDelete: (slug: string) => Promise<void>;
  /** Starts a draft with this title (and opens it). */
  onCreate: (title: string) => Promise<void>;
  /** The ideas page (I). */
  onIdeas?: () => void;
  /** The share page for a published post (S). */
  onShare?: (slug: string) => void;
};

/**
 * The first page: drafts, then published posts. J/K or arrows to move, Enter to open, ⌫ to delete
 * a draft, N (or the + button) to start one, S to share a published post.
 */
export function PostsView({ posts, onOpen, onDelete, onCreate, onIdeas, onShare }: Props) {
  // Signals, not state: a key handler must see the previous key's effect even
  // before the next render (eg ⌫ then Enter typed quickly).
  const selected = useSignal(0);
  const confirming = useSignal<string | undefined>(undefined);
  const error = useSignal<string | undefined>(undefined);
  // Typing the title of a new draft.
  const naming = useSignal(false);
  const props = useRef({ posts, onOpen, onDelete, onIdeas, onShare });
  props.current = { posts, onOpen, onDelete, onIdeas, onShare };

  const index = Math.min(selected.value, posts.length - 1);

  // Layout effect so keys pressed right after the page appears aren't lost.
  useLayoutEffect(() => {
    function onKey(e: KeyboardEvent) {
      const { posts, onOpen, onDelete, onIdeas, onShare } = props.current;
      const current = posts[Math.min(selected.value, posts.length - 1)];
      if (e.metaKey || e.ctrlKey || e.altKey || naming.value) return;
      if (e.code === 'KeyI' && onIdeas && !confirming.value) {
        e.preventDefault();
        onIdeas();
        return;
      }
      if (e.code === 'KeyN') {
        e.preventDefault();
        error.value = undefined;
        naming.value = true;
        return;
      }
      if (!current) return;
      const doing = (fn: () => void) => {
        e.preventDefault();
        error.value = undefined;
        fn();
      };
      if (confirming.value) {
        const slug = confirming.value;
        if (e.code === 'Enter') doing(() => {
          confirming.value = undefined;
          onDelete(slug).catch((err: Error) => (error.value = err.message));
        });
        else if (e.code === 'Escape') doing(() => (confirming.value = undefined));
        return;
      }
      const move = (by: number) => (selected.value = Math.max(0, Math.min(posts.length - 1, selected.value + by)));
      if (e.code === 'KeyJ' || e.code === 'ArrowDown') doing(() => move(1));
      else if (e.code === 'KeyK' || e.code === 'ArrowUp') doing(() => move(-1));
      else if (e.code === 'Enter') doing(() => onOpen(current.slug));
      // Only published posts can be shared.
      else if (e.code === 'KeyS' && !current.draft && onShare) doing(() => onShare(current.slug));
      // Only drafts can be deleted here.
      else if ((e.code === 'Backspace' || e.code === 'Delete') && current.draft) doing(() => (confirming.value = current.slug));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Selected rows keep their place in the flat list, so J/K run straight from drafts into published posts.
  const row = (p: Summary, i: number) => (
    <li
      key={p.slug}
      role="option"
      aria-selected={i === index}
      class={`draft${i === index ? ' on' : ''}`}
      onClick={() => onOpen(p.slug)}
      onMouseEnter={() => !confirming.value && (selected.value = i)}
    >
      <span class="draft-name">{p.title}</span>
      {confirming.value === p.slug ? (
        <span class="draft-meta draft-confirm">Delete this draft? ↵ delete · esc keep</span>
      ) : (
        <span class="draft-meta">
          {p.slug} · {formatNumber(p.words)} words ·{' '}
          {!p.draft && p.date ? `published ${formatDate(p.date)}` : `edited ${formatAgo(new Date(p.modified))}`}
        </span>
      )}
    </li>
  );
  const drafts = posts.filter((p) => p.draft).length;

  return (
    <>
      <main class="page page-centered">
        <div class="column drafts">
          <div class="drafts-head">
            <h1 class="drafts-title">Drafts</h1>
            <button type="button" class="drafts-new" aria-label="New draft" title="New draft (N)" onClick={() => (naming.value = true)}>
              +
            </button>
          </div>
          {naming.value && (
            <input
              class="drafts-name"
              aria-label="Title of the new draft"
              placeholder="Title, then ↵"
              ref={(el) => el?.focus()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') naming.value = false;
                else if (e.key === 'Enter' && !e.isComposing && e.currentTarget.value.trim()) {
                  error.value = undefined;
                  onCreate(e.currentTarget.value).catch((err: Error) => (error.value = err.message));
                }
              }}
              onBlur={(e) => !e.currentTarget.value.trim() && (naming.value = false)}
            />
          )}
          {drafts === 0 && !naming.value && <p class="drafts-empty">No drafts. Start one with + or /scope.</p>}
          <ul class="drafts-list" role="listbox" aria-label="Drafts">
            {posts.slice(0, drafts).map((p, i) => row(p, i))}
          </ul>
          {error.value && <p class="drafts-error">{error.value}</p>}
          {posts.length > drafts && (
            <>
              <h2 class="drafts-title drafts-title-later">Published</h2>
              <ul class="drafts-list" role="listbox" aria-label="Published">
                {posts.slice(drafts).map((p, i) => row(p, drafts + i))}
              </ul>
            </>
          )}
        </div>
      </main>
      <footer class="status">
        <PageTabs on="posts" go={(page) => page === 'ideas' && onIdeas?.()} />
        <div class="status-stats">
          <span>N new</span>
          {posts.length > 0 && <span>↵ open</span>}
          {posts[index]?.draft && <span>⌫ delete</span>}
          {posts[index] && !posts[index].draft && onShare && <span>S share</span>}
        </div>
      </footer>
    </>
  );
}
