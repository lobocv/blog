import { KEYMAP } from '../keymap.ts';

const Keys = ({ keys }: { keys?: string }) => (
  <span class="sheet-keys">
    {keys?.split(' ').map((k, i) => (
      <kbd class="key" key={i}>
        {k}
      </kbd>
    ))}
  </span>
);

/** Every shortcut (⌘/), and the last key the editor received, to tell when the system takes one first. */
export function KeySheet({ lastKey, onClose }: { lastKey?: string; onClose: () => void }) {
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <section class="sheet" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        {KEYMAP.map((group) => (
          <div class="sheet-group" key={group.title}>
            <div class="sheet-row sheet-head">
              <span>{group.title}</span>
              <span>{group.columns?.[0]}</span>
              <span>{group.columns?.[1]}</span>
            </div>
            {group.shortcuts.map((s) => (
              <div class="sheet-row" key={s.action}>
                <span>{s.action}</span>
                {group.columns ? <Keys keys={s.keys} /> : <span />}
                <Keys keys={group.columns ? s.source : s.keys} />
              </div>
            ))}
          </div>
        ))}
        <p class="sheet-last">Last key the editor saw: {lastKey ?? 'none yet'}</p>
      </section>
    </div>
  );
}
