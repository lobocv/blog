import { describe, expect, it } from 'vitest';
import { describeKey } from './keymap.ts';

const key = (code: string, mods: Partial<Record<'metaKey' | 'altKey' | 'ctrlKey' | 'shiftKey', boolean>> = {}) =>
  describeKey({ code, key: '', metaKey: false, altKey: false, ctrlKey: false, shiftKey: false, ...mods });

describe('describeKey', () => {
  it.each([
    [key('KeyJ'), 'J'],
    [key('KeyA', { altKey: true, shiftKey: true }), '⌥ ⇧ A'],
    [key('Backquote', { metaKey: true }), '⌘ `'],
    [key('KeyC', { ctrlKey: true }), '⌃ C'],
    [key('Slash', { metaKey: true }), '⌘ /'],
  ])('%s is %s', (got, want) => expect(got).toBe(want));
});
