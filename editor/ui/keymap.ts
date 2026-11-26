// Every shortcut, for the sheet Calvin opens with ⌘/. The handlers live in EditorView; keep this
// list in step with them.

export type Shortcut = { action: string; keys: string; source?: string };
export type Group = { title: string; columns?: [string, string]; shortcuts: Shortcut[] };

export const KEYMAP: Group[] = [
  {
    title: 'Everywhere',
    shortcuts: [
      { action: 'Preview / Source', keys: '⌘ \\' },
      { action: 'Comment on selection', keys: '⌘ K' },
      { action: 'This sheet', keys: '⌘ /' },
      { action: 'Back to drafts', keys: '⌥ O' },
      { action: 'Stop Claude', keys: '⌃ C' },
      { action: 'Close, cancel', keys: 'esc' },
    ],
  },
  {
    title: 'Threads',
    columns: ['Preview', 'Source'],
    shortcuts: [
      { action: 'Next / previous thread', keys: 'J K', source: '⌥ J K' },
      { action: 'Reply', keys: 'R', source: '⌥ R' },
      { action: 'Resolve', keys: 'D', source: '⌥ D' },
      { action: 'Accept suggestion', keys: 'A', source: '⌥ A' },
      { action: 'Reject suggestion', keys: 'X', source: '⌥ X' },
      { action: 'Tweak suggestion', keys: 'T', source: '⌥ T' },
      { action: 'Accept all mechanical fixes', keys: '⇧ A', source: '⌥ ⇧ A' },
      { action: 'Page thread', keys: 'P', source: '⌥ P' },
      { action: 'Critique', keys: '⇧ C', source: '⌥ ⇧ C' },
    ],
  },
  {
    title: 'Writing a message',
    shortcuts: [
      { action: 'Send', keys: '↵' },
      { action: 'New line', keys: '⇧ ↵' },
      { action: 'Cancel', keys: 'esc' },
    ],
  },
];

/** A key as the sheet shows it (eg "⌥ ⇧ A"), from a keydown event. */
export function describeKey(e: Pick<KeyboardEvent, 'code' | 'key' | 'metaKey' | 'altKey' | 'ctrlKey' | 'shiftKey'>): string {
  const mods = [e.ctrlKey && '⌃', e.altKey && '⌥', e.shiftKey && '⇧', e.metaKey && '⌘'].filter(Boolean);
  const named: Record<string, string> = { Backslash: '\\', Backquote: '`', Slash: '/', Enter: '↵', Escape: 'esc', Space: 'space' };
  const key = named[e.code] ?? e.code.replace(/^Key|^Digit/, '');
  return [...mods, key].join(' ');
}
