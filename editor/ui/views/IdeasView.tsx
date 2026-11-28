import { useSignal } from '@preact/signals';
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { Ideas } from '../../protocol.ts';
import { PageTabs } from '../components/PageTabs.tsx';

type Idea = Ideas['ideas'][number];

type Props = {
  ideas: Idea[];
  onAdd: (text: string) => Promise<void>;
  onRemove: (idea: Idea) => Promise<void>;
  /** Starts a post from the idea with a working title, and runs /scope on it. */
  onScope: (idea: Idea, title: string) => Promise<void>;
  onPosts: () => void;
};

/**
 * writing/ideas.md, the list /idea adds to. J/K or arrows to move, N (or +) to add one, ⌫ to
 * remove one, ↵ (or a click) to start a post from one with /scope, Esc or P for the posts page.
 */
export function IdeasView({ ideas, onAdd, onRemove, onScope, onPosts }: Props) {
  // Signals, not state: a key handler must see the previous key's effect straight away.
  const selected = useSignal(0);
  const confirming = useSignal<Idea | undefined>(undefined);
  const adding = useSignal(false);
  // The idea waiting for a working title before it becomes a post.
  const titling = useSignal<Idea | undefined>(undefined);
  const error = useSignal<string | undefined>(undefined);
  const props = useRef({ ideas, onRemove, onPosts });
  props.current = { ideas, onRemove, onPosts };
  const index = Math.min(selected.value, ideas.length - 1);

  useLayoutEffect(() => {
    function onKey(e: KeyboardEvent) {
      const { ideas, onRemove, onPosts } = props.current;
      if (e.metaKey || e.ctrlKey || e.altKey || adding.value || titling.value) return;
      const doing = (fn: () => void) => {
        e.preventDefault();
        error.value = undefined;
        fn();
      };
      if (confirming.value) {
        const idea = confirming.value;
        if (e.code === 'Enter') doing(() => {
          confirming.value = undefined;
          onRemove(idea).catch((err: Error) => (error.value = err.message));
        });
        else if (e.code === 'Escape') doing(() => (confirming.value = undefined));
        return;
      }
      const move = (by: number) => (selected.value = Math.max(0, Math.min(ideas.length - 1, selected.value + by)));
      const current = ideas[Math.min(selected.value, ideas.length - 1)];
      if (e.code === 'KeyN') doing(() => (adding.value = true));
      else if (e.code === 'Escape' || e.code === 'KeyP') doing(onPosts);
      else if (e.code === 'KeyJ' || e.code === 'ArrowDown') doing(() => move(1));
      else if (e.code === 'KeyK' || e.code === 'ArrowUp') doing(() => move(-1));
      else if (e.code === 'Enter' && current) doing(() => (titling.value = current));
      else if ((e.code === 'Backspace' || e.code === 'Delete') && current) doing(() => (confirming.value = current));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <main class="page page-centered">
        <div class="column drafts">
          <div class="drafts-head">
            <h1 class="drafts-title">Ideas</h1>
            <button type="button" class="drafts-new" aria-label="New idea" title="New idea (N)" onClick={() => (adding.value = true)}>
              +
            </button>
          </div>
          {adding.value && (
            <input
              class="drafts-name"
              aria-label="The new idea"
              placeholder="An idea, then ↵. Start with [series] to tag it"
              ref={(el) => el?.focus()}
              onKeyDown={(e) => {
                e.stopPropagation();
                const box = e.currentTarget;
                if (e.key === 'Escape') adding.value = false;
                else if (e.key === 'Enter' && !e.isComposing && box.value.trim()) {
                  error.value = undefined;
                  onAdd(box.value).then(
                    () => {
                      adding.value = false;
                      selected.value = 0;
                    },
                    (err: Error) => (error.value = err.message),
                  );
                }
              }}
              onBlur={(e) => !e.currentTarget.value.trim() && (adding.value = false)}
            />
          )}
          {error.value && <p class="drafts-error">{error.value}</p>}
          {ideas.length === 0 && !adding.value && <p class="drafts-empty">No ideas yet. Add one with + or /idea.</p>}
          <ul class="drafts-list ideas-list" role="listbox" aria-label="Ideas">
            {ideas.map((idea, i) => (
              <li
                key={`${idea.date}${idea.text}`}
                role="option"
                aria-selected={i === index}
                class={`draft idea${i === index ? ' on' : ''}`}
                onMouseEnter={() => !confirming.value && (selected.value = i)}
                onClick={() => !confirming.value && !titling.value && (titling.value = idea)}
              >
                {confirming.value === idea ? (
                  <span class="draft-meta draft-confirm">Remove this idea? ↵ remove · esc keep</span>
                ) : (
                  <span class="draft-meta idea-meta">
                    {idea.date}
                    {idea.series && <span class="idea-series">{idea.series}</span>}
                  </span>
                )}
                <span class="idea-text">{idea.text}</span>
                {titling.value === idea && (
                  <input
                    class="drafts-name idea-title"
                    aria-label="Working title for the post"
                    placeholder="Working title, then ↵ to scope it"
                    ref={(el) => el?.focus()}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Escape') titling.value = undefined;
                      else if (e.key === 'Enter' && !e.isComposing && e.currentTarget.value.trim()) {
                        error.value = undefined;
                        onScope(idea, e.currentTarget.value).catch((err: Error) => (error.value = err.message));
                      }
                    }}
                    onBlur={(e) => !e.currentTarget.value.trim() && (titling.value = undefined)}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      </main>
      <footer class="status">
        <PageTabs on="ideas" go={(page) => page === 'posts' && onPosts()} />
        <div class="status-stats">
          <span>N new</span>
          {ideas.length > 0 && <span>↵ scope</span>}
          {ideas.length > 0 && <span>⌫ remove</span>}
        </div>
      </footer>
    </>
  );
}
