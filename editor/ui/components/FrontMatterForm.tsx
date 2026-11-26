import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { type FrontMatter, problems, readFrontMatter, writeFrontMatter } from '../../domain/front-matter.ts';

type Props = {
  text: string;
  /** The whole post with its new front matter. */
  onChange: (text: string) => void;
  /** The form changed height, so the margin should follow the text below it. */
  onLayout?: () => void;
  /** ↵ in a one-line field: back to the text. */
  onDone?: () => void;
};

/** The post's front matter as fields, above the source. Each change rewrites the block in one format. */
export function FrontMatterForm({ text, onChange, onLayout, onDone }: Props) {
  const box = useRef<HTMLElement>(null);
  const laidOut = useRef(onLayout);
  laidOut.current = onLayout;
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => laidOut.current?.());
    observer.observe(box.current!);
    return () => observer.disconnect();
  }, []);

  const fm = readFrontMatter(text);
  if (!fm) {
    return (
      <section ref={box} class="front-matter front-matter-broken" aria-label="Front matter">
        The front matter can't be read. Fix it at the top of the text below.
      </section>
    );
  }
  const set = (change: Partial<FrontMatter>) => onChange(writeFrontMatter(text, { ...fm, ...change }));
  const issues = problems(fm);
  const done = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      onDone?.();
    }
  };

  return (
    <section ref={box} class="front-matter" aria-label="Front matter">
      <input
        class="fm-title"
        aria-label="Title"
        placeholder="Title"
        value={fm.title}
        onInput={(e) => set({ title: e.currentTarget.value })}
        onKeyDown={done}
      />
      {issues.title && <span class="fm-problem">Title: {issues.title}</span>}
      <div class="fm-row">
        <label class="fm-field fm-draft">
          <input type="checkbox" checked={fm.draft} onChange={(e) => set({ draft: e.currentTarget.checked })} />
          Draft
        </label>
        <label class="fm-field">
          <span class="fm-label">Date</span>
          <input
            type="date"
            aria-label="Date"
            value={/^\d{4}-\d{2}-\d{2}/.test(fm.date) ? fm.date.slice(0, 10) : ''}
            onChange={(e) => set({ date: e.currentTarget.value })}
            onKeyDown={done}
          />
          {issues.date && <span class="fm-problem">{issues.date}</span>}
        </label>
        <Categories value={fm.categories} onChange={(categories) => set({ categories })} />
      </div>
      <label class="fm-field fm-summary">
        <span class="fm-label">
          Summary {issues.summary && <span class="fm-problem">{issues.summary}</span>}
        </span>
        <Growing aria-label="Summary" placeholder="One line, shown on cards and in RSS" value={fm.summary} onInput={(summary) => set({ summary })} />
      </label>
      {fm.other && <Other value={fm.other} onChange={(other) => set({ other })} />}
    </section>
  );
}

/** Chips, plus a box that adds one on ↵ or a comma. ⌫ in the empty box removes the last. */
function Categories({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const name = draft.trim();
    if (name && !value.includes(name)) onChange([...value, name]);
    setDraft('');
  };
  return (
    <div class="fm-field fm-categories">
      <span class="fm-label">Categories</span>
      {value.map((c) => (
        <span class="fm-chip" key={c}>
          {c}
          <button type="button" aria-label={`Remove ${c}`} onClick={() => onChange(value.filter((x) => x !== c))}>
            ×
          </button>
        </span>
      ))}
      <input
        aria-label="Add a category"
        placeholder={value.length ? '' : 'Add'}
        value={draft}
        onInput={(e) => setDraft(e.currentTarget.value.replace(',', ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
      />
    </div>
  );
}

/** A textarea that grows with its text. */
type GrowingProps = {
  value: string;
  onInput: (v: string) => void;
  'aria-label': string;
  class?: string;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
};

function Growing({ value, onInput, ...rest }: GrowingProps) {
  const area = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = area.current!;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={area} rows={1} value={value} onInput={(e) => onInput(e.currentTarget.value)} {...rest} />;
}

/** Keys the form has no field for (eg `feature`), as YAML. Saved when the box loses focus, so a half-typed line can't break the page. */
function Other({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  return (
    <label class="fm-field fm-other">
      <span class="fm-label">Other</span>
      <Growing
        aria-label="Other front matter"
        class="fm-yaml"
        value={focused ? text : value}
        onInput={setText}
        onFocus={() => (setText(value), setFocused(true))}
        onBlur={() => {
          setFocused(false);
          if (text !== value) onChange(text);
        }}
      />
    </label>
  );
}
