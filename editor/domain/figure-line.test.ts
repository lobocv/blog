import { describe, expect, it } from 'vitest';
import { figureLine, figureUrl } from './figure-line.ts';

const path = 'src/content/posts/a/index.mdx';
const post = "import Loop from '../../../components/post/Loop.astro';\n";
const origin = 'http://127.0.0.1:4402';

describe('figureLine', () => {
  it.each([
    ['a component on its own', '<Loop />', { kind: 'component', name: 'Loop', source: 'src/components/post/Loop.astro', props: {} }],
    ['with string props', '  <Loop steps="3" title="A b"/>', { kind: 'component', name: 'Loop', source: 'src/components/post/Loop.astro', props: { steps: '3', title: 'A b' } }],
    ['an image', '![Dot](./dot.png)', { kind: 'image', alt: 'Dot', src: 'src/content/posts/a/dot.png' }],
    ['an HTML image', '<img alt="x" src="/posts/a/x.svg"/>', { kind: 'image', alt: 'x', src: 'public/posts/a/x.svg' }],
    ['a component with children', '<SeriesNote>', undefined],
    ['a prop that is code', '<Loop steps={3} />', undefined],
    ['an image inside a sentence', 'See ![Dot](./dot.png) here.', undefined],
    ['words', 'Plain words.', undefined],
  ])('%s', (_, line, want) => expect(figureLine(line, post, path)).toEqual(want));
});

describe('figureUrl', () => {
  it.each([
    [{ kind: 'component' as const, name: 'Loop', source: 'src/components/post/Loop.astro', props: {} }, `${origin}/_editor/figure?src=src%2Fcomponents%2Fpost%2FLoop.astro`],
    [{ kind: 'component' as const, name: 'Loop', source: 'x.astro', props: { a: 'b' } }, `${origin}/_editor/figure?src=x.astro&props=%7B%22a%22%3A%22b%22%7D`],
    [{ kind: 'component' as const, name: 'Gone' }, undefined],
    [{ kind: 'image' as const, alt: '', src: 'public/posts/a/x.svg' }, `${origin}/posts/a/x.svg`],
    [{ kind: 'image' as const, alt: '', src: 'src/content/posts/a/dot.png' }, `${origin}/src/content/posts/a/dot.png`],
    [{ kind: 'image' as const, alt: '', src: 'https://e.com/x.png' }, 'https://e.com/x.png'],
  ])('%o', (figure, want) => expect(figureUrl(figure, origin)).toBe(want));
});
