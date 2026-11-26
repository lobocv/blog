// The post's front matter as fields, for the form above the source. The form writes the whole
// block back in one format, so a typo can't break the post (eg a missing quote or `---`).
// The fields follow the posts schema in src/content.config.ts.
import { splitFrontMatter } from './document.ts';

export type FrontMatter = {
  title: string;
  draft: boolean;
  /** As written, eg 2021-08-01 (a time after it is kept until the date is changed). */
  date: string;
  categories: string[];
  summary: string;
  /** Any other keys (eg `feature`), as YAML, kept as they are. */
  other: string;
};

const KNOWN = ['title', 'draft', 'date', 'categories', 'summary'] as const;

/** The fields, or undefined when the post has front matter the editor can't read safely. */
export function readFrontMatter(text: string): FrontMatter | undefined {
  const { frontMatter } = splitFrontMatter(text);
  const fm: FrontMatter = { title: '', draft: false, date: '', categories: [], summary: '', other: '' };
  if (!frontMatter) return looksBroken(text) ? undefined : fm;

  const lines = frontMatter.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').slice(1, -1);
  const other: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^([A-Za-z_][\w-]*):(.*)$/.exec(lines[i]);
    // Indented lines and list items belong to the key above them.
    const rest: string[] = [];
    while (i + 1 < lines.length && /^(\s+\S|\s*-\s)/.test(lines[i + 1])) rest.push(lines[++i]);
    const key = m?.[1] as (typeof KNOWN)[number] | undefined;
    if (!m || !KNOWN.includes(key!)) {
      other.push(lines[i - rest.length], ...rest);
      continue;
    }
    const value = m[2].trim();
    if (key === 'categories') {
      const list = value ? inlineList(value) : rest.map((r) => scalar(r.replace(/^\s*-\s*/, '')));
      if (!list) return undefined;
      fm.categories = list.filter(Boolean);
    } else if (rest.length) return undefined;
    else if (key === 'draft') {
      if (!/^(true|false)?$/.test(value)) return undefined;
      fm.draft = value === 'true';
    } else fm[key!] = scalar(value);
  }
  fm.other = other.join('\n');
  return fm;
}

/** The text with its front matter set to `fm`, in the editor's one format. */
export function writeFrontMatter(text: string, fm: FrontMatter): string {
  const lines = [`title: ${quote(fm.title)}`, `draft: ${fm.draft}`];
  if (fm.date) lines.push(`date: ${fm.date}`);
  if (fm.categories.length) lines.push(`categories: [${fm.categories.map(quote).join(', ')}]`);
  if (fm.summary) lines.push(`summary: ${quote(fm.summary)}`);
  if (fm.other.trim()) lines.push(fm.other.replace(/\s+$/, ''));
  const { frontMatter, body } = splitFrontMatter(text);
  return `---\n${lines.join('\n')}\n---\n${frontMatter ? body : `\n${body}`}`;
}

/** What would stop the site building the post, by field. Mirrors the posts schema. */
export function problems(fm: FrontMatter): Partial<Record<'title' | 'date' | 'summary', string>> {
  const out: Partial<Record<'title' | 'date' | 'summary', string>> = {};
  if (!fm.title.trim()) out.title = 'Required';
  if (fm.date && !/^\d{4}-\d{2}-\d{2}/.test(fm.date)) out.date = 'Not a date';
  if (!fm.draft && !fm.date) out.date = 'Needed to publish';
  if (!fm.draft && !fm.summary.trim()) out.summary = 'Needed to publish';
  return out;
}

// Front matter the split didn't find, but that's there (eg a typo before the first ---).
function looksBroken(text: string): boolean {
  const head = text.split('\n').slice(0, 20);
  if (/^\s*---/.test(head[0] ?? '')) return true;
  const close = head.findIndex((l) => /^\S*---\s*$/.test(l));
  return close !== -1 && (/\S---/.test(head[close]) || head.slice(0, close).some((l) => /^[A-Za-z_]\w*:/.test(l)));
}

// JSON strings are valid YAML double-quoted strings.
const quote = (s: string) => JSON.stringify(s);

function scalar(v: string): string {
  if (v.startsWith('"')) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v.replace(/\s+#.*$/, '');
}

function inlineList(v: string): string[] | undefined {
  if (!v.startsWith('[') || !v.endsWith(']')) return undefined;
  const items = v.slice(1, -1).match(/"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^,]+/g) ?? [];
  return items.map((s) => scalar(s.trim()));
}
