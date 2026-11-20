// Post page behaviour ported from prototypes/mockups/post.html: code labels and copy buttons,
// the current-section highlight in the table of contents, and the reading progress bar.

export function initCode(body: HTMLElement): void {
  body.querySelectorAll<HTMLPreElement>('pre[data-language]').forEach(pre => {
    const code = pre.querySelector('code');
    if (!code) return;
    const lang = pre.dataset.language!;
    const label = lang && lang !== 'plaintext' && lang !== 'text' ? `<span class="lang">${lang}</span>` : '';
    pre.insertAdjacentHTML('afterbegin', `${label}<button class="copy" type="button">Copy</button>`);
    pre.querySelector<HTMLButtonElement>('.copy')!.addEventListener('click', e => {
      const b = e.currentTarget as HTMLButtonElement;
      navigator.clipboard?.writeText(code.textContent ?? '');
      b.textContent = 'Copied';
      setTimeout(() => (b.textContent = 'Copy'), 1500);
    });
  });
}

export function initReading(body: HTMLElement): void {
  const toc = document.getElementById('toc');
  const links = toc ? [...toc.querySelectorAll<HTMLAnchorElement>('a')] : [];
  const heads = links.map(a => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean) as HTMLElement[];
  const progress = document.getElementById('progress');
  const onScroll = () => {
    let cur = 0;
    heads.forEach((h, i) => { if (h.getBoundingClientRect().top < 140) cur = i; });
    links.forEach((a, i) => a.classList.toggle('on', i === cur));
    if (progress) {
      const r = body.getBoundingClientRect();
      progress.style.width = Math.min(100, Math.max(0, (-r.top + innerHeight * .3) / r.height * 100)) + '%';
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
