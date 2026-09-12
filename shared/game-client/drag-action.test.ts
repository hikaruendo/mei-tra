import { describe, expect, it } from 'vitest';
import { classifyCardDrop } from './drag-action';

describe('classifyCardDrop', () => {
  it('uses the play zone for an upward drag', () => {
    expect(classifyCardDrop(-100)).toBe('play');
  });
  it('uses the negri zone for a downward drag', () => {
    expect(classifyCardDrop(100)).toBe('negri');
  });
  it('keeps short drags available for hand reorder', () => {
    expect(classifyCardDrop(20)).toBeNull();
  });
});
