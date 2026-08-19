import type { TrumpType } from '@meitra/contracts/game';

import { t } from '@/i18n';

/**
 * Trump display names, matching the web app verbatim
 * (mei-tra-frontend/messages/*.json → `blowControls`).
 *
 * These are catalogue keys rather than literals so both locales stay in one
 * place; read them through `trumpLabel()` so nothing renders a raw key.
 */
const TRUMP_LABEL_KEYS: Record<TrumpType, string> = {
  tra: 'trump.tra',
  herz: 'trump.herz',
  daiya: 'trump.daiya',
  club: 'trump.club',
  zuppe: 'trump.zuppe',
};

export function trumpLabel(trump: TrumpType | string | null | undefined): string {
  if (!trump) return '';
  const key = TRUMP_LABEL_KEYS[trump as TrumpType];
  return key ? t(key) : String(trump);
}
