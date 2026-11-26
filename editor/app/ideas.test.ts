import { describe, expect, it } from 'vitest';
import { addIdea, listIdeas, removeIdea } from './ideas.ts';
import { FakeClock, MemoryIdeasFile } from './testing/fakes.ts';

const md = '# Ideas\n\n## Ideas\n\n- 2026-11-21: [trellis] Topic graph\n';

describe('ideas', () => {
  it('lists, adds dated ideas at the top, and removes them', async () => {
    const file = new MemoryIdeasFile(md);
    expect(await listIdeas(file)()).toEqual([{ date: '2026-11-21', text: 'Topic graph', series: 'trellis' }]);
    const added = await addIdea(file, new FakeClock())('Review symptoms');
    expect(added[0]).toEqual({ date: '2026-11-25', text: 'Review symptoms' });
    expect(file.text).toContain('- 2026-11-25: Review symptoms\n- 2026-11-21');
    expect(await removeIdea(file)(added[1])).toEqual([added[0]]);
  });

  it('refuses an empty idea', async () => {
    await expect(addIdea(new MemoryIdeasFile(), new FakeClock())('  ')).rejects.toThrow('needs some words');
  });
});
