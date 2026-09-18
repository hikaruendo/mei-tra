import { classifyCardDrop, isPointInRect } from '@meitra/game-client/drag-action';

describe('classifyCardDrop', () => {
  it('plays a card lifted far enough above the hand', () => {
    expect(classifyCardDrop({ deltaY: -100, overNegriTarget: false })).toBe('play');
  });

  it('places the Negri when let go over the Negri target', () => {
    expect(classifyCardDrop({ deltaY: 0, overNegriTarget: true })).toBe('negri');
    // The target is a place, not a height, so it wins over an upward drag.
    expect(classifyCardDrop({ deltaY: -100, overNegriTarget: true })).toBe('negri');
  });

  it('does nothing for a downward drag, which only reorders now', () => {
    expect(classifyCardDrop({ deltaY: 100, overNegriTarget: false })).toBeNull();
  });

  it('keeps short drags available for hand reorder', () => {
    expect(classifyCardDrop({ deltaY: -20, overNegriTarget: false })).toBeNull();
  });
});

describe('isPointInRect', () => {
  const rect = { left: 10, top: 100, width: 80, height: 120 };

  it('contains a point inside the rect, including its top-left edge', () => {
    expect(isPointInRect({ x: 50, y: 150 }, rect)).toBe(true);
    expect(isPointInRect({ x: 10, y: 100 }, rect)).toBe(true);
  });

  it('leaves out a point at or past the right and bottom edges', () => {
    expect(isPointInRect({ x: 90, y: 150 }, rect)).toBe(false);
    expect(isPointInRect({ x: 50, y: 220 }, rect)).toBe(false);
    expect(isPointInRect({ x: 5, y: 150 }, rect)).toBe(false);
  });

  it('never matches a missing or empty rect', () => {
    expect(isPointInRect({ x: 0, y: 0 }, null)).toBe(false);
    expect(
      isPointInRect({ x: 0, y: 0 }, { left: 0, top: 0, width: 0, height: 0 }),
    ).toBe(false);
  });
});
