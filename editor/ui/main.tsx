import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './theme.css';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { addIdea, createDraft, deleteDraft, loadIdeas, loadPost, loadPosts, loadShare, removeIdea, scopeIdea } from './api.ts';
import { IdeasView } from './views/IdeasView.tsx';
import { PostsView } from './views/PostsView.tsx';
import { EditorView } from './views/EditorView.tsx';
import { ShareView } from './views/ShareView.tsx';

// `/` lists the posts (drafts first), `/?post=<slug>` edits a post (`&page` opens its page thread),
// `/?share=<slug>` shares a published post, `/?ideas` lists the ideas. Each is a full page load, so the
// browser's back button and reload work as expected.
const params = new URLSearchParams(location.search);
const slug = params.get('post');
const sharing = params.get('share');
const go = (to?: string) => (location.href = to ? `/?post=${encodeURIComponent(to)}` : '/');
const goShare = (to: string) => (location.href = `/?share=${encodeURIComponent(to)}`);
const app = document.getElementById('app')!;

function Posts({ initial }: { initial: Awaited<ReturnType<typeof loadPosts>> }) {
  const [posts, setPosts] = useState(initial);
  return (
    <PostsView
      posts={posts}
      onOpen={go}
      onShare={goShare}
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
      onScope={async (idea, title) => void (location.href = `/?post=${encodeURIComponent(await scopeIdea(idea, title))}&page`)}
      onPosts={() => go()}
    />
  );
}

try {
  if (params.has('ideas')) {
    document.title = 'Ideas';
    render(<Ideas initial={await loadIdeas()} />, app);
  } else if (slug) {
    const post = await loadPost(slug);
    document.title = post.slug;
    render(<EditorView post={post} openPage={params.has('page')} onPosts={() => go()} onShare={() => goShare(post.slug)} />, app);
  } else if (sharing) {
    const share = await loadShare(sharing);
    document.title = `Share: ${share.post.title}`;
    render(<ShareView share={share} onPosts={() => go()} />, app);
  } else {
    document.title = 'Posts';
    render(<Posts initial={await loadPosts()} />, app);
  }
} catch (err) {
  render(<p class="fatal">{(err as Error).message}</p>, app);
}
