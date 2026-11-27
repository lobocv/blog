// Where a feed's "…see more" falls. The phone preview renders the text and asks whether a prefix
// (plus the "…more" label) fits in the fold's lines; this finds the longest prefix that does.

/**
 * The largest k in [0, length] with `fits(k)`, assuming fits is true up to some k and false after.
 * Returns `length` when everything fits.
 */
export function longestFitting(length: number, fits: (k: number) => boolean): number {
  if (fits(length)) return length;
  let lo = 0;
  let hi = length;
  // fits(lo) is assumed true (an empty prefix always fits); fits(hi) is false.
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}
