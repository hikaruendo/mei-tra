import { CardService } from '../card.service';
import { ChomboService } from '../chombo.service';
import { PlayService } from '../play.service';
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

  it('judges a wrong suit with the trump in play', () => {
    const service = new ChomboService(new PlayService(new CardService()));
    const player = {
      seatId: asSeatId('seat-1'),
      name: 'Player',
      team: 0 as const,
      hand: ['5♠', '6♣'],
      isPasser: false,
    };
    const field = {
      cards: ['J♠'],
      playedBySeatIds: [asSeatId('seat-0')],
      baseCard: 'J♠',
      dealerSeatId: asSeatId('seat-0'),
      isComplete: false,
    };

    // Under club trump the jack of spades leads clubs, so 5♠ fails to follow.
    expect(
      service.checkViolations(asSeatId('seat-1'), 'play-card', {
        player,
        field,
        card: '5♠',
        trump: 'club',
      }),
    ).toEqual(expect.objectContaining({ type: 'wrong-suit' }));
  });
});
