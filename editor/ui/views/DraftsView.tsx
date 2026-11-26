import { useSignal } from '@preact/signals';
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { Drafts } from '../../protocol.ts';
import { formatAgo, formatNumber } from '../format.ts';

type Draft = Drafts['drafts'][number];

type Props = {
  drafts: Draft[];
  onOpen: (slug: string) => void;
  onDelete: (slug: string) => Promise<void>;
};

/** The first page: every draft, newest first. J/K or arrows to move, Enter to open, ⌫ to delete. */
export function DraftsView({ drafts, onOpen, onDelete }: Props) {
  // Signals, not state: a key handler must see the previous key's effect even
  // before the next render (eg ⌫ then Enter typed quickly).
  const selected = useSignal(0);
  const confirming = useSignal<string | undefined>(undefined);
  const error = useSignal<string | undefined>(undefined);
  const props = useRef({ drafts, onOpen, onDelete });
  props.current = { drafts, onOpen, onDelete };

  const index = Math.min(selected.value, drafts.length - 1);

  // Layout effect so keys pressed right after the page appears aren't lost.
  useLayoutEffect(() => {
    function onKey(e: KeyboardEvent) {
      const { drafts, onOpen, onDelete } = props.current;
      const current = drafts[Math.min(selected.value, drafts.length - 1)];
      if (e.metaKey || e.ctrlKey || e.altKey || !current) return;
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
      const move = (by: number) => (selected.value = Math.max(0, Math.min(drafts.length - 1, selected.value + by)));
      if (e.code === 'KeyJ' || e.code === 'ArrowDown') doing(() => move(1));
      else if (e.code === 'KeyK' || e.code === 'ArrowUp') doing(() => move(-1));
      else if (e.code === 'Enter') doing(() => onOpen(current.slug));
      else if (e.code === 'Backspace' || e.code === 'Delete') doing(() => (confirming.value = current.slug));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <main class="page page-centered">
        <div class="column drafts">
          <h1 class="drafts-title">Drafts</h1>
          {drafts.length === 0 && <p class="drafts-empty">No drafts. Start one with /scope.</p>}
          <ul class="drafts-list" role="listbox" aria-label="Drafts">
            {drafts.map((d, i) => (
              <li
                key={d.slug}
                role="option"
                aria-selected={i === index}
                class={`draft${i === index ? ' on' : ''}`}
                onClick={() => onOpen(d.slug)}
                onMouseEnter={() => !confirming.value && (selected.value = i)}
              >
                <span class="draft-name">{d.title}</span>
                {confirming.value === d.slug ? (
                  <span class="draft-meta draft-confirm">Delete this draft? ↵ delete · esc keep</span>
                ) : (
                  <span class="draft-meta">
                    {d.slug} · {formatNumber(d.words)} words · edited {formatAgo(new Date(d.modified))}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {error.value && <p class="drafts-error">{error.value}</p>}
        </div>
      </main>
      <footer class="status">
        <div class="status-views" />
        <div class="status-stats">
          {drafts.length > 0 && (
            <>
              <span>↵ open</span>
              <span>⌫ delete</span>
            </>
          )}
        </div>
      </footer>
    </>
  );
}
