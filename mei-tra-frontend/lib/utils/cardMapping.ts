import { CARD_BACK_ID, cardToSvgId } from '@meitra/game-client/card-art';

// The wire-string -> artwork-id mapping is shared with mobile, which keys its
// static require map from the same ids. Web keeps only the URL shape, which is
// its own concern (mobile has no /cards/ route).
export { cardToSvgId };

export function cardToSvgPath(card: string): string {
  return `/cards/${cardToSvgId(card)}.svg`;
}

export const CARD_BACK_PATH = `/cards/${CARD_BACK_ID}.svg`;
