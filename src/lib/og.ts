// Social preview images (Open Graph): the night horizon art above the post title, rendered at build time.
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { horizon } from '../scripts/art/landscape.js';

const root = process.cwd();
const font = (pkg: string, file: string) => fs.readFileSync(path.join(root, 'node_modules/@fontsource', pkg, 'files', file));

// Night palette from the :root block of site.css, so the card matches the site
function nightVars(): Record<string, string> {
  const css = fs.readFileSync(path.join(root, 'src/styles/site.css'), 'utf8');
  const block = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  const vars: Record<string, string> = {};
  for (const [, k, v] of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[k] = v.trim();
  return vars;
}

/** The inner-page horizon band as standalone SVG with colours inlined. */
export function horizonSvg(): string {
  const vars = nightVars();
  const resolve = (s: string): string => s.replace(/var\(--([\w-]+)\)/g, (_, k) => resolve(vars[k] ?? '#000'));
  const el = { html: '', insertAdjacentHTML(_: string, h: string) { this.html = h; } };
  horizon(el as unknown as HTMLElement);
  return resolve(el.html
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="300" ')
    .replace(/ class="t"/g, ' fill="var(--tree)" stroke="var(--tree-edge)" stroke-width=".8" stroke-linejoin="round"')
    .replace(/ class="tl"/g, ' fill="var(--tree-lit)"')
    .replace(/ class="(night-only|trees)"/g, ''));
}

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style, children } });

export async function renderOg({ title, summary }: { title: string; summary?: string }): Promise<Buffer> {
  const v = nightVars();
  const art = `data:image/svg+xml;base64,${Buffer.from(horizonSvg()).toString('base64')}`;
  const tree = el('div', { width: 1200, height: 630, display: 'flex', flexDirection: 'column', background: v.page, color: v.ink, fontFamily: 'Inter' }, [
    el('div', { display: 'flex', position: 'relative', height: 220, background: `linear-gradient(${v['sky-1']}, ${v['sky-2']})` },
      { type: 'img', props: { src: art, width: 1200, height: 225, style: { position: 'absolute', left: 0, bottom: 0, objectFit: 'cover' } } }),
    el('div', { display: 'flex', flexDirection: 'column', flex: 1, padding: '36px 72px 44px' }, [
      el('div', { fontFamily: 'Fraunces', fontWeight: 500, fontSize: title.length > 48 ? 54 : 64, lineHeight: 1.08, letterSpacing: '-0.015em' }, title),
      ...(summary ? [el('div', { marginTop: 18, fontSize: 25, lineHeight: 1.45, color: v['ink-2'], display: 'block', lineClamp: 2 }, summary)] : []),
      el('div', { marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 14, fontSize: 21, color: v.accent, letterSpacing: '0.04em' }, [
        el('div', { width: 10, height: 10, borderRadius: 5, background: v.accent }),
        'lobocv.com',
      ]),
    ]),
  ]);
  const svg = await satori(tree as never, {
    width: 1200, height: 630,
    fonts: [
      { name: 'Fraunces', data: font('fraunces', 'fraunces-latin-500-normal.woff'), weight: 500, style: 'normal' },
      { name: 'Inter', data: font('inter', 'inter-latin-400-normal.woff'), weight: 400, style: 'normal' },
    ],
  });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
