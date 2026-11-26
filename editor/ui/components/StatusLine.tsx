import type { Stats } from '../../domain/document.ts';
import type { SaveState } from '../autosave.ts';
import { formatNumber } from '../format.ts';

export type View = 'preview' | 'source';

type Props = {
  view: View;
  onView: (view: View) => void;
  stats: Stats;
  threads?: { open: number; resolved: number };
  onPage?: () => void;
  save: SaveState;
  onDrafts: () => void;
};

export function StatusLine({ view, onView, stats, threads, onPage, save, onDrafts }: Props) {
  const tab = (name: View, label: string) => (
    <button type="button" class={`status-view${view === name ? ' on' : ''}`} aria-pressed={view === name} onClick={() => onView(name)} title={`${label} (⌘\\)`}>
      {label}
    </button>
  );
  return (
    <footer class="status">
      <div class="status-views">
        <button type="button" class="status-view" onClick={onDrafts} title="Drafts (⌥O)">
          Drafts
        </button>
        {tab('preview', 'Preview')}
        {tab('source', 'Source')}
      </div>
      <div class="status-stats">
        {save === 'failed' && <span class="status-error">Not saved, retrying</span>}
        <span>{formatNumber(stats.words)} words</span>
        <span>{stats.minutes} min read</span>
        {threads && (
          <button type="button" class="status-threads" onClick={onPage} title="Page thread (P, or ⌥P in Source)">
            {threads.open > 0 && (
              <span class="status-open">
                <span class="dot dot-calvin" />
                {threads.open} open
              </span>
            )}
            {threads.resolved > 0 && <span>{threads.resolved} resolved</span>}
            {threads.open + threads.resolved === 0 && <span>No threads</span>}
          </button>
        )}
      </div>
    </footer>
  );
}
