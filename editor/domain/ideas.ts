// writing/ideas.md: post ideas, one bullet each under "## Ideas", newest first, written by /idea
// as `- YYYY-MM-DD: <idea>` with an optional series tag (eg `[trellis]`). Everything else in the
// file is kept as it is.

export type Idea = { date?: string; text: string; series?: string };

const BULLET = /^- (?:(\d{4}-\d{2}-\d{2}): )?(.*)$/;

/** The ideas in the order the file lists them. */
export function ideas(md: string): Idea[] {
  return section(md).lines.flatMap((line) => {
    const m = BULLET.exec(line);
    if (!m) return [];
    const series = /^\[([\w-]+)\]\s*/.exec(m[2]);
    return [{ ...(m[1] && { date: m[1] }), text: series ? m[2].slice(series[0].length) : m[2], ...(series && { series: series[1] }) }];
  });
}

/** The file with `text` added at the top of the list, as /idea adds it. */
export function addIdea(md: string, text: string, today: string): string {
  const line = `- ${today}: ${text.replace(/\s*\n\s*/g, ' ').trim()}`;
  const { before, lines, after } = section(md);
  const first = lines.findIndex((l) => BULLET.test(l));
  // An empty list starts after a blank line below the heading.
  const blanks = lines.findIndex((l) => l.trim());
  const next =
    first === -1 ? ['', line, ...lines.slice(blanks === -1 ? lines.length : blanks)] : [...lines.slice(0, first), line, ...lines.slice(first)];
  const out = [...before, ...next, ...after];
  // The file ends with a line break.
  if (out.at(-1) !== '') out.push('');
  return out.join('\n');
}

/** The file without the first bullet that is `idea`. Unchanged when it's gone already. */
export function removeIdea(md: string, idea: Idea): string {
  const { before, lines, after } = section(md);
  const want = `- ${idea.date ? `${idea.date}: ` : ''}${idea.series ? `[${idea.series}] ` : ''}${idea.text}`;
  const at = lines.findIndex((l) => l === want);
  if (at === -1) return md;
  return [...before, ...lines.slice(0, at), ...lines.slice(at + 1), ...after].join('\n');
}

// The lines under "## Ideas", up to the next heading. Without the heading, the file gets one.
function section(md: string) {
  const all = md.split('\n');
  let start = all.findIndex((l) => /^##\s+Ideas\s*$/.test(l));
  if (start === -1) {
    while (all.length && !all.at(-1)!.trim()) all.pop();
    all.push(...(all.length ? [''] : []), '## Ideas', '');
    start = all.length - 2;
  }
  const rest = all.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,2}\s/.test(l));
  const lines = end === -1 ? rest : rest.slice(0, end);
  return { before: all.slice(0, start + 1), lines, after: end === -1 ? [] : rest.slice(end) };
}
