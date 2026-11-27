import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { reachesEditor } from '../keymap.ts';

type Props = {
  label: string;
  initial?: string;
  onSend: (text: string) => Promise<boolean>;
  onCancel: () => void;
  /** Focus the box when it appears. Off for a box that's always on screen (eg the share page's), so keys stay with the page. */
  autoFocus?: boolean;
};

/** A message box. Enter sends, ⇧Enter starts a new line, Esc cancels. */
export function Composer({ label, initial, onSend, onCancel, autoFocus = true }: Props) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState(false);

  // After the margin has placed the card, so focusing scrolls to where the box really is.
  useLayoutEffect(() => {
    if (!autoFocus) return;
    const frame = requestAnimationFrame(() => {
      box.current?.focus({ preventScroll: true });
      box.current?.scrollIntoView({ block: 'nearest' });
      if (initial) {
        box.current?.select();
        grow();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const grow = () => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <textarea
      ref={box}
      class="composer"
      aria-label={label}
      rows={1}
      defaultValue={initial}
      disabled={sending}
      onInput={grow}
      onKeyDown={async (e) => {
        // Keys typed here are text, except the shortcuts that close what's open (eg ⌥P).
        if (reachesEditor(e)) {
          // ⌥ plus a letter would also type a character.
          if (e.altKey) e.preventDefault();
          return;
        }
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        } else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          setSending(true);
          const el = e.currentTarget;
          const sent = await onSend(el.value);
          setSending(false);
          // A sent reply or comment closes its box; the page thread's box stays for the next message.
          if (sent && box.current) {
            el.value = '';
            grow();
          }
          box.current?.focus();
        }
      }}
    />
  );
}
