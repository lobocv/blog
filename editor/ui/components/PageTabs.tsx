/** The status line's tabs between the posts page (P) and the ideas page (I). */
export function PageTabs({ on, go }: { on: 'posts' | 'ideas'; go: (page: 'posts' | 'ideas') => void }) {
  const tab = (page: 'posts' | 'ideas', label: string, key: string) => (
    <button type="button" class={`status-view${on === page ? ' on' : ''}`} aria-pressed={on === page} title={`${label} (${key})`} onClick={() => go(page)}>
      {label}
    </button>
  );
  return (
    <div class="status-views">
      {tab('posts', 'Posts', 'P')}
      {tab('ideas', 'Ideas', 'I')}
    </div>
  );
}
