import { describe, expect, it } from 'vitest';
import { comment } from '../domain/thread.ts';
import { NotFound, Refused } from './errors.ts';
import { settleSuggestion, suggestEdit } from './suggestions.ts';
import { FakeClock, MemoryPostLibrary, MemoryThreadStore } from './testing/fakes.ts';

async function setup() {
  const deps = {
    library: new MemoryPostLibrary({ a: '---\ndraft: true\n---\nIt was incredible amounts of work.\n' }),
    threads: new MemoryThreadStore(),
    clock: new FakeClock(),
  };
  await deps.threads.save('a', comment([], { id: 't1', anchor: { quote: 'incredible', line: 4 }, text: 'x', at: '' }));
  return deps;
}

describe('suggestions', () => {
  it("saves Claude's suggestion, then Calvin's tweak when he accepts it", async () => {
    const deps = await setup();
    await suggestEdit(deps)('a', { threadId: 't1', find: 'incredible amounts of', replace: 'a lot of', reason: 'Plainer.' });
    const [thread] = await settleSuggestion(deps)('a', 't1', 'accepted', 'lots of');
    expect(thread.messages.at(-1)?.suggestion).toEqual({ id: 't1', find: 'incredible amounts of', replace: 'lots of', line: 4, status: 'accepted' });
  });

  it("refuses a suggestion that doesn't fit, with the reason", async () => {
    await expect(suggestEdit(await setup())('a', { threadId: 't1', find: 'amazing', replace: 'x', reason: '' })).rejects.toThrow(Refused);
  });

  it('refuses to settle a suggestion that does not exist', async () => {
    await expect(settleSuggestion(await setup())('a', 'nope', 'rejected')).rejects.toThrow(NotFound);
  });
});
