/** True when an old site path has no matching file in the build output (`files` holds dist-relative paths). */
export function oldUrlMissing(path: string, files: Set<string>): boolean {
  const rel = path.replace(/^\//, '');
  return !files.has(rel === '' || rel.endsWith('/') ? `${rel}index.html` : rel);
}
