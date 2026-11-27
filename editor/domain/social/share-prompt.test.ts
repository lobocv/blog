import { describe, expect, it } from 'vitest';
import { linkedin } from './networks/linkedin/index.ts';
import { describeNetwork, draftRequest, SHARE_SYSTEM_PROMPT, sharePrompt, type ShareTurn } from './share-prompt.ts';
import { resolvePost } from './resolve.ts';
import { emptyPost } from './social-post.ts';

const ctx = { postUrl: 'https://www.lobocv.com/posts/a/', categories: ['AI'], title: 'A post', summary: 'What it says.' };
const figures = [
  { key: 'preview', label: 'Preview card', figure: { kind: 'preview' as const } },
  { key: 'component:src/components/post/Tree.astro', label: 'Tree', figure: { kind: 'component' as const, source: 'src/components/post/Tree.astro' } },
];
const turn = (over: Partial<ShareTurn> = {}): ShareTurn => ({
  first: true,
  title: 'A post',
  postPath: 'src/content/posts/a/index.mdx',
  briefPath: 'writing/briefs/a.md',
  figures,
  networks: [{ network: linkedin, resolved: resolvePost(linkedin, { ...emptyPost(), text: 'Hook.' }, ctx), failures: [] }],
  messages: [{ author: 'calvin', text: 'Draft the LinkedIn post.' }],
  ...over,
});

describe('sharePrompt', () => {
  it('says what to read and the rules on the first turn only', () => {
    const first = sharePrompt(turn());
    expect(first).toContain('read the post, its brief (writing/briefs/a.md, if it exists) and docs/voice.md');
    expect(first).toContain(describeNetwork(linkedin));
    expect(first).toContain('- component:src/components/post/Tree.astro: Tree');
    const later = sharePrompt(turn({ first: false }));
    expect(later).not.toContain('docs/voice.md');
    expect(later).not.toContain('Figures an image can show');
  });

  it('shows each network as it stands, then the thread', () => {
    const p = sharePrompt(turn({ first: false, messages: [{ author: 'calvin', text: 'Shorter.' }, { author: 'claude', text: 'Done.' }, { author: 'calvin', text: 'Again.' }] }));
    expect(p).toContain('## LinkedIn\nText on screen:\n"""\nHook.\n"""');
    expect(p).toContain('Hashtags: #AI #AIAgents #SoftwareEngineering');
    expect(p).toContain('Image: Preview card (day), alt text "A post. What it says."');
    expect(p.endsWith('Calvin: Shorter.\n\nYou: Done.\n\nCalvin: Again.')).toBe(true);
  });

  it("names failing checks, and Claude's version when Calvin rewrote it", () => {
    const n = turn().networks[0];
    const p = sharePrompt(
      turn({ networks: [{ ...n, failures: [{ check: 'banned', message: 'Reads as AI-written: "leverage"', ranges: [] }], rewrite: { text: 'Mine.', hashtags: [], author: 'claude', at: 'x' } }] }),
    );
    expect(p).toContain('Failing checks: Reads as AI-written: "leverage"');
    expect(p).toContain('Calvin rewrote your last version. Yours was:\n"""\nMine.\n"""');
  });

  it('shows empty text as empty', () => {
    const n = turn().networks[0];
    expect(sharePrompt(turn({ networks: [{ ...n, resolved: resolvePost(linkedin, emptyPost(), ctx) }] }))).toContain('Text on screen:\n(empty)');
  });
});

describe('draftRequest', () => {
  it('drafts from an empty box and critiques a draft', () => {
    expect(draftRequest(linkedin, ' ')).toBe('Draft the LinkedIn post.');
    expect(draftRequest(linkedin, 'Mine.')).toBe('Critique my LinkedIn draft, then rewrite it.');
  });
});

it('keeps the system prompt free of em-dashes', () => {
  expect(SHARE_SYSTEM_PROMPT).not.toContain('—');
});
