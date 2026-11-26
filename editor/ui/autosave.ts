import { signal } from '@preact/signals';

export type SaveState = 'saved' | 'saving' | 'failed';

/**
 * Saves the latest text `delayMs` after typing stops, one save at a time.
 * `flush` saves straight away (on a view or window change). A failed save is
 * retried after `retryMs`, and the status line shows it until one succeeds.
 */
export function createAutosave(save: (text: string) => Promise<void>, delayMs = 500, retryMs = 3000) {
  const state = signal<SaveState>('saved');
  let pending: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;

  function schedule(ms: number) {
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), ms);
  }

  function change(text: string) {
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

  return { state, change, flush };
}
