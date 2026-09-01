import { CARD_ASPECT, CARD_BASE_WIDTHS } from '@/theme/cards';

import { FACE_HEIGHT, computeFieldMatSize } from '../useFieldMatSize';

/** The cross the four played cards make: one card tall, plus 24 either side. */
const CROSS_HEIGHT = CARD_BASE_WIDTHS.field * CARD_ASPECT + 24 * 2;

/** Cushion left showing above and below the cards, in points. */
const marginAround = (size: number) => (size * FACE_HEIGHT - CROSS_HEIGHT) / 2;

describe('computeFieldMatSize', () => {
  it('holds a floor on the shortest phone we support', () => {
    // iPhone SE: 667 * 0.26 = 173, below the floor.
    expect(computeFieldMatSize(375, 667)).toBe(190);
  });

  it('tracks the screen between the floor and the cap', () => {
    // iPhone 13 mini: 812 * 0.26 = 211.
    expect(computeFieldMatSize(375, 812)).toBe(211);
  });

  it('caps so the trick does not become four stamps on a pillow', () => {
    expect(computeFieldMatSize(393, 852)).toBe(214);
    expect(computeFieldMatSize(430, 932)).toBe(214);
    // A tablet is far taller again and must not keep growing.
    expect(computeFieldMatSize(744, 1133)).toBe(214);
  });

  it('yields to a narrow screen before it overflows the column', () => {
    // A 220pt-wide window has 172 of usable room, under the 190 floor.
    expect(computeFieldMatSize(220, 1000)).toBe(172);
  });

  it('always leaves the card cross resting on the top face', () => {
    for (const [width, height] of [
      [375, 667],
      [375, 812],
      [393, 852],
      [430, 932],
      [744, 1133],
    ]) {
      expect(marginAround(computeFieldMatSize(width, height))).toBeGreaterThan(0);
    }
  });

  it('grows the cushion over the flat 164 it replaced', () => {
    // The old constant left 21.7pt around the cards on every device alike.
    expect(computeFieldMatSize(375, 812)).toBeGreaterThan(164);
    expect(marginAround(computeFieldMatSize(375, 812))).toBeGreaterThan(
      (164 * 0.96 - CROSS_HEIGHT) / 2,
    );
  });
});
