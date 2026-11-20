import type { APIContext } from 'astro';
import { getPosts } from '../lib/posts';
import { getProjects } from '../lib/projects';

// Hugo served /sitemap.xml; @astrojs/sitemap writes sitemap-index.xml, so keep the old path working too.
export async function GET(context: APIContext) {
  const base = String(context.site).replace(/\/$/, '');
  const projects = await getProjects();
  const paths = [
    '/', '/posts/', '/about/', ...(await getPosts()).map(p => `/posts/${p.id}/`),
    ...(projects.length ? ['/projects/', ...projects.map(p => `/projects/${p.id}/`)] : []),
  ];
  const body = `<?xml version="1.0" encoding="utf-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p => `<url><loc>${base}${p}</loc></url>`).join('')}</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
