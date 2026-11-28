// Share links for the end of a post. Each network's link carries utm tags so analytics can
// tell reader shares (utm_medium=share) apart from Calvin's own posts (utm_medium=social,
// added by the editor's share page).

export type ShareNetwork = 'linkedin' | 'x' | 'bluesky';

export interface ShareLink {
  network: ShareNetwork;
  label: string;
  href: string;
}

/** The post URL as it should arrive from a share on this network */
export function taggedUrl(url: string, network: ShareNetwork): string {
  const u = new URL(url);
  u.searchParams.set('utm_source', network);
  u.searchParams.set('utm_medium', 'share');
  return u.toString();
}

export function shareLinks(url: string, title: string, xHandle?: string): ShareLink[] {
  const enc = encodeURIComponent;
  const linkedin = taggedUrl(url, 'linkedin');
  const x = taggedUrl(url, 'x');
  const bluesky = taggedUrl(url, 'bluesky');
  const via = xHandle ? `&via=${enc(xHandle.replace(/^@/, ''))}` : '';
  return [
    { network: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(linkedin)}` },
    { network: 'x', label: 'X', href: `https://x.com/intent/post?text=${enc(title)}&url=${enc(x)}${via}` },
    { network: 'bluesky', label: 'Bluesky', href: `https://bsky.app/intent/compose?text=${enc(`${title} ${bluesky}`)}` },
  ];
}
