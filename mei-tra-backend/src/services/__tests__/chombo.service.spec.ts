import { ChomboService } from '../chombo.service';
import { asSeatId } from '../../types/identity.types';

describe('ChomboService', () => {
  it('does not count the Joker as one of the four jacks', () => {
    const playService = { getCardPlayError: jest.fn() };
    const service = new ChomboService(playService as never);
    const player = {
      seatId: asSeatId('seat-1'),
      name: 'Player',
      team: 0 as const,
      hand: ['J♠', 'J♣', 'J♥', 'J♦', 'JOKER'],
      isPasser: false,
    };

    expect(
      service.checkViolations(asSeatId('seat-1'), 'check-four-jack', {
        player,
        hasBroken: false,
      }),
    ).toEqual(expect.objectContaining({ type: 'four-jack' }));
  });
});
