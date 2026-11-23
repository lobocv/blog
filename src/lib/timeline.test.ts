import { describe, expect, it } from 'vitest';
import { TIMELINE, type Chapter, type SideItem } from '../data/timeline';
import { ageAt, attachSideItems, cameraPos, validateTimeline } from './timeline';

const ch = (over: Partial<Chapter>): Chapter => ({
  id: 'a', kind: 'work', start: '2020-01', when: '', era: '', title: 'T', scene: 'sky', age: 0, paragraphs: [], ...over,
});
const tl = (chapters: Chapter[], side: SideItem[] = []) => ({ draft: true, chapters, side });

describe('validateTimeline', () => {
  it('accepts the real timeline', () => {
    expect(validateTimeline(TIMELINE)).toEqual([]);
  });

  it('flags overlapping work chapters by id', () => {
    const errs = validateTimeline(tl([ch({ id: 'pulley', start: '2025-09', end: '2026-09' }), ch({ id: 'infisical', start: '2026-08' })]));
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('pulley');
    expect(errs[0]).toContain('infisical');
  });

  it('allows a same-month handover', () => {
    expect(validateTimeline(tl([ch({ id: 'a', start: '2025-09', end: '2026-08' }), ch({ id: 'b', start: '2026-08' })]))).toEqual([]);
  });

  it('flags chapters out of order', () => {
    expect(validateTimeline(tl([ch({ id: 'a', start: '2021-01', end: '2021-02' }), ch({ id: 'b', start: '2020-01', end: '2020-02' })]))).not.toEqual([]);
  });

  it('flags a wolf that gets younger', () => {
    expect(validateTimeline(tl([ch({ id: 'a', end: '2020-02', age: 2 }), ch({ id: 'b', start: '2020-03', age: 1 })]))).not.toEqual([]);
  });

  it('flags an end before the start', () => {
    expect(validateTimeline(tl([ch({ start: '2020-05', end: '2020-01' })]))).not.toEqual([]);
  });

  it('flags duplicate ids', () => {
    expect(validateTimeline(tl([ch({ id: 'a', end: '2020-02' }), ch({ id: 'a', start: '2020-03' })]))).not.toEqual([]);
  });

  it.each([
    ['title', ch({ title: 'a — b' })],
    ['paragraphs', ch({ paragraphs: ['a — b'] })],
    ['bullets', ch({ bullets: ['a — b'] })],
  ])('flags an em-dash in %s', (_, c) => {
    expect(validateTimeline(tl([c]))).not.toEqual([]);
  });

  it.each(['summary', 'body'] as const)('flags an em-dash in a side item %s', field => {
    const item: SideItem = { kind: 'hobby', start: '2020-01', when: '', title: 'x', summary: 'x', [field]: 'a — b' };
    expect(validateTimeline(tl([ch({})], [item]))).not.toEqual([]);
  });
});

describe('attachSideItems', () => {
  const chapters = [ch({ id: 'strato', start: '2018-11', end: '2019-12' }), ch({ id: 'hoot', start: '2020-02', end: '2024-12' })];
  const item = (start: SideItem['start']): SideItem => ({ kind: 'renovation', start, when: '', title: start, summary: '' });

  it('places an item on the chapter whose span contains it', () => {
    expect(attachSideItems(chapters, [item('2021-06')]).get('hoot')?.map(s => s.title)).toEqual(['2021-06']);
  });

  it('places an item before the first chapter on the first', () => {
    expect(attachSideItems(chapters, [item('2010-01')]).get('strato')?.map(s => s.title)).toEqual(['2010-01']);
  });

  it('places an item starting with a chapter on that chapter', () => {
    expect(attachSideItems(chapters, [item('2020-02')]).get('hoot')?.map(s => s.title)).toEqual(['2020-02']);
  });
});

describe('cameraPos', () => {
  const tops = [100, 400, 1000];
  it('approaches the first chapter from before it', () => {
    expect(cameraPos(tops, 50, 1300)).toEqual({ index: 0, pos: -0.6 * (1 - 50 / 100) });
  });
  it('clamps the approach at -0.6', () => {
    expect(cameraPos(tops, -500, 1300)).toEqual({ index: 0, pos: -0.6 });
  });
  it('sits on a chapter at its top', () => {
    expect(cameraPos(tops, 100, 1300)).toEqual({ index: 0, pos: 0 });
  });
  it('interpolates within a row', () => {
    expect(cameraPos(tops, 250, 1300)).toEqual({ index: 0, pos: 0.5 });
  });
  it('interpolates per row with uneven heights', () => {
    expect(cameraPos(tops, 700, 1300)).toEqual({ index: 1, pos: 1.5 });
  });
  it('clamps past the end', () => {
    expect(cameraPos(tops, 5000, 1300)).toEqual({ index: 2, pos: 3 });
  });
});

describe('ageAt', () => {
  const ages = [0, 1, 1, 3];
  it('uses the first age before the first chapter', () => {
    expect(ageAt(ages, -0.4)).toBe(0);
  });
  it('holds a chapter age once past the blend', () => {
    expect(ageAt(ages, 1.5)).toBe(1);
    expect(ageAt(ages, 2.9)).toBe(1);
  });
  it('blends from the previous age across the start of a chapter', () => {
    expect(ageAt(ages, 1)).toBe(0);
    expect(ageAt(ages, 1.1)).toBeCloseTo(0.5);
    expect(ageAt(ages, 1.2)).toBeCloseTo(1);
  });
  it('blends across a jump of more than one age', () => {
    expect(ageAt(ages, 3.1)).toBeCloseTo(2);
  });
  it('holds the last age past the end', () => {
    expect(ageAt(ages, 9)).toBe(3);
  });
});
