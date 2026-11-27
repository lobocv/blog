import { describe, expect, it } from 'vitest';
import { NotFound, Refused } from './errors.ts';
import { markPosted, unmarkPosted } from './mark-posted.ts';
import { openShare, preflight } from './open-share.ts';
import { copiedSocialPost, restoreSocialPost, saveSocialPost } from './save-social-post.ts';
import { renderShareImage, shareImage } from './render-share-image.ts';
import { chooseLink } from './choose-link.ts';
import { FakeClock, FakeLiveChecker, FakeRenderer, MemoryPostLibrary, MemoryShareStore, MemoryShortLinks } from './testing/fakes.ts';

const live = '---\ntitle: "Live post"\nsummary: "What it says."\ndraft: false\ndate: 2026-11-24\ncategories: ["AI", "Architecture"]\n---\nBody.';
const draft = '---\ntitle: Draft\ndraft: true\n---\n';
const link = 'https://www.lobocv.com/posts/live/?utm_source=linkedin&utm_medium=social';

function setup() {
  const deps = {
    library: new MemoryPostLibrary({ live, draft }),
    share: new MemoryShareStore(),
    clock: new FakeClock(),
    checker: new FakeLiveChecker({ 'http://127.0.0.1:9/posts/live/': [{ ok: true, message: 'page loads (200)' }] }),
    links: new MemoryShortLinks(),
  };
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

describe('renderShareImage', () => {
  const setupRender = () => {
    const s = setup();
    const renderer = new FakeRenderer({ width: 680, height: 340 });
    const deps = { ...s.deps, renderer, origin: async () => 'http://127.0.0.1:4402' };
    return { ...s, renderer, render: renderShareImage(deps), deps };
  };
  const size = (png: Uint8Array) => [new DataView(png.buffer).getUint32(16), new DataView(png.buffer).getUint32(20)];

  it('renders the preview card by default, landscape and day, and records it', async () => {
    const { render, renderer, share } = setupRender();
    const state = await render('live', 'linkedin');
    expect(renderer.calls).toEqual([{ target: { page: 'http://127.0.0.1:4402/_editor/figure', image: 'http://127.0.0.1:4402/og/live.png' }, theme: 'day' }]);
    expect(size(share.images.get('live/linkedin')!)).toEqual([1200, 628]);
    expect(state.networks.linkedin.rendered).toEqual({ key: '["preview","day","auto"]', shape: 'landscape', width: 1200, height: 628, at: '2026-11-25T12:00:00.000Z' });
  });

  it('renders a chosen component, picking portrait for a tall one', async () => {
    const { render, renderer, deps, share } = setupRender();
    renderer.figure = { width: 680, height: 1000 };
    await saveSocialPost(deps)('live', 'linkedin', { media: { kind: 'image', figure: { kind: 'component', source: 'src/components/post/Tree.astro', props: { steps: '3' } }, theme: 'night' } });
    const state = await render('live', 'linkedin');
    expect(renderer.calls[0]).toEqual({
      target: { page: 'http://127.0.0.1:4402/_editor/figure?src=src%2Fcomponents%2Fpost%2FTree.astro&props=%7B%22steps%22%3A%223%22%7D' },
      theme: 'night',
    });
    expect(state.networks.linkedin.rendered?.shape).toBe('portrait');
    expect(size(share.images.get('live/linkedin')!)).toEqual([1080, 1350]);
  });

  it("uses Calvin's shape over the suggested one", async () => {
    const { render, renderer, deps } = setupRender();
    renderer.figure = { width: 680, height: 1000 };
    await saveSocialPost(deps)('live', 'linkedin', { media: { kind: 'image', shape: 'landscape' } });
    expect((await render('live', 'linkedin')).networks.linkedin.rendered?.shape).toBe('landscape');
  });

  it('refuses when the post carries no image, and writes nothing when rendering fails', async () => {
    const { render, renderer, deps, share } = setupRender();
    await saveSocialPost(deps)('live', 'linkedin', { media: { kind: 'link-card' } });
    await expect(render('live', 'linkedin')).rejects.toBeInstanceOf(Refused);
    await saveSocialPost(deps)('live', 'linkedin', { media: { kind: 'image' } });
    renderer.fail = new Error('The preview is off');
    await expect(render('live', 'linkedin')).rejects.toThrow('The preview is off');
    expect(share.images.size).toBe(0);
    expect((await openShare(deps)('live')).state.networks.linkedin.rendered).toBeUndefined();
  });

  it('serves the rendered image, and says when there is none', async () => {
    const { render, deps } = setupRender();
    await expect(shareImage(deps)('live', 'linkedin')).rejects.toBeInstanceOf(NotFound);
    await render('live', 'linkedin');
    expect((await shareImage(deps)('live', 'linkedin')).length).toBe(24);
  });
});

describe('openShare figures', () => {
  it('lists the preview card and the post\'s figures', async () => {
    const { deps } = setup();
    await deps.library.write('live', `${live}\nimport Tree from '../../../components/post/Tree.astro';\n\n<Tree />\n`);
    expect((await openShare(deps)('live')).figures.map((f) => f.label)).toEqual(['Preview card', 'Tree']);
  });
});

describe('chooseLink', () => {
  const setupLinks = () => {
    const s = setup();
    const links = new MemoryShortLinks({ taken1: { post: 'other', to: '/posts/other/' } });
    // Byte 0 makes "aaaaaa", then "bbbbbb", and so on: deterministic codes.
    let n = 0;
    const deps = { ...s.deps, links, randomBytes: (len: number) => new Uint8Array(len).fill(n++) };
    return { ...s, links, deps, choose: chooseLink(deps) };
  };

  it('makes a short link the first time, adds it to the data file, and puts it in the text', async () => {
    const { choose, links, share } = setupLinks();
    const state = await choose('live', 'linkedin', 'short');
    expect(state.networks.linkedin.link).toEqual({ kind: 'short', code: 'aaaaaa' });
    expect(links.links.aaaaaa).toEqual({ post: 'live', to: '/posts/live/?utm_source=linkedin&utm_medium=social' });
    expect(share.texts.get('live')?.linkedin).toContain('https://www.lobocv.com/s/aaaaaa/');
  });

  it('keeps the code when switching back to tagged, and reuses it', async () => {
    const { choose, links } = setupLinks();
    await choose('live', 'linkedin', 'short');
    expect((await choose('live', 'linkedin', 'tagged')).networks.linkedin.link).toEqual({ kind: 'tagged', code: 'aaaaaa' });
    expect((await choose('live', 'linkedin', 'short')).networks.linkedin.link).toEqual({ kind: 'short', code: 'aaaaaa' });
    expect(Object.keys(links.links)).toEqual(['taken1', 'aaaaaa']);
  });

  it('skips codes already taken', async () => {
    const { choose, links, deps } = setupLinks();
    await links.add('aaaaaa', { post: 'other', to: '/posts/other/' });
    expect((await choose('live', 'linkedin', 'short')).networks.linkedin.link?.code).toBe('bbbbbb');
    void deps;
  });

  it('pre-flight checks each short link is live', async () => {
    const { choose, deps, checker } = setupLinks();
    await choose('live', 'linkedin', 'short');
    const check = preflight({ ...deps, origin: 'http://127.0.0.1:9' });
    expect((await check('live')).at(-1)).toEqual({ ok: false, message: "/s/aaaaaa/ isn't live yet (404). It works once the site is deployed" });
    checker.live['http://127.0.0.1:9/s/aaaaaa/'] = '/posts/live/?utm_source=linkedin&utm_medium=social';
    expect((await check('live')).at(-1)).toEqual({ ok: true, message: '/s/aaaaaa/ goes to /posts/live/?utm_source=linkedin&utm_medium=social' });
  });
});
