import { describe, expect, it } from 'vitest';
import { NotFound, Refused } from './errors.ts';
import { markPosted, unmarkPosted } from './mark-posted.ts';
import { openShare, preflight } from './open-share.ts';
import { copiedSocialPost, restoreSocialPost, saveSocialPost } from './save-social-post.ts';
import { FakeClock, FakeLiveChecker, MemoryPostLibrary, MemoryShareStore } from './testing/fakes.ts';

const live = '---\ntitle: "Live post"\nsummary: "What it says."\ndraft: false\ndate: 2026-11-24\ncategories: ["AI", "Architecture"]\n---\nBody.';
const draft = '---\ntitle: Draft\ndraft: true\n---\n';
const link = 'https://www.lobocv.com/posts/live/?utm_source=linkedin&utm_medium=social';

function setup() {
  const deps = { library: new MemoryPostLibrary({ live, draft }), share: new MemoryShareStore(), clock: new FakeClock(), checker: new FakeLiveChecker() };
  return { ...deps, deps };
}

describe('openShare', () => {
  it('opens a published post with a post for each network, writing nothing', async () => {
    const { deps, share } = setup();
    const opened = await openShare(deps)('live');
    expect(opened.post).toEqual({
      slug: 'live',
      title: 'Live post',
      summary: 'What it says.',
      categories: ['AI', 'Architecture'],
      postUrl: 'https://www.lobocv.com/posts/live/',
      image: 'https://www.lobocv.com/og/live.png',
    });
    expect(opened.state.networks.linkedin).toEqual({ text: '', status: 'draft', versions: [] });
    expect(share.states.size).toBe(0);
  });

  it('refuses drafts and unknown posts', async () => {
    const { deps } = setup();
    await expect(openShare(deps)('draft')).rejects.toBeInstanceOf(Refused);
    await expect(openShare(deps)('missing')).rejects.toBeInstanceOf(NotFound);
    await expect(openShare(deps)('../x')).rejects.toBeInstanceOf(NotFound);
  });

  it("refuses rather than starting over when the saved state can't be read", async () => {
    const { deps, share } = setup();
    share.broken.add('live');
    await expect(openShare(deps)('live')).rejects.toBeInstanceOf(Refused);
    await expect(saveSocialPost(deps)('live', 'linkedin', { text: 'x' })).rejects.toBeInstanceOf(Refused);
  });
});

describe('preflight', () => {
  it('checks the live page at the given origin', async () => {
    const { deps, checker } = setup();
    expect(await preflight({ ...deps, origin: 'http://127.0.0.1:9' })('live')).toEqual([{ ok: true, message: 'page loads (200)' }]);
    expect(checker.urls).toEqual(['http://127.0.0.1:9/posts/live/']);
    await expect(preflight(deps)('draft')).rejects.toBeInstanceOf(Refused);
  });
});

describe('saveSocialPost', () => {
  it('saves the text and writes the ready-to-paste file', async () => {
    const { deps, share } = setup();
    const state = await saveSocialPost(deps)('live', 'linkedin', { text: 'Hook.' });
    expect(state.networks.linkedin.text).toBe('Hook.');
    expect(state.networks.linkedin.versions).toEqual([]);
    expect(share.texts.get('live')).toEqual({ linkedin: `Hook.\n\n${link}\n\n#AI #SoftwareArchitecture #AIAgents #SystemDesign #SoftwareEngineering` });
  });

  it('cleans hashtags and drops repeats', async () => {
    const { deps } = setup();
    const state = await saveSocialPost(deps)('live', 'linkedin', { hashtags: ['#System Design', 'systemdesign', ' ', 'Go'] });
    expect(state.networks.linkedin.hashtags).toEqual(['systemdesign', 'Go']);
  });

  it('refuses an unknown network', async () => {
    await expect(saveSocialPost(setup().deps)('live', 'nope', { text: 'x' })).rejects.toBeInstanceOf(NotFound);
  });

  it('loses nothing when saves overlap', async () => {
    const { deps } = setup();
    const save = saveSocialPost(deps);
    const copy = copiedSocialPost(deps);
    await Promise.all([save('live', 'linkedin', { text: 'a' }), copy('live', 'linkedin', { text: 'b' }), save('live', 'linkedin', { hashtags: ['X'] })]);
    const { state } = await openShare(deps)('live');
    expect(state.networks.linkedin).toMatchObject({ text: 'b', hashtags: ['X'], versions: [{ text: 'b' }] });
  });
});

describe('versions', () => {
  it('keeps what was copied, with the hashtags on screen', async () => {
    const { deps } = setup();
    const state = await copiedSocialPost(deps)('live', 'linkedin', { text: 'Copied.' });
    expect(state.networks.linkedin.versions).toEqual([
      { text: 'Copied.', hashtags: ['AI', 'SoftwareArchitecture', 'AIAgents', 'SystemDesign', 'SoftwareEngineering'], author: 'calvin', at: '2026-11-25T12:00:00.000Z' },
    ]);
    expect(state.networks.linkedin.status).toBe('ready');
  });

  it('restores a version, keeping the text on screen first', async () => {
    const { deps } = setup();
    await copiedSocialPost(deps)('live', 'linkedin', { text: 'First.', hashtags: ['A'] });
    await saveSocialPost(deps)('live', 'linkedin', { text: 'Saved.' });
    const state = await restoreSocialPost(deps)('live', 'linkedin', 0, { text: 'Typed, not saved yet.' });
    expect(state.networks.linkedin.text).toBe('First.');
    expect(state.networks.linkedin.versions.map((v) => v.text)).toEqual(['First.', 'Typed, not saved yet.']);
  });
});

describe('markPosted', () => {
  it('records the URL, time and text as it went out, and can be undone', async () => {
    const { deps } = setup();
    await saveSocialPost(deps)('live', 'linkedin', { text: 'Out.', hashtags: [] });
    const state = await markPosted(deps)('live', 'linkedin', 'https://www.linkedin.com/feed/update/urn:li:activity:1/');
    expect(state.networks.linkedin).toMatchObject({
      status: 'posted',
      posted: { url: 'https://www.linkedin.com/feed/update/urn:li:activity:1/', at: '2026-11-25T12:00:00.000Z', text: `Out.\n\n${link}` },
    });
    expect((await unmarkPosted(deps)('live', 'linkedin')).networks.linkedin.status).toBe('ready');
  });

  it('refuses something that isn\'t a link', async () => {
    await expect(markPosted(setup().deps)('live', 'linkedin', 'not a url')).rejects.toBeInstanceOf(Refused);
  });
});
