import { handDropPlacement, handFanPitch } from '@/lib/hand-drag';

describe('handFanPitch', () => {
  it('advances by the width the neighbour leaves exposed', () => {
    // A 60pt card overlapped by 20pt on each side advances by 20pt.
    expect(handFanPitch(60, -20)).toBe(20);
  });
});

describe('handDropPlacement', () => {
  const order = ['A', 'B', 'C', 'D'];
  const pitch = 20;

  it('stays put while the card is still over its own slot', () => {
    expect(handDropPlacement(order, 'B', 0, pitch)).toBeNull();
    expect(handDropPlacement(order, 'B', 9, pitch)).toBeNull();
    expect(handDropPlacement(order, 'B', -9, pitch)).toBeNull();
  });

  it('lands one slot along once the finger passes half a pitch', () => {
    expect(handDropPlacement(order, 'B', 11, pitch)).toEqual({
      card: 'C',
      side: 'after',
    });
    expect(handDropPlacement(order, 'B', -11, pitch)).toEqual({
      card: 'A',
      side: 'before',
    });
  });

  it('counts whole pitches for longer drags', () => {
    expect(handDropPlacement(order, 'A', 2 * pitch, pitch)).toEqual({
      card: 'C',
      side: 'after',
    });
  });

  it('stops at the ends of the hand', () => {
    expect(handDropPlacement(order, 'A', 99 * pitch, pitch)).toEqual({
      card: 'D',
      side: 'after',
    });
    expect(handDropPlacement(order, 'D', -99 * pitch, pitch)).toEqual({
      card: 'A',
      side: 'before',
    });
  });

  it('has nowhere to go with fewer than two cards', () => {
    expect(handDropPlacement(['A'], 'A', 99, pitch)).toBeNull();
  });

  it('ignores a card that is not in the hand', () => {
    expect(handDropPlacement(order, 'Z', 99, pitch)).toBeNull();
  });
});
