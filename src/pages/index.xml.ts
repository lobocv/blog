import type { APIContext } from 'astro';
import { getPosts } from '../lib/posts';
import { buildFeed } from '../lib/feed';

export async function GET(context: APIContext) {
  return new Response(buildFeed(await getPosts(), String(context.site)), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
