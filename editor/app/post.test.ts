import { describe, expect, it } from 'vitest';
import { createDraft } from './create-draft.ts';
import { deleteDraft } from './delete-draft.ts';
import { NotFound, Refused } from './errors.ts';
import { listPosts } from './list-posts.ts';
import { openPost } from './open-post.ts';
import { savePost } from './save-post.ts';
import { FakeClock, MemoryPostLibrary, MemoryThreadStore } from './testing/fakes.ts';

const draft = '---\ntitle: A draft\ndraft: true\n---\none two';
const live = '---\ntitle: Live\ndraft: false\n---\nthree';

const library = () => new MemoryPostLibrary({ a: draft, live });

describe('listPosts', () => {
  it('lists drafts, then published posts', async () => {
    expect((await listPosts(library())()).map((d) => [d.slug, d.draft])).toEqual([
      ['a', true],
      ['live', false],
    ]);
  });
});

describe('openPost', () => {
  it('returns the text and its path', async () => {
    expect(await openPost(library())('a')).toEqual({ slug: 'a', name: 'src/content/posts/a/index.md', text: draft });
  });

  it.each(['missing', '../a'])('refuses %j', async (slug) => {
    await expect(openPost(library())(slug)).rejects.toBeInstanceOf(NotFound);
  });
});

describe('savePost', () => {
  it('writes the text', async () => {
    const lib = library();
    await savePost(lib, new MemoryThreadStore())('a', 'new');
    expect((await lib.read('a'))?.text).toBe('new');
  });

  it("doesn't recreate a deleted post", async () => {
    const lib = library();
    await expect(savePost(lib, new MemoryThreadStore())('gone', 'text')).rejects.toBeInstanceOf(NotFound);
    expect(lib.writes).toEqual([]);
  });
});

describe('deleteDraft', () => {
  it('removes a draft', async () => {
    const lib = library();
    await deleteDraft(lib)('a');
    expect(lib.removed).toEqual(['a']);
  });

  it('refuses a published post', async () => {
    const lib = library();
    await expect(deleteDraft(lib)('live')).rejects.toBeInstanceOf(Refused);
    expect(lib.removed).toEqual([]);
  });

  it.each(['missing', '..'])('refuses %j', async (slug) => {
    await expect(deleteDraft(library())(slug)).rejects.toBeInstanceOf(NotFound);
  });
});

describe('createDraft', () => {
  it('writes a dated draft named after the title, and returns its slug', async () => {
    const lib = library();
    const slug = await createDraft(lib, new FakeClock())('The Plugin Pattern');
    expect(slug).toBe('plugin_pattern');
    expect((await lib.read('plugin_pattern'))?.text).toMatch(/^---\ntitle: "The Plugin Pattern"\ndraft: true\ndate: \d{4}-\d{2}-\d{2}\n---\n/);
  });

  it.each([['', 'a letter'], ['!!', 'a letter'], ['A', 'already a post']])('refuses %j', async (t, why) => {
    await expect(createDraft(library(), new FakeClock())(t)).rejects.toThrow(why);
  });
});
