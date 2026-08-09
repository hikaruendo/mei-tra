import { palette } from './palette';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { typography } from './typography';

export { palette } from './palette';
export { radius } from './radius';
export { shadows } from './shadows';
export { spacing } from './spacing';
export { typography } from './typography';
export { raw } from './raw';
export {
  CARD_ASPECT,
  CARD_BASE_WIDTHS,
  CARD_RADIUS_RATIO,
  CARD_SCALES,
  cardHeight,
  cardRadius,
} from './cards';
export type { CardSize } from './cards';

export const theme = {
  color: palette,
  spacing,
  radius,
  type: typography,
  shadow: shadows,
} as const;
