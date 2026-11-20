// Category filter on the posts index. Behaviour ported from prototypes/mockups/posts.html.

/** The category named by `?cat=`, if it exists; otherwise 'All'. */
export function initialCategory(search: string, names: string[]): string {
  const cat = new URLSearchParams(search).get('cat');
  return cat && names.includes(cat) ? cat : 'All';
}

function select(filters: HTMLElement, b: HTMLElement): void {
  filters.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  const c = b.dataset.cat!;
  document.querySelectorAll<HTMLElement>('.year').forEach(sec => {
    let any = false;
    sec.querySelectorAll<HTMLElement>('.row').forEach(r => {
      const show = c === 'All' || r.dataset.cats!.split('|').includes(c);
      r.hidden = !show; r.style.display = show ? '' : 'none'; any ||= show;
    });
    sec.hidden = !any;
  });
}

export function initFilter(filters: HTMLElement): void {
  const chips = [...filters.querySelectorAll<HTMLElement>('.chip')];
  const start = initialCategory(location.search, chips.map(c => c.dataset.cat!));
  const first = chips.find(c => c.dataset.cat === start);
  if (first && start !== 'All') select(filters, first);
  filters.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.chip');
    if (b) select(filters, b);
  });
}
