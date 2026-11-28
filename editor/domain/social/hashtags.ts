// Candidate hashtags from a post's categories. A hand-kept map for now; Claude picks hashtags
// once it drafts the post (milestone 3).

const byCategory: Record<string, string[]> = {
  AI: ['AI', 'AIAgents', 'SoftwareEngineering'],
  Architecture: ['SoftwareArchitecture', 'SystemDesign'],
  Databases: ['Databases', 'PostgreSQL'],
  'Design Patterns': ['DesignPatterns', 'SoftwareArchitecture'],
  Decoupling: ['SoftwareArchitecture'],
  'Developer Efficiency': ['DeveloperProductivity', 'SoftwareEngineering'],
  Golang: ['Golang', 'Go'],
};

/** Hashtags (without the #) for the categories, first-choice tags first, at most `max`. */
export function hashtagsFor(categories: string[], max: number): string[] {
  const lists = categories.map((c) => byCategory[c] ?? [c.replace(/[^\p{L}\p{N}]+/gu, '')]).filter((l) => l.length);
  // Round robin, so each category gets its best tag before any gets a second.
  const out: string[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (l[i] && !out.some((t) => t.toLowerCase() === l[i].toLowerCase())) out.push(l[i]);
  }
  return out.filter(Boolean).slice(0, max);
}

/** A hashtag as typed (eg "#System Design"), cleaned to what networks link (SystemDesign). */
export const cleanHashtag = (tag: string) => tag.replace(/[^\p{L}\p{N}_]+/gu, '');
