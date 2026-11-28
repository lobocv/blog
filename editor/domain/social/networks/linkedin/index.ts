// LinkedIn. The limit is from LinkedIn's help page "Post and share updates"
// (https://www.linkedin.com/help/linkedin/answer/a528176, checked 2026-11-27), and image sizes from
// "Share photos or videos" (https://www.linkedin.com/help/linkedin/answer/a527229, checked
// 2026-11-27): 1080px wide recommended, ratios from 3:1 to 4:5. LinkedIn documents
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

  // An image or a link card, never both. With an image the link in the text stays clickable.
  media: ['image', 'link-card', 'text-only'],
  defaultMedia: 'image',
  imageShapes: [
    // 1.91:1, the shape of a link card, so the preview card fits exactly.
    { id: 'landscape', label: 'Landscape', width: 1200, height: 628 },
    // 4:5, the tallest every version of LinkedIn's help page allows.
    { id: 'portrait', label: 'Portrait', width: 1080, height: 1350 },
  ],
  // Portrait only for figures clearly taller than wide; square-ish ones read fine landscape.
  defaultShape: ({ width, height }) => (height > width * 1.15 ? 'portrait' : 'landscape'),
  altText: true,

  defaultLink: 'tagged',
  utmSource: 'linkedin',

  guide: [
    'Plain text: LinkedIn shows no Markdown, so no **bold**, headings or bullet syntax.',
    'The phone feed shows about 3 lines (roughly 120 characters) before "…more", so the first',
    'paragraph has to give a reason to tap on its own. Short paragraphs, with blank lines between.',
    'The link goes after the text and the hashtags at the end; the editor adds both, so leave them',
    'out of the text unless the link reads better inside a sentence.',
  ].join(' '),
};
