import { computeHandFanMetrics } from '../useHandFanMetrics';

const metrics = computeHandFanMetrics;

/** Total horizontal span the row occupies, mirroring the RN box model. */
const spanOf = (
  { cardWidth, cardMargin }: { cardWidth: number; cardMargin: number },
  count: number,
) => count * (cardWidth + cardMargin * 2);

describe('computeHandFanMetrics', () => {
  it('keeps a ten-card hand inside a 375pt phone', () => {
    // 375 - 126 of chrome, per GameBoard.
    const m = metrics(249, 10);
    expect(spanOf(m, 10)).toBeLessThanOrEqual(249);
    // and the cards stay large enough to read
    expect(m.cardWidth).toBeGreaterThanOrEqual(44);
  });

  it('does not exceed the base width when there is room to spare', () => {
    const m = metrics(1200, 3);
    expect(m.cardWidth).toBeLessThanOrEqual(60);
  });

  it('never overlaps more than the readable limit', () => {
    const m = metrics(120, 12);
    // exposure bottoms out at 26%, so the margin cannot eat more than 37% a side
    expect(Math.abs(m.cardMargin)).toBeLessThanOrEqual(m.cardWidth * 0.37 + 0.01);
  });

  it('shrinks the card only after exposure has bottomed out', () => {
    const roomy = metrics(600, 8);
    const tight = metrics(160, 8);
    expect(roomy.cardWidth).toBeGreaterThan(tight.cardWidth);
  });

  it('does not overlap a single card', () => {
    expect(metrics(300, 1).cardMargin).toBe(0);
  });

  it('survives a zero-width measurement pass', () => {
    const m = metrics(0, 5);
    expect(m.cardWidth).toBeGreaterThan(0);
    expect(Number.isFinite(m.cardMargin)).toBe(true);
  });

  it('honours the accessibility scale', () => {
    expect(metrics(1200, 3, 1.2).cardWidth).toBeGreaterThan(
      metrics(1200, 3, 1).cardWidth,
    );
  });
});
