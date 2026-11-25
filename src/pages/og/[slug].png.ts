import type { APIRoute } from 'astro';
import { getPosts } from '../../lib/posts';
import { renderOg } from '../../lib/og';

// One social preview image per post, plus /og/site.png for every other page
export async function getStaticPaths() {
  const posts = await getPosts();
  return [
    { params: { slug: 'site' }, props: { title: 'Calvin Lobo', summary: 'Software architecture, engineering efficiency and building products.' } },
    ...posts.map(p => ({ params: { slug: p.id }, props: { title: p.data.title, summary: p.data.summary } })),
  ];
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await renderOg(props as { title: string; summary?: string })), { headers: { 'Content-Type': 'image/png' } });
