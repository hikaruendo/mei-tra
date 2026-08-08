import type { TrumpType } from '@meitra/contracts/game';

/**
 * Trump display names, matching the web app verbatim
 * (mei-tra-frontend/messages/ja.json → `blowControls`).
 *
 * Mobile previously spelled these differently in two places (`トラ` instead of
 * `ノートラ`, and bare suit glyphs rather than parenthesised ones), which meant
 * the same trump had two names inside one app.
 */
export const TRUMP_LABELS: Record<TrumpType, string> = {
  tra: 'ノートラ',
  herz: 'ヘル (♥)',
  daiya: 'ダイヤ (♦)',
  club: 'クラブ (♣)',
  zuppe: 'ズッペ (♠)',
};

export function trumpLabel(trump: TrumpType | string | null | undefined): string {
  if (!trump) return '';
  return TRUMP_LABELS[trump as TrumpType] ?? String(trump);
}
