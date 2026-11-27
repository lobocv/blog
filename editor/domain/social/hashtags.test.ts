import { describe, expect, it } from 'vitest';
import { cleanHashtag, hashtagsFor } from './hashtags.ts';

describe('hashtagsFor', () => {
  it('takes each category\'s best tag first, without repeats, up to the limit', () => {
    expect(hashtagsFor(['AI', 'Architecture'], 5)).toEqual(['AI', 'SoftwareArchitecture', 'AIAgents', 'SystemDesign', 'SoftwareEngineering']);
    expect(hashtagsFor(['AI', 'Architecture'], 3)).toEqual(['AI', 'SoftwareArchitecture', 'AIAgents']);
    expect(hashtagsFor(['Architecture', 'Decoupling'], 5)).toEqual(['SoftwareArchitecture', 'SystemDesign']);
  });

  it('turns an unmapped category into a tag', () => {
    expect(hashtagsFor(['Event Sourcing'], 3)).toEqual(['EventSourcing']);
  });

  it('is empty without categories', () => expect(hashtagsFor([], 5)).toEqual([]));
});

describe('cleanHashtag', () => {
  it.each([['#System Design', 'SystemDesign'], ['go-lang', 'golang'], ['C++', 'C'], ['日本', '日本']])('%j is %j', (a, b) => expect(cleanHashtag(a)).toBe(b));
});
