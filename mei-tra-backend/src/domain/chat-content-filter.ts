// Server-side posting gate: normalize full-width and separated spellings before
// testing the small set of clearly abusive terms we can reject reliably.
const DISALLOWED = [
  /(?:死ね|しね|殺す|ころす|レイプ|強姦)/u,
  /(?:kill\s*yourself|kys|go\s*die|rape|nigg(?:er|a))/iu,
];

export function isObjectionableChatContent(value: string): boolean {
  const normalized = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
  return DISALLOWED.some((pattern) => pattern.test(normalized));
}
