import { describe, expect, it } from 'vitest';
import { figureIn } from './figure.ts';

const path = 'src/content/posts/agents/index.mdx';
const post = "---\ntitle: A\n---\nimport ContextStack from '../../../components/post/ContextStack.astro';\n\n<ContextStack />\n";

describe('figureIn', () => {
  it.each([
    ['a component, with its file from the import', '<ContextStack />', { kind: 'component', name: 'ContextStack', source: 'src/components/post/ContextStack.astro' }],
    ['a component with props over several lines', '<ContextStack', { kind: 'component', name: 'ContextStack', source: 'src/components/post/ContextStack.astro' }],
    ['a component the post doesn\'t import', '<Missing />', { kind: 'component', name: 'Missing', source: undefined }],
    ['an image next to the post', '![The loop](./loop.png)', { kind: 'image', alt: 'The loop', src: 'src/content/posts/agents/loop.png' }],
    ['an image from the site', '![](/images/x.png "title")', { kind: 'image', alt: '', src: 'public/images/x.png' }],
    ['an HTML image', '<img alt="Slots" src="/posts/a/slots.svg"/>', { kind: 'image', alt: 'Slots', src: 'public/posts/a/slots.svg' }],
    ['an image on the web', '![x](https://example.com/x.png)', { kind: 'image', alt: 'x', src: 'https://example.com/x.png' }],
    ['plain words', 'Some words with <b>html</b>.', undefined],
  ])('%s', (_, quote, want) => expect(figureIn(quote, post, path)).toEqual(want));
});
