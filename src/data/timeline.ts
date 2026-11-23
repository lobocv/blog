// The journey page's content. Chapters are the main story and never overlap; side items
// (renovations, hobbies, side projects) ran alongside them and attach to a chapter by date.
// Checked by validateTimeline in src/lib/timeline.ts, so bad data fails the build.

/** pup, yearling, adult, grey muzzle */
export type Age = 0 | 1 | 2 | 3;
export type SceneId = 'fork' | 'sky' | 'radar-ground' | 'radar-sweep' | 'clouds' | 'avalanche' | 'summit' | 'ridge' | 'overlook';
/** 'YYYY-MM' */
export type Month = `${number}-${string}`;

export interface Chapter {
  id: string;
  kind: 'work' | 'life';
  start: Month;
  /** Omitted means ongoing */
  end?: Month;
  /** Display dates, eg 'Jul 2013 – Nov 2017' */
  when: string;
  /** Short name in the scene's corner */
  era: string;
  title: string;
  role?: string;
  scene: SceneId;
  age: Age;
  paragraphs: string[];
  bullets?: string[];
  link?: { href: string; label: string };
}

export interface SideItem {
  kind: 'renovation' | 'hobby' | 'project';
  start: Month;
  end?: Month;
  when: string;
  title: string;
  /** One line, always shown */
  summary: string;
  /** Shown when expanded */
  body?: string;
}

export const TIMELINE: { draft: boolean; chapters: Chapter[]; side: SideItem[] } = {
  draft: true,
  chapters: [
    { id: 'mcmaster', kind: 'work', start: '2008-09', end: '2013-04', when: '2008 – 2013', era: 'University',
      title: 'McMaster University', role: 'Honours BSc Physics (co-op)', scene: 'sky', age: 0, paragraphs: [] },
    { id: 'sensors', kind: 'work', start: '2013-07', end: '2017-11', when: 'Jul 2013 – Nov 2017', era: 'Sensors & Software',
      title: 'Sensors & Software', role: 'Software Developer', scene: 'radar-ground', age: 1, paragraphs: [] },
    { id: 'patriot', kind: 'work', start: '2017-11', end: '2018-11', when: 'Nov 2017 – Nov 2018', era: 'Patriot One',
      title: 'Patriot One Technologies', role: 'Software Engineer', scene: 'radar-sweep', age: 2, paragraphs: [] },
    { id: 'stratoscale', kind: 'work', start: '2018-11', end: '2019-12', when: 'Nov 2018 – Dec 2019', era: 'Stratoscale',
      title: 'Stratoscale', role: 'Backend Software Developer', scene: 'clouds', age: 2, paragraphs: [] },
    { id: 'hootsuite-analytics', kind: 'work', start: '2020-02', end: '2024-01', when: 'Feb 2020 – 2024', era: 'Hootsuite',
      title: 'Hootsuite, Social Analytics', role: 'Senior, then Staff Software Engineer', scene: 'avalanche', age: 2, paragraphs: [],
      link: { href: '/projects/avalanche/', label: 'How we built Avalanche' } },
    { id: 'hootsuite-arch', kind: 'work', start: '2024-01', end: '2025-08', when: '2024 – Aug 2025', era: 'Hootsuite',
      title: 'Hootsuite, Architecture', role: 'Staff Software Engineer (Architecture)', scene: 'summit', age: 3, paragraphs: [] },
    { id: 'pulley', kind: 'work', start: '2025-09', end: '2026-08', when: 'Sep 2025 – Aug 2026', era: 'Pulley',
      title: 'Pulley', role: 'Staff Software Engineer (Architect / Tech Lead)', scene: 'ridge', age: 3, paragraphs: [] },
    { id: 'infisical', kind: 'work', start: '2026-08', end: '2026-10', when: 'Aug 2026 – Oct 2026', era: 'Infisical',
      title: 'Infisical', role: 'Architect', scene: 'ridge', age: 3, paragraphs: [] },
  ],
  side: [],
};
