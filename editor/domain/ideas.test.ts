import { describe, expect, it } from 'vitest';
import { addIdea, ideas, removeIdea } from './ideas.ts';

const md = `# Ideas

Post ideas, one line each.

## Ideas

- 2026-11-22: Series on generative UI
- 2026-11-21: [trellis] How the topic graph works
- An undated one
`;

describe('ideas', () => {
  it('lists the bullets under "## Ideas", with their date and series tag', () => {
    expect(ideas(md)).toEqual([
      { date: '2026-11-22', text: 'Series on generative UI' },
      { date: '2026-11-21', text: 'How the topic graph works', series: 'trellis' },
      { text: 'An undated one' },
    ]);
  });

  it('ignores bullets outside the section', () => {
    expect(ideas('# Ideas\n\n- not this\n\n## Ideas\n\n- this\n\n## Parked\n\n- nor this\n')).toEqual([{ text: 'this' }]);
  });
});

describe('addIdea', () => {
  it('adds a dated bullet at the top of the list, keeping the rest of the file', () => {
    const next = addIdea(md, '[trellis] New one', '2026-11-26');
    expect(next).toBe(md.replace('\n- 2026-11-22', '\n- 2026-11-26: [trellis] New one\n- 2026-11-22'));
    expect(ideas(next)[0]).toEqual({ date: '2026-11-26', text: 'New one', series: 'trellis' });
  });

  it('starts the list, or the whole section, when there is none', () => {
    expect(addIdea('# Ideas\n\n## Ideas\n', 'First', '2026-11-26')).toBe('# Ideas\n\n## Ideas\n\n- 2026-11-26: First\n');
    expect(addIdea('', 'First', '2026-11-26')).toBe('## Ideas\n\n- 2026-11-26: First\n');
  });

  it('keeps an idea on one line', () => expect(ideas(addIdea(md, 'two\nlines', '2026-11-26'))[0].text).toBe('two lines'));
});

describe('removeIdea', () => {
  it('removes that bullet only', () => {
    const next = removeIdea(md, { date: '2026-11-21', text: 'How the topic graph works', series: 'trellis' });
    expect(next).toBe(md.replace('- 2026-11-21: [trellis] How the topic graph works\n', ''));
    expect(removeIdea(md, { text: 'An undated one' })).not.toContain('undated');
  });

  it('leaves the file alone when the idea is gone already', () => expect(removeIdea(md, { text: 'gone' })).toBe(md));
});
