import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DraftsView } from './DraftsView.tsx';

const drafts = [
  { slug: 'plugin_pattern', title: 'The Plugin Pattern', words: 1204, minutes: 6, modified: new Date().toISOString() },
  { slug: 'db_model', title: 'DB models', words: 300, minutes: 2, modified: new Date().toISOString() },
];

afterEach(cleanup);

const key = (code: string) => fireEvent.keyDown(window, { code });

function setup() {
  const onOpen = vi.fn();
  const onDelete = vi.fn(async () => {});
  render(<DraftsView drafts={drafts} onOpen={onOpen} onDelete={onDelete} />);
  return { onOpen, onDelete };
}

describe('DraftsView', () => {
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
    render(<DraftsView drafts={drafts} onOpen={() => {}} onDelete={onDelete} />);
    key('Delete');
    key('Enter');
    expect(await screen.findByText(/is published/)).toBeTruthy();
  });

  it('says so when there are no drafts', () => {
    render(<DraftsView drafts={[]} onOpen={() => {}} onDelete={async () => {}} />);
    expect(screen.getByText('No drafts. Start one with /scope.')).toBeTruthy();
  });
});
