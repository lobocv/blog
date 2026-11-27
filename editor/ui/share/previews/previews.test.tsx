import { render } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { networks } from '../../../domain/social/networks/registry.ts';
import { previews } from './index.ts';

const post = { title: 'Title', summary: 'Sum', image: 'https://www.lobocv.com/og/a.png', postUrl: 'https://www.lobocv.com/posts/a/' };

describe('previews', () => {
  it('has one for each enabled network, and none for others', () => {
    expect(Object.keys(previews).sort()).toEqual(networks.map((n) => n.id).sort());
  });

  it.each(networks.map((n) => [n.id, n] as const))('%s shows the text and reports a fold', (_, network) => {
    const Preview = previews[network.id];
    const folds: unknown[] = [];
    const { getByText } = render(<Preview network={network} text={'Hook.\n\n#AI'} media={network.defaultMedia} post={post} onFold={(f) => folds.push(f)} />);
    expect(getByText(/Hook\./)).toBeTruthy();
    // No layout in tests, so nothing is cut.
    if (network.fold.kind === 'lines') expect(folds.at(-1)).toEqual({ text: 'Hook.\n\n#AI', offset: 10 });
  });
});
