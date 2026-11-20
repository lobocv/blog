// Post page behaviour: code block headers and copy buttons, footnote popovers, the image lightbox,
// the current-section highlight in the table of contents, and the reading progress bar.

export function initCode(body: HTMLElement): void {
  body.querySelectorAll<HTMLPreElement>('pre[data-language]').forEach(pre => {
    const code = pre.querySelector('code');
    if (!code) return;
    // Wrap so the header and the right-edge fade stay put while the code scrolls sideways
    const box = document.createElement('div');
    box.className = 'code';
    pre.replaceWith(box);
    const lang = pre.dataset.language!;
    const title = pre.dataset.title;
    const esc = (t: string) => t.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
    const label = title ? `<span class="file">${esc(title)}</span>`
      : lang && lang !== 'plaintext' && lang !== 'text' ? `<span class="lang">${lang}</span>` : '<span></span>';
    box.innerHTML = `<div class="code-head">${label}<button class="copy" type="button">Copy</button></div>`;
    box.append(pre);
    box.querySelector<HTMLButtonElement>('.copy')!.addEventListener('click', async e => {
      const b = e.currentTarget as HTMLButtonElement;
      try { await navigator.clipboard.writeText(code.textContent ?? ''); b.textContent = 'Copied'; }
      catch { b.textContent = 'Copy failed'; }
      setTimeout(() => (b.textContent = 'Copy'), 1500);
    });
    const fade = () => box.classList.toggle('more', pre.scrollLeft + pre.clientWidth < pre.scrollWidth - 2);
    pre.addEventListener('scroll', fade, { passive: true });
    new ResizeObserver(fade).observe(pre);
  });
}

// On devices with a mouse, hovering or focusing a footnote marker shows the note beside it
export function initFootnotes(body: HTMLElement): void {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const refs = body.querySelectorAll<HTMLAnchorElement>('a[data-footnote-ref]');
  if (!refs.length) return;
  const pop = document.createElement('div');
  pop.className = 'fn-pop';
  pop.id = 'fn-pop';
  pop.setAttribute('role', 'tooltip');
  document.body.append(pop);
  let hideTimer = 0;
  const hide = () => { hideTimer = window.setTimeout(() => pop.classList.remove('on'), 150); };
  const show = (a: HTMLAnchorElement) => {
    clearTimeout(hideTimer);
    const note = document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!note) return;
    pop.innerHTML = note.innerHTML;
    pop.querySelectorAll('[data-footnote-backref]').forEach(b => b.remove());
    pop.classList.add('on');
    const r = a.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), innerWidth - w - 12);
    const above = r.top - h - 10 > 60;
    pop.style.left = `${left + scrollX}px`;
    pop.style.top = `${(above ? r.top - h - 10 : r.bottom + 10) + scrollY}px`;
  };
  refs.forEach(a => {
    a.setAttribute('aria-describedby', 'fn-pop');
    a.addEventListener('mouseenter', () => show(a));
    a.addEventListener('focus', () => show(a));
    a.addEventListener('mouseleave', hide);
    a.addEventListener('blur', hide);
  });
  pop.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  pop.addEventListener('mouseleave', hide);
  addEventListener('keydown', e => { if (e.key === 'Escape') pop.classList.remove('on'); });
}

// Clicking an image opens it full screen; clicking again or Escape closes it
export function initLightbox(body: HTMLElement): void {
  const imgs = [...body.querySelectorAll<HTMLImageElement>('img')].filter(i => !i.closest('a'));
  if (!imgs.length) return;
  const dlg = document.createElement('dialog');
  dlg.className = 'lightbox';
  dlg.setAttribute('aria-label', 'Image');
  document.body.append(dlg);
  dlg.addEventListener('click', () => dlg.close());
  imgs.forEach(img => {
    img.classList.add('zoomable');
    img.tabIndex = 0;
    const open = () => {
      dlg.innerHTML = '';
      const big = img.cloneNode() as HTMLImageElement;
      big.removeAttribute('tabindex');
      big.classList.remove('zoomable');
      dlg.append(big);
      dlg.showModal();
    };
    img.addEventListener('click', open);
    img.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
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
