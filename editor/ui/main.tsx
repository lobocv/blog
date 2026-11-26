import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './theme.css';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { deleteDraft, loadDrafts, loadPost } from './api.ts';
import { DraftsView } from './views/DraftsView.tsx';
import { EditorView } from './views/EditorView.tsx';

// `/` is the drafts page, `/?post=<slug>` edits a post. Each is a full page
// load, so the browser's back button and reload work as expected.
const slug = new URLSearchParams(location.search).get('post');
const go = (to?: string) => (location.href = to ? `/?post=${encodeURIComponent(to)}` : '/');
const app = document.getElementById('app')!;

function Drafts({ initial }: { initial: Awaited<ReturnType<typeof loadDrafts>> }) {
  const [drafts, setDrafts] = useState(initial);
  return (
    <DraftsView
      drafts={drafts}
      onOpen={go}
      onDelete={async (s) => {
        await deleteDraft(s);
        setDrafts(await loadDrafts());
      }}
    />
  );
}

try {
  if (slug) {
    const post = await loadPost(slug);
    document.title = post.slug;
    render(<EditorView post={post} onDrafts={() => go()} />, app);
  } else {
    document.title = 'Drafts';
    render(<Drafts initial={await loadDrafts()} />, app);
  }
} catch (err) {
  render(<p class="fatal">{(err as Error).message}</p>, app);
}
