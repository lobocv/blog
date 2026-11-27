import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import cases from './banned-words.cases.json' with { type: 'json' };
import { bannedWords } from './banned-words.ts';

const root = resolve(import.meta.dirname, '..');

describe('banned words', () => {
  it.each(cases)('finds $matches in $text', ({ text, matches }) => {
    expect(bannedWords(text).map((w) => w.word)).toEqual(matches);
  });

  it('gives offsets into the original text', () => {
    const text = 'I’ll say: it’s worth noting.';
    const [w] = bannedWords(text);
    expect(text.slice(w.from, w.to)).toBe('it’s worth noting');
  });

  it('matches the same way in scripts/lint_post.py', () => {
    const script = `
import json, sys
sys.path.insert(0, 'scripts')
import lint_post
cases = json.load(open('shared/banned-words.cases.json'))
print(json.dumps([[m.group(0) for m in lint_post.banned(c['text'])] for c in cases]))
`;
    const found = JSON.parse(execFileSync('python3', ['-c', script], { cwd: root, encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));
    expect(found).toEqual(cases.map((c) => c.matches));
  });
});
