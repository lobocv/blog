import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PostsView } from './PostsView.tsx';

const drafts = [
  { slug: 'plugin_pattern', title: 'The Plugin Pattern', draft: true, words: 1204, minutes: 6, modified: new Date().toISOString() },
  { slug: 'db_model', title: 'DB models', draft: true, words: 300, minutes: 2, modified: new Date().toISOString() },
];
const live = { slug: 'event_folding', title: 'Event Folding', draft: false, date: '2021-08-01', words: 900, minutes: 5, modified: new Date().toISOString() };

afterEach(cleanup);

const key = (code: string) => fireEvent.keyDown(window, { code });

function setup() {
  const onOpen = vi.fn();
  const onDelete = vi.fn(async () => {});
  render(<PostsView posts={drafts} onOpen={onOpen} onDelete={onDelete} onCreate={async () => {}} />);
  return { onOpen, onDelete };
}

describe('PostsView', () => {
  it('lists drafts with their size and age', () => {
    setup();
    expect(screen.getByText('The Plugin Pattern')).toBeTruthy();
    expect(screen.getByText('plugin_pattern · 1,204 words · edited just now')).toBeTruthy();
  });

  it('opens the selected draft with Enter after moving with J', () => {
    const { onOpen } = setup();
    key('KeyJ');
    key('Enter');
    expect(onOpen).toHaveBeenCalledWith('db_model');
  });

  it('asks before deleting, and Esc keeps the draft', () => {
    const { onDelete } = setup();
    key('Backspace');
    expect(screen.getByText(/Delete this draft\?/)).toBeTruthy();
    key('Escape');
    expect(screen.queryByText(/Delete this draft\?/)).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('sees each key straight after the one before it', () => {
    const { onOpen, onDelete } = setup();
    key('KeyJ');
    key('KeyJ');
    key('KeyK');
    key('Enter');
    expect(onOpen).toHaveBeenCalledWith('plugin_pattern');
    key('Backspace');
    key('Enter');
    expect(onDelete).toHaveBeenCalledWith('plugin_pattern');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('deletes after Enter confirms', async () => {
    const { onDelete, onOpen } = setup();
    key('Backspace');
    key('Enter');
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('plugin_pattern'));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('shows why a delete failed', async () => {
    const onDelete = vi.fn(async () => {
      throw new Error('"x" is published. Only drafts can be deleted here.');
    });
    render(<PostsView posts={drafts} onOpen={() => {}} onDelete={onDelete} onCreate={async () => {}} />);
    key('Delete');
    key('Enter');
    expect(await screen.findByText(/is published/)).toBeTruthy();
  });

  it('says so when there are no drafts', () => {
    render(<PostsView posts={[]} onOpen={() => {}} onDelete={async () => {}} onCreate={async () => {}} />);
    expect(screen.getByText('No drafts. Start one with + or /scope.')).toBeTruthy();
  });

  it('lists published posts after the drafts, moving into them with J, and never deletes one', () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn(async () => {});
    render(<PostsView posts={[...drafts, live]} onOpen={onOpen} onDelete={onDelete} onCreate={async () => {}} />);
    expect(screen.getByRole('listbox', { name: 'Published' }).textContent).toContain('event_folding · 900 words · published Aug 1, 2021');
    key('KeyJ');
    key('KeyJ');
    key('Backspace');
    expect(screen.queryByText(/Delete this draft\?/)).toBeNull();
    key('Enter');
    expect(onOpen).toHaveBeenCalledWith('event_folding');
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('starts a draft with N: type a title, then ↵', async () => {
    const onCreate = vi.fn(async () => {});
    render(<PostsView posts={drafts} onOpen={() => {}} onDelete={async () => {}} onCreate={onCreate} />);
    key('KeyN');
    const box = screen.getByLabelText('Title of the new draft') as HTMLInputElement;
    // Letters typed in the box are the title, not shortcuts.
    fireEvent.keyDown(box, { code: 'KeyJ', key: 'j' });
    box.value = 'New idea';
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onCreate).toHaveBeenCalledWith('New idea');
  });
});
