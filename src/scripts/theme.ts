// Day/night toggle. The initial theme is set before paint by the inline bootstrap in Base.astro.
export type Time = 'day' | 'night';

const current = (): Time => (document.documentElement.dataset.time === 'day' ? 'day' : 'night');

export function applyTheme(t: Time): void {
  document.documentElement.dataset.time = t;
  document.getElementById('toggle')?.setAttribute('aria-label', t === 'day' ? 'Switch to night' : 'Switch to day');
}

export function saveTheme(t: Time): void {
  try { localStorage.setItem('time', t); } catch {}
}

let handler: (next: Time) => void = t => { applyTheme(t); saveTheme(t); };

/** The home page replaces the default switch with the hero's crossfade. */
export function setThemeHandler(fn: (next: Time) => void): void {
  handler = fn;
}

export function initTheme(): void {
  const b = document.getElementById('toggle');
  if (!b) return;
  applyTheme(current());
  b.addEventListener('click', () => handler(current() === 'day' ? 'night' : 'day'));
}
