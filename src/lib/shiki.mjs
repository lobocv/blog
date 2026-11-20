// Code highlighting theme. Token colours point at the mockup's CSS variables (--tok-*),
// so code follows day/night with the rest of the page. Shared by Markdown and the home feature card.
const v = name => `var(--tok-${name})`;
export const shikiTheme = {
  name: 'lobocv',
  type: 'dark',
  colors: { 'editor.foreground': 'var(--ink)', 'editor.background': 'var(--code-bg)' },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: v('com'), fontStyle: 'italic' } },
    { scope: ['string', 'string.quoted', 'string.template'], settings: { foreground: v('str') } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character'], settings: { foreground: v('num') } },
    { scope: ['keyword', 'storage', 'storage.type', 'storage.modifier', 'keyword.operator.new', 'keyword.control'], settings: { foreground: v('kw') } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function'], settings: { foreground: v('fn') } },
    { scope: ['entity.name.type', 'support.type', 'entity.name.class', 'entity.other.inherited-class', 'storage.type.numeric.go', 'storage.type.string.go', 'storage.type.boolean.go', 'storage.type.error.go', 'storage.type.byte.go', 'storage.type.rune.go', 'storage.type.uintptr.go'], settings: { foreground: v('type') } },
    { scope: ['keyword.operator', 'punctuation'], settings: { foreground: 'var(--ink)' } },
  ],
};
// Posts often open a fence with a blank line; the mockup trimmed leading blank lines and trailing space.
export const trimCode = { name: 'trim-code', preprocess: code => code.replace(/^\s*\n/, '').replace(/\s+$/, '') };
export const shikiConfig = { theme: shikiTheme, langAlias: { postgresql: 'sql' }, transformers: [trimCode] };
