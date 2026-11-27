// Every shortcut, for the sheet Calvin opens with H. The handlers live in the views (EditorView,
// ShareView, PostsView); keep this list in step with them.

export type Shortcut = { action: string; keys: string; source?: string };
export type Group = { title: string; columns?: [string, string]; shortcuts: Shortcut[] };

export const KEYMAP: Group[] = [
  {
    title: 'Everywhere',
    shortcuts: [
      { action: 'Preview / Source', keys: '⌘ \\' },
      { action: 'Comment on selection', keys: '⌘ K' },
      { action: 'Page thread', keys: '⌘ /' },
      { action: 'Back to posts, when nothing is open', keys: 'esc' },
      { action: 'Stop Claude', keys: '⌃ C' },
      { action: 'Close, cancel (or the key that opened it)', keys: 'esc' },
    ],
  },
  {
    title: 'In the post',
    columns: ['Preview', 'Source'],
    shortcuts: [
      { action: 'Go to section', keys: 'G', source: '⌥ G' },
      { action: 'Next / previous thread', keys: 'J K', source: '⌥ J K' },
      { action: 'Reply', keys: 'R', source: '⌥ R' },
      { action: 'Resolve', keys: 'D', source: '⌥ D' },
      { action: 'Accept suggestion', keys: 'A', source: '⌥ A' },
      { action: 'Reject suggestion', keys: 'X', source: '⌥ X' },
      { action: 'Tweak suggestion', keys: 'T', source: '⌥ T' },
      { action: 'Accept all mechanical fixes', keys: '⇧ A', source: '⌥ ⇧ A' },
      { action: 'Page thread', keys: '/', source: '⌥ /' },
      { action: 'Hide threads', keys: 'Z', source: '⌥ Z' },
      { action: 'Critique', keys: '⇧ C', source: '⌥ ⇧ C' },
      { action: 'Action all notes', keys: '⇧ N', source: '⌥ ⇧ N' },
      { action: 'Share page, for published posts', keys: 'S', source: '⌥ S' },
      { action: 'This sheet', keys: 'H', source: '⌥ H' },
    ],
  },
  {
    title: 'Share page',
    columns: ['Page', 'Typing'],
    shortcuts: [
      { action: 'Network tab', keys: '1-9', source: '⌥ 1-9' },
      { action: 'Copy text', keys: 'C', source: '⌥ C' },
      { action: 'Save image', keys: 'I', source: '⌥ I' },
      { action: 'Open compose page', keys: 'P', source: '⌥ P' },
      { action: 'Versions', keys: 'V', source: '⌥ V' },
      { action: 'This sheet', keys: 'H', source: '⌥ H' },
      { action: 'Leave the text box, then back to posts', keys: 'esc', source: 'esc' },
    ],
  },
  {
    title: 'Posts page',
    shortcuts: [
      { action: 'Next / previous post', keys: 'J K' },
      { action: 'Open', keys: '↵' },
      { action: 'New draft', keys: 'N' },
      { action: 'Delete a draft', keys: '⌫' },
      { action: 'Share a published post', keys: 'S' },
      { action: 'Ideas', keys: 'I' },
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

type Keydown = Pick<KeyboardEvent, 'code' | 'metaKey' | 'altKey' | 'ctrlKey' | 'shiftKey'>;

/**
 * Shortcuts that still work while Calvin types a message, so the key that opened something
 * closes it again (eg ⌘/ closes the page thread). Bare letters stay text.
 */
export function reachesEditor(e: Keydown): boolean {
  if (e.shiftKey) return false;
  if (e.altKey && !e.metaKey && !e.ctrlKey) return ['Slash', 'KeyH', 'KeyR', 'KeyT'].includes(e.code);
  if (e.metaKey && !e.altKey && !e.ctrlKey) return ['KeyK', 'Slash', 'Backslash'].includes(e.code);
  return e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyC';
}
