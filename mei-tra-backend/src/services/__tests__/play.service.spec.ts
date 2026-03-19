import { CardService } from '../card.service';
import { PlayService } from '../play.service';
import { Field, Player } from '../../types/game.types';

describe('PlayService', () => {
  const playService = new PlayService(new CardService());

  const makePlayer = (playerId: string, isCOM = false): Player => ({
    id: playerId,
    playerId,
    name: playerId,
    hand: [],
    team: isCOM ? 1 : 0,
    isPasser: false,
    isCOM,
  });

  it('treats A as stronger than 5 when the suit is the same', () => {
    const players = [
      makePlayer('player-1'),
      makePlayer('player-2'),
      makePlayer('player-3'),
      makePlayer('player-4'),
    ];

    const field: Field = {
      cards: ['5♣', 'A♣', 'K♣', '6♣'],
      baseCard: '5♣',
      dealerId: 'player-1',
      isComplete: true,
    };

    const winner = playService.determineFieldWinner(field, players, null);

    expect(winner?.playerId).toBe('player-2');
  });

  it('keeps COM seats in the play order when attributing cards to players', () => {
    const players = [
      makePlayer('player-1'),
      makePlayer('com-1', true),
      makePlayer('player-2'),
      makePlayer('com-2', true),
    ];

    const field: Field = {
      cards: ['5♣', 'A♣', '6♣', 'K♣'],
      baseCard: '5♣',
      dealerId: 'player-1',
      isComplete: true,
    };

    const winner = playService.determineFieldWinner(field, players, null);

    expect(winner?.playerId).toBe('com-1');
  });
});
