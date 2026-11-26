import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusLine } from './StatusLine.tsx';

afterEach(cleanup);
const base = { view: 'source', onView: () => {}, onDrafts: () => {} } as const;

describe('StatusLine', () => {
  it('shows words and reading time', () => {
    render(<StatusLine stats={{ words: 1642, minutes: 8 }} save="saved" {...base} />);
    expect(screen.getByText('1,642 words')).toBeTruthy();
    expect(screen.getByText('8 min read')).toBeTruthy();
  });

  it('says nothing about saving unless a save failed', () => {
    const { rerender } = render(<StatusLine stats={{ words: 1, minutes: 1 }} save="saving" {...base} />);
    expect(screen.queryByText(/saved|saving/i)).toBeNull();
    rerender(<StatusLine stats={{ words: 1, minutes: 1 }} save="failed" {...base} />);
    expect(screen.getByText('Not saved, retrying')).toBeTruthy();
  });

  it('marks the current view and swaps on click', () => {
    const onView = vi.fn();
    render(<StatusLine stats={{ words: 1, minutes: 1 }} save="saved" {...base} onView={onView} />);
    expect(screen.getByRole('button', { name: 'Source' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(onView).toHaveBeenCalledWith('preview');
  });
});
