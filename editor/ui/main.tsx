import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './theme.css';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { addIdea, createDraft, deleteDraft, loadIdeas, loadPost, loadPosts, removeIdea } from './api.ts';
import { IdeasView } from './views/IdeasView.tsx';
import { PostsView } from './views/PostsView.tsx';
import { EditorView } from './views/EditorView.tsx';

// `/` lists the posts (drafts first), `/?post=<slug>` edits a post, `/?ideas` lists the ideas. Each is a full page
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
      onCreate={async (title) => void go(await createDraft(title))}
      onIdeas={() => (location.href = '/?ideas')}
      onDelete={async (s) => {
        await deleteDraft(s);
        setPosts(await loadPosts());
      }}
    />
  );
}

function Ideas({ initial }: { initial: Awaited<ReturnType<typeof loadIdeas>> }) {
  const [ideas, setIdeas] = useState(initial);
  return (
    <IdeasView
      ideas={ideas}
      onAdd={async (text) => setIdeas(await addIdea(text))}
      onRemove={async (idea) => setIdeas(await removeIdea(idea))}
      onPosts={() => go()}
    />
  );
}

try {
  if (new URLSearchParams(location.search).has('ideas')) {
    document.title = 'Ideas';
    render(<Ideas initial={await loadIdeas()} />, app);
  } else if (slug) {
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
