// Shared by astro.config.mjs (Markdown) and the home feature card, so both highlight alike.
export const shikiThemes = { light: 'github-light', dark: 'github-dark' };
export const shikiConfig = { themes: shikiThemes, defaultColor: false, langAlias: { postgresql: 'sql' } };
