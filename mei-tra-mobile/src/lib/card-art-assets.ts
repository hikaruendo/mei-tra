import {
  CARD_BACK_ID,
  cardToSvgId,
} from '@meitra/game-client/card-art';
import type React from 'react';
import type { SvgProps } from 'react-native-svg';

/**
 * Static require maps for the card artwork.
 *
 * Metro resolves `require` at build time, so every specifier has to be a
 * literal — hence the generated tables rather than a computed path. They are
 * thunks so that importing this module does not evaluate all 54 artwork
 * modules up front; a typical hand only touches a handful.
 *
 * Paths are relative rather than `@/assets/*`: the tsconfig alias overlaps
 * with `@/*` -> `src/*`, and jest-expo only maps the latter, so a relative
 * specifier is the one form metro, tsc and jest all agree on.
 *
 * Regenerate alongside the assets with `npm run assets:cards`.
 */
type SvgComponent = React.FC<SvgProps>;

const VECTORS: Record<string, () => SvgComponent> = {
  "10_C": () => require('../../assets/cards/10_C.svg').default,
  "10_D": () => require('../../assets/cards/10_D.svg').default,
  "10_H": () => require('../../assets/cards/10_H.svg').default,
  "10_S": () => require('../../assets/cards/10_S.svg').default,
  "2_C": () => require('../../assets/cards/2_C.svg').default,
  "2_D": () => require('../../assets/cards/2_D.svg').default,
  "2_H": () => require('../../assets/cards/2_H.svg').default,
  "2_S": () => require('../../assets/cards/2_S.svg').default,
  "3_C": () => require('../../assets/cards/3_C.svg').default,
  "3_D": () => require('../../assets/cards/3_D.svg').default,
  "3_H": () => require('../../assets/cards/3_H.svg').default,
  "3_S": () => require('../../assets/cards/3_S.svg').default,
  "4_C": () => require('../../assets/cards/4_C.svg').default,
  "4_D": () => require('../../assets/cards/4_D.svg').default,
  "4_H": () => require('../../assets/cards/4_H.svg').default,
  "4_S": () => require('../../assets/cards/4_S.svg').default,
  "5_C": () => require('../../assets/cards/5_C.svg').default,
  "5_D": () => require('../../assets/cards/5_D.svg').default,
  "5_H": () => require('../../assets/cards/5_H.svg').default,
  "5_S": () => require('../../assets/cards/5_S.svg').default,
  "6_C": () => require('../../assets/cards/6_C.svg').default,
  "6_D": () => require('../../assets/cards/6_D.svg').default,
  "6_H": () => require('../../assets/cards/6_H.svg').default,
  "6_S": () => require('../../assets/cards/6_S.svg').default,
  "7_C": () => require('../../assets/cards/7_C.svg').default,
  "7_D": () => require('../../assets/cards/7_D.svg').default,
  "7_H": () => require('../../assets/cards/7_H.svg').default,
  "7_S": () => require('../../assets/cards/7_S.svg').default,
  "8_C": () => require('../../assets/cards/8_C.svg').default,
  "8_D": () => require('../../assets/cards/8_D.svg').default,
  "8_H": () => require('../../assets/cards/8_H.svg').default,
  "8_S": () => require('../../assets/cards/8_S.svg').default,
  "9_C": () => require('../../assets/cards/9_C.svg').default,
  "9_D": () => require('../../assets/cards/9_D.svg').default,
  "9_H": () => require('../../assets/cards/9_H.svg').default,
  "9_S": () => require('../../assets/cards/9_S.svg').default,
  A_C: () => require('../../assets/cards/A_C.svg').default,
  A_D: () => require('../../assets/cards/A_D.svg').default,
  A_H: () => require('../../assets/cards/A_H.svg').default,
  A_S: () => require('../../assets/cards/A_S.svg').default,
  card_back: () => require('../../assets/cards/card_back.svg').default,
  joker_red: () => require('../../assets/cards/joker_red.svg').default,
};

const RASTERS: Record<string, () => number> = {
  J_C: () => require('../../assets/cards/J_C.webp'),
  J_D: () => require('../../assets/cards/J_D.webp'),
  J_H: () => require('../../assets/cards/J_H.webp'),
  J_S: () => require('../../assets/cards/J_S.webp'),
  K_C: () => require('../../assets/cards/K_C.webp'),
  K_D: () => require('../../assets/cards/K_D.webp'),
  K_H: () => require('../../assets/cards/K_H.webp'),
  K_S: () => require('../../assets/cards/K_S.webp'),
  Q_C: () => require('../../assets/cards/Q_C.webp'),
  Q_D: () => require('../../assets/cards/Q_D.webp'),
  Q_H: () => require('../../assets/cards/Q_H.webp'),
  Q_S: () => require('../../assets/cards/Q_S.webp'),
};

export type CardArt =
  | { kind: 'vector'; Svg: SvgComponent }
  | { kind: 'raster'; source: number };

/**
 * Court cards ship as rasters (their vector form is ~9,000 path nodes each,
 * which react-native-svg would re-render at a 30-60px display size); every
 * other card stays a true vector.
 */
export function resolveCardArt(card: string, faceDown = false): CardArt {
  const id = faceDown ? CARD_BACK_ID : cardToSvgId(card);

  const raster = RASTERS[id];
  if (raster) return { kind: 'raster', source: raster() };

  const vector = VECTORS[id] ?? VECTORS[CARD_BACK_ID];
  return { kind: 'vector', Svg: vector() };
}

export const CARD_ART_KEYS = {
  vector: Object.keys(VECTORS),
  raster: Object.keys(RASTERS),
};
