import { signal } from '@preact/signals';

export type SaveState = 'saved' | 'saving' | 'failed';

/**
 * Saves the latest text `delayMs` after typing stops, one save at a time.
 * `flush` saves straight away (on a view or window change). A failed save is
 * retried after `retryMs`, and the status line shows it until one succeeds.
 * `saved` is the text the file holds as far as the editor knows, starting at `initial`.
 */
export function createAutosave(save: (text: string) => Promise<void>, delayMs = 500, retryMs = 3000, initial?: string) {
  const state = signal<SaveState>('saved');
  let saved = initial;
  let pending: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;

  function schedule(ms: number) {
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), ms);
  }

  function change(text: string) {
    // Eg an outside edit loaded into the editor: the file already has it.
    if (text === saved && pending === undefined && !inFlight) return;
    pending = text;
    schedule(delayMs);
  }

  async function flush(): Promise<void> {
    clearTimeout(timer);
    while (inFlight) await inFlight;
    if (pending === undefined) return;
    const text = pending;
    pending = undefined;
    state.value = 'saving';
    inFlight = save(text).then(
      () => {
        saved = text;
        if (pending === undefined) state.value = 'saved';
      },
      () => {
        state.value = 'failed';
        pending ??= text;
        schedule(retryMs);
      },
    );
    await inFlight;
    inFlight = undefined;
  }

  return {
    state,
    change,
    flush,
    /** The text the file holds, as far as the editor knows. */
    saved: () => saved,
    /** Typing that hasn't reached the file yet. */
    unsaved: () => pending !== undefined || Boolean(inFlight),
    /** Records that the file now holds `text` (eg after an outside edit). */
    markSaved(text: string) {
      saved = text;
    },
  };
}
