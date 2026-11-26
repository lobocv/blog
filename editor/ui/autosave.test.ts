import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosave } from './autosave.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('autosave', () => {
  it('saves once, with the latest text, after typing stops', async () => {
    const saved: string[] = [];
    const a = createAutosave(async (t) => void saved.push(t), 500);
    a.change('a');
    await vi.advanceTimersByTimeAsync(300);
    a.change('ab');
    await vi.advanceTimersByTimeAsync(499);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved).toEqual(['ab']);
    expect(a.state.value).toBe('saved');
  });

  it('saves straight away on flush, and not again after', async () => {
    const saved: string[] = [];
    const a = createAutosave(async (t) => void saved.push(t), 500);
    a.change('x');
    await a.flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(saved).toEqual(['x']);
  });

  it('does nothing on flush when there is nothing new', async () => {
    const save = vi.fn(async () => {});
    await createAutosave(save).flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('runs one save at a time and keeps typing made during a save', async () => {
    const saved: string[] = [];
    let release = () => {};
    const a = createAutosave((t) => new Promise<void>((r) => (release = () => (saved.push(t), r()))), 500);
    a.change('one');
    await vi.advanceTimersByTimeAsync(500);
    a.change('two');
    const second = a.flush();
    expect(a.state.value).toBe('saving');
    release();
    await vi.advanceTimersByTimeAsync(0);
    release();
    await second;
    expect(saved).toEqual(['one', 'two']);
    expect(a.state.value).toBe('saved');
  });

  it('shows a failed save and retries it', async () => {
    let fail = true;
    const saved: string[] = [];
    const a = createAutosave(async (t) => {
      if (fail) throw new Error('offline');
      saved.push(t);
    }, 500, 3000);
    a.change('x');
    await vi.advanceTimersByTimeAsync(500);
    expect(a.state.value).toBe('failed');
    fail = false;
    await vi.advanceTimersByTimeAsync(3000);
    expect(saved).toEqual(['x']);
    expect(a.state.value).toBe('saved');
  });
});
