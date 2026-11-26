const number = new Intl.NumberFormat('en-US');
const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

export const formatNumber = (n: number) => number.format(n);

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago" */
export function formatAgo(date: Date, now = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  if (seconds > -60) return 'just now';
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2629800],
    ['year', 31557600],
  ];
  let [unit, size] = units[0];
  for (const [u, s] of units) if (-seconds >= s) [unit, size] = [u, s];
  return relative.format(Math.round(seconds / size), unit);
}

const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "Aug 1, 2021", from a front matter date like 2021-08-01. */
export const formatDate = (iso: string) => day.format(new Date(`${iso}T00:00:00Z`));
