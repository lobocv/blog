import { describe, expect, it } from 'vitest';
import { NotFound, Refused } from './errors.ts';
import { openShare } from './open-share.ts';
import { saveSocialPost } from './save-social-post.ts';
import { createShareConversation } from './share-conversation.ts';
import { FakeAgent, FakeClock, MemoryPostLibrary, MemoryShareStore, MemoryThreadStore } from './testing/fakes.ts';
import { writeSocialPost } from './write-social-post.ts';

const live = "---\ntitle: \"Live post\"\nsummary: \"What it says.\"\ndraft: false\ncategories: [\"AI\"]\n---\nimport Tree from '../../../components/post/Tree.astro';\n\n<Tree />\n";

function setup(replies: string[] = ['ok']) {
  const deps = { library: new MemoryPostLibrary({ live, draft: '---\ndraft: true\n---\n' }), share: new MemoryShareStore(), threads: new MemoryThreadStore(), clock: new FakeClock() };
  const agent = new FakeAgent(replies);
  const conversation = createShareConversation({ ...deps, agent, turn: { system: 'SHARE', allow: ['mcp__editor__write_social_post'] } });
  const write = writeSocialPost({ ...deps, turnStart: conversation.turnStart });
  return { ...deps, deps, agent, conversation, write };
}

describe('share conversation', () => {
  it("passes Calvin's message to Claude with the share prompt, system prompt and tools", async () => {
    const { conversation, agent, threads } = setup(['Drafted it.']);
    await (await conversation.send('live', 'Draft the LinkedIn post.')).replied;
    const [turn] = agent.turns;
    expect(turn.system).toBe('SHARE');
    expect(turn.allow).toEqual(['mcp__editor__write_social_post']);
    expect(turn.prompt).toContain('read the post, its brief (writing/briefs/live.md, if it exists) and docs/voice.md');
    expect(turn.prompt).toContain('- component:src/components/post/Tree.astro: Tree');
    expect(turn.prompt.endsWith('Calvin: Draft the LinkedIn post.')).toBe(true);
    expect((await threads.load('live'))[0].messages.map((m) => [m.author, m.text])).toEqual([
      ['calvin', 'Draft the LinkedIn post.'],
      ['claude', 'Drafted it.'],
    ]);
    expect(await threads.session('live')).toBe('s1');
  });

  it('says what to read only on the first turn of a session', async () => {
    const { conversation, agent } = setup(['one', 'two']);
    await (await conversation.send('live', 'Draft it.')).replied;
    await (await conversation.send('live', 'Shorter.')).replied;
    expect(agent.turns[1].prompt).not.toContain('docs/voice.md');
    expect(agent.turns[1].session).toBe('s1');
  });

  it('refuses drafts', async () => {
    await expect(setup().conversation.send('draft', 'hi')).rejects.toBeInstanceOf(Refused);
  });

  it("shows Claude its version once after Calvin rewrites it, so it asks about it once", async () => {
    const { conversation, agent, write, deps } = setup(['a', 'b', 'c']);
    await (await conversation.send('live', 'Draft.')).replied;
    await write('live', { network: 'linkedin', text: 'Claude wrote this.', hashtags: [] });
    await saveSocialPost(deps)('live', 'linkedin', { text: 'Calvin rewrote this.' });
    await (await conversation.send('live', 'Better?')).replied;
    expect(agent.turns[1].prompt).toContain('Calvin rewrote your last version. Yours was:\n"""\nClaude wrote this.\n"""');
    await (await conversation.send('live', 'And now?')).replied;
    expect(agent.turns[2].prompt).not.toContain('Calvin rewrote your last version');
  });
});

describe('writeSocialPost', () => {
  it('fills an empty box outside a turn, and keeps a version by Claude', async () => {
    const { write } = setup();
    const { state, replaced } = await write('live', { network: 'linkedin', text: ' Hook. ', hashtags: ['#AI', 'Go'], claims: ['over a year', ' '] });
    expect(replaced).toBe(true);
    expect(state.networks.linkedin).toMatchObject({
      text: 'Hook.',
      hashtags: ['AI', 'Go'],
      versions: [{ text: 'Hook.', author: 'claude', flags: ['over a year'], at: '2026-11-25T12:00:00.000Z' }],
    });
  });

  it("replaces the text when Calvin hasn't typed since the turn started, and keeps only a version when he has", async () => {
    const { conversation, write, deps, agent } = setup(['wait']);
    await saveSocialPost(deps)('live', 'linkedin', { text: 'Mine.' });
    const { replied: turn } = await conversation.send('live', 'Critique it.');
    await new Promise((r) => setTimeout(r, 0));
    expect((await write('live', { network: 'linkedin', text: 'Rewrite one.', hashtags: [] })).replaced).toBe(true);
    await saveSocialPost(deps)('live', 'linkedin', { text: 'Rewrite one, edited by Calvin.' });
    const second = await write('live', { network: 'linkedin', text: 'Rewrite two.', hashtags: [] });
    expect(second.replaced).toBe(false);
    expect(second.state.networks.linkedin.text).toBe('Rewrite one, edited by Calvin.');
    expect(second.state.networks.linkedin.versions.map((v) => v.text)).toEqual(['Rewrite one.', 'Rewrite two.']);
    agent.release();
    await turn;
  });

  it('sets the image by figure key and its alt text', async () => {
    const { write } = setup();
    const { state } = await write('live', { network: 'linkedin', text: 'T', hashtags: [], figure: 'component:src/components/post/Tree.astro', alt: 'A tree.' });
    expect(state.networks.linkedin.media).toEqual({ kind: 'image', figure: { kind: 'component', source: 'src/components/post/Tree.astro' }, alt: 'A tree.' });
  });

  it('refuses an unknown figure with the keys it knows, empty text and unknown networks', async () => {
    const { write } = setup();
    await expect(write('live', { network: 'linkedin', text: 'T', hashtags: [], figure: 'nope' })).rejects.toThrow('The keys are: preview, component:src/components/post/Tree.astro.');
    await expect(write('live', { network: 'linkedin', text: ' ', hashtags: [] })).rejects.toBeInstanceOf(Refused);
    await expect(write('live', { network: 'nope', text: 'T', hashtags: [] })).rejects.toBeInstanceOf(NotFound);
  });

  it('writes the ready-to-paste text with it', async () => {
    const { write, share, deps } = setup();
    await write('live', { network: 'linkedin', text: 'Hook.', hashtags: ['AI'] });
    expect(share.texts.get('live')?.linkedin).toBe('Hook.\n\nhttps://www.lobocv.com/posts/live/?utm_source=linkedin&utm_medium=social\n\n#AI');
    expect((await openShare(deps)('live')).state.networks.linkedin.text).toBe('Hook.');
  });
});
