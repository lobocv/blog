// The journey wolf. Stand-in shapes until the faceted drawings land.
const NS = 'http://www.w3.org/2000/svg';

export interface Wolf { ages: SVGGElement[]; legs: SVGGElement[]; body: SVGGElement }

export function drawWolf(parent: SVGGElement): Wolf {
  const body = document.createElementNS(NS, 'g');
  parent.appendChild(body);
  const ages: SVGGElement[] = [], legs: SVGGElement[] = [];
  for (let a = 0; a < 4; a++) {
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = `<rect x="-60" y="-46" width="96" height="40" rx="10" fill="var(--ink-3)"/><polygon points="30,-66 70,-44 34,-20" fill="var(--ink-2)"/>`;
    const l = document.createElementNS(NS, 'g');
    l.innerHTML = `<line x1="-40" y1="-10" x2="-40" y2="18" stroke="var(--ink-3)" stroke-width="9" stroke-linecap="round"/><line x1="20" y1="-10" x2="20" y2="18" stroke="var(--ink-3)" stroke-width="9" stroke-linecap="round"/>`;
    g.appendChild(l);
    g.style.opacity = a === 0 ? '1' : '0';
    body.appendChild(g); ages.push(g); legs.push(l);
  }
  return { ages, legs, body };
}

/** Pose for one frame. `age` is fractional while cross-fading between two drawings. */
export function poseWolf(w: Wolf, phase: number, moving: boolean, age: number): void {
  const lo = Math.floor(age), hi = Math.min(3, lo + 1), f = age - lo;
  w.ages.forEach((g, i) => { g.style.opacity = String(i === lo ? 1 - f : i === hi ? f : 0); });
  const swing = moving ? Math.sin(phase) * 18 : 0;
  for (const l of w.legs) {
    const [a, b] = l.children as unknown as SVGElement[];
    a.style.transform = `rotate(${swing}deg)`; b.style.transform = `rotate(${-swing}deg)`;
    a.style.transformBox = b.style.transformBox = 'fill-box';
    a.style.transformOrigin = b.style.transformOrigin = 'top center';
  }
  w.body.style.transform = `translateY(${moving ? -6 * Math.abs(Math.sin(phase)) : 0}px)`;
}
