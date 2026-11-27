import { describe, expect, it } from 'vitest';
import { describeKey, KEYMAP, reachesEditor } from './keymap.ts';

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

describe('reachesEditor', () => {
  const ev = (code: string, mods: Partial<Record<'metaKey' | 'altKey' | 'ctrlKey' | 'shiftKey', boolean>> = {}) => ({
    code,
    metaKey: false,
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...mods,
  });
  it.each([
    [ev('Slash', { altKey: true }), true],
    [ev('KeyH', { altKey: true }), true],
    [ev('KeyP', { metaKey: true }), false],
    [ev('KeyK', { metaKey: true }), true],
    [ev('KeyR', { altKey: true }), true],
    [ev('Slash', { metaKey: true }), true],
    [ev('KeyC', { ctrlKey: true }), true],
    [ev('Slash'), false],
    [ev('KeyA', { metaKey: true }), false],
    [ev('KeyZ', { metaKey: true }), false],
    [ev('Slash', { altKey: true, shiftKey: true }), false],
  ])('%o is %s', (e, want) => expect(reachesEditor(e)).toBe(want));
});

describe('KEYMAP', () => {
  // Esc means "close, else go back" everywhere, so it's listed more than once on purpose.
  it.each(KEYMAP.map((g) => [g.title, g] as const))('binds each key once in %s', (_, group) => {
    for (const column of ['keys', 'source'] as const) {
      const keys = group.shortcuts.map((s) => s[column]).filter((k): k is string => Boolean(k) && k !== 'esc');
      expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
    }
  });
});
