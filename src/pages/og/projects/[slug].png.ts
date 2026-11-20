import type { APIRoute } from 'astro';
import { getProjects } from '../../../lib/projects';
import { renderOg } from '../../../lib/og';

// One social preview image per project
export async function getStaticPaths() {
  const projects = await getProjects();
  return projects.map(p => ({ params: { slug: p.id }, props: { title: p.data.title, summary: p.data.summary } }));
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await renderOg(props as { title: string; summary?: string })), { headers: { 'Content-Type': 'image/png' } });
