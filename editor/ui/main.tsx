import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './theme.css';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { deleteDraft, loadPost, loadPosts } from './api.ts';
import { PostsView } from './views/PostsView.tsx';
import { EditorView } from './views/EditorView.tsx';

// `/` lists the posts (drafts first), `/?post=<slug>` edits a post. Each is a full page
// load, so the browser's back button and reload work as expected.
const slug = new URLSearchParams(location.search).get('post');
const go = (to?: string) => (location.href = to ? `/?post=${encodeURIComponent(to)}` : '/');
const app = document.getElementById('app')!;

function Posts({ initial }: { initial: Awaited<ReturnType<typeof loadPosts>> }) {
  const [posts, setPosts] = useState(initial);
  return (
    <PostsView
      posts={posts}
      onOpen={go}
      onDelete={async (s) => {
        await deleteDraft(s);
        setPosts(await loadPosts());
      }}
    />
  );
}

try {
  if (slug) {
    const post = await loadPost(slug);
    document.title = post.slug;
    render(<EditorView post={post} onPosts={() => go()} />, app);
  } else {
    document.title = 'Posts';
    render(<Posts initial={await loadPosts()} />, app);
  }
} catch (err) {
  render(<p class="fatal">{(err as Error).message}</p>, app);
}
