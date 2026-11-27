// LinkedIn. The limit is from LinkedIn's help page "Post and share updates"
// (https://www.linkedin.com/help/linkedin/answer/a528176, checked 2026-11-27). LinkedIn documents
// neither the fold nor hashtag advice, so those are judgment calls: its phone feed cuts posts after
// about 3 lines, and 3 to 5 hashtags is the common advice since hashtag following was dropped.
import type { Network, Parts } from '../../network.ts';

export const linkedin: Network = {
  id: 'linkedin',
  label: 'LinkedIn',
  composeUrl: 'https://www.linkedin.com/feed/?shareActive=true',

  // Characters as people see them, so an emoji counts once.
  count: (text) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)].length,
  limit: 3000,
  fold: { kind: 'lines', lines: 3, viewport: 'phone' },

  // Calvin's text, then the link unless he placed it himself, then the hashtags. LinkedIn makes
  // the link card from the URL, and wraps the link in its own shortener.
  assemble({ text, link, hashtags }: Parts) {
    const body = text.trim();
    const blocks = [body];
    if (link && !body.includes(link)) blocks.push(link);
    if (hashtags.length) blocks.push(hashtags.map((t) => `#${t}`).join(' '));
    // Leading space is trimmed, so Calvin's text sits that much earlier in the result.
    return { text: blocks.filter(Boolean).join('\n\n'), shift: -(text.length - text.trimStart().length) };
  },

  hashtags: { min: 3, max: 5, placement: 'end' },

  // Image comes with milestone 2, and becomes the default then.
  media: ['link-card', 'text-only'],
  defaultMedia: 'link-card',

  defaultLink: 'tagged',
  utmSource: 'linkedin',
};
