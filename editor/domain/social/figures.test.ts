import { describe, expect, it } from 'vitest';
import { figureKey, postFigures } from './figures.ts';

const post = `---
title: T
---
import Tree from '../../../components/post/Tree.astro';
import Callout from '../../../components/post/Callout.astro';

Intro.

<Tree />

<Tree steps="3" />

<Callout>Prose, not a figure.</Callout>

![A dot](./dot.png)

<Tree />
`;

describe('postFigures', () => {
  it('lists the preview card, then each figure placed on its own line, once each', () => {
    expect(postFigures(post, 'src/content/posts/a/index.mdx')).toEqual([
      { key: 'preview', label: 'Preview card', figure: { kind: 'preview' } },
      { key: 'component:src/components/post/Tree.astro', label: 'Tree', figure: { kind: 'component', source: 'src/components/post/Tree.astro' } },
      {
        key: 'component:src/components/post/Tree.astro{"steps":"3"}',
        label: 'Tree',
        figure: { kind: 'component', source: 'src/components/post/Tree.astro', props: { steps: '3' } },
      },
      { key: 'image:src/content/posts/a/dot.png', label: 'A dot', figure: { kind: 'image', src: 'src/content/posts/a/dot.png' } },
    ]);
  });

  it('skips a component it can\'t find the import for', () => {
    expect(postFigures('<Missing />', 'src/content/posts/a/index.mdx')).toHaveLength(1);
  });
});

it('keys figures apart', () => {
  expect(new Set([figureKey({ kind: 'preview' }), figureKey({ kind: 'image', src: 'a.png' }), figureKey({ kind: 'component', source: 'a.png' })]).size).toBe(3);
});
