import { describe, expect, it } from 'vitest';
import { comment, PAGE } from '../domain/thread.ts';
import { type ConversationEvent, createConversation } from './conversation.ts';
import { FakeAgent, FakeClock, MemoryPostLibrary, MemoryThreadStore } from './testing/fakes.ts';

const at = '2026-11-25T12:00:00.000Z';

async function setup(replies: string[]) {
  const deps = {
    library: new MemoryPostLibrary({ a: '---\ndraft: true\n---\nOne two.\n' }),
    threads: new MemoryThreadStore(),
    clock: new FakeClock(),
    agent: new FakeAgent(replies),
  };
  let threads = comment([], { id: 't1', anchor: { quote: 'One', line: 4 }, text: 'why one?', at });
  threads = comment(threads, { id: 'x', text: 'overall?', at });
  await deps.threads.save('a', threads);
  const conversation = createConversation(deps);
  const events: ConversationEvent[] = [];
  conversation.subscribe('a', (e) => events.push(e));
  return { deps, conversation, events };
}

const replies = async (deps: Awaited<ReturnType<typeof setup>>['deps']) =>
  (await deps.threads.load('a')).map((t) => t.messages.map((m) => `${m.author}: ${m.text}`));

describe('conversation', () => {
  it('streams the reply, then adds it to the thread and remembers the session', async () => {
    const { deps, conversation, events } = await setup(['Because it counts.']);
    await conversation.ask('a', 't1');
    expect(deps.agent.turns[0].prompt).toContain('> One');
    expect(deps.agent.turns[0].session).toBeUndefined();
    expect(events.filter((e) => e.type === 'working').map((e) => (e as { text: string }).text)).toEqual([
      '',
      'Because',
      'Because it',
      'Because it counts.',
    ]);
    expect(events.at(-1)).toEqual({ type: 'idle' });
    expect((await replies(deps))[0]).toEqual(['calvin: why one?', 'claude: Because it counts.']);
    expect(await deps.threads.session('a')).toBe('s1');
  });

  it('resumes the same session on the next turn', async () => {
    const { deps, conversation } = await setup(['a', 'b']);
    await conversation.ask('a', 't1');
    await conversation.ask('a', PAGE);
    expect(deps.agent.turns[1].session).toBe('s1');
    expect((await replies(deps))[1]).toEqual(['calvin: overall?', 'claude: b']);
  });

  it('runs one turn at a time, in order', async () => {
    const { deps, conversation } = await setup(['wait', 'second']);
    const first = conversation.ask('a', 't1');
    const second = conversation.ask('a', PAGE);
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.agent.turns).toHaveLength(1);
    deps.agent.release();
    await Promise.all([first, second]);
    expect(deps.agent.turns).toHaveLength(2);
    expect((await replies(deps)).map((m) => m.at(-1))).toEqual(['claude: released', 'claude: second']);
  });

  it('stops the running turn, keeping what Claude wrote, and drops waiting turns', async () => {
    const { deps, conversation } = await setup(['wait', 'never']);
    const first = conversation.ask('a', 't1');
    const second = conversation.ask('a', PAGE);
    await new Promise((r) => setTimeout(r, 0));
    conversation.stop('a');
    await Promise.all([first, second]);
    expect(deps.agent.turns).toHaveLength(1);
    expect((await replies(deps))[0].at(-1)).toBe('claude: partial (stopped)');
  });

  it('tells a new listener about the turn in progress', async () => {
    const { deps, conversation } = await setup(['wait']);
    const running = conversation.ask('a', 't1');
    await new Promise((r) => setTimeout(r, 0));
    const late: ConversationEvent[] = [];
    conversation.subscribe('a', (e) => late.push(e));
    expect(late).toEqual([{ type: 'working', threadId: 't1', text: 'partial', tool: undefined }]);
    deps.agent.release();
    await running;
  });

  it('reports a failed turn and carries on with the next', async () => {
    const { deps, conversation, events } = await setup([]);
    deps.agent.ask = async () => {
      throw new Error('claude not found');
    };
    await conversation.ask('a', 't1');
    expect(events).toContainEqual({ type: 'failed', threadId: 't1', message: 'claude not found' });
    expect(events.at(-1)).toEqual({ type: 'idle' });
  });
});
