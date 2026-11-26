import { useLayoutEffect, useRef } from 'preact/hooks';
import type { Section } from '../../domain/document.ts';

type Props = { sections: Section[]; at: number; onGo: (s: Section) => void; onClose: () => void };

/** The post's headings (G). J/K or the arrows move, ↵ goes there. The keys live in EditorView. */
export function SectionPicker({ sections, at, onGo, onClose }: Props) {
  const box = useRef<HTMLElement>(null);
  // Take focus from the source or the preview, so J/K don't type or reach the page.
  useLayoutEffect(() => box.current?.focus(), []);
  useLayoutEffect(() => box.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }), [at]);
  const top = Math.min(...sections.map((s) => s.level));
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <section ref={box} tabIndex={-1} class="sheet sections" role="listbox" aria-label="Sections" onClick={(e) => e.stopPropagation()}>
        {sections.length === 0 && <p class="sheet-last">No headings yet</p>}
        {sections.map((s, i) => (
          <button
            type="button"
            key={s.line}
            role="option"
            aria-selected={i === at}
            class="section-row"
            style={{ paddingLeft: `${12 + (s.level - top) * 18}px` }}
            onClick={() => onGo(s)}
          >
            {s.title}
          </button>
        ))}
      </section>
    </div>
  );
}
