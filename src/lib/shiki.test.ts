import { describe, expect, it } from 'vitest';
import { codeToHtml } from 'shiki';
import { shikiConfig } from './shiki.mjs';

const render = (code: string, meta: string) =>
  codeToHtml(code, { lang: 'go', theme: shikiConfig.theme as never, transformers: shikiConfig.transformers, meta: { __raw: meta } });

describe('code block transformers', () => {
  it('puts a title="..." filename on the pre', async () => {
    expect(await render('x := 1', 'title="main.go"')).toContain('data-title="main.go"');
  });
  it('highlights lines named in the meta', async () => {
    const html = await render('a := 1\nb := 2\nc := 3', '{2}');
    expect(html.match(/class="line[^"]*highlighted/g)).toHaveLength(1);
  });
});
