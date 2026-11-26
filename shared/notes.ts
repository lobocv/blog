// Calvin's drafting notes for Claude, written straight into a post: `@@ note` runs to the end of the
// line, `@@ note @@` ends early so the sentence can carry on. A note starting with "claude:" is a
// reply. The site (src/lib/notes.mjs) and the editor both read notes with this pattern.
export const NOTE = /@@[ \t]*([^\n]*?)[ \t]*(?:@@|(?=\n)|$)/g;
