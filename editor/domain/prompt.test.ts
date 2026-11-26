import { describe, expect, it } from 'vitest';
import { threadPrompt } from './prompt.ts';
import { PAGE } from './thread.ts';

const at = '';
const path = 'src/content/posts/a/index.md';

describe('threadPrompt', () => {
  it('names the thread, quotes its words and includes the conversation', () => {
    const prompt = threadPrompt(path, {
      id: 't1',
      anchor: { quote: 'two\nlines', line: 7 },
      resolved: false,
      messages: [
        { author: 'calvin', text: 'too long?', at },
        { author: 'claude', text: 'A little.', at },
        { author: 'calvin', text: 'cut what?', at },
      ],
    });
    expect(prompt).toBe(
      `Calvin wrote in thread t1 on ${path}, about these words near line 7:\n> two\n> lines\n\n` +
        'Read the post if you need more context. Lines may have moved since.\n\n' +
        'Calvin: too long?\n\nYou: A little.\n\nCalvin: cut what?',
    );
  });

  it('says when the thread is the page thread', () => {
    const prompt = threadPrompt(path, { id: PAGE, resolved: false, messages: [{ author: 'calvin', text: 'flow?', at }] });
    expect(prompt).toMatch(/^Calvin wrote in the page thread/);
  });

  it('turns a "/skill args" message into a request for the skill', () => {
    const prompt = threadPrompt(path, { id: PAGE, resolved: false, messages: [{ author: 'calvin', text: '/critique line', at }] });
    expect(prompt).toMatch(/run the `critique` skill with "line" on this post\.$/);
  });

  it('says when the quoted words are gone', () => {
    const prompt = threadPrompt(path, { id: 't1', anchor: { quote: 'x', line: 1 }, lost: true, resolved: false, messages: [] });
    expect(prompt).toContain('no longer in the post');
  });
});
