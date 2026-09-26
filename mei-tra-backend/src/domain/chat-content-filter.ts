// Server-side posting gate: normalize full-width and separated spellings before
// testing the small set of clearly abusive terms we can reject reliably.
const DISALLOWED_JAPANESE = /(?:死ね|しね|殺す|ころす|レイプ|強姦)/u;
const GAP = '[\\s\\p{P}\\p{S}]*';
const DISALLOWED_ENGLISH = new RegExp(
  `(?:^|[^a-z])(?:k${GAP}i${GAP}l${GAP}l${GAP}yourself|k${GAP}y${GAP}s|go${GAP}die|r${GAP}a${GAP}p${GAP}e|nigg(?:er|a))(?:$|[^a-z])`,
  'iu',
);

export function isObjectionableChatContent(value: string): boolean {
  const normalized = value.normalize('NFKC').toLowerCase();
  const compact = normalized.replace(/[\s\p{P}\p{S}]+/gu, '');
  return (
    DISALLOWED_JAPANESE.test(compact) || DISALLOWED_ENGLISH.test(normalized)
  );
}
